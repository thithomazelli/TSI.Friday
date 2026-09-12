import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, VehicleMaintenance, WebApiResponse } from '@nexus/core';
import { VehicleMaintenanceService } from './vehicle-maintenance.service';

describe('VehicleMaintenanceService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): VehicleMaintenanceService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(VehicleMaintenanceService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getAll/getById/getByVehicle hit the expected endpoints', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getAll();
    expect(apiServiceMock.get).toHaveBeenCalledWith('vehiclemaintenances/getAll');

    service.getById('vm1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('vehiclemaintenances/getById/vm1');

    service.getByVehicle('v1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('vehiclemaintenances/getByVehicle/v1');
  });

  it('getAllPaged builds the query string and unwraps response.data', () => {
    const service = createService();
    const paged$ = new Subject<WebApiResponse<{ items: VehicleMaintenance[] }>>();
    apiServiceMock.get.mockReturnValue(paged$);

    let result: unknown;
    service.getAllPaged({ page: 2, pageSize: 10 }).subscribe((v) => (result = v));
    paged$.next({ data: { items: [] } } as unknown as WebApiResponse<{ items: VehicleMaintenance[] }>);

    expect(apiServiceMock.get).toHaveBeenCalledWith('vehiclemaintenances/getAllPaged?page=2&pageSize=10');
    expect(result).toEqual({ items: [] });
  });

  it('maintenanceChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.maintenanceChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each notify maintenanceChanged$ after the request completes', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<VehicleMaintenance>>();
    const updateResponse$ = new Subject<WebApiResponse<VehicleMaintenance>>();
    const deleteResponse$ = new Subject<WebApiResponse<VehicleMaintenance>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);

    let emissions = 0;
    service.maintenanceChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as VehicleMaintenance).subscribe();
    addResponse$.next({} as WebApiResponse<VehicleMaintenance>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.update({} as VehicleMaintenance).subscribe();
    updateResponse$.next({} as WebApiResponse<VehicleMaintenance>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as VehicleMaintenance).subscribe();
    deleteResponse$.next({} as WebApiResponse<VehicleMaintenance>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);
  });
});
