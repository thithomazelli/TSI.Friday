import { ChangeDetectorRef } from '@angular/core';
import {
  ModalService,
  NotificationService,
  ResponseStatus,
  Transaction,
  TransactionService,
  TranslationService,
} from '@nexus/core';
import { GridApi } from 'ag-grid-community';
import { Subject, of, throwError } from 'rxjs';
import { TransactionsComponent } from './transactions.component';
import { GridComponent } from '../shared/grid/grid.component';

describe('TransactionsComponent', () => {
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let transactionChanged$: Subject<void>;
  let transactionServiceMock: {
    getAllPaged: ReturnType<typeof vi.fn>;
    transactionChanged$: Subject<void>;
    delete: ReturnType<typeof vi.fn>;
    getByBusinessPartnerId: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
  };
  let language$: Subject<string>;
  let translationServiceMock: {
    instant: ReturnType<typeof vi.fn>;
    language$: Subject<string>;
  };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  function createComponent(): TransactionsComponent {
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    transactionChanged$ = new Subject();
    transactionServiceMock = {
      getAllPaged: vi.fn(),
      transactionChanged$,
      delete: vi.fn(),
      getByBusinessPartnerId: vi.fn(),
      getAll: vi.fn(),
    };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };
    cdrMock = { markForCheck: vi.fn() };

    return new TransactionsComponent(
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      transactionServiceMock as unknown as TransactionService,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  function mockGridRef(): GridComponent<Transaction> {
    return {
      gridApi: { purgeInfiniteCache: vi.fn() } as unknown as GridApi,
    } as unknown as GridComponent<Transaction>;
  }

  beforeEach(() => {
    window.history.pushState({}, '', '/transactions');
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('isTopLevelList', () => {
    it('is true for the main transactions screen', () => {
      expect(createComponent().isTopLevelList).toBe(true);
    });

    it('is false when embedded under a parent with an id', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' };
      expect(component.isTopLevelList).toBe(false);
    });
  });

  describe('ngOnInit', () => {
    it('builds the grid and reacts to language changes', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.columnDefs;

      language$.next('en');

      expect(before.length).toBeGreaterThan(0);
      expect(component.columnDefs).not.toBe(before);
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('top-level: purges the grid cache on transactionChanged$, skipping the initial replay', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();

      transactionChanged$.next();
      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();

      transactionChanged$.next();
      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalledTimes(1);
    });

    it('embedded: reloads on every transactionChanged$ emission', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' };
      transactionServiceMock.getByBusinessPartnerId.mockReturnValue(of({ data: [] }));
      component.ngOnInit();

      transactionChanged$.next();

      expect(transactionServiceMock.getByBusinessPartnerId).toHaveBeenCalledWith('bp1');
    });

    it('stops reacting after ngOnDestroy', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();
      component.ngOnDestroy();

      transactionChanged$.next();
      transactionChanged$.next();

      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('does not throw when destroyed before ngOnInit ever subscribed', () => {
      const component = createComponent();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('typeMap / conditionMap / statusMap getters', () => {
    it('exposes translated labels', () => {
      const component = createComponent();

      expect(component.typeMap).toEqual({ Incoming: 'REPORTS.INCOMING', Outgoing: 'REPORTS.OUTGOING' });
      expect(component.conditionMap).toEqual({
        FullPayment: 'TRANSACTIONS.FULL_PAYMENT',
        InPayments: 'TRANSACTIONS.IN_PAYMENTS',
      });
      expect(component.statusMap).toEqual({
        Approved: 'REPORTS.STATUS_PAID',
        Pending: 'REPORTS.STATUS_OPEN',
        Delayed: 'REPORTS.STATUS_DELAYED',
      });
    });
  });

  describe('openModal', () => {
    it('opens the transaction details modal', () => {
      const component = createComponent();
      component.openModal({ isEdit: false });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        { isEdit: false },
      );
    });
  });

  describe('deleteTransaction', () => {
    it('top-level: purges the grid cache on success', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      transactionServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteTransaction({ id: 't1' } as Transaction);

      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalled();
    });

    it('embedded: removes the transaction from the filtered rows on success', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' };
      component.filteredRowData = [{ id: 't1' } as Transaction, { id: 't2' } as Transaction];
      transactionServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteTransaction({ id: 't1' } as Transaction);

      expect(component.filteredRowData).toEqual([{ id: 't2' }]);
    });

    it('does not touch the grid/rows when the deletion fails, but still notifies', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      transactionServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falha' }),
      );

      component.deleteTransaction({ id: 't1' } as Transaction);

      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Falha',
        ResponseStatus.Error,
      );
    });
  });

  describe('refreshTransactions', () => {
    it('top-level: just shows a notification', () => {
      const component = createComponent();

      component.refreshTransactions();

      expect(transactionServiceMock.getAll).not.toHaveBeenCalled();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'TRANSACTIONS.TRANSACTIONS_REFRESHED',
      );
    });

    it('embedded: reloads transactions for the business partner', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' };
      transactionServiceMock.getByBusinessPartnerId.mockReturnValue(of({ data: [] }));

      component.refreshTransactions();

      expect(transactionServiceMock.getByBusinessPartnerId).toHaveBeenCalledWith('bp1');
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

    it('embedded: filters client-side rows by status and type', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' };
      component.rowData = [
        { id: 't1', status: 'Approved', type: 'Incoming', date: '2024-01-01' } as unknown as Transaction,
        { id: 't2', status: 'Pending', type: 'Outgoing', date: '2024-01-02' } as unknown as Transaction,
      ];
      component.filterStatus.Approved = true;

      component.applyFilters();

      expect(component.filteredRowData.map((t) => t.id)).toEqual(['t1']);
    });

    it('clearFilters resets state', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' };
      component.rowData = [{ id: 't1' } as Transaction];
      component.filterStatus.Approved = true;
      component.filterType.Incoming = true;

      component.clearFilters();

      expect(component.filterStatus).toEqual({
        Approved: false,
        Pending: false,
        Delayed: false,
      });
      expect(component.filterType).toEqual({ Incoming: false, Outgoing: false });
      expect(component.filteredRowData).toEqual([{ id: 't1' }]);
    });

    it('top-level: clearFilters purges the grid cache without touching filteredRowData', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.filterStatus.Approved = true;

      component.clearFilters();

      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalled();
    });

    it('embedded: excludes rows with no date when a date filter is active', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' };
      component.rowData = [
        { id: 't1' } as unknown as Transaction,
        { id: 't2', date: '2024-01-01' } as unknown as Transaction,
      ];
      component.filterStartDate = '2024-01-01';

      component.applyFilters();

      expect(component.filteredRowData.map((t) => t.id)).toEqual(['t2']);
    });

    it('embedded: filters by start date only', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' };
      component.rowData = [
        { id: 't1', date: '2024-01-01' } as unknown as Transaction,
        { id: 't2', date: '2024-02-01' } as unknown as Transaction,
      ];
      component.filterStartDate = '2024-01-15';

      component.applyFilters();

      expect(component.filteredRowData.map((t) => t.id)).toEqual(['t2']);
    });

    it('embedded: filters by end date only', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' };
      component.rowData = [
        { id: 't1', date: '2024-01-01' } as unknown as Transaction,
        { id: 't2', date: '2024-02-01' } as unknown as Transaction,
      ];
      component.filterEndDate = '2024-01-15';

      component.applyFilters();

      expect(component.filteredRowData.map((t) => t.id)).toEqual(['t1']);
    });

    it('embedded: treats a missing status as an empty string when filtering by status', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' };
      component.rowData = [{ id: 't1' } as unknown as Transaction];
      component.filterStatus.Approved = true;

      component.applyFilters();

      expect(component.filteredRowData).toEqual([]);
    });

    it('embedded: filters by type', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' };
      component.rowData = [
        { id: 't1', type: 'Incoming' } as unknown as Transaction,
        { id: 't2', type: 'Outgoing' } as unknown as Transaction,
      ];
      component.filterType.Incoming = true;

      component.applyFilters();

      expect(component.filteredRowData.map((t) => t.id)).toEqual(['t1']);
    });

    it('embedded: treats a missing type as an empty string when filtering by type', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' };
      component.rowData = [{ id: 't1' } as unknown as Transaction];
      component.filterType.Incoming = true;

      component.applyFilters();

      expect(component.filteredRowData).toEqual([]);
    });
  });

  describe('getTransactions (private, via ngOnInit/refreshTransactions)', () => {
    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' };
      transactionServiceMock.getByBusinessPartnerId.mockReturnValue(of({}));

      component.refreshTransactions();

      expect(component.rowData).toEqual([]);
    });

    it('stops loading without throwing when the request errors', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' };
      transactionServiceMock.getByBusinessPartnerId.mockReturnValue(
        throwError(() => new Error('fail')),
      );

      component.refreshTransactions();

      expect(component.loading).toBe(false);
    });

    it('runs without a callback when called directly with none', () => {
      const component = createComponent();
      transactionServiceMock.getAll.mockReturnValue(of({ data: [] }));

      expect(() => (component as any).getTransactions()).not.toThrow();
    });
  });

  describe('pagedDataSource', () => {
    it('forwards the active status filters', () => {
      const component = createComponent();
      component.filterStatus.Delayed = true;

      component.pagedDataSource({ page: 1, pageSize: 10 });

      expect(transactionServiceMock.getAllPaged).toHaveBeenCalledWith(
        expect.objectContaining({ statuses: ['Delayed'] }),
      );
    });

    it('falls back to undefined dates when no date filter is set', () => {
      const component = createComponent();

      component.pagedDataSource({ page: 1, pageSize: 10 });

      expect(transactionServiceMock.getAllPaged).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: undefined, endDate: undefined, statuses: [] }),
      );
    });
  });

  describe('setFiltersFromQueryParams (via ngOnInit)', () => {
    it('reads filters from the URL', () => {
      window.history.pushState(
        {},
        '',
        '/transactions?status=Approved&type=Incoming&startDate=2024-01-01&endDate=2024-01-31',
      );
      const component = createComponent();

      component.ngOnInit();

      expect(component.filterStatus.Approved).toBe(true);
      expect(component.filterType.Incoming).toBe(true);
      expect(component.filterStartDate).toBe('2024-01-01');
      expect(component.filterEndDate).toBe('2024-01-31');
      expect(component.showFiltersOnInit).toBe(true);
    });

    it('ignores status/type values that are not known filter keys', () => {
      window.history.pushState({}, '', '/transactions?status=Bogus,Approved&type=Bogus,Incoming');
      const component = createComponent();

      component.ngOnInit();

      expect(component.filterStatus.Approved).toBe(true);
      expect(component.filterType.Incoming).toBe(true);
      expect((component.filterStatus as any).Bogus).toBeUndefined();
      expect((component.filterType as any).Bogus).toBeUndefined();
    });

    it('sets showFiltersOnInit true when only a type filter is active', () => {
      window.history.pushState({}, '', '/transactions?type=Incoming');
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

  describe('column value formatters', () => {
    it('translates a known condition and falls back to the raw value otherwise', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'condition')!;

      expect((column.valueFormatter as (params: any) => string)({ value: 'FullPayment' })).toBe(
        'TRANSACTIONS.FULL_PAYMENT',
      );
      expect((column.valueFormatter as (params: any) => string)({ value: 'Weird' })).toBe(
        'Weird',
      );
    });

    it('falls back to an empty string when the condition is missing entirely', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'condition')!;

      expect((column.valueFormatter as (params: any) => string)({ value: null })).toBe('');
    });

    it('resolves the condition filterValueGetter from the row data', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'condition')!;

      expect(
        (column.filterValueGetter as (p: any) => string)({ data: { condition: 'InPayments' } }),
      ).toBe('TRANSACTIONS.IN_PAYMENTS');
    });

    it('colors the status badge based on the status', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find(
        (c) => c.field === 'status' && c.cellRenderer,
      )!;

      const html = (column.cellRenderer as (params: any) => string)({ value: 'Delayed' });

      expect(html).toContain('bg-danger');
      expect(html).toContain('REPORTS.STATUS_DELAYED');
    });

    it('falls back to the raw value and default color for an unknown status', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'status')!;

      const html = (column.cellRenderer as (params: any) => string)({ value: 'Weird' });

      expect(html).toContain('bg-secondary');
      expect(html).toContain('Weird');
    });

    it('resolves the status filterValueGetter from the row data', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'status')!;

      expect(
        (column.filterValueGetter as (p: any) => string)({ data: { status: 'Approved' } }),
      ).toBe('REPORTS.STATUS_PAID');
    });

    it('renders the description as a link, falling back to an empty string', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'description')!;

      expect((column.cellRenderer as (p: any) => string)({ value: 'Desc' })).toContain('Desc');
      expect((column.cellRenderer as (p: any) => string)({ value: null })).toContain('ag-link');
    });

    it('applies a success/danger cell class to positive payment/expense values, none otherwise', () => {
      const component = createComponent();
      component.ngOnInit();
      const paymentColumn = component.columnDefs.find((c) => c.field === 'paymentTotalPrice')!;
      const expenseColumn = component.columnDefs.find((c) => c.field === 'expenseTotalPrice')!;

      expect((paymentColumn.cellClass as (p: any) => string)({ value: 10 })).toBe('text-success');
      expect((paymentColumn.cellClass as (p: any) => string)({ value: 0 })).toBe('');
      expect((expenseColumn.cellClass as (p: any) => string)({ value: 10 })).toBe('text-danger');
      expect((expenseColumn.cellClass as (p: any) => string)({ value: 0 })).toBe('');
      expect(
        (paymentColumn.valueFormatter as (p: any) => string)({ value: 10 } as any),
      ).toContain('R$');
      expect(
        (expenseColumn.valueFormatter as (p: any) => string)({ value: 10 } as any),
      ).toContain('R$');
    });

    it('falls back to an empty string for a completely missing status', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'status')!;

      const html = (column.cellRenderer as (params: any) => string)({ value: undefined });

      expect(html).toContain('bg-secondary');
      expect(html).not.toContain('undefined');
    });

    it('formats date as a BR date', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'date')!;

      expect(
        (column.valueFormatter as (p: any) => string)({ value: '2024-01-15' } as any),
      ).toContain('/');
    });

    it('renders businessPartnerName, falling back to N/A, and hides the column when embedded', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'businessPartnerName')!;

      expect(column.hide).toBe(true);
      expect((column.cellRenderer as (p: any) => string)({ value: 'Cliente A' })).toBe(
        'Cliente A',
      );
      expect((column.cellRenderer as (p: any) => string)({ value: null })).toBe('N/A');
    });

    it('renders orderNumber, falling back to N/A', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'orderNumber')!;

      expect((column.cellRenderer as (p: any) => string)({ value: '123' })).toBe('123');
      expect((column.cellRenderer as (p: any) => string)({ value: null })).toBe('N/A');
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
