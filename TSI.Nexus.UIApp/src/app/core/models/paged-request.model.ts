/**
 * Request shape for a server-side paged listing (ag-Grid Infinite Row Model), mirroring the
 * backend's PagedRequest.
 */
export interface PagedRequest {
  page: number;
  pageSize: number;
  sortField?: string;
  sortDescending?: boolean;
  quickFilter?: string;
  startDate?: string;
  endDate?: string;
  statuses?: string[];
  types?: string[];
  /** Products-only: mirrors the navbar low-stock alert's "ver todos" link. */
  lowStockOnly?: boolean;
}
