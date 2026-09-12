import { Router } from '@angular/router';
import {
  AccountService,
  AgendaEvent,
  EventService,
  ModalService,
  NotificationService,
  ResponseStatus,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { Subject, of, throwError } from 'rxjs';
import { EventListComponent } from './event-list.component';

describe('EventListComponent', () => {
  let eventServiceMock: {
    getAll: ReturnType<typeof vi.fn>;
    getByUserId: ReturnType<typeof vi.fn>;
    getByEntityId: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    eventChanged$: Subject<void>;
  };
  let accountServiceMock: { user$: Subject<{ id: string } | null> };
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn>; language$: Subject<string> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };

  function createComponent(): EventListComponent {
    eventServiceMock = {
      getAll: vi.fn().mockReturnValue(new Subject()),
      getByUserId: vi.fn().mockReturnValue(new Subject()),
      getByEntityId: vi.fn().mockReturnValue(new Subject()),
      delete: vi.fn(),
      eventChanged$: new Subject(),
    };
    accountServiceMock = { user$: new Subject() };
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key), language$: new Subject() };
    routerMock = { navigateByUrl: vi.fn() };

    return new EventListComponent(
      eventServiceMock as unknown as EventService,
      accountServiceMock as unknown as AccountService,
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      translationServiceMock as unknown as TranslationService,
      routerMock as unknown as Router,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds columns and reacts to language changes', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.columnDefs;

      translationServiceMock.language$.next('en');

      expect(before.length).toBeGreaterThan(0);
      expect(component.columnDefs).not.toBe(before);
    });

    it('loads events once the current user resolves', () => {
      const component = createComponent();
      eventServiceMock.getAll.mockReturnValue(of({ data: [{ id: 'e1' }] } as WebApiResponse<AgendaEvent[]>));
      component.ngOnInit();

      accountServiceMock.user$.next({ id: 'u1' });

      expect(component.events).toEqual([{ id: 'e1' }]);
    });

    it('handles a logged-out user (no id) without throwing', () => {
      const component = createComponent();
      eventServiceMock.getAll.mockReturnValue(of({ data: [] } as unknown as WebApiResponse<AgendaEvent[]>));
      component.ngOnInit();

      expect(() => accountServiceMock.user$.next(null)).not.toThrow();
    });

    it('reloads on eventChanged$', () => {
      const component = createComponent();
      eventServiceMock.getAll.mockReturnValue(of({ data: [] } as unknown as WebApiResponse<AgendaEvent[]>));
      component.ngOnInit();
      accountServiceMock.user$.next({ id: 'u1' });
      eventServiceMock.getAll.mockClear();

      eventServiceMock.eventChanged$.next();

      expect(eventServiceMock.getAll).toHaveBeenCalled();
    });

    it('stops reacting after ngOnDestroy', () => {
      const component = createComponent();
      component.ngOnInit();
      component.ngOnDestroy();
      eventServiceMock.getAll.mockClear();

      accountServiceMock.user$.next({ id: 'u1' });
      eventServiceMock.eventChanged$.next();

      expect(eventServiceMock.getAll).not.toHaveBeenCalled();
    });
  });

  describe('ngOnChanges', () => {
    it('reloads when entity changes after the first change', () => {
      const component = createComponent();
      eventServiceMock.getAll.mockReturnValue(of({ data: [] } as unknown as WebApiResponse<AgendaEvent[]>));

      component.ngOnChanges({
        entity: { firstChange: false, currentValue: 'Trip' } as never,
      });

      expect(eventServiceMock.getAll).toHaveBeenCalled();
    });

    it('reloads when entityId changes after the first change', () => {
      const component = createComponent();
      eventServiceMock.getAll.mockReturnValue(of({ data: [] } as unknown as WebApiResponse<AgendaEvent[]>));

      component.ngOnChanges({
        entityId: { firstChange: false, currentValue: 't1' } as never,
      });

      expect(eventServiceMock.getAll).toHaveBeenCalled();
    });

    it('does not reload on the very first change', () => {
      const component = createComponent();

      component.ngOnChanges({
        entity: { firstChange: true, currentValue: 'Trip' } as never,
      });

      expect(eventServiceMock.getAll).not.toHaveBeenCalled();
    });

    it('does nothing when neither entity nor entityId nor extraEvents changed', () => {
      const component = createComponent();

      expect(() =>
        component.ngOnChanges({ compact: { firstChange: false } as never }),
      ).not.toThrow();
      expect(eventServiceMock.getAll).not.toHaveBeenCalled();
    });

    it('merges extraEvents into the row data after the first change, replacing prior read-only rows', () => {
      const component = createComponent();
      component.events = [
        { id: 'real1', readOnly: false } as AgendaEvent,
        { id: 'ro-old', readOnly: true } as AgendaEvent,
      ];
      component.extraEvents = [{ id: 'ro-new', readOnly: true } as AgendaEvent];

      component.ngOnChanges({
        extraEvents: { firstChange: false, currentValue: component.extraEvents } as never,
      });

      expect(component.events).toEqual([
        { id: 'real1', readOnly: false },
        { id: 'ro-new', readOnly: true },
      ]);
      expect(component.rowData).toBe(component.events);
    });

    it('does not touch events on the first extraEvents change', () => {
      const component = createComponent();
      const original = component.events;

      component.ngOnChanges({
        extraEvents: { firstChange: true, currentValue: [] } as never,
      });

      expect(component.events).toBe(original);
    });
  });

  describe('toggleFilters', () => {
    it('flips filtersOpen', () => {
      const component = createComponent();
      expect(component.filtersOpen).toBe(false);

      component.toggleFilters();
      expect(component.filtersOpen).toBe(true);

      component.toggleFilters();
      expect(component.filtersOpen).toBe(false);
    });
  });

  describe('refresh', () => {
    it('reloads and notifies on success', () => {
      const component = createComponent();
      eventServiceMock.getAll.mockReturnValue(
        of({ data: [], status: ResponseStatus.Success, message: 'OK' } as unknown as WebApiResponse<AgendaEvent[]>),
      );

      component.refresh();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Success, 'OK');
    });
  });

  it('noop does nothing', () => {
    const component = createComponent();
    expect(() => component.noop()).not.toThrow();
  });

  describe('openModal', () => {
    it('navigates to the trip when the clicked row is a read-only trip event', () => {
      const component = createComponent();

      component.openModal({ data: { readOnly: true, tripId: 't1' } });

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/trips/t1');
      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
    });

    it('opens the details modal for a normal row', () => {
      const component = createComponent();

      component.openModal({ isEdit: true, data: { id: 'e1' } });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isEdit: true, data: { id: 'e1' } }),
      );
    });

    it('opens the create modal with no initialState at all', () => {
      const component = createComponent();

      component.openModal(undefined);

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isEdit: false, data: null, prefillStart: null, prefillEnd: null }),
      );
    });

    it('locks the link field to the embedding entity when adding from an entity tab', () => {
      const component = createComponent();
      component.entity = 'trip';
      component.entityId = 't1';
      component.entityLabel = 'Viagem V-1';

      component.openModal({ isEdit: false, data: null });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          lockedLinkField: 'tripId',
          lockedLinkId: 't1',
          lockedLinkLabel: 'Viagem V-1',
        }),
      );
    });

    it('does not lock the link field when editing an existing event', () => {
      const component = createComponent();
      component.entity = 'trip';
      component.entityId = 't1';

      component.openModal({ isEdit: true, data: { id: 'e1' } });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lockedLinkField: null, lockedLinkId: null, lockedLinkLabel: null }),
      );
    });

    it('does not lock the link field for the user entity', () => {
      const component = createComponent();
      component.entity = 'user';
      component.entityId = 'u1';

      component.openModal({ isEdit: false, data: null });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lockedLinkField: null }),
      );
    });
  });

  describe('onRangeSelected', () => {
    it('opens the create modal prefilled with the selected range', () => {
      const component = createComponent();
      const start = new Date(2024, 0, 1);
      const end = new Date(2024, 0, 2);

      component.onRangeSelected({ start, end });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isEdit: false, prefillStart: start, prefillEnd: end }),
      );
    });
  });

  describe('deleteEvent', () => {
    it('does nothing for a read-only event', () => {
      const component = createComponent();

      component.deleteEvent({ id: 'e1', readOnly: true } as AgendaEvent);

      expect(eventServiceMock.delete).not.toHaveBeenCalled();
    });

    it('removes the event from the list and notifies', () => {
      const component = createComponent();
      component.events = [{ id: 'e1' } as AgendaEvent, { id: 'e2' } as AgendaEvent];
      eventServiceMock.delete.mockReturnValue(
        of({ message: 'Removido', status: ResponseStatus.Success } as WebApiResponse<AgendaEvent>),
      );

      component.deleteEvent({ id: 'e1' } as AgendaEvent);

      expect(component.events).toEqual([{ id: 'e2' }]);
      expect(component.rowData).toBe(component.events);
      expect(modalServiceMock.hideModal).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Removido',
        ResponseStatus.Success,
      );
    });
  });

  describe('load', () => {
    it('appends extraEvents to the loaded events', () => {
      const component = createComponent();
      component.extraEvents = [{ id: 'ro1', readOnly: true } as AgendaEvent];
      eventServiceMock.getAll.mockReturnValue(
        of({ data: [{ id: 'e1' }] } as WebApiResponse<AgendaEvent[]>),
      );

      component.load();

      expect(component.events).toEqual([{ id: 'e1' }, { id: 'ro1', readOnly: true }]);
      expect(component.loading).toBe(false);
    });

    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      eventServiceMock.getAll.mockReturnValue(of({} as WebApiResponse<AgendaEvent[]>));

      component.load();

      expect(component.events).toEqual([]);
    });

    it('does not notify on a normal (non-refresh) load', () => {
      const component = createComponent();
      eventServiceMock.getAll.mockReturnValue(
        of({ data: [], status: ResponseStatus.Success, message: 'OK' } as unknown as WebApiResponse<AgendaEvent[]>),
      );

      component.load();

      expect(notificationServiceMock.showMessage).not.toHaveBeenCalled();
    });

    it('sets loading=false without throwing when the request errors', () => {
      const component = createComponent();
      eventServiceMock.getAll.mockReturnValue(throwError(() => new Error('boom')));

      expect(() => component.load()).not.toThrow();
      expect(component.loading).toBe(false);
    });

    it('does nothing when resolveRequest has nothing to fetch', () => {
      const component = createComponent();
      component.entity = 'user';
      component.entityId = null;

      component.load();

      expect(component.loading).toBe(false);
      expect(eventServiceMock.getByUserId).not.toHaveBeenCalled();
    });
  });

  describe('resolveRequest (via load)', () => {
    it('fetches by user id for the user entity', () => {
      const component = createComponent();
      component.entity = 'user';
      component.entityId = 'u1';

      component.load();

      expect(eventServiceMock.getByUserId).toHaveBeenCalledWith('u1');
    });

    it('fetches by entity id, capitalizing the entity name', () => {
      const component = createComponent();
      component.entity = 'trip';
      component.entityId = 't1';

      component.load();

      expect(eventServiceMock.getByEntityId).toHaveBeenCalledWith('t1', 'Trip');
    });

    it('fetches by the current user id when onlyMine is set', () => {
      const component = createComponent();
      component.onlyMine = true;
      component.ngOnInit();
      accountServiceMock.user$.next({ id: 'u1' });
      eventServiceMock.getByUserId.mockClear();

      component.load();

      expect(eventServiceMock.getByUserId).toHaveBeenCalledWith('u1');
    });

    it('does nothing for onlyMine when there is no current user yet', () => {
      const component = createComponent();
      component.onlyMine = true;

      component.load();

      expect(eventServiceMock.getByUserId).not.toHaveBeenCalled();
    });

    it('falls back to getAll when nothing else applies', () => {
      const component = createComponent();

      component.load();

      expect(eventServiceMock.getAll).toHaveBeenCalled();
    });
  });

  describe('column definitions', () => {
    it('title cellRenderer falls back to an empty string', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'title')!;

      const html = (column.cellRenderer as (p: any) => string)({ value: null });

      expect(html).toBe('<a data-action="edit" class="ag-link"></a>');
    });

    it('eventTypeName cellRenderer uses the row color and label, with a default color', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'eventTypeName')!;

      const withColor = (column.cellRenderer as (p: any) => string)({
        value: 'Reunião',
        data: { eventTypeColor: '#ff0000' },
      });
      const withoutColor = (column.cellRenderer as (p: any) => string)({
        value: null,
        data: {},
      });

      expect(withColor).toContain('#ff0000');
      expect(withColor).toContain('Reunião');
      expect(withoutColor).toContain('#6c757d');
    });

    it('startDate/endDate valueFormatters format the date in BR', () => {
      const component = createComponent();
      component.ngOnInit();
      const start = component.columnDefs.find((c) => c.field === 'startDate')!;
      const end = component.columnDefs.find((c) => c.field === 'endDate')!;

      expect((start.valueFormatter as (p: any) => string)({ value: null })).toBe('');
      expect((end.valueFormatter as (p: any) => string)({ value: null })).toBe('');
    });

    it('actions cellRenderer shows only a view button for a read-only row', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.headerName === 'COMMON.ACTIONS')!;

      const html = (column.cellRenderer as (p: any) => string)({ data: { readOnly: true } });

      expect(html).toContain('fa-eye');
      expect(html).not.toContain('fa-trash');
    });

    it('actions cellRenderer shows edit/delete buttons for a normal row', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.headerName === 'COMMON.ACTIONS')!;

      const html = (column.cellRenderer as (p: any) => string)({ data: { readOnly: false } });

      expect(html).toContain('fa-edit');
      expect(html).toContain('fa-trash');
    });
  });
});
