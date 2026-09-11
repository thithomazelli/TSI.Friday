/**
 * Response shape for a server-side paged listing (ag-Grid Infinite Row Model), mirroring the
 * backend's PagedResult<T>.
 */
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}
