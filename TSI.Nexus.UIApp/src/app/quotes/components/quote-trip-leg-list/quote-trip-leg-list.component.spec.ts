import {
  ModalService,
  NotificationService,
  QuoteTripLeg,
  QuoteTripLegService,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';
import { Subject, of, throwError } from 'rxjs';
import { QuoteTripLegListComponent } from './quote-trip-leg-list.component';

describe('QuoteTripLegListComponent', () => {
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
  let quoteTripLegChanged$: Subject<void>;
  let quoteTripLegServiceMock: {
    getByQuoteTrip: ReturnType<typeof vi.fn>;
    quoteTripLegChanged$: Subject<void>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createComponent(): QuoteTripLegListComponent {
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };
    quoteTripLegChanged$ = new Subject();
    quoteTripLegServiceMock = {
      getByQuoteTrip: vi.fn().mockReturnValue(of({ data: [] })),
      quoteTripLegChanged$,
      delete: vi.fn(),
    };

    return new QuoteTripLegListComponent(
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      translationServiceMock as unknown as TranslationService,
      quoteTripLegServiceMock as unknown as QuoteTripLegService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds the column defs and loads the legs', () => {
      const component = createComponent();
      component.quoteTripId = 'qt1';

      component.ngOnInit();

      expect(component.columnDefs.length).toBeGreaterThan(0);
      expect(quoteTripLegServiceMock.getByQuoteTrip).toHaveBeenCalledWith('qt1');
    });

    it('rebuilds the column defs on language change', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.columnDefs;

      language$.next('en');

      expect(component.columnDefs).not.toBe(before);
    });

    it('reloads the legs whenever quoteTripLegChanged$ emits', () => {
      const component = createComponent();
      component.quoteTripId = 'qt1';
      component.ngOnInit();
      quoteTripLegServiceMock.getByQuoteTrip.mockClear();

      quoteTripLegChanged$.next();

      expect(quoteTripLegServiceMock.getByQuoteTrip).toHaveBeenCalledWith('qt1');
    });

    it('stops reacting to language/quoteTripLegChanged$ after ngOnDestroy', () => {
      const component = createComponent();
      component.quoteTripId = 'qt1';
      component.ngOnInit();
      component.ngOnDestroy();
      const before = component.columnDefs;
      quoteTripLegServiceMock.getByQuoteTrip.mockClear();

      language$.next('en');
      quoteTripLegChanged$.next();

      expect(component.columnDefs).toBe(before);
      expect(quoteTripLegServiceMock.getByQuoteTrip).not.toHaveBeenCalled();
    });
  });

  describe('ngOnChanges', () => {
    it('reloads when quoteTripId changes after the first change', () => {
      const component = createComponent();
      component.quoteTripId = 'qt2';

      component.ngOnChanges({
        quoteTripId: { firstChange: false } as any,
      });

      expect(quoteTripLegServiceMock.getByQuoteTrip).toHaveBeenCalledWith('qt2');
    });

    it('does not reload on the first change', () => {
      const component = createComponent();
      component.quoteTripId = 'qt2';

      component.ngOnChanges({
        quoteTripId: { firstChange: true } as any,
      });

      expect(quoteTripLegServiceMock.getByQuoteTrip).not.toHaveBeenCalled();
    });

    it('does nothing when quoteTripId is not part of the change set', () => {
      const component = createComponent();

      expect(() => component.ngOnChanges({})).not.toThrow();
      expect(quoteTripLegServiceMock.getByQuoteTrip).not.toHaveBeenCalled();
    });
  });

  describe('openModal', () => {
    it('adds the quoteTripId and the next sequence number to the initial state', () => {
      const component = createComponent();
      component.quoteTripId = 'qt1';
      component.rowData = [{ id: 'l1' } as QuoteTripLeg, { id: 'l2' } as QuoteTripLeg];

      component.openModal({ isEdit: false });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ quoteTripId: 'qt1', nextSequenceNumber: 3 }),
      );
    });
  });

  describe('refresh', () => {
    it('reloads and shows a success notification', () => {
      const component = createComponent();
      component.quoteTripId = 'qt1';
      quoteTripLegServiceMock.getByQuoteTrip.mockReturnValue(of({ data: [] }));

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

  describe('deleteQuoteTripLeg', () => {
    it('removes the leg from the grid on success', () => {
      const component = createComponent();
      component.rowData = [{ id: 'l1' } as QuoteTripLeg, { id: 'l2' } as QuoteTripLeg];
      quoteTripLegServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteQuoteTripLeg({ id: 'l1' } as QuoteTripLeg);

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
      component.rowData = [{ id: 'l1' } as QuoteTripLeg];
      quoteTripLegServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falha' }),
      );

      component.deleteQuoteTripLeg({ id: 'l1' } as QuoteTripLeg);

      expect(component.rowData).toEqual([{ id: 'l1' }]);
    });
  });

  describe('load (private, via ngOnInit)', () => {
    it('does nothing when there is no quoteTripId', () => {
      const component = createComponent();
      component.quoteTripId = '' as any;

      component.ngOnInit();

      expect(quoteTripLegServiceMock.getByQuoteTrip).not.toHaveBeenCalled();
      expect(component.loading).toBe(false);
    });

    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      component.quoteTripId = 'qt1';
      quoteTripLegServiceMock.getByQuoteTrip.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.rowData).toEqual([]);
      expect(component.loading).toBe(false);
    });

    it('stops loading without throwing when the request errors', () => {
      const component = createComponent();
      component.quoteTripId = 'qt1';
      quoteTripLegServiceMock.getByQuoteTrip.mockReturnValue(
        throwError(() => new Error('fail')),
      );

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
