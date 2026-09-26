// ==============================================================================
// Automatic participant-quality rules
// ==============================================================================
// Evaluated once, when a session completes. Each triggered rule produces a
// QualitySignal and (if its penalty is non-zero) an auditable rating event.

import { z } from 'zod';
import { getResponseElements, type ExperimentDefinition, type TrialResponsePayload } from '../../shared/experiment';

export const qualityRulesSchema = z.object({
  fastResponses: z.object({
    enabled: z.boolean(),
    /** A response faster than this is "extremely fast". */
    thresholdMs: z.number().int().min(50).max(1000),
    /** Triggered when more than this fraction of response trials are extremely fast. */
    maxFraction: z.number().min(0).max(1),
    penalty: z.number().int().min(0).max(50),
  }),
  identicalResponses: z.object({
    enabled: z.boolean(),
    /** Triggered when this many consecutive response trials have identical answers. */
    runLength: z.number().int().min(3).max(100),
    penalty: z.number().int().min(0).max(50),
  }),
  missedResponses: z.object({
    enabled: z.boolean(),
    /** Triggered when more than this fraction of trials end without their required responses. */
    maxFraction: z.number().min(0).max(1),
    penalty: z.number().int().min(0).max(50),
  }),
});

export type QualityRules = z.infer<typeof qualityRulesSchema>;

export const DEFAULT_QUALITY_RULES: QualityRules = {
  fastResponses: { enabled: true, thresholdMs: 150, maxFraction: 0.25, penalty: 15 },
  identicalResponses: { enabled: true, runLength: 8, penalty: 10 },
  missedResponses: { enabled: true, maxFraction: 0.2, penalty: 10 },
};

/** Stored JSON may be missing or from an older shape; fall back to defaults per rule. */
export function resolveQualityRules(stored: unknown): QualityRules {
  const obj = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<string, unknown>;
  const pick = <K extends keyof QualityRules>(key: K): QualityRules[K] => {
    const parsed = qualityRulesSchema.shape[key].safeParse(obj[key]);
    return (parsed.success ? parsed.data : DEFAULT_QUALITY_RULES[key]) as QualityRules[K];
  };
  return {
    fastResponses: pick('fastResponses'),
    identicalResponses: pick('identicalResponses'),
    missedResponses: pick('missedResponses'),
  };
}

export interface RecordedTrial {
  trialKey: string;
  trialSequence: number;
  reactionTimeMs: number | null;
  timeout: boolean;
  response: TrialResponsePayload | null;
}

export type QualitySignalType = 'EXTREMELY_FAST_RESPONSES' | 'REPEATED_IDENTICAL_RESPONSES' | 'MISSED_REQUIRED_RESPONSES';

export interface QualityFinding {
  signalType: QualitySignalType;
  severity: 'MEDIUM' | 'HIGH';
  penalty: number;
  metadata: Record<string, unknown>;
}

export function evaluateSessionQuality(
  definition: ExperimentDefinition,
  trials: RecordedTrial[],
  rules: QualityRules
): QualityFinding[] {
  const byKey = new Map(definition.trials.map((t) => [t.id, t]));
  const ordered = [...trials].sort((a, b) => a.trialSequence - b.trialSequence);
  const responseTrials = ordered.filter((r) => {
    const def = byKey.get(r.trialKey);
    return def ? getResponseElements(def).length > 0 : false;
  });
  const findings: QualityFinding[] = [];
  if (responseTrials.length === 0) return findings;

  if (rules.fastResponses.enabled) {
    const fast = responseTrials.filter(
      (r) => !r.timeout && r.reactionTimeMs !== null && r.reactionTimeMs < rules.fastResponses.thresholdMs
    ).length;
    const fraction = fast / responseTrials.length;
    if (fast > 0 && fraction > rules.fastResponses.maxFraction) {
      findings.push({
        signalType: 'EXTREMELY_FAST_RESPONSES',
        severity: 'MEDIUM',
        penalty: rules.fastResponses.penalty,
        metadata: { fastCount: fast, responseTrials: responseTrials.length, fraction, thresholdMs: rules.fastResponses.thresholdMs, maxFraction: rules.fastResponses.maxFraction },
      });
    }
  }

  if (rules.identicalResponses.enabled && responseTrials.length >= rules.identicalResponses.runLength) {
    let longest = 0;
    let current = 0;
    let previous: string | null = null;
    let longestValue: string | null = null;
    for (const r of responseTrials) {
      const signature = r.response && r.response.elements.length > 0
        ? r.response.elements.map((e) => `${e.type}:${JSON.stringify(e.value)}`).sort().join('|')
        : null;
      if (signature !== null && signature === previous) current += 1;
      else current = signature === null ? 0 : 1;
      previous = signature;
      if (current > longest) {
        longest = current;
        longestValue = signature;
      }
    }
    if (longest >= rules.identicalResponses.runLength) {
      findings.push({
        signalType: 'REPEATED_IDENTICAL_RESPONSES',
        severity: 'HIGH',
        penalty: rules.identicalResponses.penalty,
        metadata: { longestRun: longest, runLength: rules.identicalResponses.runLength, value: longestValue },
      });
    }
  }

  if (rules.missedResponses.enabled) {
    const missed = responseTrials.filter((r) => {
      const def = byKey.get(r.trialKey);
      if (!def) return false;
      const answered = new Set((r.response?.elements ?? []).map((e) => e.elementId));
      return getResponseElements(def).some((el) => el.required && !answered.has(el.id));
    }).length;
    const fraction = missed / responseTrials.length;
    if (missed > 0 && fraction > rules.missedResponses.maxFraction) {
      findings.push({
        signalType: 'MISSED_REQUIRED_RESPONSES',
        severity: 'MEDIUM',
        penalty: rules.missedResponses.penalty,
        metadata: { missedCount: missed, responseTrials: responseTrials.length, fraction, maxFraction: rules.missedResponses.maxFraction },
      });
    }
  }

  return findings;
}
