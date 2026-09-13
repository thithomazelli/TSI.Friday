import {
  ModalService,
  NotificationService,
  ResponseStatus,
  TripLeg,
  TripLegService,
  TranslationService,
} from '@nexus/core';
import { Subject, of, throwError } from 'rxjs';
import { TripLegListComponent } from './trip-leg-list.component';

describe('TripLegListComponent', () => {
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
  let tripLegChanged$: Subject<void>;
  let tripLegServiceMock: {
    getByTrip: ReturnType<typeof vi.fn>;
    tripLegChanged$: Subject<void>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createComponent(): TripLegListComponent {
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };
    tripLegChanged$ = new Subject();
    tripLegServiceMock = {
      getByTrip: vi.fn().mockReturnValue(of({ data: [] })),
      tripLegChanged$,
      delete: vi.fn(),
    };

    return new TripLegListComponent(
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      translationServiceMock as unknown as TranslationService,
      tripLegServiceMock as unknown as TripLegService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds the column defs and loads the legs', () => {
      const component = createComponent();
      component.tripId = 't1';

      component.ngOnInit();

      expect(component.columnDefs.length).toBeGreaterThan(0);
      expect(tripLegServiceMock.getByTrip).toHaveBeenCalledWith('t1');
    });

    it('rebuilds the column defs on language change', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.columnDefs;

      language$.next('en');

      expect(component.columnDefs).not.toBe(before);
    });

    it('reloads the legs whenever tripLegChanged$ emits', () => {
      const component = createComponent();
      component.tripId = 't1';
      component.ngOnInit();
      tripLegServiceMock.getByTrip.mockClear();

      tripLegChanged$.next();

      expect(tripLegServiceMock.getByTrip).toHaveBeenCalledWith('t1');
    });

    it('stops reacting to language/tripLegChanged$ after ngOnDestroy', () => {
      const component = createComponent();
      component.tripId = 't1';
      component.ngOnInit();
      component.ngOnDestroy();
      const before = component.columnDefs;
      tripLegServiceMock.getByTrip.mockClear();

      language$.next('en');
      tripLegChanged$.next();

      expect(component.columnDefs).toBe(before);
      expect(tripLegServiceMock.getByTrip).not.toHaveBeenCalled();
    });
  });

  describe('ngOnChanges', () => {
    it('reloads when tripId changes after the first change', () => {
      const component = createComponent();
      component.tripId = 't2';

      component.ngOnChanges({ tripId: { firstChange: false } as any });

      expect(tripLegServiceMock.getByTrip).toHaveBeenCalledWith('t2');
    });

    it('does not reload on the first change', () => {
      const component = createComponent();
      component.tripId = 't2';

      component.ngOnChanges({ tripId: { firstChange: true } as any });

      expect(tripLegServiceMock.getByTrip).not.toHaveBeenCalled();
    });

    it('does nothing when tripId is not part of the change set', () => {
      const component = createComponent();

      expect(() => component.ngOnChanges({})).not.toThrow();
      expect(tripLegServiceMock.getByTrip).not.toHaveBeenCalled();
    });
  });

  describe('openModal', () => {
    it('adds the tripId and the next sequence number to the initial state', () => {
      const component = createComponent();
      component.tripId = 't1';
      component.rowData = [{ id: 'l1' } as TripLeg, { id: 'l2' } as TripLeg];

      component.openModal({ isEdit: false });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ tripId: 't1', nextSequenceNumber: 3 }),
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
        'TRIPS.LEGS_REFRESHED',
      );
    });
  });

  describe('noop', () => {
    it('does nothing', () => {
      const component = createComponent();
      expect(() => component.noop()).not.toThrow();
    });
  });

  describe('deleteTripLeg', () => {
    it('removes the leg from the grid on success', () => {
      const component = createComponent();
      component.rowData = [{ id: 'l1' } as TripLeg, { id: 'l2' } as TripLeg];
      tripLegServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteTripLeg({ id: 'l1' } as TripLeg);

      expect(component.rowData).toEqual([{ id: 'l2' }]);
      expect(modalServiceMock.hideModal).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Removido',
        ResponseStatus.Success,
      );
    });

    it('does not touch the grid rows when the deletion fails', () => {
      const component = createComponent();
      component.rowData = [{ id: 'l1' } as TripLeg];
      tripLegServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falha' }),
      );

      component.deleteTripLeg({ id: 'l1' } as TripLeg);

      expect(component.rowData).toEqual([{ id: 'l1' }]);
    });
  });

  describe('load (private, via ngOnInit)', () => {
    it('does nothing when there is no tripId', () => {
      const component = createComponent();
      component.tripId = '' as any;

      component.ngOnInit();

      expect(tripLegServiceMock.getByTrip).not.toHaveBeenCalled();
      expect(component.loading).toBe(false);
    });

    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      component.tripId = 't1';
      tripLegServiceMock.getByTrip.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.rowData).toEqual([]);
      expect(component.loading).toBe(false);
    });

    it('stops loading without throwing when the request errors', () => {
      const component = createComponent();
      component.tripId = 't1';
      tripLegServiceMock.getByTrip.mockReturnValue(throwError(() => new Error('fail')));

      component.ngOnInit();

      expect(component.loading).toBe(false);
    });
  });

  describe('column defs cell renderers', () => {
    it('renders the sequenceNumber as a link, falling back to an empty string', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'sequenceNumber')!;

      expect((column.cellRenderer as (p: any) => string)({ value: 1 })).toContain('1');
      expect((column.cellRenderer as (p: any) => string)({ value: null })).toContain('ag-link');
    });

    it('formats the departureDate as a BR date/time', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'departureDate')!;

      expect(
        (column.valueFormatter as (p: any) => string)({ value: '2024-01-15T10:00:00' } as any),
      ).toContain('/');
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
