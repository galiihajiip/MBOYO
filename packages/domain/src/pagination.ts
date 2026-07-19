import { z } from "zod";

/**
 * Shared cursor-free, offset-based pagination request shape for list
 * endpoints (reports queue, operational reports, etc.) — offset-based
 * (not cursor) because every list this block exposes is filtered/sorted by
 * a stable, indexed column (created_at) and the expected result set sizes
 * are small enough (per-organization/per-event report volumes) that
 * deep-pagination performance isn't a present concern; cursor pagination
 * can be introduced later without changing this envelope's shape if it
 * ever becomes one.
 */
export const paginationRequestSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationRequest = z.infer<typeof paginationRequestSchema>;

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export function buildPaginatedResult<T>(
  items: T[],
  totalCount: number,
  pagination: PaginationRequest,
): PaginatedResult<T> {
  return {
    items,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pagination.pageSize)),
  };
}
