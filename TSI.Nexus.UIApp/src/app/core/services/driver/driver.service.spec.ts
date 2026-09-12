import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, Driver, WebApiResponse } from '@nexus/core';
import { DriverService } from './driver.service';

describe('DriverService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): DriverService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    apiServiceMock.get.mockReturnValue(new Subject());
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(DriverService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('triggers a getAll fetch eagerly on construction', () => {
    createService();

    expect(apiServiceMock.get).toHaveBeenCalledWith('drivers/getAll');
  });

  it('drivers$/getAll() emits the loaded response once the request resolves', () => {
    const load$ = new Subject<WebApiResponse<Driver[]>>();
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    apiServiceMock.get.mockReturnValue(load$);
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    const service = TestBed.inject(DriverService);

    let response: WebApiResponse<Driver[]> | undefined;
    service.getAll().subscribe((v) => (response = v));
    TestBed.flushEffects();
    expect(response).toBeUndefined();

    const loaded = { data: [{ id: 'd1' } as Driver] } as WebApiResponse<Driver[]>;
    load$.next(loaded);
    TestBed.flushEffects();

    expect(response).toBe(loaded);
  });

  it('getAllPaged builds the query string and unwraps response.data', () => {
    const service = createService();
    const paged$ = new Subject<WebApiResponse<unknown>>();
    apiServiceMock.get.mockReturnValue(paged$);

    let result: unknown;
    service.getAllPaged({ page: 1, pageSize: 10 } as never).subscribe((r) => (result = r));
    const pagedResult = { items: [], totalCount: 0 };
    paged$.next({ data: pagedResult } as WebApiResponse<unknown>);

    expect(apiServiceMock.get).toHaveBeenCalledWith(
      expect.stringContaining('drivers/getAllPaged?'),
    );
    expect(result).toBe(pagedResult);
  });

  it('getById hits the expected endpoint', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getById('d1');

    expect(apiServiceMock.get).toHaveBeenCalledWith('drivers/getById/d1');
  });

  it('getActive hits the expected endpoint', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getActive();

    expect(apiServiceMock.get).toHaveBeenCalledWith('drivers/getActive');
  });

  describe('getExpiringLicenses', () => {
    it('omits the query string when daysAhead is not provided', () => {
      const service = createService();
      apiServiceMock.get.mockReturnValue(new Subject());

      service.getExpiringLicenses();

      expect(apiServiceMock.get).toHaveBeenCalledWith('drivers/getExpiringLicenses');
    });

    it('appends daysAhead when provided', () => {
      const service = createService();
      apiServiceMock.get.mockReturnValue(new Subject());

      service.getExpiringLicenses(30);

      expect(apiServiceMock.get).toHaveBeenCalledWith('drivers/getExpiringLicenses?daysAhead=30');
    });
  });

  it('refresh re-fetches directly and also invalidates the shared drivers$ cache', () => {
    const service = createService();
    const refreshResponse$ = new Subject<WebApiResponse<Driver[]>>();
    apiServiceMock.get.mockReturnValue(refreshResponse$);

    let refreshResult: WebApiResponse<Driver[]> | undefined;
    service.refresh().subscribe((v) => (refreshResult = v));

    const getCallsBefore = apiServiceMock.get.mock.calls.length;
    const reload$ = new Subject<WebApiResponse<Driver[]>>();
    apiServiceMock.get.mockReturnValue(reload$);

    const refreshed = { data: [{ id: 'd2' } as Driver] } as WebApiResponse<Driver[]>;
    refreshResponse$.next(refreshed);

    expect(refreshResult).toBe(refreshed);
    expect(apiServiceMock.get.mock.calls.length).toBe(getCallsBefore + 1);
  });

  it('driverChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.driverChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each re-fetch the shared list and notify driverChanged$', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<Driver>>();
    const updateResponse$ = new Subject<WebApiResponse<Driver>>();
    const deleteResponse$ = new Subject<WebApiResponse<Driver>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);
    apiServiceMock.get.mockReturnValue(new Subject());

    let changedEmissions = 0;
    service.driverChanged$.subscribe(() => changedEmissions++);
    TestBed.flushEffects();
    expect(changedEmissions).toBe(1);

    const getCallsBefore = apiServiceMock.get.mock.calls.length;

    service.add({} as Driver).subscribe();
    addResponse$.next({} as WebApiResponse<Driver>);
    TestBed.flushEffects();
    expect(apiServiceMock.get.mock.calls.length).toBe(getCallsBefore + 1);
    expect(changedEmissions).toBe(2);

    service.update({} as Driver).subscribe();
    updateResponse$.next({} as WebApiResponse<Driver>);
    TestBed.flushEffects();
    expect(apiServiceMock.get.mock.calls.length).toBe(getCallsBefore + 2);
    expect(changedEmissions).toBe(3);

    service.delete({} as Driver).subscribe();
    deleteResponse$.next({} as WebApiResponse<Driver>);
    TestBed.flushEffects();
    expect(apiServiceMock.get.mock.calls.length).toBe(getCallsBefore + 3);
    expect(changedEmissions).toBe(4);
  });
});
