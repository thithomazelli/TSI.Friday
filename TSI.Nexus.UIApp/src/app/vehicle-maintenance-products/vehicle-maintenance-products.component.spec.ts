import {
  ModalService,
  NotificationService,
  ResponseStatus,
  TranslationService,
  VehicleMaintenanceProduct,
  VehicleMaintenanceProductService,
} from '@nexus/core';
import { Subject, of, throwError } from 'rxjs';
import { VehicleMaintenanceProductsComponent } from './vehicle-maintenance-products.component';

describe('VehicleMaintenanceProductsComponent', () => {
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let vehicleMaintenanceProductChanged$: Subject<void>;
  let vehicleMaintenanceProductServiceMock: {
    getByEntityId: ReturnType<typeof vi.fn>;
    vehicleMaintenanceProductChanged$: Subject<void>;
    delete: ReturnType<typeof vi.fn>;
  };
  let language$: Subject<string>;
  let translationServiceMock: {
    instant: ReturnType<typeof vi.fn>;
    language$: Subject<string>;
  };

  function createComponent(): VehicleMaintenanceProductsComponent {
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    vehicleMaintenanceProductChanged$ = new Subject();
    vehicleMaintenanceProductServiceMock = {
      getByEntityId: vi.fn().mockReturnValue(of({ data: [] })),
      vehicleMaintenanceProductChanged$,
      delete: vi.fn(),
    };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };

    return new VehicleMaintenanceProductsComponent(
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      vehicleMaintenanceProductServiceMock as unknown as VehicleMaintenanceProductService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds the column defs and loads the products', () => {
      const component = createComponent();
      component.parentId = 'vm1';

      component.ngOnInit();

      expect(component.columnDefs.length).toBeGreaterThan(0);
      expect(vehicleMaintenanceProductServiceMock.getByEntityId).toHaveBeenCalledWith(
        'vm1',
        'VehicleMaintenance',
      );
    });

    it('rebuilds the column defs on language change', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.columnDefs;

      language$.next('en');

      expect(component.columnDefs).not.toBe(before);
    });

    it('reloads whenever vehicleMaintenanceProductChanged$ emits', () => {
      const component = createComponent();
      component.parentId = 'vm1';
      component.ngOnInit();
      vehicleMaintenanceProductServiceMock.getByEntityId.mockClear();

      vehicleMaintenanceProductChanged$.next();

      expect(vehicleMaintenanceProductServiceMock.getByEntityId).toHaveBeenCalledWith(
        'vm1',
        'VehicleMaintenance',
      );
    });

    it('stops reacting to language/vehicleMaintenanceProductChanged$ after ngOnDestroy', () => {
      const component = createComponent();
      component.parentId = 'vm1';
      component.ngOnInit();
      component.ngOnDestroy();
      const before = component.columnDefs;
      vehicleMaintenanceProductServiceMock.getByEntityId.mockClear();

      language$.next('en');
      vehicleMaintenanceProductChanged$.next();

      expect(component.columnDefs).toBe(before);
      expect(vehicleMaintenanceProductServiceMock.getByEntityId).not.toHaveBeenCalled();
    });
  });

  describe('ngOnChanges', () => {
    it('reloads when parentId changes after the first change', () => {
      const component = createComponent();
      component.parentId = 'vm2';

      component.ngOnChanges({ parentId: { firstChange: false } as any });

      expect(vehicleMaintenanceProductServiceMock.getByEntityId).toHaveBeenCalledWith(
        'vm2',
        'VehicleMaintenance',
      );
    });

    it('does not reload on the first change', () => {
      const component = createComponent();
      component.parentId = 'vm2';

      component.ngOnChanges({ parentId: { firstChange: true } as any });

      expect(vehicleMaintenanceProductServiceMock.getByEntityId).not.toHaveBeenCalled();
    });

    it('does nothing when parentId is not part of the change set', () => {
      const component = createComponent();

      expect(() => component.ngOnChanges({})).not.toThrow();
      expect(vehicleMaintenanceProductServiceMock.getByEntityId).not.toHaveBeenCalled();
    });
  });

  describe('openModal', () => {
    it('uses the vehicleMaintenanceId from the initial data when present', () => {
      const component = createComponent();
      component.parentId = 'vm1';

      component.openModal({ isEdit: true, data: { vehicleMaintenanceId: 'vm-from-data' } });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parentId: 'vm-from-data' }),
      );
    });

    it('falls back to the component parentId when the initial data has none', () => {
      const component = createComponent();
      component.parentId = 'vm1';

      component.openModal({ isEdit: false, data: {} });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parentId: 'vm1' }),
      );
    });
  });

  describe('refresh', () => {
    it('reloads and shows a success notification', () => {
      const component = createComponent();
      component.parentId = 'vm1';

      component.refresh();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'VEHICLE_MAINTENANCE_PRODUCTS.VEHICLE_MAINTENANCE_PRODUCTS_REFRESHED',
      );
    });
  });

  describe('noop', () => {
    it('does nothing', () => {
      const component = createComponent();
      expect(() => component.noop()).not.toThrow();
    });
  });

  describe('deleteVehicleMaintenanceProduct', () => {
    it('removes the product from the grid and notifies with the response status', () => {
      const component = createComponent();
      component.rowData = [
        { id: 'x1' } as VehicleMaintenanceProduct,
        { id: 'x2' } as VehicleMaintenanceProduct,
      ];
      vehicleMaintenanceProductServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteVehicleMaintenanceProduct({ id: 'x1' } as VehicleMaintenanceProduct);

      expect(component.rowData).toEqual([{ id: 'x2' }]);
      expect(modalServiceMock.hideModal).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        'VEHICLE_MAINTENANCE_PRODUCTS.ITEM_DELETED',
        'Removido',
        ResponseStatus.Success,
      );
    });
  });

  describe('load (private, via ngOnInit)', () => {
    it('does nothing when there is no parentId', () => {
      const component = createComponent();
      component.parentId = null;

      component.ngOnInit();

      expect(vehicleMaintenanceProductServiceMock.getByEntityId).not.toHaveBeenCalled();
      expect(component.loading).toBe(false);
    });

    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      component.parentId = 'vm1';
      vehicleMaintenanceProductServiceMock.getByEntityId.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.rowData).toEqual([]);
      expect(component.loading).toBe(false);
    });

    it('stops loading without throwing when the request errors', () => {
      const component = createComponent();
      component.parentId = 'vm1';
      vehicleMaintenanceProductServiceMock.getByEntityId.mockReturnValue(
        throwError(() => new Error('fail')),
      );

      component.ngOnInit();

      expect(component.loading).toBe(false);
    });
  });

  describe('column defs cell renderers', () => {
    it('renders the productSku as a link, falling back to an empty string', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'productSku')!;

      expect((column.cellRenderer as (p: any) => string)({ value: 'SKU1' })).toContain('SKU1');
      expect((column.cellRenderer as (p: any) => string)({ value: null })).toContain('ag-link');
    });

    it('renders the productName as a link, falling back to an empty string', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'productName')!;

      expect((column.cellRenderer as (p: any) => string)({ value: 'Produto A' })).toContain(
        'Produto A',
      );
      expect((column.cellRenderer as (p: any) => string)({ value: null })).toContain('ag-link');
    });

    it('formats totalPrice as BRL currency, falling back to R$ 0,00', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'totalPrice')!;

      expect((column.valueFormatter as (p: any) => string)({ value: 12.5 } as any)).toBe(
        'R$ 12.50',
      );
      expect((column.valueFormatter as (p: any) => string)({ value: 0 } as any)).toBe('R$ 0,00');
      expect((column.valueFormatter as (p: any) => string)({ value: null } as any)).toBe(
        'R$ 0,00',
      );
    });

    it('renders the actions column buttons', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs[component.columnDefs.length - 1];

      const html = (column.cellRenderer as () => string)();

      expect(html).toContain('data-action="edit"');
      expect(html).toContain('data-action="delete"');
    });
  });
});
