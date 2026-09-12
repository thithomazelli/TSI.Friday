import { Subject, of } from 'rxjs';
import {
  Commission,
  CommissionStatus,
  Driver,
  DriverStatus,
  ServiceOrder,
  Trip,
  Vehicle,
  VehicleMaintenance,
  VehicleStatus,
  WebApiResponse,
} from '@nexus/core';
import { FleetReportComponent } from './fleet-report.component';

describe('FleetReportComponent', () => {
  let driverServiceMock: { getAll: ReturnType<typeof vi.fn> };
  let tripServiceMock: { getAll: ReturnType<typeof vi.fn> };
  let serviceOrderServiceMock: { getByDriver: ReturnType<typeof vi.fn> };
  let vehicleMaintenanceServiceMock: { getAll: ReturnType<typeof vi.fn> };
  let vehicleServiceMock: { getAll: ReturnType<typeof vi.fn> };

  let vehicles$: Subject<WebApiResponse<Vehicle[]>>;
  let drivers$: Subject<WebApiResponse<Driver[]>>;

  function createComponent(): FleetReportComponent {
    vehicles$ = new Subject();
    drivers$ = new Subject();

    driverServiceMock = { getAll: vi.fn().mockReturnValue(drivers$) };
    tripServiceMock = { getAll: vi.fn().mockReturnValue(of({ data: [] } as unknown as WebApiResponse<Trip[]>)) };
    serviceOrderServiceMock = { getByDriver: vi.fn().mockReturnValue(of({ data: [] })) };
    vehicleMaintenanceServiceMock = {
      getAll: vi.fn().mockReturnValue(of({ data: [] } as unknown as WebApiResponse<VehicleMaintenance[]>)),
    };
    vehicleServiceMock = { getAll: vi.fn().mockReturnValue(vehicles$) };

    return new FleetReportComponent(
      driverServiceMock as never,
      tripServiceMock as never,
      serviceOrderServiceMock as never,
      vehicleMaintenanceServiceMock as never,
      vehicleServiceMock as never,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('loads the summary from vehicles$/drivers$ streams that never complete', () => {
    const component = createComponent();
    component.ngOnInit();

    expect(component.loading).toBe(true);

    const vehicle = { id: 'v1', plate: 'ABC1234', brand: 'Ford', model: 'Ka', status: VehicleStatus.Available } as Vehicle;
    const driver = { id: 'd1', name: 'João', status: DriverStatus.Active } as Driver;

    vehicles$.next({ data: [vehicle] } as unknown as WebApiResponse<Vehicle[]>);
    drivers$.next({ data: [driver] } as unknown as WebApiResponse<Driver[]>);

    expect(component.loading).toBe(false);
    expect(component.totalVehicles).toBe(1);
    expect(component.totalDrivers).toBe(1);
    expect(component.vehicleRows).toEqual([
      { plate: 'ABC1234', brandModel: 'Ford Ka', status: VehicleStatus.Available, tripCount: 0, revenue: 0, maintenanceCost: 0 },
    ]);
    expect(serviceOrderServiceMock.getByDriver).toHaveBeenCalledWith('d1');
  });

  it('does not react to a second emission on vehicles$/drivers$ (take(1) unsubscribes after the first combination)', () => {
    const component = createComponent();
    component.ngOnInit();

    vehicles$.next({ data: [{ id: 'v1' } as Vehicle] } as unknown as WebApiResponse<Vehicle[]>);
    drivers$.next({ data: [] } as unknown as WebApiResponse<Driver[]>);
    expect(component.totalVehicles).toBe(1);

    vehicles$.next({
      data: [{ id: 'v1' } as Vehicle, { id: 'v2' } as Vehicle],
    } as unknown as WebApiResponse<Vehicle[]>);

    expect(component.totalVehicles).toBe(1);
  });

  it('aggregates driver commissions by status (pending/paid) from serviceOrderService.getByDriver', () => {
    const component = createComponent();
    const driver = { id: 'd1', name: 'João', status: DriverStatus.Active } as Driver;
    const pendingCommission = { amount: 100, status: CommissionStatus.Pending } as Commission;
    const paidCommission = { amount: 50, status: CommissionStatus.Paid } as Commission;
    serviceOrderServiceMock.getByDriver.mockReturnValue(
      of({
        data: [
          { commission: pendingCommission, issueDate: new Date() } as unknown as ServiceOrder,
          { commission: paidCommission, issueDate: new Date() } as unknown as ServiceOrder,
          { commission: null, issueDate: new Date() } as unknown as ServiceOrder,
        ],
      }),
    );

    component.ngOnInit();
    vehicles$.next({ data: [] } as unknown as WebApiResponse<Vehicle[]>);
    drivers$.next({ data: [driver] } as unknown as WebApiResponse<Driver[]>);

    expect(component.driverRows).toEqual([
      { name: 'João', status: DriverStatus.Active, tripCount: 2, commissionPending: 100, commissionPaid: 50 },
    ]);
    expect(component.totalCommissionPending).toBe(100);
    expect(component.totalCommissionPaid).toBe(50);
  });

  it('skips serviceOrderService.getByDriver entirely when there are no drivers', () => {
    const component = createComponent();
    component.ngOnInit();

    vehicles$.next({ data: [] } as unknown as WebApiResponse<Vehicle[]>);
    drivers$.next({ data: [] } as unknown as WebApiResponse<Driver[]>);

    expect(serviceOrderServiceMock.getByDriver).not.toHaveBeenCalled();
    expect(component.driverRows).toEqual([]);
  });

  describe('date range filtering', () => {
    it('applyFilters narrows trips/maintenances/commissions to the selected range', () => {
      const component = createComponent();
      tripServiceMock.getAll.mockReturnValue(
        of({
          data: [
            { vehicleId: 'v1', date: new Date('2024-01-10'), totalPrice: 100 },
            { vehicleId: 'v1', date: new Date('2024-06-10'), totalPrice: 200 },
          ],
        } as unknown as WebApiResponse<Trip[]>),
      );

      component.ngOnInit();
      vehicles$.next({
        data: [{ id: 'v1', plate: 'ABC1234', brand: 'Ford', model: 'Ka', status: VehicleStatus.Available } as Vehicle],
      } as unknown as WebApiResponse<Vehicle[]>);
      drivers$.next({ data: [] } as unknown as WebApiResponse<Driver[]>);

      expect(component.totalRevenue).toBe(300);

      component.filterStartDate = '2024-01-01';
      component.filterEndDate = '2024-01-31';
      component.applyFilters();

      expect(component.totalRevenue).toBe(100);

      component.clearFilters();

      expect(component.filterStartDate).toBeNull();
      expect(component.filterEndDate).toBeNull();
      expect(component.totalRevenue).toBe(300);
    });
  });

  it('toggleFilters flips showFilters', () => {
    const component = createComponent();

    expect(component.showFilters).toBe(false);
    component.toggleFilters();
    expect(component.showFilters).toBe(true);
    component.toggleFilters();
    expect(component.showFilters).toBe(false);
  });
});
