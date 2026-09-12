import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, WebApiResponse } from '@nexus/core';
import { VehicleMaintenanceProduct } from '../../models';
import { VehicleMaintenanceProductService } from './vehicle-maintenance-product.service';

describe('VehicleMaintenanceProductService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): VehicleMaintenanceProductService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(VehicleMaintenanceProductService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getByEntityId hits the expected endpoint', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getByEntityId('vm1', 'VehicleMaintenance');

    expect(apiServiceMock.get).toHaveBeenCalledWith(
      'vehiclemaintenanceproducts/getByVehicleMaintenanceId/vm1',
    );
  });

  it('vehicleMaintenanceProductChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.vehicleMaintenanceProductChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each notify vehicleMaintenanceProductChanged$ after the request completes', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<VehicleMaintenanceProduct>>();
    const updateResponse$ = new Subject<WebApiResponse<VehicleMaintenanceProduct>>();
    const deleteResponse$ = new Subject<WebApiResponse<VehicleMaintenanceProduct>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);

    let emissions = 0;
    service.vehicleMaintenanceProductChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as VehicleMaintenanceProduct).subscribe();
    addResponse$.next({} as WebApiResponse<VehicleMaintenanceProduct>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.update({} as VehicleMaintenanceProduct).subscribe();
    updateResponse$.next({} as WebApiResponse<VehicleMaintenanceProduct>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as VehicleMaintenanceProduct).subscribe();
    deleteResponse$.next({} as WebApiResponse<VehicleMaintenanceProduct>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);
  });
});
