import { ChangeDetectorRef } from '@angular/core';
import {
  Company,
  ModalService,
  NotificationService,
  Order,
  OrderService,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';
import { GridApi } from 'ag-grid-community';
import { Subject, of } from 'rxjs';
import { OrdersComponent } from './orders.component';
import { GridComponent } from '../shared/grid/grid.component';

describe('OrdersComponent', () => {
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let orderChanged$: Subject<void>;
  let orderServiceMock: {
    getAllPaged: ReturnType<typeof vi.fn>;
    orderChanged$: Subject<void>;
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

  function createComponent(): OrdersComponent {
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    orderChanged$ = new Subject();
    orderServiceMock = {
      getAllPaged: vi.fn(),
      orderChanged$,
      delete: vi.fn(),
      getByBusinessPartnerId: vi.fn(),
      getAll: vi.fn(),
    };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };
    cdrMock = { markForCheck: vi.fn() };

    return new OrdersComponent(
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      orderServiceMock as unknown as OrderService,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  function mockGridRef(): GridComponent<Order> {
    return {
      gridApi: { purgeInfiniteCache: vi.fn() } as unknown as GridApi,
    } as unknown as GridComponent<Order>;
  }

  beforeEach(() => {
    window.history.pushState({}, '', '/orders');
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('isTopLevelList', () => {
    it('is true for the main orders screen', () => {
      const component = createComponent();
      expect(component.isTopLevelList).toBe(true);
    });

    it('is false when embedded in a business partner with an id', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
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

    it('top-level: purges the grid cache on orderChanged$, skipping the initial replay', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();

      orderChanged$.next();
      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();

      orderChanged$.next();
      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalledTimes(1);
    });

    it('embedded: reloads orders on every orderChanged$ emission, including the first', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      orderServiceMock.getByBusinessPartnerId.mockReturnValue(of({ data: [] }));
      component.ngOnInit();

      orderChanged$.next();

      expect(orderServiceMock.getByBusinessPartnerId).toHaveBeenCalledWith('bp1');
    });
  });

  describe('openModal', () => {
    it('prefills a new order with the parent business partner on add', () => {
      const component = createComponent();
      component.parentData = { id: 'bp1', name: 'Cliente A' } as Company;

      component.openModal({ isEdit: false });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            businessPartnerId: 'bp1',
            businessPartnerName: 'Cliente A',
          }),
        }),
      );
    });

    it('does not overwrite the order data when editing', () => {
      const component = createComponent();
      component.parentData = { id: 'bp1', name: 'Cliente A' } as Company;
      const order = { id: 'o1' };

      component.openModal({ isEdit: true, data: order });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: order }),
      );
    });
  });

  describe('deleteOrder', () => {
    it('top-level: purges the grid cache on success', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      orderServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteOrder({ id: 'o1' } as Order);

      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalled();
    });

    it('embedded: removes the order from the filtered rows on success', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      component.filteredRowData = [{ id: 'o1' } as Order, { id: 'o2' } as Order];
      orderServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteOrder({ id: 'o1' } as Order);

      expect(component.filteredRowData).toEqual([{ id: 'o2' }]);
    });
  });

  describe('refreshOrders', () => {
    it('top-level: just shows a notification', () => {
      const component = createComponent();

      component.refreshOrders();

      expect(orderServiceMock.getAll).not.toHaveBeenCalled();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'ORDERS.ORDERS_REFRESHED',
      );
    });

    it('embedded: reloads orders for the business partner', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      orderServiceMock.getByBusinessPartnerId.mockReturnValue(of({ data: [] }));

      component.refreshOrders();

      expect(orderServiceMock.getByBusinessPartnerId).toHaveBeenCalledWith('bp1');
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'ORDERS.ORDERS_REFRESHED',
      );
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
        { id: 'o1', status: 'Open', createDate: '2024-01-01' } as unknown as Order,
        { id: 'o2', status: 'Closed', createDate: '2024-01-02' } as unknown as Order,
      ];
      component.filterStatus.Open = true;

      component.applyFilters();

      expect(component.filteredRowData.map((o) => o.id)).toEqual(['o1']);
    });

    it('embedded: filters client-side rows by date range', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      component.rowData = [
        { id: 'o1', createDate: '2024-01-01' } as unknown as Order,
        { id: 'o2', createDate: '2024-02-01' } as unknown as Order,
      ];
      component.filterStartDate = '2024-01-15';

      component.applyFilters();

      expect(component.filteredRowData.map((o) => o.id)).toEqual(['o2']);
    });

    it('clearFilters resets state and reapplies (embedded)', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      component.rowData = [{ id: 'o1' } as Order];
      component.filterStatus.Open = true;

      component.clearFilters();

      expect(component.filterStatus).toEqual({
        Open: false,
        WaitingPayment: false,
        Closed: false,
      });
      expect(component.filteredRowData).toEqual([{ id: 'o1' }]);
    });
  });

  describe('pagedDataSource', () => {
    it('forwards the active filters to the paged request', () => {
      const component = createComponent();
      component.filterStartDate = '2024-01-01';
      component.filterEndDate = '2024-01-31';
      component.filterStatus.Closed = true;

      component.pagedDataSource({ page: 1, pageSize: 10 });

      expect(orderServiceMock.getAllPaged).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          statuses: ['Closed'],
        }),
      );
    });
  });

  describe('setFiltersFromQueryParams (via ngOnInit)', () => {
    it('reads status and date filters from the URL', () => {
      window.history.pushState(
        {},
        '',
        '/orders?status=Open,Closed&startDate=2024-01-01&endDate=2024-01-31',
      );
      const component = createComponent();

      component.ngOnInit();

      expect(component.filterStatus.Open).toBe(true);
      expect(component.filterStatus.Closed).toBe(true);
      expect(component.filterStatus.WaitingPayment).toBe(false);
      expect(component.filterStartDate).toBe('2024-01-01');
      expect(component.filterEndDate).toBe('2024-01-31');
      expect(component.showFiltersOnInit).toBe(true);
    });

    it('leaves filters empty and showFiltersOnInit false with no query params', () => {
      const component = createComponent();

      component.ngOnInit();

      expect(component.showFiltersOnInit).toBe(false);
    });
  });
});
