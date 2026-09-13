import {
  ModalService,
  NotificationService,
  PurchaseOrderProduct,
  PurchaseOrderProductService,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';
import { Subject, of, throwError } from 'rxjs';
import { PurchaseOrderProductsComponent } from './purchase-order-products.component';

describe('PurchaseOrderProductsComponent', () => {
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let purchaseOrderProductChanged$: Subject<void>;
  let purchaseOrderProductServiceMock: {
    getByEntityId: ReturnType<typeof vi.fn>;
    purchaseOrderProductChanged$: Subject<void>;
    delete: ReturnType<typeof vi.fn>;
  };
  let language$: Subject<string>;
  let translationServiceMock: {
    instant: ReturnType<typeof vi.fn>;
    language$: Subject<string>;
  };

  function createComponent(): PurchaseOrderProductsComponent {
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    purchaseOrderProductChanged$ = new Subject();
    purchaseOrderProductServiceMock = {
      getByEntityId: vi.fn().mockReturnValue(of({ data: [] })),
      purchaseOrderProductChanged$,
      delete: vi.fn(),
    };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };

    return new PurchaseOrderProductsComponent(
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      purchaseOrderProductServiceMock as unknown as PurchaseOrderProductService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds the column defs and loads the products', () => {
      const component = createComponent();
      component.parentId = 'po1';

      component.ngOnInit();

      expect(component.columnDefs.length).toBeGreaterThan(0);
      expect(purchaseOrderProductServiceMock.getByEntityId).toHaveBeenCalledWith(
        'po1',
        'PurchaseOrder',
      );
    });

    it('rebuilds the column defs on language change', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.columnDefs;

      language$.next('en');

      expect(component.columnDefs).not.toBe(before);
    });

    it('reloads whenever purchaseOrderProductChanged$ emits', () => {
      const component = createComponent();
      component.parentId = 'po1';
      component.ngOnInit();
      purchaseOrderProductServiceMock.getByEntityId.mockClear();

      purchaseOrderProductChanged$.next();

      expect(purchaseOrderProductServiceMock.getByEntityId).toHaveBeenCalledWith(
        'po1',
        'PurchaseOrder',
      );
    });

    it('stops reacting to language/purchaseOrderProductChanged$ after ngOnDestroy', () => {
      const component = createComponent();
      component.parentId = 'po1';
      component.ngOnInit();
      component.ngOnDestroy();
      const before = component.columnDefs;
      purchaseOrderProductServiceMock.getByEntityId.mockClear();

      language$.next('en');
      purchaseOrderProductChanged$.next();

      expect(component.columnDefs).toBe(before);
      expect(purchaseOrderProductServiceMock.getByEntityId).not.toHaveBeenCalled();
    });
  });

  describe('ngOnChanges', () => {
    it('reloads when parentId changes after the first change', () => {
      const component = createComponent();
      component.parentId = 'po2';

      component.ngOnChanges({ parentId: { firstChange: false } as any });

      expect(purchaseOrderProductServiceMock.getByEntityId).toHaveBeenCalledWith(
        'po2',
        'PurchaseOrder',
      );
    });

    it('does not reload on the first change', () => {
      const component = createComponent();
      component.parentId = 'po2';

      component.ngOnChanges({ parentId: { firstChange: true } as any });

      expect(purchaseOrderProductServiceMock.getByEntityId).not.toHaveBeenCalled();
    });

    it('does nothing when parentId is not part of the change set', () => {
      const component = createComponent();

      expect(() => component.ngOnChanges({})).not.toThrow();
      expect(purchaseOrderProductServiceMock.getByEntityId).not.toHaveBeenCalled();
    });
  });

  describe('openModal', () => {
    it('uses the purchaseOrderId from the initial data when present', () => {
      const component = createComponent();
      component.parentId = 'po1';

      component.openModal({ isEdit: true, data: { purchaseOrderId: 'po-from-data' } });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parentId: 'po-from-data' }),
      );
    });

    it('falls back to the component parentId when the initial data has none', () => {
      const component = createComponent();
      component.parentId = 'po1';

      component.openModal({ isEdit: false, data: {} });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parentId: 'po1' }),
      );
    });
  });

  describe('refresh', () => {
    it('reloads and shows a success notification', () => {
      const component = createComponent();
      component.parentId = 'po1';

      component.refresh();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'PURCHASE_ORDER_PRODUCTS.PURCHASE_ORDER_PRODUCTS_REFRESHED',
      );
    });
  });

  describe('noop', () => {
    it('does nothing', () => {
      const component = createComponent();
      expect(() => component.noop()).not.toThrow();
    });
  });

  describe('deletePurchaseOrderProduct', () => {
    it('removes the product from the grid and notifies', () => {
      const component = createComponent();
      component.rowData = [
        { id: 'x1' } as PurchaseOrderProduct,
        { id: 'x2' } as PurchaseOrderProduct,
      ];
      purchaseOrderProductServiceMock.delete.mockReturnValue(of({ message: 'Removido' }));

      component.deletePurchaseOrderProduct({ id: 'x1' } as PurchaseOrderProduct);

      expect(component.rowData).toEqual([{ id: 'x2' }]);
      expect(modalServiceMock.hideModal).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        'PURCHASE_ORDER_PRODUCTS.ITEM_DELETED',
        'Removido',
        'success',
      );
    });
  });

  describe('load (private, via ngOnInit)', () => {
    it('does nothing when there is no parentId', () => {
      const component = createComponent();
      component.parentId = null;

      component.ngOnInit();

      expect(purchaseOrderProductServiceMock.getByEntityId).not.toHaveBeenCalled();
      expect(component.loading).toBe(false);
    });

    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      component.parentId = 'po1';
      purchaseOrderProductServiceMock.getByEntityId.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.rowData).toEqual([]);
      expect(component.loading).toBe(false);
    });

    it('stops loading without throwing when the request errors', () => {
      const component = createComponent();
      component.parentId = 'po1';
      purchaseOrderProductServiceMock.getByEntityId.mockReturnValue(
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
