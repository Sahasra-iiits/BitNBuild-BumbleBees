// ==============================================================================
// SynapseLab — Pagination Utilities
// ==============================================================================

import { PAGINATION } from '../../config/constants';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
}

export interface CursorPaginatedResult<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

/**
 * Parse and validate page-based pagination from query params.
 */
export function parsePagination(query: Record<string, unknown>): PaginationParams {
  let page = Number(query.page) || PAGINATION.DEFAULT_PAGE;
  let limit = Number(query.limit) || PAGINATION.DEFAULT_LIMIT;

  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > PAGINATION.MAX_LIMIT) limit = PAGINATION.MAX_LIMIT;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

/**
 * Build a paginated result envelope.
 */
export function paginatedResult<T>(
  data: T[],
  total: number,
  pagination: PaginationParams
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / pagination.limit);
  return {
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
    },
  };
}

/**
 * Parse cursor-based pagination from query params.
 */
export function parseCursorPagination(query: Record<string, unknown>): CursorPaginationParams {
  let limit = Number(query.limit) || PAGINATION.DEFAULT_LIMIT;
  if (limit < 1) limit = 1;
  if (limit > PAGINATION.MAX_LIMIT) limit = PAGINATION.MAX_LIMIT;

  return {
    cursor: query.cursor as string | undefined,
    limit,
  };
}
