// ==============================================================================
// SynapseLab — Exports Service
// ==============================================================================
// Export jobs run in the BullMQ worker when it is running in this process
// (the API server), otherwise inline (tests, scripts).

import path from 'path';
import fs from 'fs/promises';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { NotFoundError, ForbiddenError, ExperimentStateError } from '../../common/errors/app-error';
import { logger } from '../../common/utils/logger';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../../config/constants';
import { buildExportRows, EXPORT_CODEBOOK, EXPORT_COLUMNS, loadExportData, toCsv, toJsonDocument, type ExportFilters } from './export-rows';
import { datasetToCsv, datasetToJson, formatTimestamp, loadDataset } from './dataset';

type Format = 'CSV' | 'XLSX' | 'JSON';

const exportRoot = () => path.resolve(env.EXPORT_DIR);

type EnqueueFn = (payload: { exportId: string; actorId: string }) => Promise<void>;
let enqueue: EnqueueFn | null = null;

/** Called by the export worker when it starts, so jobs go to the queue. */
export function setExportEnqueuer(fn: EnqueueFn | null) {
  enqueue = fn;
}

function viewOf(job: { id: string; status: string; filePath: string | null } & Record<string, unknown>) {
  const { filePath: _internalPath, ...rest } = job;
  return { ...rest, downloadable: job.status === 'READY' && !!job.filePath };
}

export class ExportService {
  static async createExport(
    researcherId: string,
    data: { experimentId: string; format: Format; filters?: ExportFilters; idempotencyKey?: string },
    actorId: string
  ) {
    const experiment = await prisma.experiment.findUnique({ where: { id: data.experimentId } });
    if (!experiment) throw new NotFoundError('Experiment not found');
    if (experiment.researcherId !== researcherId) throw new ForbiddenError('You do not own this experiment');

    if (data.filters?.versionId) {
      const version = await prisma.experimentVersion.findUnique({ where: { id: data.filters.versionId }, select: { experimentId: true } });
      if (!version || version.experimentId !== data.experimentId) throw new NotFoundError('Version not found for this experiment');
    }

    const scopedKey = data.idempotencyKey ? `${researcherId}:${data.idempotencyKey}` : null;
    if (scopedKey) {
      const existing = await prisma.exportJob.findUnique({ where: { idempotencyKey: scopedKey } });
      if (existing) return viewOf(existing);
    }

    const job = await prisma.exportJob.create({
      data: {
        researcherId,
        experimentId: data.experimentId,
        format: data.format,
        status: 'QUEUED',
        filters: (data.filters ?? {}) as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + env.EXPORT_EXPIRY_HOURS * 60 * 60 * 1000),
        idempotencyKey: scopedKey,
      },
    });

    await AuditService.record({
      actorId,
      actorRole: 'RESEARCHER',
      action: AUDIT_ACTIONS.EXPORT_REQUESTED,
      resourceType: 'ExportJob',
      resourceId: job.id,
      metadata: { format: data.format, experimentId: data.experimentId, filters: data.filters ?? {} },
    });

