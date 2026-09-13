import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  ModalService,
  NotificationService,
  Product,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';
import { GridApi } from 'ag-grid-community';
import { Subject, of } from 'rxjs';
import { ProductsComponent } from './products.component';
import { ProductService } from '../core/services/product/product.service';
import { GridComponent } from '../shared/grid/grid.component';

describe('ProductsComponent', () => {
  let activatedRouteMock: { snapshot: { queryParamMap: { get: ReturnType<typeof vi.fn> } } };
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let productChanged$: Subject<void>;
  let productServiceMock: {
    getAllPaged: ReturnType<typeof vi.fn>;
    productChanged$: Subject<void>;
    delete: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
  };
  let language$: Subject<string>;
  let translationServiceMock: {
    instant: ReturnType<typeof vi.fn>;
    language$: Subject<string>;
  };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  function createComponent(stockStatus: string | null = null): ProductsComponent {
    activatedRouteMock = {
      snapshot: { queryParamMap: { get: vi.fn().mockReturnValue(stockStatus) } },
    };
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    productChanged$ = new Subject();
    productServiceMock = {
      getAllPaged: vi.fn(),
      productChanged$,
      delete: vi.fn(),
      refresh: vi.fn(),
    };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };
    cdrMock = { markForCheck: vi.fn() };

    return new ProductsComponent(
      activatedRouteMock as unknown as ActivatedRoute,
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      productServiceMock as unknown as ProductService,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  function mockGridRef(): GridComponent<Product> {
    return {
      gridApi: { purgeInfiniteCache: vi.fn() } as unknown as GridApi,
    } as unknown as GridComponent<Product>;
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('rebuilds the column definitions when the language changes', () => {
    const component = createComponent();
    const before = component.columnDefs;

    language$.next('en');

    expect(component.columnDefs).not.toBe(before);
    expect(cdrMock.markForCheck).toHaveBeenCalled();
  });

  describe('ngOnInit', () => {
    it('reads the stockStatus query param and forwards lowStockOnly to the paged request', () => {
      const component = createComponent('Low');
      component.ngOnInit();

      component.pagedDataSource({ page: 1, pageSize: 10 });

      expect(productServiceMock.getAllPaged).toHaveBeenCalledWith(
        expect.objectContaining({ lowStockOnly: true }),
      );
    });

    it('defaults lowStockOnly to false without the query param', () => {
      const component = createComponent(null);
      component.ngOnInit();

      component.pagedDataSource({ page: 1, pageSize: 10 });

      expect(productServiceMock.getAllPaged).toHaveBeenCalledWith(
        expect.objectContaining({ lowStockOnly: false }),
      );
    });

    it('ignores the first (replay) emission but purges the cache on later changes', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();

      productChanged$.next();
      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();

      productChanged$.next();
      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalledTimes(1);
    });

    it('stops reacting after ngOnDestroy', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();
      component.ngOnDestroy();

      productChanged$.next();
      productChanged$.next();

      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('does not throw when called before ngOnInit ever subscribed', () => {
      const component = createComponent();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('openModal', () => {
    it('opens the product details modal', () => {
      const component = createComponent();
      component.openModal({ isEdit: false });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        { isEdit: false },
      );
    });
  });

  describe('deleteProduct', () => {
    it('purges the grid cache and notifies on success', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      productServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteProduct({ id: 'p1' } as Product);

      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalled();
      expect(modalServiceMock.hideModal).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Removido',
        ResponseStatus.Success,
      );
    });

    it('does not purge the cache when the delete reports an error', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      productServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' }),
      );

      component.deleteProduct({ id: 'p1' } as Product);

      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();
    });
  });

  describe('refreshProducts', () => {
    it('refreshes the shared cache and shows a notification', () => {
      const component = createComponent();
      component.refreshProducts();

      expect(productServiceMock.refresh).toHaveBeenCalled();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'PRODUCTS.PRODUCTS_REFRESHED',
      );
    });
  });

  describe('column cell renderers', () => {
    it('renders the sku and name as links, falling back to empty when the value is missing', () => {
      const component = createComponent();
      const skuColumn = component.columnDefs.find((c) => c.field === 'sku')!;
      const nameColumn = component.columnDefs.find((c) => c.field === 'name')!;

      expect((skuColumn.cellRenderer as (params: any) => string)({ value: 'SKU1' })).toContain('SKU1');
      expect((skuColumn.cellRenderer as (params: any) => string)({ value: null })).toContain('ag-link');
      expect((nameColumn.cellRenderer as (params: any) => string)({ value: 'Produto 1' })).toContain('Produto 1');
      expect((nameColumn.cellRenderer as (params: any) => string)({ value: null })).toContain('ag-link');
    });

    it('shows an "available" badge for an in-stock, non-service product', () => {
      const component = createComponent();
      const statusColumn = component.columnDefs.find((c) => c.headerName === 'COMMON.STATUS')!;

      const html = (statusColumn.cellRenderer as (params: any) => string)({
        value: 5,
        data: { type: 'Sale' },
      });

      expect(html).toContain('bg-success');
    });

    it('formats the price column with formatCurrencyBRL', () => {
      const component = createComponent();
      const priceColumn = component.columnDefs.find((c) => c.field === 'price')!;

      const formatted = (priceColumn.valueFormatter as (params: any) => string)({ value: 1234.5 });

      expect(typeof formatted).toBe('string');
    });

    it('renders the action buttons column', () => {
      const component = createComponent();
      const actionsColumn = component.columnDefs[component.columnDefs.length - 1];

      const html = (actionsColumn.cellRenderer as () => string)();

      expect(html).toContain('data-action="view"');
      expect(html).toContain('data-action="edit"');
      expect(html).toContain('data-action="delete"');
    });

    it('exposes filterValueGetter for unit and type, matching the cell renderer output', () => {
      const component = createComponent();
      const unitColumn = component.columnDefs.find((c) => c.field === 'unit')!;
      const typeColumn = component.columnDefs.find((c) => c.field === 'type')!;

      expect((unitColumn.filterValueGetter as (params: any) => string)({ data: { unit: 'Unit' } })).toBe(
        'PRODUCTS.UNIT_UNIT',
      );
      expect((typeColumn.filterValueGetter as (params: any) => string)({ data: { type: 'Sale' } })).toBe(
        'PRODUCTS.TYPE_SALE',
      );
    });

    it('falls back to an empty string when the unit/type is nullish', () => {
      const component = createComponent();
      const unitColumn = component.columnDefs.find((c) => c.field === 'unit')!;
      const typeColumn = component.columnDefs.find((c) => c.field === 'type')!;

      expect((unitColumn.cellRenderer as (params: any) => string)({ data: { unit: undefined } })).toBe('');
      expect((typeColumn.cellRenderer as (params: any) => string)({ data: { type: undefined } })).toBe('');
    });

    it('shows an "available" badge for a service regardless of stock', () => {
      const component = createComponent();
      const statusColumn = component.columnDefs.find((c) => c.headerName === 'COMMON.STATUS')!;

      const html = (statusColumn.cellRenderer as (params: any) => string)({
        value: 0,
        data: { type: 'Service' },
      });

      expect(html).toContain('bg-success');
    });

    it('shows an "unavailable" badge when a non-service product is out of stock', () => {
      const component = createComponent();
      const statusColumn = component.columnDefs.find((c) => c.headerName === 'COMMON.STATUS')!;

      const html = (statusColumn.cellRenderer as (params: any) => string)({
        value: 0,
        data: { type: 'Sale' },
      });

      expect(html).toContain('bg-danger');
    });

    it('translates a known unit and falls back to the raw value otherwise', () => {
      const component = createComponent();
      const unitColumn = component.columnDefs.find((c) => c.field === 'unit')!;

      expect(
        (unitColumn.cellRenderer as (params: any) => string)({ data: { unit: 'Unit' } }),
      ).toBe('PRODUCTS.UNIT_UNIT');
      expect(
        (unitColumn.cellRenderer as (params: any) => string)({ data: { unit: 'Weird' } }),
      ).toBe('Weird');
    });

    it('translates a known type and falls back to the raw value otherwise', () => {
      const component = createComponent();
      const typeColumn = component.columnDefs.find((c) => c.field === 'type')!;

      expect(
        (typeColumn.cellRenderer as (params: any) => string)({ data: { type: 'Sale' } }),
      ).toBe('PRODUCTS.TYPE_SALE');
      expect(
        (typeColumn.cellRenderer as (params: any) => string)({ data: { type: 'Weird' } }),
      ).toBe('Weird');
    });
  });
});
