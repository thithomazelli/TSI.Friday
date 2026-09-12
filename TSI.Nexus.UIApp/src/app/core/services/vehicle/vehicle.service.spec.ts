import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, Vehicle, WebApiResponse } from '@nexus/core';
import { VehicleService } from './vehicle.service';

describe('VehicleService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): VehicleService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    apiServiceMock.get.mockReturnValue(new Subject());
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(VehicleService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('triggers a getAll fetch eagerly on construction', () => {
    createService();

    expect(apiServiceMock.get).toHaveBeenCalledWith('vehicles/getAll');
  });

  it('vehicles$/getAll() emits the loaded response once the request resolves', () => {
    const load$ = new Subject<WebApiResponse<Vehicle[]>>();
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    apiServiceMock.get.mockReturnValue(load$);
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    const service = TestBed.inject(VehicleService);

    let response: WebApiResponse<Vehicle[]> | undefined;
    service.getAll().subscribe((v) => (response = v));
    TestBed.flushEffects();
    expect(response).toBeUndefined();

    const loaded = { data: [{ id: 'v1' } as Vehicle] } as WebApiResponse<Vehicle[]>;
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
      expect.stringContaining('vehicles/getAllPaged?'),
    );
    expect(result).toBe(pagedResult);
  });

  it('getById hits the expected endpoint', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getById('v1');

    expect(apiServiceMock.get).toHaveBeenCalledWith('vehicles/getById/v1');
  });

  it('getAvailable hits the expected endpoint', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getAvailable();

    expect(apiServiceMock.get).toHaveBeenCalledWith('vehicles/getAvailable');
  });

  it('refresh re-fetches directly and also invalidates the shared vehicles$ cache', () => {
    const service = createService();
    const refreshResponse$ = new Subject<WebApiResponse<Vehicle[]>>();
    apiServiceMock.get.mockReturnValue(refreshResponse$);

    let refreshResult: WebApiResponse<Vehicle[]> | undefined;
    service.refresh().subscribe((v) => (refreshResult = v));

    const getCallsBefore = apiServiceMock.get.mock.calls.length;
    apiServiceMock.get.mockReturnValue(new Subject());

    const refreshed = { data: [{ id: 'v2' } as Vehicle] } as WebApiResponse<Vehicle[]>;
    refreshResponse$.next(refreshed);

    expect(refreshResult).toBe(refreshed);
    expect(apiServiceMock.get.mock.calls.length).toBe(getCallsBefore + 1);
  });

  it('vehicleChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.vehicleChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each re-fetch the shared list and notify vehicleChanged$', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<Vehicle>>();
    const updateResponse$ = new Subject<WebApiResponse<Vehicle>>();
    const deleteResponse$ = new Subject<WebApiResponse<Vehicle>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);
    apiServiceMock.get.mockReturnValue(new Subject());

    let changedEmissions = 0;
    service.vehicleChanged$.subscribe(() => changedEmissions++);
    TestBed.flushEffects();
    expect(changedEmissions).toBe(1);

    const getCallsBefore = apiServiceMock.get.mock.calls.length;

    service.add({} as Vehicle).subscribe();
    addResponse$.next({} as WebApiResponse<Vehicle>);
    TestBed.flushEffects();
    expect(apiServiceMock.get.mock.calls.length).toBe(getCallsBefore + 1);
    expect(changedEmissions).toBe(2);

    service.update({} as Vehicle).subscribe();
    updateResponse$.next({} as WebApiResponse<Vehicle>);
    TestBed.flushEffects();
    expect(apiServiceMock.get.mock.calls.length).toBe(getCallsBefore + 2);
    expect(changedEmissions).toBe(3);

    service.delete({} as Vehicle).subscribe();
    deleteResponse$.next({} as WebApiResponse<Vehicle>);
    TestBed.flushEffects();
    expect(apiServiceMock.get.mock.calls.length).toBe(getCallsBefore + 3);
    expect(changedEmissions).toBe(4);
  });
});
