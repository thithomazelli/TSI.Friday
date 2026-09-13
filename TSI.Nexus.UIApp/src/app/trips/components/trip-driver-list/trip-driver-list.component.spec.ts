import {
  ModalService,
  NotificationService,
  ResponseStatus,
  TripDriver,
  TripDriverService,
  TranslationService,
} from '@nexus/core';
import { Subject, of, throwError } from 'rxjs';
import { TripDriverListComponent } from './trip-driver-list.component';

describe('TripDriverListComponent', () => {
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let language$: Subject<string>;
  let translationServiceMock: {
    instant: ReturnType<typeof vi.fn>;
    language$: Subject<string>;
  };
  let tripDriverChanged$: Subject<void>;
  let tripDriverServiceMock: {
    getByTripId: ReturnType<typeof vi.fn>;
    tripDriverChanged$: Subject<void>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createComponent(): TripDriverListComponent {
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };
    tripDriverChanged$ = new Subject();
    tripDriverServiceMock = {
      getByTripId: vi.fn().mockReturnValue(of({ data: [] })),
      tripDriverChanged$,
      delete: vi.fn(),
    };

    return new TripDriverListComponent(
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      translationServiceMock as unknown as TranslationService,
      tripDriverServiceMock as unknown as TripDriverService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds the column defs and loads the drivers', () => {
      const component = createComponent();
      component.tripId = 't1';

      component.ngOnInit();

      expect(component.columnDefs.length).toBeGreaterThan(0);
      expect(tripDriverServiceMock.getByTripId).toHaveBeenCalledWith('t1');
    });

    it('rebuilds the column defs on language change', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.columnDefs;

      language$.next('en');

      expect(component.columnDefs).not.toBe(before);
    });

    it('reloads the drivers whenever tripDriverChanged$ emits', () => {
      const component = createComponent();
      component.tripId = 't1';
      component.ngOnInit();
      tripDriverServiceMock.getByTripId.mockClear();

      tripDriverChanged$.next();

      expect(tripDriverServiceMock.getByTripId).toHaveBeenCalledWith('t1');
    });

    it('stops reacting to language/tripDriverChanged$ after ngOnDestroy', () => {
      const component = createComponent();
      component.tripId = 't1';
      component.ngOnInit();
      component.ngOnDestroy();
      const before = component.columnDefs;
      tripDriverServiceMock.getByTripId.mockClear();

      language$.next('en');
      tripDriverChanged$.next();

      expect(component.columnDefs).toBe(before);
      expect(tripDriverServiceMock.getByTripId).not.toHaveBeenCalled();
    });
  });

  describe('ngOnChanges', () => {
    it('reloads when tripId changes after the first change', () => {
      const component = createComponent();
      component.tripId = 't2';

      component.ngOnChanges({ tripId: { firstChange: false } as any });

      expect(tripDriverServiceMock.getByTripId).toHaveBeenCalledWith('t2');
    });

    it('does not reload on the first change', () => {
      const component = createComponent();
      component.tripId = 't2';

      component.ngOnChanges({ tripId: { firstChange: true } as any });

      expect(tripDriverServiceMock.getByTripId).not.toHaveBeenCalled();
    });

    it('does nothing when tripId is not part of the change set', () => {
      const component = createComponent();

      expect(() => component.ngOnChanges({})).not.toThrow();
      expect(tripDriverServiceMock.getByTripId).not.toHaveBeenCalled();
    });
  });

  describe('openModal', () => {
    it('adds the parentId and parentData to the initial state', () => {
      const component = createComponent();
      component.tripId = 't1';
      component.rowData = [{ id: 'd1' } as TripDriver];

      component.openModal({ isEdit: false });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parentId: 't1', parentData: [{ id: 'd1' }] }),
      );
    });
  });

  describe('refresh', () => {
    it('reloads and shows a success notification', () => {
      const component = createComponent();
      component.tripId = 't1';

      component.refresh();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'TRIPS.DRIVERS_REFRESHED',
      );
    });
  });

  describe('noop', () => {
    it('does nothing', () => {
      const component = createComponent();
      expect(() => component.noop()).not.toThrow();
    });
  });

  describe('deleteTripDriver', () => {
    it('removes the driver from the grid on success', () => {
      const component = createComponent();
      component.rowData = [{ id: 'd1' } as TripDriver, { id: 'd2' } as TripDriver];
      tripDriverServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteTripDriver({ id: 'd1' } as TripDriver);

      expect(component.rowData).toEqual([{ id: 'd2' }]);
      expect(modalServiceMock.hideModal).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Removido',
        ResponseStatus.Success,
      );
    });

    it('does not touch the grid rows when the deletion fails', () => {
      const component = createComponent();
      component.rowData = [{ id: 'd1' } as TripDriver];
      tripDriverServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falha' }),
      );

      component.deleteTripDriver({ id: 'd1' } as TripDriver);

      expect(component.rowData).toEqual([{ id: 'd1' }]);
    });
  });

  describe('load (private, via ngOnInit)', () => {
    it('does nothing when there is no tripId', () => {
      const component = createComponent();
      component.tripId = '' as any;

      component.ngOnInit();

      expect(tripDriverServiceMock.getByTripId).not.toHaveBeenCalled();
      expect(component.loading).toBe(false);
    });

    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      component.tripId = 't1';
      tripDriverServiceMock.getByTripId.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.rowData).toEqual([]);
      expect(component.loading).toBe(false);
    });

    it('stops loading without throwing when the request errors', () => {
      const component = createComponent();
      component.tripId = 't1';
      tripDriverServiceMock.getByTripId.mockReturnValue(throwError(() => new Error('fail')));

      component.ngOnInit();

      expect(component.loading).toBe(false);
    });
  });

  describe('column defs cell renderers', () => {
    it('renders the driverName as a link, falling back to an empty string', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'driverName')!;

      expect((column.cellRenderer as (p: any) => string)({ value: 'João' })).toContain('João');
      expect((column.cellRenderer as (p: any) => string)({ value: null })).toContain('ag-link');
    });

    it('formats driverLicenseExpiryDate as a BR date', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'driverLicenseExpiryDate')!;

      expect(
        (column.valueFormatter as (p: any) => string)({ value: '2024-01-15' } as any),
      ).toContain('/');
    });

    it('formats amount as BRL currency', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'amount')!;

      expect((column.valueFormatter as (p: any) => string)({ value: 100 } as any)).toContain(
        'R$',
      );
    });

    it('renders the actions column buttons', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs[component.columnDefs.length - 1];

      const html = (column.cellRenderer as () => string)();

      expect(html).toContain('data-action="edit"');
      expect(html).toContain('data-action="delete"');
    });
  });
});
