import { toPagedQueryString } from './paged-request.utils';
import { PagedRequest } from '../models/paged-request.model';

function baseRequest(overrides: Partial<PagedRequest> = {}): PagedRequest {
  return { page: 1, pageSize: 20, ...overrides };
}

describe('toPagedQueryString', () => {
  it('serializes required page/pageSize only when nothing else is set', () => {
    const qs = toPagedQueryString(baseRequest());
    const params = new URLSearchParams(qs);

    expect(params.get('page')).toBe('1');
    expect(params.get('pageSize')).toBe('20');
    expect(params.has('sortField')).toBe(false);
    expect(params.has('quickFilter')).toBe(false);
  });

  it('includes sortField and sortDescending when provided', () => {
    const qs = toPagedQueryString(
      baseRequest({ sortField: 'name', sortDescending: true }),
    );
    const params = new URLSearchParams(qs);

    expect(params.get('sortField')).toBe('name');
    expect(params.get('sortDescending')).toBe('true');
  });

  it('omits sortDescending when false', () => {
    const qs = toPagedQueryString(baseRequest({ sortDescending: false }));
    expect(new URLSearchParams(qs).has('sortDescending')).toBe(false);
  });

  it('includes quickFilter, startDate and endDate when provided', () => {
    const qs = toPagedQueryString(
      baseRequest({ quickFilter: 'abc', startDate: '2024-01-01', endDate: '2024-01-31' }),
    );
    const params = new URLSearchParams(qs);

    expect(params.get('quickFilter')).toBe('abc');
    expect(params.get('startDate')).toBe('2024-01-01');
    expect(params.get('endDate')).toBe('2024-01-31');
  });

  it('appends every status and type as repeated params', () => {
    const qs = toPagedQueryString(
      baseRequest({ statuses: ['Open', 'Closed'], types: ['A', 'B'] }),
    );
    const params = new URLSearchParams(qs);

    expect(params.getAll('statuses')).toEqual(['Open', 'Closed']);
    expect(params.getAll('types')).toEqual(['A', 'B']);
  });

  it('omits statuses/types params entirely when arrays are empty or absent', () => {
    const qs = toPagedQueryString(baseRequest({ statuses: [], types: [] }));
    const params = new URLSearchParams(qs);

    expect(params.has('statuses')).toBe(false);
    expect(params.has('types')).toBe(false);
  });

  it('includes lowStockOnly when true and omits it when false', () => {
    expect(new URLSearchParams(toPagedQueryString(baseRequest({ lowStockOnly: true }))).get('lowStockOnly')).toBe(
      'true',
    );
    expect(
      new URLSearchParams(toPagedQueryString(baseRequest({ lowStockOnly: false }))).has('lowStockOnly'),
    ).toBe(false);
  });
});
