import {
  Company,
  Driver,
  Individual,
  ModalService,
  NotificationService,
  ResponseStatus,
  Trip,
  TripService,
  TranslationService,
  Vehicle,
} from '@nexus/core';
import { GridApi } from 'ag-grid-community';
import { Subject, of } from 'rxjs';
import { TripsComponent } from './trips.component';
import { GridComponent } from '../shared/grid/grid.component';

describe('TripsComponent', () => {
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let tripChanged$: Subject<void>;
  let tripServiceMock: {
    getAllPaged: ReturnType<typeof vi.fn>;
    tripChanged$: Subject<void>;
    delete: ReturnType<typeof vi.fn>;
    getByDriverId: ReturnType<typeof vi.fn>;
    getByVehicleId: ReturnType<typeof vi.fn>;
    getByBusinessPartnerId: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
  };
  let language$: Subject<string>;
  let translationServiceMock: {
    instant: ReturnType<typeof vi.fn>;
    language$: Subject<string>;
  };

  function createComponent(): TripsComponent {
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    tripChanged$ = new Subject();
    tripServiceMock = {
      getAllPaged: vi.fn(),
      tripChanged$,
      delete: vi.fn(),
      getByDriverId: vi.fn(),
      getByVehicleId: vi.fn(),
      getByBusinessPartnerId: vi.fn(),
      getAll: vi.fn(),
    };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };

    return new TripsComponent(
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      tripServiceMock as unknown as TripService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  function mockGridRef(): GridComponent<Trip> {
    return {
      gridApi: { purgeInfiniteCache: vi.fn() } as unknown as GridApi,
    } as unknown as GridComponent<Trip>;
  }

  beforeEach(() => {
    window.history.pushState({}, '', '/trips');
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('isTopLevelList', () => {
    it('is true for the main trips screen', () => {
      const component = createComponent();
      expect(component.isTopLevelList).toBe(true);
    });

    it('is false when embedded in a driver with an id', () => {
      const component = createComponent();
      component.entity = 'Driver';
      component.parentData = { id: 'd1' } as Driver;
      expect(component.isTopLevelList).toBe(false);
    });

    it('is false when embedded in a vehicle with an id', () => {
      const component = createComponent();
      component.entity = 'Vehicle';
      component.parentData = { id: 'v1' } as Vehicle;
      expect(component.isTopLevelList).toBe(false);
    });

    it('is false when embedded in any other entity with an id', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      expect(component.isTopLevelList).toBe(false);
    });

    it('is true when an entity is set but the parent has no id', () => {
      const component = createComponent();
      component.entity = 'Driver';
      component.parentData = null;
      expect(component.isTopLevelList).toBe(true);
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
    });

    it('top-level: purges the grid cache on tripChanged$, skipping the initial replay', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();

      tripChanged$.next();
      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();

      tripChanged$.next();
      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalledTimes(1);
    });

    it('embedded: reloads trips on every tripChanged$ emission, including the first', () => {
      const component = createComponent();
      component.entity = 'Driver';
      component.parentData = { id: 'd1' } as Driver;
      tripServiceMock.getByDriverId.mockReturnValue(of({ data: [] }));
      component.ngOnInit();

      tripChanged$.next();

      expect(tripServiceMock.getByDriverId).toHaveBeenCalledWith('d1');
    });
  });

  describe('ngOnDestroy', () => {
    it('unsubscribes tripChanged$ and completes the destroy subject', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() => component.ngOnDestroy()).not.toThrow();

      tripChanged$.next();
      expect(tripServiceMock.getAllPaged).not.toHaveBeenCalledWith(
        expect.anything(),
      );
    });

    it('does not throw when called before ngOnInit ever subscribed', () => {
      const component = createComponent();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('openModal', () => {
    it('prefills a new trip with the parent vehicle on add', () => {
      const component = createComponent();
      component.entity = 'Vehicle';
      component.parentData = { id: 'v1', plate: 'ABC1234' } as Vehicle;

      component.openModal({ isEdit: false });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ vehicleId: 'v1', vehiclePlate: 'ABC1234' }),
        }),
      );
    });

    it('prefills a new trip with the parent business partner on add', () => {
      const component = createComponent();
      component.entity = 'Driver';
      component.parentData = { id: 'd1', name: 'Motorista A' } as Driver;

      component.openModal({ isEdit: false });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            businessPartnerId: 'd1',
            businessPartnerName: 'Motorista A',
          }),
        }),
      );
    });

    it('does not overwrite the trip data when editing', () => {
      const component = createComponent();
      component.entity = 'Vehicle';
      component.parentData = { id: 'v1' } as Vehicle;
      const trip = { id: 't1' };

      component.openModal({ isEdit: true, data: trip });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: trip }),
      );
    });

    it('does not prefill when there is no parent data', () => {
      const component = createComponent();

      component.openModal({ isEdit: false });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        { isEdit: false },
      );
    });
  });

  describe('deleteTrip', () => {
    it('top-level: purges the grid cache on success', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      tripServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteTrip({ id: 't1' } as Trip);

      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalled();
      expect(modalServiceMock.hideModal).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Removido',
        ResponseStatus.Success,
      );
    });

    it('embedded: removes the trip from the filtered rows on success', () => {
      const component = createComponent();
      component.entity = 'Driver';
      component.parentData = { id: 'd1' } as Driver;
      component.filteredRowData = [{ id: 't1' } as Trip, { id: 't2' } as Trip];
      tripServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteTrip({ id: 't1' } as Trip);

      expect(component.filteredRowData).toEqual([{ id: 't2' }]);
    });

    it('does not touch rows when the delete reports an error status', () => {
      const component = createComponent();
      component.entity = 'Driver';
      component.parentData = { id: 'd1' } as Driver;
      component.filteredRowData = [{ id: 't1' } as Trip];
      tripServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' }),
      );

      component.deleteTrip({ id: 't1' } as Trip);

      expect(component.filteredRowData).toEqual([{ id: 't1' }]);
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Falhou',
        ResponseStatus.Error,
      );
    });
  });

  describe('refreshTrips', () => {
    it('top-level: just shows a notification', () => {
      const component = createComponent();

      component.refreshTrips();

      expect(tripServiceMock.getAll).not.toHaveBeenCalled();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'TRIPS.TRIPS_REFRESHED',
      );
    });

    it('embedded: reloads trips for the driver and notifies', () => {
      const component = createComponent();
      component.entity = 'Driver';
      component.parentData = { id: 'd1' } as Driver;
      tripServiceMock.getByDriverId.mockReturnValue(of({ data: [] }));

      component.refreshTrips();

      expect(tripServiceMock.getByDriverId).toHaveBeenCalledWith('d1');
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'TRIPS.TRIPS_REFRESHED',
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
      component.entity = 'Driver';
      component.parentData = { id: 'd1' } as Driver;
      component.rowData = [
        { id: 't1', status: 'Open', createDate: '2024-01-01' } as unknown as Trip,
        { id: 't2', status: 'Closed', createDate: '2024-01-02' } as unknown as Trip,
      ];
      component.filterStatus.Open = true;

      component.applyFilters();

      expect(component.filteredRowData.map((t) => t.id)).toEqual(['t1']);
    });

    it('embedded: treats a row with no status as not matching any selected status', () => {
      const component = createComponent();
      component.entity = 'Driver';
      component.parentData = { id: 'd1' } as Driver;
      component.rowData = [{ id: 't1', status: undefined } as unknown as Trip];
      component.filterStatus.Open = true;

      component.applyFilters();

      expect(component.filteredRowData).toEqual([]);
    });

    it('embedded: filters client-side rows by an end date only', () => {
      const component = createComponent();
      component.entity = 'Driver';
      component.parentData = { id: 'd1' } as Driver;
      component.rowData = [
        { id: 't1', createDate: '2024-01-01' } as unknown as Trip,
        { id: 't2', createDate: '2024-02-01' } as unknown as Trip,
      ];
      component.filterEndDate = '2024-01-15';

      component.applyFilters();

      expect(component.filteredRowData.map((t) => t.id)).toEqual(['t1']);
    });

    it('embedded: filters client-side rows by a start/end date range', () => {
      const component = createComponent();
      component.entity = 'Driver';
      component.parentData = { id: 'd1' } as Driver;
      component.rowData = [
        { id: 't1', createDate: '2024-01-01' } as unknown as Trip,
        { id: 't2', createDate: '2024-02-01' } as unknown as Trip,
        { id: 't3', createDate: '2024-03-01' } as unknown as Trip,
      ];
      component.filterStartDate = '2024-01-15';
      component.filterEndDate = '2024-02-15';

      component.applyFilters();

      expect(component.filteredRowData.map((t) => t.id)).toEqual(['t2']);
    });

    it('embedded: excludes rows without a createDate when a date filter is active', () => {
      const component = createComponent();
      component.entity = 'Driver';
      component.parentData = { id: 'd1' } as Driver;
      component.rowData = [
        { id: 't1', createDate: null } as unknown as Trip,
        { id: 't2', createDate: '2024-01-01' } as unknown as Trip,
      ];
      component.filterStartDate = '2024-01-01';

      component.applyFilters();

      expect(component.filteredRowData.map((t) => t.id)).toEqual(['t2']);
    });

    it('clearFilters resets state and reapplies (embedded)', () => {
      const component = createComponent();
      component.entity = 'Driver';
      component.parentData = { id: 'd1' } as Driver;
      component.rowData = [{ id: 't1' } as Trip];
      component.filterStatus.Open = true;

      component.clearFilters();

      expect(component.filterStatus).toEqual({
        Open: false,
        WaitingPayment: false,
        Closed: false,
      });
      expect(component.filteredRowData).toEqual([{ id: 't1' }]);
    });

    it('clearFilters just purges the grid cache (top-level)', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;

      component.clearFilters();

      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalled();
    });
  });

  describe('pagedDataSource', () => {
    it('forwards the active filters to the paged request', () => {
      const component = createComponent();
      component.filterStartDate = '2024-01-01';
      component.filterEndDate = '2024-01-31';
      component.filterStatus.Closed = true;

      component.pagedDataSource({ page: 1, pageSize: 10 });

      expect(tripServiceMock.getAllPaged).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          statuses: ['Closed'],
        }),
      );
    });

    it('omits start/end date when neither filter is set', () => {
      const component = createComponent();

      component.pagedDataSource({ page: 1, pageSize: 10 });

      expect(tripServiceMock.getAllPaged).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: undefined, endDate: undefined }),
      );
    });
  });

  describe('setFiltersFromQueryParams (via ngOnInit)', () => {
    it('reads status and date filters from the URL', () => {
      window.history.pushState(
        {},
        '',
        '/trips?status=Open,Closed&startDate=2024-01-01&endDate=2024-01-31',
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

    it('ignores unknown status values from the URL', () => {
      window.history.pushState({}, '', '/trips?status=Bogus');
      const component = createComponent();

      component.ngOnInit();

      expect(component.filterStatus).toEqual({
        Open: false,
        WaitingPayment: false,
        Closed: false,
      });
    });

    it('leaves filters empty and showFiltersOnInit false with no query params', () => {
      const component = createComponent();

      component.ngOnInit();

      expect(component.showFiltersOnInit).toBe(false);
    });

    it('sets showFiltersOnInit from a status filter alone, with no date range', () => {
      window.history.pushState({}, '', '/trips?status=Open');
      const component = createComponent();

      component.ngOnInit();

      expect(component.showFiltersOnInit).toBe(true);
    });
  });

  describe('getTrips (private, direct call)', () => {
    it('falls back to tripService.getAll() when not scoped to any parent entity', () => {
      const component = createComponent();
      tripServiceMock.getAll.mockReturnValue(of({ data: [] }));

      expect(() => (component as any).getTrips()).not.toThrow();

      expect(tripServiceMock.getAll).toHaveBeenCalled();
      expect(component.loading).toBe(false);
    });
  });

  describe('getTrips (via refreshTrips on embedded views)', () => {
    it('fetches by vehicle when embedded in a vehicle', () => {
      const component = createComponent();
      component.entity = 'Vehicle';
      component.parentData = { id: 'v1' } as Vehicle;
      tripServiceMock.getByVehicleId.mockReturnValue(of({ data: [{ id: 't1' }] }));

      component.refreshTrips();

      expect(tripServiceMock.getByVehicleId).toHaveBeenCalledWith('v1');
      expect(component.rowData).toEqual([{ id: 't1' }]);
      expect(component.loading).toBe(false);
    });

    it('fetches by business partner for any other embedded entity', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.parentData = { id: 'bp1' } as Company;
      tripServiceMock.getByBusinessPartnerId.mockReturnValue(of({ data: [] }));

      component.refreshTrips();

      expect(tripServiceMock.getByBusinessPartnerId).toHaveBeenCalledWith('bp1');
    });

    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      component.entity = 'Driver';
      component.parentData = { id: 'd1' } as Driver;
      tripServiceMock.getByDriverId.mockReturnValue(of({}));

      component.refreshTrips();

      expect(component.rowData).toEqual([]);
    });

    it('stops loading without throwing when the request errors', () => {
      const component = createComponent();
      component.entity = 'Driver';
      component.parentData = { id: 'd1' } as Driver;
      const errorSubject = new Subject<never>();
      tripServiceMock.getByDriverId.mockReturnValue(errorSubject.asObservable());

      component.refreshTrips();
      expect(() => errorSubject.error(new Error('boom'))).not.toThrow();

      expect(component.loading).toBe(false);
    });
  });

  describe('initializeGrid cell renderers', () => {
    function columnByField(component: TripsComponent, field: string) {
      return component.columnDefs.find((c) => c.field === field)!;
    }

    it('renders the trip number and business partner name as links', () => {
      const component = createComponent();
      component.ngOnInit();

      const tripNumberHtml = (columnByField(component, 'tripNumber').cellRenderer as any)({
        value: 'T-1',
      });
      const partnerHtml = (columnByField(component, 'businessPartnerName').cellRenderer as any)({
        value: 'Cliente A',
      });

      expect(tripNumberHtml).toContain('T-1');
      expect(partnerHtml).toContain('Cliente A');
    });

    it('renders an empty link when the cell value is missing', () => {
      const component = createComponent();
      component.ngOnInit();

      const tripNumberHtml = (columnByField(component, 'tripNumber').cellRenderer as any)({
        value: null,
      });
      const partnerHtml = (columnByField(component, 'businessPartnerName').cellRenderer as any)({
        value: null,
      });

      expect(tripNumberHtml).toContain('ag-link');
      expect(partnerHtml).toContain('ag-link');
    });

    it('hides the business partner column when embedded in a business partner', () => {
      const component = createComponent();
      component.entity = 'BusinessPartner';
      component.ngOnInit();

      expect(columnByField(component, 'businessPartnerName').hide).toBe(true);
    });

    it('hides the vehicle plate column when embedded in a vehicle', () => {
      const component = createComponent();
      component.entity = 'Vehicle';
      component.ngOnInit();

      expect(columnByField(component, 'vehiclePlate').hide).toBe(true);
    });

    it('formats total price and date columns', () => {
      const component = createComponent();
      component.ngOnInit();

      const priceHtml = (columnByField(component, 'totalPrice').valueFormatter as any)({
        value: 1234.5,
      });
      const dateHtml = (columnByField(component, 'date').valueFormatter as any)({
        value: '2024-01-15',
      });

      expect(typeof priceHtml).toBe('string');
      expect(typeof dateHtml).toBe('string');
    });

    it.each([
      ['Closed', 'QUOTES.STATUS_CLOSED', 'success'],
      ['Open', 'QUOTES.STATUS_OPEN', 'info'],
      ['WaitingPayment', 'QUOTES.STATUS_WAITING_PAYMENT', 'warning'],
      ['SomethingElse', 'SomethingElse', 'secondary'],
    ])('renders the %s status badge', (value, expectedLabel, expectedColor) => {
      const component = createComponent();
      component.ngOnInit();

      const html = (columnByField(component, 'status').cellRenderer as any)({ value });

      expect(html).toContain(expectedColor);
      expect(html).toContain(expectedLabel);
    });

    it('renders the action buttons column', () => {
      const component = createComponent();
      component.ngOnInit();

      const actionsColumn = component.columnDefs[component.columnDefs.length - 1];
      const html = (actionsColumn.cellRenderer as any)();

      expect(html).toContain('data-action="view"');
      expect(html).toContain('data-action="edit"');
      expect(html).toContain('data-action="delete"');
    });
  });
});
