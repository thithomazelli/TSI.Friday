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
}
