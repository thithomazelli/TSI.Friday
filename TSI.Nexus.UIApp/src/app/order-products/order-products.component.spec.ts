import {
  ModalService,
  NotificationService,
  OrderProduct,
  OrderProductService,
  ResponseStatus,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { SimpleChanges } from '@angular/core';
import { Subject } from 'rxjs';
import { OrderProductsComponent } from './order-products.component';

describe('OrderProductsComponent', () => {
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let orderProductChanged$: Subject<void>;
  let orderProductServiceMock: {
    getByEntityId: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    orderProductChanged$: Subject<void>;
  };
  let language$: Subject<string>;
  let translationServiceMock: { instant: ReturnType<typeof vi.fn>; language$: Subject<string> };

  function createComponent(): OrderProductsComponent {
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    orderProductChanged$ = new Subject();
    orderProductServiceMock = {
      getByEntityId: vi.fn().mockReturnValue(new Subject()),
      delete: vi.fn(),
      orderProductChanged$,
    };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };

    return new OrderProductsComponent(
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      orderProductServiceMock as unknown as OrderProductService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds the columns, loads data for the current parentId, and reacts to language and orderProductChanged$', () => {
      const component = createComponent();
      component.parentId = 'o1';
      component.ngOnInit();

      expect(component.columnDefs.length).toBeGreaterThan(0);
      expect(orderProductServiceMock.getByEntityId).toHaveBeenCalledWith('o1', 'Order');

      const columnsBefore = component.columnDefs;
      language$.next('en');
      expect(component.columnDefs).not.toBe(columnsBefore);

      orderProductServiceMock.getByEntityId.mockClear();
      orderProductChanged$.next();
      expect(orderProductServiceMock.getByEntityId).toHaveBeenCalledWith('o1', 'Order');
    });

    it('hides the SKU/product columns and shows order/client columns when viewed from the product history tab', () => {
      const component = createComponent();
      component.isFromProductsView = true;
      component.ngOnInit();

      const skuColumn = component.columnDefs.find((c) => c.field === 'productSku');
      const orderColumn = component.columnDefs.find((c) => c.field === 'orderNumber');
      expect(skuColumn?.hide).toBe(true);
      expect(orderColumn?.hide).toBe(false);
    });

    it('sku/product cellRenderers fall back to an empty value when the cell has none', () => {
      const component = createComponent();
      component.ngOnInit();

      const skuColumn = component.columnDefs.find((c) => c.field === 'productSku');
      const nameColumn = component.columnDefs.find((c) => c.field === 'productName');

      expect((skuColumn?.cellRenderer as (p: unknown) => string)({ value: 'SKU-1' })).toContain('SKU-1');
      expect((skuColumn?.cellRenderer as (p: unknown) => string)({ value: undefined })).toContain('>');
      expect((nameColumn?.cellRenderer as (p: unknown) => string)({ value: 'Produto X' })).toContain('Produto X');
      expect((nameColumn?.cellRenderer as (p: unknown) => string)({ value: undefined })).toContain('>');
    });

    it('orderNumber cellRenderer falls back to N/A when the cell has no value', () => {
      const component = createComponent();
      component.ngOnInit();

      const orderColumn = component.columnDefs.find((c) => c.field === 'orderNumber');

      expect((orderColumn?.cellRenderer as (p: unknown) => string)({ value: 'PED-1' })).toContain('PED-1');
      expect((orderColumn?.cellRenderer as (p: unknown) => string)({ value: undefined })).toContain('N/A');
    });

    it('totalPrice valueFormatter formats the amount or falls back to R$ 0,00', () => {
      const component = createComponent();
      component.ngOnInit();

      const totalColumn = component.columnDefs.find((c) => c.field === 'totalPrice');
      const formatter = totalColumn?.valueFormatter as (p: { value: number }) => string;

      expect(formatter({ value: 150 })).toBe('R$ 150.00');
      expect(formatter({ value: 0 })).toBe('R$ 0,00');
    });

    it('actions column cellRenderer includes the delete button only outside the product history tab', () => {
      const component = createComponent();
      component.isFromProductsView = false;
      component.ngOnInit();
      const actionsColumn = component.columnDefs.find((c) => c.headerName === 'COMMON.ACTIONS');
      const withDelete = (actionsColumn?.cellRenderer as () => string)();
      expect(withDelete).toContain('data-action="delete"');

      component.isFromProductsView = true;
      component.ngOnInit();
      const readOnlyColumn = component.columnDefs.find((c) => c.headerName === 'COMMON.ACTIONS');
      const withoutDelete = (readOnlyColumn?.cellRenderer as () => string)();
      expect(withoutDelete).not.toContain('data-action="delete"');
    });
  });

  describe('ngOnChanges', () => {
    it('reloads when parentId changes after the first change', () => {
      const component = createComponent();
      component.parentId = 'o2';

      component.ngOnChanges({ parentId: { firstChange: false } } as unknown as SimpleChanges);

      expect(orderProductServiceMock.getByEntityId).toHaveBeenCalledWith('o2', 'Order');
    });

    it('does not reload on the first change', () => {
      const component = createComponent();
      component.parentId = 'o2';

      component.ngOnChanges({ parentId: { firstChange: true } } as unknown as SimpleChanges);

      expect(orderProductServiceMock.getByEntityId).not.toHaveBeenCalled();
    });

    it('does nothing when parentId is not part of the changes', () => {
      const component = createComponent();
      component.parentId = 'o2';

      component.ngOnChanges({} as SimpleChanges);

      expect(orderProductServiceMock.getByEntityId).not.toHaveBeenCalled();
    });
  });

  it('does not fetch when there is no parentId', () => {
    const component = createComponent();
    component.parentId = null;

    component.ngOnInit();

    expect(orderProductServiceMock.getByEntityId).not.toHaveBeenCalled();
  });

  it('fetches by product id and stops loading, without a refresh notification, on a plain load', () => {
    const component = createComponent();
    component.parentId = 'p1';
    component.isFromProductsView = true;
    const response$ = new Subject<WebApiResponse<OrderProduct[]>>();
    orderProductServiceMock.getByEntityId.mockReturnValue(response$);

    component.ngOnInit();
    expect(component.loading).toBe(true);
    response$.next({ data: [{ id: 'op1' } as OrderProduct] } as WebApiResponse<OrderProduct[]>);

    expect(orderProductServiceMock.getByEntityId).toHaveBeenCalledWith('p1', 'Product');
    expect(component.rowData).toEqual([{ id: 'op1' }]);
    expect(component.loading).toBe(false);
    expect(notificationServiceMock.showMessage).not.toHaveBeenCalled();
  });

  it('falls back to an empty list when the response has no data', () => {
    const component = createComponent();
    component.parentId = 'o1';
    const response$ = new Subject<WebApiResponse<OrderProduct[]>>();
    orderProductServiceMock.getByEntityId.mockReturnValue(response$);

    component.ngOnInit();
    response$.next({} as WebApiResponse<OrderProduct[]>);

    expect(component.rowData).toEqual([]);
  });

  it('refresh() reloads and shows a success notification once the data arrives', () => {
    const component = createComponent();
    component.parentId = 'o1';
    const response$ = new Subject<WebApiResponse<OrderProduct[]>>();
    orderProductServiceMock.getByEntityId.mockReturnValue(response$);

    component.refresh();
    response$.next({ data: [] } as unknown as WebApiResponse<OrderProduct[]>);

    expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
      ResponseStatus.Success,
      'ORDER_PRODUCTS.ORDER_PRODUCTS_REFRESHED',
    );
  });

  it('stops loading when the request errors', () => {
    const component = createComponent();
    component.parentId = 'o1';
    const response$ = new Subject<WebApiResponse<OrderProduct[]>>();
    orderProductServiceMock.getByEntityId.mockReturnValue(response$);

    component.ngOnInit();
    response$.error(new Error('fail'));

    expect(component.loading).toBe(false);
  });

  it('noop() does nothing', () => {
    const component = createComponent();
    expect(() => component.noop()).not.toThrow();
  });

  describe('openModal', () => {
    it('uses the orderId from the modal data when present', () => {
      const component = createComponent();
      component.parentId = 'o1';

      component.openModal({ data: { orderId: 'o2' } });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parentId: 'o2' }),
      );
    });

    it('falls back to the component parentId when the modal data has none', () => {
      const component = createComponent();
      component.parentId = 'o1';

      component.openModal({});

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parentId: 'o1' }),
      );
    });
  });

  it('deleteOrderProduct removes the item, hides the modal, and shows a success notification', () => {
    const component = createComponent();
    component.rowData = [{ id: 'op1' } as OrderProduct, { id: 'op2' } as OrderProduct];
    const deleteResponse$ = new Subject<WebApiResponse<OrderProduct>>();
    orderProductServiceMock.delete.mockReturnValue(deleteResponse$);

    component.deleteOrderProduct({ id: 'op1' } as OrderProduct);
    deleteResponse$.next({ message: 'removido' } as WebApiResponse<OrderProduct>);

    expect(component.rowData).toEqual([{ id: 'op2' }]);
    expect(modalServiceMock.hideModal).toHaveBeenCalled();
    expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
      'ORDER_PRODUCTS.ITEM_DELETED',
      'removido',
      'success',
    );
  });

  it('ngOnDestroy completes the destroy subject so subscriptions stop reacting', () => {
    const component = createComponent();
    component.parentId = 'o1';
    component.ngOnInit();

    component.ngOnDestroy();
    orderProductServiceMock.getByEntityId.mockClear();
    orderProductChanged$.next();

    expect(orderProductServiceMock.getByEntityId).not.toHaveBeenCalled();
  });
});
