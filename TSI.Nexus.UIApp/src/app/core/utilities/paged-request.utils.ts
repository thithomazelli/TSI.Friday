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
  if (request.startDate) {
    params.set('startDate', request.startDate);
  }
  if (request.endDate) {
    params.set('endDate', request.endDate);
  }
  for (const status of request.statuses ?? []) {
    params.append('statuses', status);
  }
  for (const type of request.types ?? []) {
    params.append('types', type);
  }
  if (request.lowStockOnly) {
    params.set('lowStockOnly', String(request.lowStockOnly));
  }

  return params.toString();
}
