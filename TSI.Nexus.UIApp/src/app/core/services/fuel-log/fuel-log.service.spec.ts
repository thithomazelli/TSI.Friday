import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, FuelLog, WebApiResponse } from '@nexus/core';
import { FuelLogService } from './fuel-log.service';

describe('FuelLogService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): FuelLogService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(FuelLogService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getAll and getByVehicle hit the expected endpoints', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getAll();
    expect(apiServiceMock.get).toHaveBeenCalledWith('fuellogs/getAll');

    service.getByVehicle('v1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('fuellogs/getByVehicle/v1');
  });

  it('getAllPaged builds the query string and unwraps response.data', () => {
    const service = createService();
    const paged$ = new Subject<WebApiResponse<{ items: FuelLog[] }>>();
    apiServiceMock.get.mockReturnValue(paged$);

    let result: unknown;
    service.getAllPaged({ page: 1, pageSize: 20 }).subscribe((v) => (result = v));
    paged$.next({ data: { items: [] } } as unknown as WebApiResponse<{ items: FuelLog[] }>);

    expect(apiServiceMock.get).toHaveBeenCalledWith('fuellogs/getAllPaged?page=1&pageSize=20');
    expect(result).toEqual({ items: [] });
  });

  it('fuelLogChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.fuelLogChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each notify fuelLogChanged$ after the request completes', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<FuelLog>>();
    const updateResponse$ = new Subject<WebApiResponse<FuelLog>>();
    const deleteResponse$ = new Subject<WebApiResponse<FuelLog>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);

    let emissions = 0;
    service.fuelLogChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as FuelLog).subscribe();
    addResponse$.next({} as WebApiResponse<FuelLog>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.update({} as FuelLog).subscribe();
    updateResponse$.next({} as WebApiResponse<FuelLog>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as FuelLog).subscribe();
    deleteResponse$.next({} as WebApiResponse<FuelLog>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);
  });
});
