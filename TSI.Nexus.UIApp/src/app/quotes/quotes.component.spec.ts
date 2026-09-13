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
import { Subject, of, throwError } from 'rxjs';
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

    it('rebuilds the grid on language change', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.columnDefs;

      language$.next('en');

      expect(component.columnDefs).not.toBe(before);
    });
  });

  describe('ngOnDestroy', () => {
    it('does not throw when destroyed before ngOnInit ever subscribed', () => {
      const component = createComponent();

      expect(() => component.ngOnDestroy()).not.toThrow();
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

    it('does not touch the grid/rows when the deletion fails, but still notifies', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      quoteServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falha' }),
      );

      component.deleteQuote({ id: 'q1' } as Quote);

      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Falha',
        ResponseStatus.Error,
      );
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

    it('top-level: clearFilters purges the grid cache without touching filteredRowData', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.filterStatus.Open = true;

      component.clearFilters();

      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalled();
    });

    it('embedded: excludes rows with no createDate when a date filter is active', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      component.rowData = [
        { id: 'q1' } as unknown as Quote,
        { id: 'q2', createDate: '2024-01-01' } as unknown as Quote,
      ];
      component.filterStartDate = '2024-01-01';

      component.applyFilters();

      expect(component.filteredRowData.map((q) => q.id)).toEqual(['q2']);
    });

    it('embedded: filters by start date only', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      component.rowData = [
        { id: 'q1', createDate: '2024-01-01' } as unknown as Quote,
        { id: 'q2', createDate: '2024-02-01' } as unknown as Quote,
      ];
      component.filterStartDate = '2024-01-15';

      component.applyFilters();

      expect(component.filteredRowData.map((q) => q.id)).toEqual(['q2']);
    });

    it('embedded: filters by end date only', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      component.rowData = [
        { id: 'q1', createDate: '2024-01-01' } as unknown as Quote,
        { id: 'q2', createDate: '2024-02-01' } as unknown as Quote,
      ];
      component.filterEndDate = '2024-01-15';

      component.applyFilters();

      expect(component.filteredRowData.map((q) => q.id)).toEqual(['q1']);
    });

    it('embedded: treats a missing status as an empty string when filtering by status', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      component.rowData = [{ id: 'q1' } as unknown as Quote];
      component.filterStatus.Open = true;

      component.applyFilters();

      expect(component.filteredRowData).toEqual([]);
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

  describe('getQuotes (private, via ngOnInit/refreshQuotes)', () => {
    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      quoteServiceMock.getByBusinessPartnerId.mockReturnValue(of({}));

      component.refreshQuotes();

      expect(component.rowData).toEqual([]);
    });

    it('stops loading without throwing when the request errors', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      quoteServiceMock.getByBusinessPartnerId.mockReturnValue(
        throwError(() => new Error('fail')),
      );

      component.refreshQuotes();

      expect(component.loading).toBe(false);
    });

    it('runs without a callback when called directly with none', () => {
      const component = createComponent();
      quoteServiceMock.getAll.mockReturnValue(of({ data: [] }));

      expect(() => (component as any).getQuotes()).not.toThrow();
    });
  });

  describe('setFiltersFromQueryParams (via ngOnInit)', () => {
    it('reads filters from the URL', () => {
      window.history.pushState(
        {},
        '',
        '/quotes?status=Open&startDate=2024-01-01&endDate=2024-01-31',
      );
      const component = createComponent();

      component.ngOnInit();

      expect(component.filterStatus.Open).toBe(true);
      expect(component.filterStartDate).toBe('2024-01-01');
      expect(component.filterEndDate).toBe('2024-01-31');
      expect(component.showFiltersOnInit).toBe(true);
    });

    it('ignores status values that are not known filter keys', () => {
      window.history.pushState({}, '', '/quotes?status=Bogus,Open');
      const component = createComponent();

      component.ngOnInit();

      expect(component.filterStatus.Open).toBe(true);
      expect((component.filterStatus as any).Bogus).toBeUndefined();
    });

    it('sets showFiltersOnInit true when only a status filter is active (no dates)', () => {
      window.history.pushState({}, '', '/quotes?status=Open');
      const component = createComponent();

      component.ngOnInit();

      expect(component.showFiltersOnInit).toBe(true);
    });

    it('leaves showFiltersOnInit false with no query params', () => {
      const component = createComponent();

      component.ngOnInit();

      expect(component.showFiltersOnInit).toBe(false);
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

    it('renders the quoteNumber value as a link, falling back to an empty string', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'quoteNumber')!;

      expect((column.cellRenderer as (p: any) => string)({ value: '123' })).toContain('123');
      expect((column.cellRenderer as (p: any) => string)({ value: null })).toContain('ag-link');
    });

    it('renders the businessPartnerName value as a link, falling back to an empty string', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'businessPartnerName')!;

      expect((column.cellRenderer as (p: any) => string)({ value: 'Cliente A' })).toContain(
        'Cliente A',
      );
      expect((column.cellRenderer as (p: any) => string)({ value: null })).toContain('ag-link');
    });

    it('hides the businessPartnerName column when embedded in a business partner', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'businessPartnerName')!;

      expect(column.hide).toBe(true);
    });

    it('formats totalPrice as BRL currency', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'totalPrice')!;

      expect((column.valueFormatter as (p: any) => string)({ value: 100 } as any)).toContain(
        'R$',
      );
    });

    it('formats date as BR date', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'date')!;

      expect(
        (column.valueFormatter as (p: any) => string)({ value: '2024-01-15' } as any),
      ).toContain('/');
    });

    describe('status column', () => {
      it.each([
        ['Closed', 'success', 'QUOTES.STATUS_CLOSED'],
        ['Open', 'info', 'QUOTES.STATUS_OPEN'],
        ['WaitingPayment', 'warning', 'QUOTES.STATUS_WAITING_PAYMENT'],
      ])('renders status %s with the %s color and translated label', (status, color, label) => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.find((c) => c.headerName === 'COMMON.STATUS')!;

        const html = (column.cellRenderer as (p: any) => string)({ value: status });

        expect(html).toContain(`bg-${color}`);
        expect(html).toContain(label);
      });

      it('falls back to a secondary badge with the raw value for an unknown status', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.find((c) => c.headerName === 'COMMON.STATUS')!;

        const html = (column.cellRenderer as (p: any) => string)({ value: 'Unknown' });

        expect(html).toContain('bg-secondary');
        expect(html).toContain('Unknown');
      });
    });

    it('renders the actions column buttons', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs[component.columnDefs.length - 1];

      const html = (column.cellRenderer as () => string)();

      expect(html).toContain('data-action="view"');
      expect(html).toContain('data-action="edit"');
      expect(html).toContain('data-action="delete"');
    });
  });
});
