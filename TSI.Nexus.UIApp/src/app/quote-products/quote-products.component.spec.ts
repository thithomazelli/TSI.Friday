import { ActivatedRoute } from '@angular/router';
import {
  ModalService,
  NotificationService,
  QuoteProduct,
  QuoteProductService,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';
import { Subject, of } from 'rxjs';
import { QuoteProductsComponent } from './quote-products.component';

describe('QuoteProductsComponent', () => {
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let quoteProductChanged$: Subject<void>;
  let quoteProductServiceMock: {
    quoteProductChanged$: Subject<void>;
    delete: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
    getByEntityId: ReturnType<typeof vi.fn>;
  };
  let language$: Subject<string>;
  let translationServiceMock: {
    instant: ReturnType<typeof vi.fn>;
    language$: Subject<string>;
  };

  function createComponent(): QuoteProductsComponent {
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    quoteProductChanged$ = new Subject();
    quoteProductServiceMock = {
      quoteProductChanged$,
      delete: vi.fn(),
      getAll: vi.fn(),
      getByEntityId: vi.fn(),
    };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };

    return new QuoteProductsComponent(
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      quoteProductServiceMock as unknown as QuoteProductService,
      {} as ActivatedRoute,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds the grid and reacts to language changes', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.columnDefs;

      language$.next('en');

      expect(before.length).toBeGreaterThan(0);
      expect(component.columnDefs).not.toBe(before);
    });

    it('reloads the full list on quoteProductChanged$', () => {
      const component = createComponent();
      quoteProductServiceMock.getAll.mockReturnValue(of({ data: [{ id: 'qp1' }] }));
      component.ngOnInit();

      quoteProductChanged$.next();

      expect(quoteProductServiceMock.getAll).toHaveBeenCalled();
      expect(component.rowData).toEqual([{ id: 'qp1' }]);
    });

    it('stops reloading after ngOnDestroy', () => {
      const component = createComponent();
      component.ngOnInit();
      component.ngOnDestroy();

      quoteProductChanged$.next();

      expect(quoteProductServiceMock.getAll).not.toHaveBeenCalled();
    });
  });

  describe('getQuoteProducts (via ngOnInit trigger)', () => {
    it('does nothing without a parentId when not the full list', () => {
      const component = createComponent();
      component.isFullList = false;
      component.parentId = null;
      component.ngOnInit();

      quoteProductChanged$.next();

      expect(quoteProductServiceMock.getByEntityId).not.toHaveBeenCalled();
    });

    it('fetches by entity id (Order) when scoped and not from the products view', () => {
      const component = createComponent();
      component.isFullList = false;
      component.parentId = 'o1';
      component.isFromProductsView = false;
      quoteProductServiceMock.getByEntityId.mockReturnValue(of({ data: [] }));
      component.ngOnInit();

      quoteProductChanged$.next();

      expect(quoteProductServiceMock.getByEntityId).toHaveBeenCalledWith('o1', 'Order');
    });

    it('fetches by entity id (Product) when scoped from the products view', () => {
      const component = createComponent();
      component.isFullList = false;
      component.parentId = 'p1';
      component.isFromProductsView = true;
      quoteProductServiceMock.getByEntityId.mockReturnValue(of({ data: [] }));
      component.ngOnInit();

      quoteProductChanged$.next();

      expect(quoteProductServiceMock.getByEntityId).toHaveBeenCalledWith('p1', 'Product');
    });
  });

  describe('openModal', () => {
    it('uses the order id from the row data when present', () => {
      const component = createComponent();
      component.parentId = 'fallback';

      component.openModal({ isEdit: true, data: { orderId: 'o1' } });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parentId: 'o1' }),
      );
    });

    it('falls back to the component parentId otherwise', () => {
      const component = createComponent();
      component.parentId = 'fallback';

      component.openModal({ isEdit: false, data: {} });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parentId: 'fallback' }),
      );
    });
  });

  describe('deleteQuoteProduct', () => {
    it('removes the item from the filtered rows and notifies', () => {
      const component = createComponent();
      component.filteredRowData = [{ id: 'qp1' } as QuoteProduct, { id: 'qp2' } as QuoteProduct];
      quoteProductServiceMock.delete.mockReturnValue(of({ message: 'Removido' }));

      component.deleteQuoteProduct({ id: 'qp1' } as QuoteProduct);

      expect(component.filteredRowData).toEqual([{ id: 'qp2' }]);
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        'QUOTES.ITEM_DELETED',
        'Removido',
        'success',
      );
    });
  });

  describe('refreshQuoteProducts', () => {
    it('reloads and notifies on success', () => {
      const component = createComponent();
      component.isFullList = true;
      quoteProductServiceMock.getAll.mockReturnValue(of({ data: [] }));

      component.refreshQuoteProducts();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'QUOTES.QUOTE_PRODUCTS_REFRESHED',
      );
    });
  });

  describe('total price column formatter', () => {
    it('formats a value in BRL', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'totalPrice')!;

      expect((column.valueFormatter as (params: any) => string)({ value: 12.5 })).toBe(
        'R$ 12.50',
      );
    });

    it('falls back to R$ 0,00 for a falsy value', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'totalPrice')!;

      expect((column.valueFormatter as (params: any) => string)({ value: 0 })).toBe('R$ 0,00');
    });
  });
});
