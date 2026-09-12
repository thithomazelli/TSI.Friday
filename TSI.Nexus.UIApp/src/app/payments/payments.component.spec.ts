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
import { Subject, of } from 'rxjs';
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
  });
});
