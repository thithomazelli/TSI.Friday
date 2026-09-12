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
import { Subject, of } from 'rxjs';
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
  });

  describe('setFiltersFromQueryParams (via ngOnInit)', () => {
    it('reads filters from the URL', () => {
      window.history.pushState(
        {},
        '',
        '/transactions?status=Approved&type=Incoming&startDate=2024-01-01',
      );
      const component = createComponent();

      component.ngOnInit();

      expect(component.filterStatus.Approved).toBe(true);
      expect(component.filterType.Incoming).toBe(true);
      expect(component.filterStartDate).toBe('2024-01-01');
      expect(component.showFiltersOnInit).toBe(true);
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
  });
});
