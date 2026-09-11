import { PagedRequest } from '../models/paged-request.model';

/**
 * Serializes a PagedRequest into a query string for a "GetAllPaged" endpoint - shared by every
 * paginated list service instead of each one rebuilding the same param list.
 */
export function toPagedQueryString(request: PagedRequest): string {
  const params = new URLSearchParams();
  params.set('page', String(request.page));
  params.set('pageSize', String(request.pageSize));

  if (request.sortField) {
    params.set('sortField', request.sortField);
  }
  if (request.sortDescending) {
    params.set('sortDescending', String(request.sortDescending));
  }
  if (request.quickFilter) {
    params.set('quickFilter', request.quickFilter);
  }

  return params.toString();
}