    if (enqueue) {
      await enqueue({ exportId: job.id, actorId });
      return viewOf(job);
    }
    await this.executeJob(job.id, actorId);
    const done = await prisma.exportJob.findUniqueOrThrow({ where: { id: job.id } });
    return viewOf(done);
  }

  private static async ownedJob(jobId: string, researcherId: string) {
    const job = await prisma.exportJob.findUnique({ where: { id: jobId } });
    if (!job || job.researcherId !== researcherId) throw new NotFoundError('Export job not found');
    if (job.status === 'READY' && job.expiresAt && new Date() > job.expiresAt) {
      if (job.filePath) await fs.rm(job.filePath, { force: true });
      return prisma.exportJob.update({ where: { id: jobId }, data: { status: 'EXPIRED', filePath: null } });
    }
    return job;
  }

  static async getExport(jobId: string, researcherId: string) {
    return viewOf(await this.ownedJob(jobId, researcherId));
  }

  static async listExports(researcherId: string, experimentId: string) {
    const jobs = await prisma.exportJob.findMany({
      where: { researcherId, experimentId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return jobs.map(viewOf);
  }

  static async getDownload(jobId: string, researcherId: string) {
    const job = await this.ownedJob(jobId, researcherId);
    if (job.status !== 'READY' || !job.filePath || !job.fileName) {
      throw new ExperimentStateError(`Export is ${job.status.toLowerCase()} and cannot be downloaded.`);
    }
    const resolved = path.resolve(job.filePath);
    if (!resolved.startsWith(exportRoot() + path.sep)) throw new NotFoundError('Export file not found');
    try {
      await fs.access(resolved);
    } catch {
      throw new NotFoundError('Export file is no longer available');
    }
    const contentType = job.format === 'CSV' ? 'text/csv; charset=utf-8' : job.format === 'JSON' ? 'application/json' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return { path: resolved, fileName: job.fileName, contentType };
  }

  /** Generates the export file. Failures are recorded on the job, never swallowed. */
  static async executeJob(jobId: string, actorId: string) {
    const job = await prisma.exportJob.findUnique({ where: { id: jobId }, include: { experiment: { select: { title: true } } } });
    if (!job) {
      logger.warn({ jobId }, 'Export job disappeared before processing');
      return;
    }

    await prisma.exportJob.update({ where: { id: jobId }, data: { status: 'PROCESSING' } });

    try {
      const filters = (job.filters ?? {}) as ExportFilters;
      await fs.mkdir(exportRoot(), { recursive: true });

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const extension = job.format === 'XLSX' ? 'xlsx' : job.format.toLowerCase();
      const isDataset = filters.layout === 'dataset';
      const fileName = `${isDataset ? 'dataset' : 'experiment'}_${job.experimentId.slice(0, 8)}_${stamp}.${extension}`;
      const filePath = path.join(exportRoot(), `${job.id}.${extension}`);
      let rowCount = 0;

      if (isDataset) {
        const dataset = await loadDataset(job.experimentId, filters);
        rowCount = dataset.rows.length;
        if (job.format === 'JSON') {
          await fs.writeFile(filePath, JSON.stringify(datasetToJson(job.experimentId, dataset), null, 2), 'utf-8');
        } else if (job.format === 'CSV') {
          await fs.writeFile(filePath, '\uFEFF' + datasetToCsv(dataset), 'utf-8');
        } else {
          const ExcelJS = (await import('exceljs')).default;
          const workbook = new ExcelJS.Workbook();
          const sheet = workbook.addWorksheet('Form responses');
          sheet.columns = dataset.columns.map((c) => ({ header: c.header, key: c.key, width: Math.min(60, Math.max(14, c.header.length + 2)) }));
          for (const row of dataset.rows) sheet.addRow(row);
          sheet.getColumn('timestamp').numFmt = 'yyyy-mm-dd hh:mm:ss';
          sheet.getRow(1).font = { bold: true };
          sheet.getRow(1).alignment = { wrapText: true, vertical: 'top' };
          sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 2 }];
          sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: dataset.columns.length } };
          const about = workbook.addWorksheet('About this file');
          about.columns = [
            { header: 'item', key: 'item', width: 28 },
            { header: 'value', key: 'value', width: 90 },
          ];
          about.addRows([
            { item: 'Experiment', value: job.experiment.title },
            { item: 'Experiment id', value: job.experimentId },
            { item: 'Generated at (UTC)', value: formatTimestamp(new Date()) },
            { item: 'Source', value: 'Database table form_submissions. Each row is written by the server when a participant completes the experiment.' },
            { item: 'Rows', value: String(dataset.rows.length) },
            { item: 'participant_type', value: 'guest = took part without an account; registered = signed-in participant.' },
            { item: 'Excluded sessions', value: filters.includeExcluded ? 'included' : 'not included' },
          ]);
          about.getRow(1).font = { bold: true };
          await workbook.xlsx.writeFile(filePath);
        }
      } else if (job.format === 'JSON') {
        const data = await loadExportData(job.experimentId, filters);
        const doc = toJsonDocument(job.experimentId, filters, data);
        rowCount = data.length;
        await fs.writeFile(filePath, JSON.stringify(doc, null, 2), 'utf-8');
      } else {
        const data = await loadExportData(job.experimentId, filters);
        const rows = buildExportRows(job.experimentId, data);
        rowCount = rows.length;
        if (job.format === 'CSV') {
          // BOM so Excel detects UTF-8 (participant text may contain any script).
          await fs.writeFile(filePath, '﻿' + toCsv(rows), 'utf-8');
        } else {
          const ExcelJS = (await import('exceljs')).default;
          const workbook = new ExcelJS.Workbook();
          const sheet = workbook.addWorksheet('responses');
          sheet.columns = EXPORT_COLUMNS.map((key) => ({ header: key, key, width: Math.max(12, key.length + 2) }));
          for (const row of rows) sheet.addRow(row);
          sheet.getRow(1).font = { bold: true };
          sheet.views = [{ state: 'frozen', ySplit: 1 }];
          const codebook = workbook.addWorksheet('codebook');
          codebook.columns = [
            { header: 'column', key: 'column', width: 26 },
            { header: 'description', key: 'description', width: 110 },
          ];
          for (const key of EXPORT_COLUMNS) codebook.addRow({ column: key, description: EXPORT_CODEBOOK[key] });
          codebook.getRow(1).font = { bold: true };
          await workbook.xlsx.writeFile(filePath);
        }
      }

      await prisma.exportJob.update({
        where: { id: jobId },
        data: { status: 'READY', filePath, fileName, completedAt: new Date(), errorMessage: null },
      });
      await AuditService.record({
        actorId,
        actorRole: 'RESEARCHER',
        action: AUDIT_ACTIONS.EXPORT_COMPLETED,
        resourceType: 'ExportJob',
        resourceId: jobId,
        metadata: { fileName, rows: rowCount },
      });
    } catch (error) {
      logger.error({ err: error, jobId }, 'Export job failed');
      await prisma.exportJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error' },
      });
      await AuditService.record({ actorId, action: AUDIT_ACTIONS.EXPORT_FAILED, resourceType: 'ExportJob', resourceId: jobId });
    }
  }
}
