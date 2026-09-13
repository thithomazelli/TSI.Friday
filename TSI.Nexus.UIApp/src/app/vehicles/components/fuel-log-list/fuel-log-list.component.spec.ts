import {
  FuelLog,
  FuelLogService,
  ModalService,
  NotificationService,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';
import { GridApi } from 'ag-grid-community';
import { Subject, of } from 'rxjs';
import { GridComponent } from '../../../shared/grid/grid.component';
import { FuelLogListComponent } from './fuel-log-list.component';

describe('FuelLogListComponent', () => {
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let modalServiceMock: { showTemplateModal: ReturnType<typeof vi.fn>; hideModal: ReturnType<typeof vi.fn>; showSweetNotification: ReturnType<typeof vi.fn> };
  let fuelLogChanged$: Subject<void>;
  let fuelLogServiceMock: {
    getAllPaged: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
    getByVehicle: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    fuelLogChanged$: Subject<void>;
  };
  let language$: Subject<string>;
  let translationServiceMock: { instant: ReturnType<typeof vi.fn>; language$: Subject<string> };

  function mockGridRef(): GridComponent<FuelLog> {
    return {
      gridApi: { purgeInfiniteCache: vi.fn() } as unknown as GridApi,
    } as unknown as GridComponent<FuelLog>;
  }

  function createComponent(): FuelLogListComponent {
    notificationServiceMock = { showMessage: vi.fn() };
    modalServiceMock = { showTemplateModal: vi.fn(), hideModal: vi.fn(), showSweetNotification: vi.fn() };
    fuelLogChanged$ = new Subject();
    fuelLogServiceMock = {
      getAllPaged: vi.fn(),
      getAll: vi.fn().mockReturnValue(of({ data: [] })),
      getByVehicle: vi.fn().mockReturnValue(of({ data: [] })),
      delete: vi.fn(),
      fuelLogChanged$,
    };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };

    return new FuelLogListComponent(
      notificationServiceMock as unknown as NotificationService,
      fuelLogServiceMock as unknown as FuelLogService,
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

  describe('pagedDataSource', () => {
    it('delegates to fuelLogService.getAllPaged', () => {
      const component = createComponent();
      const request = { page: 1 } as any;
      fuelLogServiceMock.getAllPaged.mockReturnValue(of({ data: [], total: 0 }));

      component.pagedDataSource(request);

      expect(fuelLogServiceMock.getAllPaged).toHaveBeenCalledWith(request);
    });
  });

  describe('ngOnInit', () => {
    it('builds the column defs and does not load eagerly for the top-level list', () => {
      const component = createComponent();

      component.ngOnInit();

      expect(component.columnDefs.length).toBeGreaterThan(0);
      expect(fuelLogServiceMock.getAll).not.toHaveBeenCalled();
      expect(fuelLogServiceMock.getByVehicle).not.toHaveBeenCalled();
    });

    it('loads eagerly when embedded for a specific vehicle', () => {
      const component = createComponent();
      component.vehicleId = 'v1';

      component.ngOnInit();

      expect(fuelLogServiceMock.getByVehicle).toHaveBeenCalledWith('v1');
    });

    it('rebuilds the column defs on language change', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.columnDefs;

      language$.next('en');

      expect(component.columnDefs).not.toBe(before);
    });

    it('purges the grid cache on fuelLogChanged$ for the top-level list', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();

      fuelLogChanged$.next();

      expect(gridRef.gridApi!.purgeInfiniteCache).toHaveBeenCalled();
    });

    it('does not throw when fuelLogChanged$ fires without a gridRef', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() => fuelLogChanged$.next()).not.toThrow();
    });

    it('reloads when embedded and fuelLogChanged$ fires', () => {
      const component = createComponent();
      component.vehicleId = 'v1';
      component.ngOnInit();
      fuelLogServiceMock.getByVehicle.mockClear();

      fuelLogChanged$.next();

      expect(fuelLogServiceMock.getByVehicle).toHaveBeenCalledWith('v1');
    });
  });

  describe('ngOnChanges', () => {
    it('reloads when vehicleId changes after the first change', () => {
      const component = createComponent();
      component.vehicleId = 'v2';

      component.ngOnChanges({ vehicleId: { firstChange: false } as any });

      expect(fuelLogServiceMock.getByVehicle).toHaveBeenCalledWith('v2');
    });

    it('does not reload on the first change', () => {
      const component = createComponent();
      component.vehicleId = 'v2';

      component.ngOnChanges({ vehicleId: { firstChange: true } as any });

      expect(fuelLogServiceMock.getByVehicle).not.toHaveBeenCalled();
    });

    it('loads via getAll when vehicleId changes back to undefined', () => {
      const component = createComponent();
      component.vehicleId = undefined;

      component.ngOnChanges({ vehicleId: { firstChange: false } as any });

      expect(fuelLogServiceMock.getAll).toHaveBeenCalled();
      expect(fuelLogServiceMock.getByVehicle).not.toHaveBeenCalled();
    });

    it('does nothing when vehicleId is not part of the change set', () => {
      const component = createComponent();

      expect(() => component.ngOnChanges({})).not.toThrow();
      expect(fuelLogServiceMock.getByVehicle).not.toHaveBeenCalled();
      expect(fuelLogServiceMock.getAll).not.toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('stops reacting to language changes and fuelLogChanged$', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();

      component.ngOnDestroy();
      const before = component.columnDefs;
      language$.next('en');
      fuelLogChanged$.next();

      expect(component.columnDefs).toBe(before);
      expect(gridRef.gridApi!.purgeInfiniteCache).not.toHaveBeenCalled();
    });
  });

  describe('openModal', () => {
    it('opens the details modal, always forcing the component vehicleId', () => {
      const component = createComponent();
      component.vehicleId = 'v1';

      component.openModal({ data: { id: 'f1', vehicleId: 'other-vehicle' } });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ vehicleId: 'v1', data: { id: 'f1', vehicleId: 'other-vehicle' } }),
      );
    });
  });

  describe('removeFuelLog', () => {
    it('purges the grid cache on success for the top-level list', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      fuelLogServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.removeFuelLog({ id: 'f1' } as FuelLog);

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
      component.rowData = [{ id: 'f1' } as FuelLog, { id: 'f2' } as FuelLog];
      fuelLogServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.removeFuelLog({ id: 'f1' } as FuelLog);

      expect(component.rowData).toEqual([{ id: 'f2' }]);
    });

    it('does not purge or filter rows when the delete reports an error', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.rowData = [{ id: 'f1' } as FuelLog];
      fuelLogServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' }),
      );

      component.removeFuelLog({ id: 'f1' } as FuelLog);

      expect(gridRef.gridApi!.purgeInfiniteCache).not.toHaveBeenCalled();
      expect(component.rowData).toEqual([{ id: 'f1' }]);
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith('', 'Falhou', ResponseStatus.Error);
    });
  });

  describe('refresh', () => {
    it('shows a notification without reloading for the top-level list', () => {
      const component = createComponent();

      component.refresh();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'VEHICLES.FUEL_LOGS_REFRESHED',
      );
      expect(fuelLogServiceMock.getAll).not.toHaveBeenCalled();
    });

    it('reloads with the refresh notification when embedded for a vehicle', () => {
      const component = createComponent();
      component.vehicleId = 'v1';
      fuelLogServiceMock.getByVehicle.mockReturnValue(
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
      fuelLogServiceMock.getByVehicle.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.rowData).toEqual([]);
      expect(component.loading).toBe(false);
    });

    it('stops loading without throwing when the request errors', () => {
      const component = createComponent();
      component.vehicleId = 'v1';
      fuelLogServiceMock.getByVehicle.mockReturnValue({
        pipe: () => ({
          subscribe: (observer: any) => observer.error(new Error('fail')),
        }),
      } as any);

      component.ngOnInit();

      expect(component.loading).toBe(false);
    });
  });

  describe('column defs', () => {
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

    it('formats date as BR', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'date')!;

      expect((column.valueFormatter as (p: any) => string)({ value: '2024-01-15' } as any)).toContain('/');
    });

    it('formats pricePerLiter and totalCost as BRL currency', () => {
      const component = createComponent();
      component.ngOnInit();
      const priceColumn = component.columnDefs.find((c) => c.field === 'pricePerLiter')!;
      const totalColumn = component.columnDefs.find((c) => c.field === 'totalCost')!;

      expect((priceColumn.valueFormatter as (p: any) => string)({ value: 5.5 } as any)).toContain('R$');
      expect((totalColumn.valueFormatter as (p: any) => string)({ value: 100 } as any)).toContain('R$');
    });

    describe('status column', () => {
      it.each([
        ['Concluído', 'success'],
        ['Agendado', 'info'],
        ['Cancelado', 'secondary'],
      ])('renders status %s with the %s color', (status, color) => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.find((c) => c.field === 'status')!;

        const html = (column.cellRenderer as (p: any) => string)({ value: status } as any);

        expect(html).toContain(`bg-${color}`);
        expect(html).toContain(status);
      });

      it('falls back to a secondary badge for an unknown status', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.find((c) => c.field === 'status')!;

        const html = (column.cellRenderer as (p: any) => string)({ value: 'Unknown' } as any);

        expect(html).toContain('bg-secondary');
        expect(html).toContain('Unknown');
      });

      it('renders an empty label when there is no status', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.find((c) => c.field === 'status')!;

        const html = (column.cellRenderer as (p: any) => string)({ value: null } as any);

        expect(html).toContain('bg-secondary');
        expect(html).toContain('></span>');
      });
    });

    it('renders the actions column with edit and delete buttons', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs[component.columnDefs.length - 1];

      const html = (column.cellRenderer as (p: any) => string)({} as any);

      expect(html).toContain('data-action="edit"');
      expect(html).toContain('data-action="delete"');
    });
  });
});
