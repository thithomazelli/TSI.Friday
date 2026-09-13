import {
  ModalService,
  NotificationService,
  ResponseStatus,
  TranslationService,
  VehicleMaintenance,
  VehicleMaintenanceService,
} from '@nexus/core';
import { GridApi } from 'ag-grid-community';
import { Subject, of } from 'rxjs';
import { GridComponent } from '../../../shared/grid/grid.component';
import { VehicleMaintenanceListComponent } from './vehicle-maintenance-list.component';

describe('VehicleMaintenanceListComponent', () => {
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let modalServiceMock: { showTemplateModal: ReturnType<typeof vi.fn>; hideModal: ReturnType<typeof vi.fn>; showSweetNotification: ReturnType<typeof vi.fn> };
  let maintenanceChanged$: Subject<void>;
  let vehicleMaintenanceServiceMock: {
    getAllPaged: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
    getByVehicle: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    maintenanceChanged$: Subject<void>;
  };
  let language$: Subject<string>;
  let translationServiceMock: { instant: ReturnType<typeof vi.fn>; language$: Subject<string> };

  function mockGridRef(): GridComponent<VehicleMaintenance> {
    return {
      gridApi: { purgeInfiniteCache: vi.fn() } as unknown as GridApi,
    } as unknown as GridComponent<VehicleMaintenance>;
  }

  function createComponent(): VehicleMaintenanceListComponent {
    notificationServiceMock = { showMessage: vi.fn() };
    modalServiceMock = { showTemplateModal: vi.fn(), hideModal: vi.fn(), showSweetNotification: vi.fn() };
    maintenanceChanged$ = new Subject();
    vehicleMaintenanceServiceMock = {
      getAllPaged: vi.fn(),
      getAll: vi.fn().mockReturnValue(of({ data: [] })),
      getByVehicle: vi.fn().mockReturnValue(of({ data: [] })),
      delete: vi.fn(),
      maintenanceChanged$,
    };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };

    return new VehicleMaintenanceListComponent(
      notificationServiceMock as unknown as NotificationService,
      vehicleMaintenanceServiceMock as unknown as VehicleMaintenanceService,
      modalServiceMock as unknown as ModalService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('isTopLevelList', () => {
    it('is true when there is no vehicleId', () => {
      const component = createComponent();
      expect(component.isTopLevelList).toBe(true);
    });

    it('is false when a vehicleId is provided', () => {
      const component = createComponent();
      component.vehicleId = 'v1';
      expect(component.isTopLevelList).toBe(false);
    });
  });

  describe('statusMap', () => {
    it('exposes all statuses with their translated labels and colors', () => {
      const component = createComponent();
      expect(component.statusMap['Scheduled']).toEqual({ label: 'VEHICLES.MAINTENANCE_SCHEDULED', color: 'info' });
      expect(component.statusMap['InProgress']).toEqual({ label: 'VEHICLES.MAINTENANCE_IN_PROGRESS', color: 'warning' });
      expect(component.statusMap['Completed']).toEqual({ label: 'VEHICLES.MAINTENANCE_COMPLETED', color: 'success' });
      expect(component.statusMap['Overdue']).toEqual({ label: 'VEHICLES.MAINTENANCE_OVERDUE', color: 'danger' });
      expect(component.statusMap['Cancelled']).toEqual({ label: 'VEHICLES.MAINTENANCE_CANCELLED', color: 'secondary' });
    });
  });

  describe('pagedDataSource', () => {
    it('delegates to vehicleMaintenanceService.getAllPaged', () => {
      const component = createComponent();
      const request = { page: 1 } as any;
      vehicleMaintenanceServiceMock.getAllPaged.mockReturnValue(of({ data: [], total: 0 }));

      component.pagedDataSource(request);

      expect(vehicleMaintenanceServiceMock.getAllPaged).toHaveBeenCalledWith(request);
    });
  });

  describe('ngOnInit', () => {
    it('builds the column defs and does not load eagerly for the top-level list', () => {
      const component = createComponent();

      component.ngOnInit();

      expect(component.columnDefs.length).toBeGreaterThan(0);
      expect(vehicleMaintenanceServiceMock.getAll).not.toHaveBeenCalled();
      expect(vehicleMaintenanceServiceMock.getByVehicle).not.toHaveBeenCalled();
    });

    it('loads eagerly when embedded for a specific vehicle', () => {
      const component = createComponent();
      component.vehicleId = 'v1';

      component.ngOnInit();

      expect(vehicleMaintenanceServiceMock.getByVehicle).toHaveBeenCalledWith('v1');
    });

    it('rebuilds the column defs on language change', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.columnDefs;

      language$.next('en');

      expect(component.columnDefs).not.toBe(before);
    });

    it('purges the grid cache on maintenanceChanged$ for the top-level list', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();

      maintenanceChanged$.next();

      expect(gridRef.gridApi!.purgeInfiniteCache).toHaveBeenCalled();
    });

    it('does not throw when maintenanceChanged$ fires without a gridRef', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() => maintenanceChanged$.next()).not.toThrow();
    });

    it('reloads when embedded and maintenanceChanged$ fires', () => {
      const component = createComponent();
      component.vehicleId = 'v1';
      component.ngOnInit();
      vehicleMaintenanceServiceMock.getByVehicle.mockClear();

      maintenanceChanged$.next();

      expect(vehicleMaintenanceServiceMock.getByVehicle).toHaveBeenCalledWith('v1');
    });
  });

  describe('ngOnChanges', () => {
    it('reloads when vehicleId changes after the first change', () => {
      const component = createComponent();
      component.vehicleId = 'v2';

      component.ngOnChanges({ vehicleId: { firstChange: false } as any });

      expect(vehicleMaintenanceServiceMock.getByVehicle).toHaveBeenCalledWith('v2');
    });

    it('does not reload on the first change', () => {
      const component = createComponent();
      component.vehicleId = 'v2';

      component.ngOnChanges({ vehicleId: { firstChange: true } as any });

      expect(vehicleMaintenanceServiceMock.getByVehicle).not.toHaveBeenCalled();
    });

    it('loads via getAll when vehicleId changes back to undefined', () => {
      const component = createComponent();
      component.vehicleId = undefined;

      component.ngOnChanges({ vehicleId: { firstChange: false } as any });

      expect(vehicleMaintenanceServiceMock.getAll).toHaveBeenCalled();
      expect(vehicleMaintenanceServiceMock.getByVehicle).not.toHaveBeenCalled();
    });

    it('does nothing when vehicleId is not part of the change set', () => {
      const component = createComponent();

      expect(() => component.ngOnChanges({})).not.toThrow();
      expect(vehicleMaintenanceServiceMock.getByVehicle).not.toHaveBeenCalled();
      expect(vehicleMaintenanceServiceMock.getAll).not.toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('stops reacting to language changes and maintenanceChanged$', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();

      component.ngOnDestroy();
      const before = component.columnDefs;
      language$.next('en');
      maintenanceChanged$.next();

      expect(component.columnDefs).toBe(before);
      expect(gridRef.gridApi!.purgeInfiniteCache).not.toHaveBeenCalled();
    });
  });

  describe('openModal', () => {
    it('uses the initialState data vehicleId when present', () => {
      const component = createComponent();
      component.vehicleId = 'v1';

      component.openModal({ data: { id: 'm1', vehicleId: 'other-vehicle' } });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ vehicleId: 'other-vehicle' }),
      );
    });

    it('falls back to the component vehicleId when initialState has none', () => {
      const component = createComponent();
      component.vehicleId = 'v1';

      component.openModal({});

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ vehicleId: 'v1' }),
      );
    });
  });

  describe('deleteMaintenance', () => {
    it('purges the grid cache on success for the top-level list', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      vehicleMaintenanceServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteMaintenance({ id: 'm1' } as VehicleMaintenance);

      expect(gridRef.gridApi!.purgeInfiniteCache).toHaveBeenCalled();
      expect(modalServiceMock.hideModal).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Removido',
        ResponseStatus.Success,
      );
    });

    it('removes the row locally on success when embedded for a vehicle', () => {
      const component = createComponent();
      component.vehicleId = 'v1';
      component.rowData = [{ id: 'm1' } as VehicleMaintenance, { id: 'm2' } as VehicleMaintenance];
      vehicleMaintenanceServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteMaintenance({ id: 'm1' } as VehicleMaintenance);

      expect(component.rowData).toEqual([{ id: 'm2' }]);
    });

    it('does not purge or filter rows when the delete reports an error', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.rowData = [{ id: 'm1' } as VehicleMaintenance];
      vehicleMaintenanceServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' }),
      );

      component.deleteMaintenance({ id: 'm1' } as VehicleMaintenance);

      expect(gridRef.gridApi!.purgeInfiniteCache).not.toHaveBeenCalled();
      expect(component.rowData).toEqual([{ id: 'm1' }]);
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith('', 'Falhou', ResponseStatus.Error);
    });
  });

  describe('refresh', () => {
    it('shows a notification without reloading for the top-level list', () => {
      const component = createComponent();

      component.refresh();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'VEHICLES.MAINTENANCES_REFRESHED',
      );
      expect(vehicleMaintenanceServiceMock.getAll).not.toHaveBeenCalled();
    });

    it('reloads with the refresh notification when embedded for a vehicle', () => {
      const component = createComponent();
      component.vehicleId = 'v1';
      vehicleMaintenanceServiceMock.getByVehicle.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Atualizado', data: [] }),
      );

      component.refresh();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Success, 'Atualizado');
    });
  });

  describe('load (private, via ngOnInit/refresh)', () => {
    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      component.vehicleId = 'v1';
      vehicleMaintenanceServiceMock.getByVehicle.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.rowData).toEqual([]);
      expect(component.loading).toBe(false);
    });

    it('stops loading without throwing when the request errors', () => {
      const component = createComponent();
      component.vehicleId = 'v1';
      vehicleMaintenanceServiceMock.getByVehicle.mockReturnValue({
        pipe: () => ({
          subscribe: (observer: any) => observer.error(new Error('fail')),
        }),
      } as any);

      component.ngOnInit();

      expect(component.loading).toBe(false);
    });
  });

  describe('column defs', () => {
    it('renders description as a link', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'description')!;

      expect((column.cellRenderer as (p: any) => string)({ value: 'Troca de óleo' } as any)).toContain('Troca de óleo');
      expect((column.cellRenderer as (p: any) => string)({ value: null } as any)).toContain('></a>');
    });

    it('renders vehicle.plate as a link and hides the column when embedded', () => {
      const component = createComponent();
      component.vehicleId = 'v1';
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'vehicle.plate')!;

      expect(column.hide).toBe(true);
      expect((column.cellRenderer as (p: any) => string)({ value: 'ABC-1234' } as any)).toContain('ABC-1234');
      expect((column.cellRenderer as (p: any) => string)({ value: null } as any)).toContain('></a>');
    });

    it('shows the vehicle.plate column for the top-level list', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'vehicle.plate')!;

      expect(column.hide).toBe(false);
    });

    describe('type column', () => {
      it('renders Preventive with the correct translated label', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.find((c) => c.field === 'type')!;

        expect((column.cellRenderer as (p: any) => string)({ value: 'Preventive' } as any)).toContain('VEHICLES.PREVENTIVE');
      });

      it('renders any non-Preventive value as Corrective', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.find((c) => c.field === 'type')!;

        expect((column.cellRenderer as (p: any) => string)({ value: 'Corrective' } as any)).toContain('VEHICLES.CORRECTIVE');
        expect((column.cellRenderer as (p: any) => string)({ value: null } as any)).toContain('VEHICLES.CORRECTIVE');
      });
    });

    it('formats scheduledDate as a BR date', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'scheduledDate')!;

      expect((column.valueFormatter as (p: any) => string)({ value: '2024-01-15' } as any)).toContain('/');
    });

    it('formats cost as BRL currency', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'cost')!;

      expect((column.valueFormatter as (p: any) => string)({ value: 250 } as any)).toContain('R$');
    });

    describe('status column', () => {
      it.each([
        ['Scheduled', 'info', 'VEHICLES.MAINTENANCE_SCHEDULED'],
        ['InProgress', 'warning', 'VEHICLES.MAINTENANCE_IN_PROGRESS'],
        ['Completed', 'success', 'VEHICLES.MAINTENANCE_COMPLETED'],
        ['Overdue', 'danger', 'VEHICLES.MAINTENANCE_OVERDUE'],
        ['Cancelled', 'secondary', 'VEHICLES.MAINTENANCE_CANCELLED'],
      ])('renders status %s with the %s color and translated label', (status, color, label) => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.find((c) => c.field === 'status')!;

        const html = (column.cellRenderer as (p: any) => string)({ value: status } as any);

        expect(html).toContain(`bg-${color}`);
        expect(html).toContain(label);
      });

      it('falls back to a secondary badge with the raw value for an unknown status', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.find((c) => c.field === 'status')!;

        const html = (column.cellRenderer as (p: any) => string)({ value: 'Unknown' } as any);

        expect(html).toContain('bg-secondary');
        expect(html).toContain('Unknown');
      });
    });

    it('renders the actions column with view, edit and delete buttons', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs[component.columnDefs.length - 1];

      const html = (column.cellRenderer as (p: any) => string)({} as any);

      expect(html).toContain('data-action="view"');
      expect(html).toContain('data-action="edit"');
      expect(html).toContain('data-action="delete"');
    });
  });
});
