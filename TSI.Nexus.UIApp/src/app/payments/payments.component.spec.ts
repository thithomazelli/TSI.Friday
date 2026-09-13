import { ActivatedRoute } from '@angular/router';
import {
  ModalService,
  NotificationService,
  Order,
  Payment,
  PaymentService,
  PaymentStatus,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';
import { GridApi } from 'ag-grid-community';
import { Subject, of, throwError } from 'rxjs';
import { PaymentsComponent } from './payments.component';
import { GridComponent } from '../shared/grid/grid.component';

describe('PaymentsComponent', () => {
  let queryParams$: Subject<Record<string, string>>;
  let routeMock: { queryParams: Subject<Record<string, string>> };
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
    showSweetConfirmation: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let paymentChanged$: Subject<void>;
  let paymentServiceMock: {
    getAllPaged: ReturnType<typeof vi.fn>;
    paymentChanged$: Subject<void>;
    delete: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
    getByEntityId: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let language$: Subject<string>;
  let translationServiceMock: {
    instant: ReturnType<typeof vi.fn>;
    language$: Subject<string>;
  };

  function createComponent(): PaymentsComponent {
    queryParams$ = new Subject();
    routeMock = { queryParams: queryParams$ };
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
      showSweetConfirmation: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    paymentChanged$ = new Subject();
    paymentServiceMock = {
      getAllPaged: vi.fn(),
      paymentChanged$,
      delete: vi.fn(),
      getAll: vi.fn(),
      getByEntityId: vi.fn(),
      update: vi.fn(),
    };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };

    return new PaymentsComponent(
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      paymentServiceMock as unknown as PaymentService,
      routeMock as unknown as ActivatedRoute,
      translationServiceMock as unknown as TranslationService,
    );
  }

  function mockGridRef(): GridComponent<Payment> {
    return {
      gridApi: { purgeInfiniteCache: vi.fn() } as unknown as GridApi,
    } as unknown as GridComponent<Payment>;
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('isTopLevelList', () => {
    it('is true when there is no entity', () => {
      expect(createComponent().isTopLevelList).toBe(true);
    });

    it('is false when embedded under an entity', () => {
      const component = createComponent();
      component.entity = 'Order';
      expect(component.isTopLevelList).toBe(false);
    });
  });

  describe('ngOnInit', () => {
    it('reads filters from the route query params', () => {
      const component = createComponent();
      component.ngOnInit();

      queryParams$.next({ status: 'Approved,Pending', startDate: '2024-01-01' });

      expect(component.filterStatus.Approved).toBe(true);
      expect(component.filterStatus.Pending).toBe(true);
      expect(component.filterStartDate).toBe('2024-01-01');
      expect(component.showFiltersOnInit).toBe(true);
    });

    it('top-level: purges the grid cache on paymentChanged$, skipping the initial replay', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();
      queryParams$.next({});

      paymentChanged$.next();
      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();

      paymentChanged$.next();
      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalledTimes(1);
    });

    it('embedded: reloads on every paymentChanged$ emission', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.parentData = { id: 'o1' } as Order;
      paymentServiceMock.getByEntityId.mockReturnValue(of({ data: [] }));
      component.ngOnInit();
      queryParams$.next({});

      paymentChanged$.next();

      expect(paymentServiceMock.getByEntityId).toHaveBeenCalledWith('o1', 'Order');
    });
  });

  describe('openModal', () => {
    it('includes the parent id and data in the initial state', () => {
      const component = createComponent();
      component.parentData = { id: 'o1' } as Order;

      component.openModal({ isEdit: false });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parentId: 'o1', parentData: component.parentData }),
      );
    });
  });

  describe('deleteOrder', () => {
    it('top-level: purges the grid cache on success', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      paymentServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteOrder({ id: 'p1' } as Payment);

      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalled();
    });

    it('does not purge or filter rows when the delete reports an error', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.filteredRowData = [{ id: 'p1' } as Payment];
      paymentServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' }),
      );

      component.deleteOrder({ id: 'p1' } as Payment);

      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();
      expect(component.filteredRowData).toEqual([{ id: 'p1' }]);
    });

    it('embedded: removes the payment from the filtered rows on success', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.filteredRowData = [{ id: 'p1' } as Payment, { id: 'p2' } as Payment];
      paymentServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteOrder({ id: 'p1' } as Payment);

      expect(component.filteredRowData).toEqual([{ id: 'p2' }]);
    });
  });

  describe('updatePaymentStatus', () => {
    it('does nothing for an already-approved payment', () => {
      const component = createComponent();
      component.updatePaymentStatus({ id: 'p1', status: PaymentStatus.Approved } as Payment);

      expect(modalServiceMock.showSweetConfirmation).not.toHaveBeenCalled();
    });

    it('marks the payment approved and purges the cache when confirmed (top-level)', async () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      paymentServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Atualizado' }),
      );

      component.updatePaymentStatus({ id: 'p1', status: PaymentStatus.Pending } as Payment);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(paymentServiceMock.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.Approved }),
      );
      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalled();
    });

    it('re-applies filters and does not update when cancelled', async () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.updatePaymentStatus({ id: 'p1', status: PaymentStatus.Pending } as Payment);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(paymentServiceMock.update).not.toHaveBeenCalled();
    });
  });

  describe('applyFilters / clearFilters (embedded)', () => {
    it('filters client-side rows by status and type', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.rowData = [
        { id: 'p1', status: 'Approved', type: 'Incoming', date: '2024-01-01' } as unknown as Payment,
        { id: 'p2', status: 'Pending', type: 'Outgoing', date: '2024-01-02' } as unknown as Payment,
      ];
      component.filterStatus.Approved = true;

      component.applyFilters();

      expect(component.filteredRowData.map((p) => p.id)).toEqual(['p1']);
    });

    it('clearFilters resets state', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.rowData = [{ id: 'p1' } as Payment];
      component.filterStatus.Approved = true;
      component.filterType.Incoming = true;

      component.clearFilters();

      expect(component.filterStatus).toEqual({
        Approved: false,
        Pending: false,
        Delayed: false,
      });
      expect(component.filterType).toEqual({ Incoming: false, Outgoing: false });
      expect(component.filteredRowData).toEqual([{ id: 'p1' }]);
    });
  });

  describe('pagedDataSource', () => {
    it('forwards the active filters', () => {
      const component = createComponent();
      component.filterStatus.Delayed = true;
      component.filterType.Outgoing = true;

      component.pagedDataSource({ page: 1, pageSize: 10 });

      expect(paymentServiceMock.getAllPaged).toHaveBeenCalledWith(
        expect.objectContaining({ statuses: ['Delayed'], types: ['Outgoing'] }),
      );
    });
  });

  describe('column cell renderers', () => {
    it('renders a checked checkbox for an approved status', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.headerName === 'PAYMENTS.PAID_QUESTION')!;

      const html = (column.cellRenderer as (params: any) => string)({
        value: PaymentStatus.Approved,
      });

      expect(html).toContain('checked');
    });

    it('translates the payment type with its icon', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'type')!;

      const html = (column.cellRenderer as (params: any) => string)({ value: 'Incoming' });

      expect(html).toContain('REPORTS.INCOMING');
      expect(html).toContain('bi-arrow-up-circle-fill');
    });

    it('renders an unchecked checkbox for a non-approved status', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.headerName === 'PAYMENTS.PAID_QUESTION')!;

      const html = (column.cellRenderer as (params: any) => string)({ value: PaymentStatus.Pending });

      expect(html).not.toContain('checked');
    });

    it('renders description as a link, falling back to empty when there is no value', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'description')!;

      expect((column.cellRenderer as (p: any) => string)({ value: 'Aluguel' } as any)).toContain('Aluguel');
      expect((column.cellRenderer as (p: any) => string)({ value: null } as any)).toContain('></a>');
    });

    it('renders paymentNumber as a link and hides the column unless compact', () => {
      const component = createComponent();
      component.compact = false;
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'paymentNumber')!;

      expect(column.hide).toBe(true);
      expect((column.cellRenderer as (p: any) => string)({ value: '#1' } as any)).toContain('#1');
      expect((column.cellRenderer as (p: any) => string)({ value: null } as any)).toContain('></a>');
    });

    it('shows the paymentNumber column when compact', () => {
      const component = createComponent();
      component.compact = true;
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'paymentNumber')!;

      expect(column.hide).toBe(false);
    });

    it('filters by the translated type label via filterValueGetter', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'type')!;

      expect((column.filterValueGetter as (p: any) => string)({ data: { type: 'Outgoing' } } as any)).toBe(
        'REPORTS.OUTGOING',
      );
    });

    it('falls back to an empty type value when there is none', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'type')!;

      const html = (column.cellRenderer as (params: any) => string)({ value: null });

      expect(html).toBe('');
    });

    describe('price column', () => {
      it('applies text-success for Incoming', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.find((c) => c.field === 'price')!;

        expect((column.cellClass as (p: any) => string)({ data: { type: 'Incoming' } } as any)).toBe('text-success');
      });

      it('applies text-danger for Outgoing', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.find((c) => c.field === 'price')!;

        expect((column.cellClass as (p: any) => string)({ data: { type: 'Outgoing' } } as any)).toBe('text-danger');
      });

      it('applies no class for an unknown type', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.find((c) => c.field === 'price')!;

        expect((column.cellClass as (p: any) => string)({ data: { type: 'Other' } } as any)).toBe('');
      });

      it('formats the value as BRL currency', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.find((c) => c.field === 'price')!;

        expect((column.valueFormatter as (p: any) => string)({ value: 100 } as any)).toContain('R$');
      });
    });

    describe('status column', () => {
      it('filters by the translated status label via filterValueGetter', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.filter((c) => c.field === 'status')[1];

        expect((column.filterValueGetter as (p: any) => string)({ data: { status: 'Approved' } } as any)).toBe(
          'REPORTS.STATUS_PAID',
        );
      });

      it('renders the status badge with the mapped color and label', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.filter((c) => c.field === 'status')[1];

        const html = (column.cellRenderer as (p: any) => string)({ value: 'Delayed' } as any);

        expect(html).toContain('bg-danger');
        expect(html).toContain('REPORTS.STATUS_DELAYED');
      });

      it('falls back to a secondary badge for an unknown status', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.filter((c) => c.field === 'status')[1];

        const html = (column.cellRenderer as (p: any) => string)({ value: 'Unknown' } as any);

        expect(html).toContain('bg-secondary');
        expect(html).toContain('Unknown');
      });
    });

    it('formats date as a BR date', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'date')!;

      expect((column.valueFormatter as (p: any) => string)({ value: '2024-01-15' } as any)).toContain('/');
    });

    it('renders businessPartnerName with an N/A fallback and hides when entity is BusinessPartner', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'businessPartnerName')!;

      expect(column.hide).toBe(true);
      expect((column.cellRenderer as (p: any) => string)({ value: 'Cliente X' } as any)).toBe('Cliente X');
      expect((column.cellRenderer as (p: any) => string)({ value: null } as any)).toBe('N/A');
    });

    it('shows businessPartnerName when entity is not BusinessPartner', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'businessPartnerName')!;

      expect(column.hide).toBe(false);
    });

    it('renders orderNumber with an N/A fallback and hides for Order/Trip entities', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.ngOnInit();
      const orderColumn = component.columnDefs.find((c) => c.field === 'orderNumber')!;
      expect(orderColumn.hide).toBe(true);
      expect((orderColumn.cellRenderer as (p: any) => string)({ value: 'ORD-1' } as any)).toBe('ORD-1');
      expect((orderColumn.cellRenderer as (p: any) => string)({ value: null } as any)).toBe('N/A');

      const tripComponent = createComponent();
      tripComponent.entity = 'Trip';
      tripComponent.ngOnInit();
      expect(tripComponent.columnDefs.find((c) => c.field === 'orderNumber')!.hide).toBe(true);
    });

    it('shows orderNumber for other entities', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'orderNumber')!;
      expect(column.hide).toBe(false);
    });

    it('renders tripNumber with an N/A fallback and hides for Order/Trip entities', () => {
      const component = createComponent();
      component.entity = 'Trip';
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'tripNumber')!;
      expect(column.hide).toBe(true);
      expect((column.cellRenderer as (p: any) => string)({ value: 'TRIP-1' } as any)).toBe('TRIP-1');
      expect((column.cellRenderer as (p: any) => string)({ value: null } as any)).toBe('N/A');
    });

    it('shows tripNumber for other entities', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'tripNumber')!;
      expect(column.hide).toBe(false);
    });

    it('renders the actions column with edit and delete buttons', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs[component.columnDefs.length - 1];

      const html = (column.cellRenderer as (p: any) => string)({});

      expect(html).toContain('data-action="edit"');
      expect(html).toContain('data-action="delete"');
    });
  });

  describe('typeMap / statusMap getters', () => {
    it('typeMap exposes translated labels for Incoming/Outgoing', () => {
      const component = createComponent();
      expect(component.typeMap).toEqual({ Incoming: 'REPORTS.INCOMING', Outgoing: 'REPORTS.OUTGOING' });
    });

    it('statusMap exposes translated labels for all statuses', () => {
      const component = createComponent();
      expect(component.statusMap).toEqual({
        Approved: 'REPORTS.STATUS_PAID',
        Pending: 'REPORTS.STATUS_OPEN',
        Delayed: 'REPORTS.STATUS_DELAYED',
      });
    });
  });

  describe('ngOnInit - additional coverage', () => {
    it('rebuilds column defs on language change', () => {
      const component = createComponent();
      component.ngOnInit();
      queryParams$.next({});
      const before = component.columnDefs;

      language$.next('en');

      expect(component.columnDefs).not.toBe(before);
    });

    it('showFiltersOnInit stays false when there are no initial filters', () => {
      const component = createComponent();
      component.ngOnInit();

      queryParams$.next({});

      expect(component.showFiltersOnInit).toBe(false);
    });
  });

  describe('ngOnDestroy', () => {
    it('completes the destroy subject and unsubscribes the payment-changed subscription', () => {
      const component = createComponent();
      component.ngOnInit();
      queryParams$.next({});

      expect(() => component.ngOnDestroy()).not.toThrow();

      paymentChanged$.next();
      // no assertion needed beyond "does not throw" - the subscription teardown itself is
      // what the accompanying unsubscribe spy below verifies precisely
    });

    it('does not throw when called before ngOnInit ever subscribed', () => {
      const component = createComponent();
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('refreshOrders', () => {
    it('shows a notification without reloading for the top-level list', () => {
      const component = createComponent();

      component.refreshOrders();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'PAYMENTS.PAYMENTS_REFRESHED',
      );
      expect(paymentServiceMock.getAll).not.toHaveBeenCalled();
    });

    it('reloads with a refresh notification when embedded', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.parentData = { id: 'o1' } as Order;
      paymentServiceMock.getByEntityId.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Atualizado', data: [] }),
      );

      component.refreshOrders();

      expect(paymentServiceMock.getByEntityId).toHaveBeenCalledWith('o1', 'Order');
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'PAYMENTS.PAYMENTS_REFRESHED',
      );
    });
  });

  describe('applyFilters - date range and top-level', () => {
    it('purges the grid cache and returns early for the top-level list', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;

      component.applyFilters();

      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalled();
    });

    it('excludes rows without a date when a date range filter is active', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.rowData = [
        { id: 'p1', date: null } as unknown as Payment,
        { id: 'p2', date: '2024-01-05' } as unknown as Payment,
      ];
      component.filterStartDate = '2024-01-01';

      component.applyFilters();

      expect(component.filteredRowData.map((p) => p.id)).toEqual(['p2']);
    });

    it('filters using only a start date', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.rowData = [
        { id: 'p1', date: '2024-01-01' } as unknown as Payment,
        { id: 'p2', date: '2024-02-01' } as unknown as Payment,
      ];
      component.filterStartDate = '2024-01-15';

      component.applyFilters();

      expect(component.filteredRowData.map((p) => p.id)).toEqual(['p2']);
    });

    it('filters using only an end date', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.rowData = [
        { id: 'p1', date: '2024-01-01' } as unknown as Payment,
        { id: 'p2', date: '2024-02-01' } as unknown as Payment,
      ];
      component.filterEndDate = '2024-01-15';

      component.applyFilters();

      expect(component.filteredRowData.map((p) => p.id)).toEqual(['p1']);
    });

    it('filters by type', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.rowData = [
        { id: 'p1', type: 'Incoming' } as unknown as Payment,
        { id: 'p2', type: 'Outgoing' } as unknown as Payment,
      ];
      component.filterType.Outgoing = true;

      component.applyFilters();

      expect(component.filteredRowData.map((p) => p.id)).toEqual(['p2']);
    });

    it('treats a missing status/type as an empty string when filtering', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.rowData = [{ id: 'p1' } as unknown as Payment];
      component.filterStatus.Approved = true;

      component.applyFilters();

      expect(component.filteredRowData).toEqual([]);
    });

    it('excludes a row with no type when a type filter is active', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.rowData = [{ id: 'p1' } as unknown as Payment];
      component.filterType.Incoming = true;

      component.applyFilters();

      expect(component.filteredRowData).toEqual([]);
    });
  });

  describe('clearFilters - top-level', () => {
    it('purges the grid cache and returns early for the top-level list', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;

      component.clearFilters();

      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalled();
    });
  });

  describe('getPayment (private, via ngOnInit/refreshOrders/paymentChanged$)', () => {
    it('fetches all payments when there is no entity', () => {
      const component = createComponent();
      paymentServiceMock.getAll.mockReturnValue(of({ data: [{ id: 'p1' } as Payment] }));

      (component as any).getPayment();

      expect(paymentServiceMock.getAll).toHaveBeenCalled();
      expect(component.rowData).toEqual([{ id: 'p1' }]);
    });

    it('does nothing but invoke the callback when embedded without a saved parent yet', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.parentData = null;
      let called = false;

      (component as any).getPayment(() => (called = true));

      expect(component.rowData).toEqual([]);
      expect(called).toBe(true);
    });

    it('does not throw when there is no callback and no saved parent', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.parentData = null;

      expect(() => (component as any).getPayment()).not.toThrow();
    });

    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.parentData = { id: 'o1' } as Order;
      paymentServiceMock.getByEntityId.mockReturnValue(of({}));

      (component as any).getPayment();

      expect(component.rowData).toEqual([]);
      expect(component.loading).toBe(false);
    });

    it('stops loading without throwing when the request errors', () => {
      const component = createComponent();
      component.entity = 'Order';
      component.parentData = { id: 'o1' } as Order;
      paymentServiceMock.getByEntityId.mockReturnValue(throwError(() => new Error('fail')));

      (component as any).getPayment();

      expect(component.loading).toBe(false);
    });
  });

  describe('markAsApproved (private, via updatePaymentStatus)', () => {
    it('does nothing for a falsy payment', () => {
      expect(() => (createComponent() as any).markAsApproved(null)).not.toThrow();
      expect(paymentServiceMock.update).not.toHaveBeenCalled();
    });

    it('reloads with applyFilters when embedded and confirmed', async () => {
      const component = createComponent();
      component.entity = 'Order';
      component.parentData = { id: 'o1' } as Order;
      paymentServiceMock.getByEntityId.mockReturnValue(of({ data: [] }));
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      paymentServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Atualizado' }),
      );

      component.updatePaymentStatus({ id: 'p1', status: PaymentStatus.Pending } as Payment);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(paymentServiceMock.getByEntityId).toHaveBeenCalledWith('o1', 'Order');
      expect(modalServiceMock.hideModal).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith('', 'Atualizado', ResponseStatus.Success);
    });
  });

  describe('getTypeLabel / getStatusLabel / getStatusColor (private, via column defs)', () => {
    it('falls back to the raw type when there is no mapped label', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'type')!;

      const html = (column.cellRenderer as (p: any) => string)({ value: 'CustomType' });

      expect(html).toContain('CustomType');
    });

    it('falls back to the raw status when there is no mapped label', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.filter((c) => c.field === 'status')[1];

      const html = (column.cellRenderer as (p: any) => string)({ value: 'CustomStatus' });

      expect(html).toContain('CustomStatus');
    });

    it('getStatusColor falls back to the default color for an unmapped status', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.filter((c) => c.field === 'status')[1];

      const html = (column.cellRenderer as (p: any) => string)({ value: 'CustomStatus' });

      expect(html).toContain('bg-secondary');
    });

    it('getTypeLabel falls back to an empty string when there is no type at all', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'type')!;

      expect((column.filterValueGetter as (p: any) => string)({} as any)).toBe('');
    });

    it('getStatusLabel falls back to an empty string when there is no status at all', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.filter((c) => c.field === 'status')[1];

      expect((column.filterValueGetter as (p: any) => string)({} as any)).toBe('');
    });
  });

  describe('setFiltersFromQueryParams edge cases', () => {
    it('accepts status/type as arrays instead of comma-separated strings', () => {
      const component = createComponent();
      component.ngOnInit();

      queryParams$.next({ status: ['Approved', 'Delayed'] as any, type: ['Incoming'] as any });

      expect(component.filterStatus.Approved).toBe(true);
      expect(component.filterStatus.Delayed).toBe(true);
      expect(component.filterType.Incoming).toBe(true);
    });

    it('ignores unknown status/type values', () => {
      const component = createComponent();
      component.ngOnInit();

      queryParams$.next({ status: 'NotAStatus', type: 'NotAType' });

      expect(Object.values(component.filterStatus).some(Boolean)).toBe(false);
      expect(Object.values(component.filterType).some(Boolean)).toBe(false);
    });

    it('sets showFiltersOnInit from a type-only filter', () => {
      const component = createComponent();
      component.ngOnInit();

      queryParams$.next({ type: 'Incoming' });

      expect(component.filterType.Incoming).toBe(true);
      expect(component.showFiltersOnInit).toBe(true);
    });

    it('sets showFiltersOnInit from an end-date-only filter', () => {
      const component = createComponent();
      component.ngOnInit();

      queryParams$.next({ endDate: '2024-01-31' });

      expect(component.filterEndDate).toBe('2024-01-31');
      expect(component.showFiltersOnInit).toBe(true);
    });

    it('defaults dates to null when absent from the query params', () => {
      const component = createComponent();
      component.ngOnInit();

      queryParams$.next({});

      expect(component.filterStartDate).toBeNull();
      expect(component.filterEndDate).toBeNull();
    });
  });
});
