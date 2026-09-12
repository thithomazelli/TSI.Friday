import {
  Company,
  FeatureFlagService,
  ModalService,
  NotificationService,
  Quote,
  QuoteService,
  QuoteType,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';
import { GridApi } from 'ag-grid-community';
import { Subject, of } from 'rxjs';
import { QuotesComponent } from './quotes.component';
import { GridComponent } from '../shared/grid/grid.component';

describe('QuotesComponent', () => {
  let featureFlagServiceMock: { isEnabled: ReturnType<typeof vi.fn> };
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let quoteChanged$: Subject<void>;
  let quoteServiceMock: {
    getAllPaged: ReturnType<typeof vi.fn>;
    quoteChanged$: Subject<void>;
    delete: ReturnType<typeof vi.fn>;
    getByBusinessPartnerId: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
  };
  let language$: Subject<string>;
  let translationServiceMock: {
    instant: ReturnType<typeof vi.fn>;
    language$: Subject<string>;
  };

  function createComponent(): QuotesComponent {
    featureFlagServiceMock = { isEnabled: vi.fn().mockReturnValue(of(true)) };
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    quoteChanged$ = new Subject();
    quoteServiceMock = {
      getAllPaged: vi.fn(),
      quoteChanged$,
      delete: vi.fn(),
      getByBusinessPartnerId: vi.fn(),
      getAll: vi.fn(),
    };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };

    return new QuotesComponent(
      featureFlagServiceMock as unknown as FeatureFlagService,
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      quoteServiceMock as unknown as QuoteService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  function mockGridRef(): GridComponent<Quote> {
    return {
      gridApi: { purgeInfiniteCache: vi.fn() } as unknown as GridApi,
    } as unknown as GridComponent<Quote>;
  }

  beforeEach(() => {
    window.history.pushState({}, '', '/quotes');
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('isTopLevelList', () => {
    it('is true for the main quotes screen', () => {
      expect(createComponent().isTopLevelList).toBe(true);
    });

    it('is false when embedded in a business partner with an id', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      expect(component.isTopLevelList).toBe(false);
    });
  });

  describe('ngOnInit', () => {
    it('builds the grid and reads the fleet module flag', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.columnDefs.length).toBeGreaterThan(0);
      expect(featureFlagServiceMock.isEnabled).toHaveBeenCalled();
      expect(component.isFleetModuleEnabled).toBe(true);
    });

    it('top-level: purges the grid cache on quoteChanged$, skipping the initial replay', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();

      quoteChanged$.next();
      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();

      quoteChanged$.next();
      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalledTimes(1);
    });

    it('embedded: reloads on every quoteChanged$ emission', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      quoteServiceMock.getByBusinessPartnerId.mockReturnValue(of({ data: [] }));
      component.ngOnInit();

      quoteChanged$.next();

      expect(quoteServiceMock.getByBusinessPartnerId).toHaveBeenCalledWith('bp1');
    });

    it('stops reacting after ngOnDestroy', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();
      component.ngOnDestroy();

      quoteChanged$.next();
      quoteChanged$.next();

      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();
    });
  });

  describe('openModal', () => {
    it('prefills a new quote with the parent business partner', () => {
      const component = createComponent();
      component.parentData = { id: 'bp1', name: 'Cliente A' } as Company;

      component.openModal({ isEdit: false, data: { type: QuoteType.Product } });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            businessPartnerId: 'bp1',
            businessPartnerName: 'Cliente A',
            type: QuoteType.Product,
          }),
        }),
      );
    });
  });

  describe('openNewProductQuoteModal / openNewTripQuoteModal', () => {
    it('opens with the Product type', () => {
      const component = createComponent();
      component.openNewProductQuoteModal();

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining({ type: QuoteType.Product }) }),
      );
    });

    it('opens with the Trip type', () => {
      const component = createComponent();
      component.openNewTripQuoteModal();

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining({ type: QuoteType.Trip }) }),
      );
    });
  });

  describe('deleteQuote', () => {
    it('top-level: purges the grid cache on success', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      quoteServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteQuote({ id: 'q1' } as Quote);

      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalled();
    });

    it('embedded: removes the quote from the filtered rows on success', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      component.filteredRowData = [{ id: 'q1' } as Quote, { id: 'q2' } as Quote];
      quoteServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteQuote({ id: 'q1' } as Quote);

      expect(component.filteredRowData).toEqual([{ id: 'q2' }]);
    });
  });

  describe('refreshQuotes', () => {
    it('top-level: just shows a notification', () => {
      const component = createComponent();

      component.refreshQuotes();

      expect(quoteServiceMock.getAll).not.toHaveBeenCalled();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'QUOTES.QUOTES_REFRESHED',
      );
    });

    it('embedded: reloads quotes for the business partner', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      quoteServiceMock.getByBusinessPartnerId.mockReturnValue(of({ data: [] }));

      component.refreshQuotes();

      expect(quoteServiceMock.getByBusinessPartnerId).toHaveBeenCalledWith('bp1');
    });
  });

  describe('applyFilters / clearFilters', () => {
    it('top-level: applyFilters just purges the grid cache', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;

      component.applyFilters();

      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalled();
    });

    it('embedded: filters client-side rows by status', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      component.rowData = [
        { id: 'q1', status: 'Open', createDate: '2024-01-01' } as unknown as Quote,
        { id: 'q2', status: 'Closed', createDate: '2024-01-02' } as unknown as Quote,
      ];
      component.filterStatus.Open = true;

      component.applyFilters();

      expect(component.filteredRowData.map((q) => q.id)).toEqual(['q1']);
    });

    it('clearFilters resets state', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      component.rowData = [{ id: 'q1' } as Quote];
      component.filterStatus.Open = true;

      component.clearFilters();

      expect(component.filterStatus).toEqual({
        Open: false,
        WaitingPayment: false,
        Closed: false,
      });
      expect(component.filteredRowData).toEqual([{ id: 'q1' }]);
    });
  });

  describe('pagedDataSource', () => {
    it('forwards the active filters', () => {
      const component = createComponent();
      component.filterStatus.Closed = true;

      component.pagedDataSource({ page: 1, pageSize: 10 });

      expect(quoteServiceMock.getAllPaged).toHaveBeenCalledWith(
        expect.objectContaining({ statuses: ['Closed'] }),
      );
    });
  });

  describe('setFiltersFromQueryParams (via ngOnInit)', () => {
    it('reads filters from the URL', () => {
      window.history.pushState({}, '', '/quotes?status=Open&startDate=2024-01-01');
      const component = createComponent();

      component.ngOnInit();

      expect(component.filterStatus.Open).toBe(true);
      expect(component.filterStartDate).toBe('2024-01-01');
      expect(component.showFiltersOnInit).toBe(true);
    });
  });

  describe('column cell renderers', () => {
    it('labels a Trip quote', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'type')!;

      const html = (column.cellRenderer as (params: any) => string)({ value: 'Trip' });

      expect(html).toContain('TRIPS.SINGULAR');
    });

    it('labels a Product quote', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'type')!;

      const html = (column.cellRenderer as (params: any) => string)({ value: 'Product' });

      expect(html).toContain('PRODUCTS.SINGULAR');
    });
  });
});
