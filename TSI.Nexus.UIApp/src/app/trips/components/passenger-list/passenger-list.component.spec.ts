import {
  ModalService,
  NotificationService,
  Passenger,
  PassengerService,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';
import { Subject, of, throwError } from 'rxjs';
import { PassengerListComponent } from './passenger-list.component';

describe('PassengerListComponent', () => {
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let passengerChanged$: Subject<void>;
  let passengerServiceMock: {
    getByTrip: ReturnType<typeof vi.fn>;
    passengerChanged$: Subject<void>;
    delete: ReturnType<typeof vi.fn>;
  };
  let language$: Subject<string>;
  let translationServiceMock: {
    instant: ReturnType<typeof vi.fn>;
    language$: Subject<string>;
  };

  function createComponent(): PassengerListComponent {
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    passengerChanged$ = new Subject();
    passengerServiceMock = {
      getByTrip: vi.fn().mockReturnValue(of({ data: [] })),
      passengerChanged$,
      delete: vi.fn(),
    };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };

    return new PassengerListComponent(
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      passengerServiceMock as unknown as PassengerService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds the column defs and loads the passengers', () => {
      const component = createComponent();
      component.tripId = 't1';

      component.ngOnInit();

      expect(component.columnDefs.length).toBeGreaterThan(0);
      expect(passengerServiceMock.getByTrip).toHaveBeenCalledWith('t1');
    });

    it('rebuilds the column defs on language change', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.columnDefs;

      language$.next('en');

      expect(component.columnDefs).not.toBe(before);
    });

    it('reloads the passengers whenever passengerChanged$ emits', () => {
      const component = createComponent();
      component.tripId = 't1';
      component.ngOnInit();
      passengerServiceMock.getByTrip.mockClear();

      passengerChanged$.next();

      expect(passengerServiceMock.getByTrip).toHaveBeenCalledWith('t1');
    });

    it('stops reacting to language/passengerChanged$ after ngOnDestroy', () => {
      const component = createComponent();
      component.tripId = 't1';
      component.ngOnInit();
      component.ngOnDestroy();
      const before = component.columnDefs;
      passengerServiceMock.getByTrip.mockClear();

      language$.next('en');
      passengerChanged$.next();

      expect(component.columnDefs).toBe(before);
      expect(passengerServiceMock.getByTrip).not.toHaveBeenCalled();
    });
  });

  describe('ngOnChanges', () => {
    it('reloads when tripId changes after the first change', () => {
      const component = createComponent();
      component.tripId = 't2';

      component.ngOnChanges({ tripId: { firstChange: false } as any });

      expect(passengerServiceMock.getByTrip).toHaveBeenCalledWith('t2');
    });

    it('does not reload on the first change', () => {
      const component = createComponent();
      component.tripId = 't2';

      component.ngOnChanges({ tripId: { firstChange: true } as any });

      expect(passengerServiceMock.getByTrip).not.toHaveBeenCalled();
    });

    it('does nothing when tripId is not part of the change set', () => {
      const component = createComponent();

      expect(() => component.ngOnChanges({})).not.toThrow();
      expect(passengerServiceMock.getByTrip).not.toHaveBeenCalled();
    });
  });

  describe('openModal', () => {
    it('adds the tripId to the initial state', () => {
      const component = createComponent();
      component.tripId = 't1';

      component.openModal({ isEdit: false });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ tripId: 't1' }),
      );
    });
  });

  describe('openImportModal', () => {
    it('opens the import modal with the tripId', () => {
      const component = createComponent();
      component.tripId = 't1';

      component.openImportModal();

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        { tripId: 't1' },
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
        'TRIPS.PASSENGERS_REFRESHED',
      );
    });
  });

  describe('noop', () => {
    it('does nothing', () => {
      const component = createComponent();
      expect(() => component.noop()).not.toThrow();
    });
  });

  describe('deletePassenger', () => {
    it('removes the passenger from the grid on success', () => {
      const component = createComponent();
      component.rowData = [{ id: 'p1' } as Passenger, { id: 'p2' } as Passenger];
      passengerServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deletePassenger({ id: 'p1' } as Passenger);

      expect(component.rowData).toEqual([{ id: 'p2' }]);
      expect(modalServiceMock.hideModal).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Removido',
        ResponseStatus.Success,
      );
    });

    it('does not touch the grid rows when the deletion fails', () => {
      const component = createComponent();
      component.rowData = [{ id: 'p1' } as Passenger];
      passengerServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falha' }),
      );

      component.deletePassenger({ id: 'p1' } as Passenger);

      expect(component.rowData).toEqual([{ id: 'p1' }]);
    });
  });

  describe('load (private, via ngOnInit)', () => {
    it('does nothing when there is no tripId', () => {
      const component = createComponent();
      component.tripId = '' as any;

      component.ngOnInit();

      expect(passengerServiceMock.getByTrip).not.toHaveBeenCalled();
      expect(component.loading).toBe(false);
    });

    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      component.tripId = 't1';
      passengerServiceMock.getByTrip.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.rowData).toEqual([]);
      expect(component.loading).toBe(false);
    });

    it('stops loading without throwing when the request errors', () => {
      const component = createComponent();
      component.tripId = 't1';
      passengerServiceMock.getByTrip.mockReturnValue(throwError(() => new Error('fail')));

      component.ngOnInit();

      expect(component.loading).toBe(false);
    });
  });

  describe('column defs cell renderers', () => {
    it('renders the name as a link, falling back to an empty string', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'name')!;

      expect((column.cellRenderer as (p: any) => string)({ value: 'João' })).toContain('João');
      expect((column.cellRenderer as (p: any) => string)({ value: null })).toContain('ag-link');
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
