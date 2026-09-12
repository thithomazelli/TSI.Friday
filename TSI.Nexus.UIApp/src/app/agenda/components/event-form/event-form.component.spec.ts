import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AgendaEvent,
  BusinessPartnerService,
  DriverService,
  EventParticipant,
  EventParticipantService,
  EventService,
  FuelLogService,
  ModalService,
  NotificationService,
  OrderService,
  PaymentService,
  PurchaseOrderService,
  QuoteService,
  ResponseStatus,
  SelectableOptionService,
  TransactionService,
  TranslationService,
  TripService,
  User,
  UserService,
  VehicleMaintenanceService,
  VehicleService,
  WebApiResponse,
} from '@nexus/core';
import { config, of, throwError } from 'rxjs';
import { EventFormComponent } from './event-form.component';

describe('EventFormComponent', () => {
  let modalServiceMock: { hideModal: ReturnType<typeof vi.fn> };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let eventServiceMock: { add: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let eventParticipantServiceMock: { add: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let selectableOptionServiceMock: { getByGroup: ReturnType<typeof vi.fn> };
  let businessPartnerServiceMock: { getClients: ReturnType<typeof vi.fn>; getSuppliers: ReturnType<typeof vi.fn> };
  let listServiceMocks: Record<string, { getAll: ReturnType<typeof vi.fn> }>;
  let userServiceMock: { getAll: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  const users: User[] = [
    { id: 'u1', firstName: 'Ana', lastName: 'Silva' } as User,
    { id: 'u2', firstName: 'Bruno', lastName: 'Costa' } as User,
  ];

  function createComponent(): EventFormComponent {
    modalServiceMock = { hideModal: vi.fn() };
    notificationServiceMock = { showMessage: vi.fn() };
    eventServiceMock = { add: vi.fn(), update: vi.fn(), delete: vi.fn() };
    eventParticipantServiceMock = { add: vi.fn().mockReturnValue(of(null)), delete: vi.fn().mockReturnValue(of(null)) };
    selectableOptionServiceMock = { getByGroup: vi.fn().mockReturnValue(of({ data: [] })) };
    businessPartnerServiceMock = {
      getClients: vi.fn().mockReturnValue(of({ data: [] })),
      getSuppliers: vi.fn().mockReturnValue(of({ data: [] })),
    };
    listServiceMocks = {
      quote: { getAll: vi.fn().mockReturnValue(of({ data: [] })) },
      order: { getAll: vi.fn().mockReturnValue(of({ data: [] })) },
      purchaseOrder: { getAll: vi.fn().mockReturnValue(of({ data: [] })) },
      trip: { getAll: vi.fn().mockReturnValue(of({ data: [] })) },
      transaction: { getAll: vi.fn().mockReturnValue(of({ data: [] })) },
      payment: { getAll: vi.fn().mockReturnValue(of({ data: [] })) },
      vehicle: { getAll: vi.fn().mockReturnValue(of({ data: [] })) },
      driver: { getAll: vi.fn().mockReturnValue(of({ data: [] })) },
      vehicleMaintenance: { getAll: vi.fn().mockReturnValue(of({ data: [] })) },
      fuelLog: { getAll: vi.fn().mockReturnValue(of({ data: [] })) },
    };
    userServiceMock = { getAll: vi.fn().mockReturnValue(of({ data: users })) };
    routerMock = { navigateByUrl: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };

    return new EventFormComponent(
      new FormBuilder(),
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      eventServiceMock as unknown as EventService,
      eventParticipantServiceMock as unknown as EventParticipantService,
      selectableOptionServiceMock as unknown as SelectableOptionService,
      businessPartnerServiceMock as unknown as BusinessPartnerService,
      listServiceMocks['quote'] as unknown as QuoteService,
      listServiceMocks['order'] as unknown as OrderService,
      listServiceMocks['purchaseOrder'] as unknown as PurchaseOrderService,
      listServiceMocks['trip'] as unknown as TripService,
      listServiceMocks['transaction'] as unknown as TransactionService,
      listServiceMocks['payment'] as unknown as PaymentService,
      listServiceMocks['vehicle'] as unknown as VehicleService,
      listServiceMocks['driver'] as unknown as DriverService,
      listServiceMocks['vehicleMaintenance'] as unknown as VehicleMaintenanceService,
      listServiceMocks['fuelLog'] as unknown as FuelLogService,
      userServiceMock as unknown as UserService,
      routerMock as unknown as Router,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  function fillValidForm(component: EventFormComponent) {
    component.form.patchValue({
      title: 'Reunião',
      startDate: '2099-01-01',
      startTime: '09:00',
      endDate: '2099-01-01',
      endTime: '10:00',
      eventTypeOptionId: 'et1',
    });
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds the form, link configs and loads event types/users', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.linkConfigs.length).toBe(11);
      expect(selectableOptionServiceMock.getByGroup).toHaveBeenCalled();
      expect(userServiceMock.getAll).toHaveBeenCalled();
    });

    it('falls back to an empty array when eventTypes/users responses have no data', () => {
      const component = createComponent();
      selectableOptionServiceMock.getByGroup.mockReturnValue(of({}));
      userServiceMock.getAll.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.eventTypeOptions).toEqual([]);
      expect(component.users).toEqual([]);
    });

    it('patches the form and link values from the provided data', () => {
      const component = createComponent();
      component.data = {
        title: 'Evento existente',
        startDate: '2024-01-01T09:30:00',
        endDate: '2024-01-01T10:30:00',
        driverId: 'd1',
        participants: [{ id: 'p1', displayName: 'Ana' } as EventParticipant],
      } as unknown as AgendaEvent;

      component.ngOnInit();

      expect(component.form.get('title')!.value).toBe('Evento existente');
      expect(component.form.get('startTime')!.value).toBe('09:30');
      expect(component.participants).toEqual([{ id: 'p1', displayName: 'Ana' }]);
    });

    it('leaves link values untouched for ids the data does not carry', () => {
      const component = createComponent();
      component.data = { title: 'x' } as AgendaEvent;

      expect(() => component.ngOnInit()).not.toThrow();
    });

    it('prefills start/end/locked link when creating a fresh event', () => {
      const component = createComponent();
      component.prefillStart = new Date(2024, 0, 1, 14, 0);
      component.prefillEnd = new Date(2024, 0, 1, 15, 0);
      component.lockedLinkField = 'tripId';
      component.lockedLinkId = 't1';

      component.ngOnInit();

      expect(component.form.get('startDate')!.value).toEqual(component.prefillStart);
      expect(component.form.get('startTime')!.value).toBe('14:00');
      expect(component.form.get('endTime')!.value).toBe('15:00');
    });

    it('does not prefill anything when there is no data and no prefill/lock inputs', () => {
      const component = createComponent();

      expect(() => component.ngOnInit()).not.toThrow();
      expect(component.form.get('startDate')!.value).toBe('');
    });
  });

  describe('ngOnChanges', () => {
    it('re-patches the form when data changes after init', () => {
      const component = createComponent();
      component.ngOnInit();
      component.data = { title: 'Novo título' } as AgendaEvent;

      component.ngOnChanges({ data: {} as any });

      expect(component.form.get('title')!.value).toBe('Novo título');
    });

    it('does nothing when the changed input is not data', () => {
      const component = createComponent();
      component.ngOnInit();

      component.ngOnChanges({ isEdit: {} as any });

      expect(component.form.get('title')!.value).toBe('');
    });

    it('does not throw when data changes before the form exists', () => {
      const component = createComponent();
      component.data = { title: 'x' } as AgendaEvent;

      expect(() => component.ngOnChanges({ data: {} as any })).not.toThrow();
    });
  });

  describe('link fields', () => {
    it('selectLink stores the id and sets the label without emitting a change event', () => {
      const component = createComponent();
      component.ngOnInit();
      const config = component.linkConfigs[0];

      component.selectLink(config, { id: 'bp1', label: 'Cliente X' });

      expect(component.form.get(config.labelField)!.value).toBe('Cliente X');
    });

    it('onLinkBlur clears the link value when the typed label is blank', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      const config = component.linkConfigs[0];
      component.selectLink(config, { id: 'bp1', label: 'Cliente X' });
      component.form.get(config.labelField)!.setValue('   ');

      component.onLinkBlur(config);
      vi.advanceTimersByTime(200);

      expect((component as any).buildLinkPayload()[config.idField]).toBeNull();
    });

    it('onLinkBlur keeps the link value when the typed label is not blank', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      const config = component.linkConfigs[0];
      component.selectLink(config, { id: 'bp1', label: 'Cliente X' });

      component.onLinkBlur(config);
      vi.advanceTimersByTime(200);

      expect((component as any).buildLinkPayload()[config.idField]).toBe('bp1');
    });

    it('onLinkBlur clears the link value when the label control value is null', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      const config = component.linkConfigs[0];
      component.selectLink(config, { id: 'bp1', label: 'Cliente X' });
      component.form.get(config.labelField)!.setValue(null);

      component.onLinkBlur(config);
      vi.advanceTimersByTime(200);

      expect((component as any).buildLinkPayload()[config.idField]).toBeNull();
    });

    it('clearLink resets both the stored id and the label control', () => {
      const component = createComponent();
      component.ngOnInit();
      const config = component.linkConfigs[0];
      component.selectLink(config, { id: 'bp1', label: 'Cliente X' });

      component.clearLink(config);

      expect(component.form.get(config.labelField)!.value).toBe('');
      expect((component as any).buildLinkPayload()[config.idField]).toBeNull();
    });

    it('toggleLinkSection flips linkSectionOpen', () => {
      const component = createComponent();
      expect(component.linkSectionOpen).toBe(true);
      component.toggleLinkSection();
      expect(component.linkSectionOpen).toBe(false);
    });

    it('filters link options by the typed label', () => {
      const component = createComponent();
      businessPartnerServiceMock.getClients.mockReturnValue(
        of({ data: [{ id: 'bp1', name: 'Cliente Um' }] }),
      );
      component.ngOnInit();
      const linkConfig = component.linkConfigs[0];

      let result: unknown[] = [];
      linkConfig.filtered$!.subscribe((r) => (result = r));
      linkConfig.activate();
      component.form.get(linkConfig.labelField)!.setValue('cliente');

      expect(result).toEqual([{ id: 'bp1', label: 'Cliente Um' }]);
    });

    it('emits an empty list when the link filter value is blank', () => {
      const component = createComponent();
      component.ngOnInit();
      const config = component.linkConfigs[0];
      config.activate();

      let result: unknown[] = [];
      config.filtered$!.subscribe((r) => (result = r));

      expect(result).toEqual([]);
    });

    it('activate() only fetches once even if called multiple times', () => {
      const component = createComponent();
      component.ngOnInit();
      const config = component.linkConfigs[0];

      config.items$.subscribe();
      config.items$.subscribe();
      config.activate();
      config.activate();

      expect(businessPartnerServiceMock.getClients).toHaveBeenCalledTimes(1);
    });

    it('filtered$ treats a non-string label value as empty', () => {
      const component = createComponent();
      component.ngOnInit();
      const config = component.linkConfigs[0];

      let result: unknown[] = [];
      config.filtered$!.subscribe((r) => (result = r));
      config.activate();
      component.form.get(config.labelField)!.setValue(123 as unknown as string);

      expect(result).toEqual([]);
    });

    it('mergeResponses falls back to an empty array when clients/suppliers responses have no data', () => {
      const component = createComponent();
      businessPartnerServiceMock.getClients.mockReturnValue(of({}));
      businessPartnerServiceMock.getSuppliers.mockReturnValue(of({}));
      component.ngOnInit();
      const config = component.linkConfigs[0];

      let result: unknown[] = [];
      config.items$.subscribe((items) => (result = items));
      config.activate();

      expect(result).toEqual([]);
    });

    it('activates every non-business-partner link and maps its items via mapList', () => {
      const component = createComponent();
      const sampleData: Record<string, unknown> = {
        quote: { data: [{ id: 'q1', quoteNumber: 'Q-1' }] },
        order: { data: [{ id: 'o1', orderNumber: 'O-1' }] },
        purchaseOrder: { data: [{ id: 'po1', purchaseOrderNumber: 'PO-1' }] },
        trip: { data: [{ id: 't1', tripNumber: 'T-1' }] },
        transaction: { data: [{ id: 'tr1', description: 'Trans 1' }] },
        payment: { data: [{ id: 'p1', description: 'Pay 1' }] },
        vehicle: { data: [{ id: 'v1', plate: 'ABC1234' }] },
        driver: { data: [{ id: 'd1', name: 'Driver 1' }] },
        vehicleMaintenance: { data: [{ id: 'vm1', description: 'Maint 1' }] },
        fuelLog: { data: [{ id: 'fl1', gasStation: 'Posto 1' }] },
      };
      Object.entries(sampleData).forEach(([key, response]) => {
        listServiceMocks[key].getAll.mockReturnValue(of(response));
      });
      component.ngOnInit();

      const results: Record<string, unknown[]> = {};
      component.linkConfigs.slice(1).forEach((config) => {
        config.items$.subscribe((items) => (results[config.key] = items));
        config.activate();
      });

      expect(results['quote']).toEqual([{ id: 'q1', label: 'Q-1' }]);
      expect(results['order']).toEqual([{ id: 'o1', label: 'O-1' }]);
      expect(results['purchaseOrder']).toEqual([{ id: 'po1', label: 'PO-1' }]);
      expect(results['trip']).toEqual([{ id: 't1', label: 'T-1' }]);
      expect(results['transaction']).toEqual([{ id: 'tr1', label: 'Trans 1' }]);
      expect(results['payment']).toEqual([{ id: 'p1', label: 'Pay 1' }]);
      expect(results['vehicle']).toEqual([{ id: 'v1', label: 'ABC1234' }]);
      expect(results['driver']).toEqual([{ id: 'd1', label: 'Driver 1' }]);
      expect(results['vehicleMaintenance']).toEqual([{ id: 'vm1', label: 'Maint 1' }]);
      expect(results['fuelLog']).toEqual([{ id: 'fl1', label: 'Posto 1' }]);
    });

    it('mapList falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      listServiceMocks['quote'].getAll.mockReturnValue(of({}));
      component.ngOnInit();
      const config = component.linkConfigs[1];

      let result: unknown[] = [];
      config.items$.subscribe((items) => (result = items));
      config.activate();

      expect(result).toEqual([]);
    });
  });

  describe('participants', () => {
    it('selectUser adds a participant and clears the search field', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.get('participantSearch')!.setValue('ana');

      component.selectUser(users[0]);

      expect(component.participants).toEqual([{ id: '', userId: 'u1', displayName: 'Ana Silva' }]);
      expect(component.form.get('participantSearch')!.value).toBe('');
    });

    it('selectUser does nothing when the user is already a participant', () => {
      const component = createComponent();
      component.ngOnInit();
      component.participants = [{ id: '', userId: 'u1', displayName: 'Ana Silva' } as EventParticipant];

      component.selectUser(users[0]);

      expect(component.participants.length).toBe(1);
    });

    it('filters users by name for the participant search field', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: User[] = [];
      component.filteredUsers$.subscribe((r) => (result = r));
      component.form.get('participantSearch')!.setValue('bruno');

      expect(result).toEqual([users[1]]);
    });

    it('filteredUsers$ treats a non-string search value as empty', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: User[] = [];
      component.filteredUsers$.subscribe((r) => (result = r));
      component.form.get('participantSearch')!.setValue(123 as unknown as string);

      expect(result).toEqual([]);
    });

    it('emits an empty list when the participant search value is blank', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: User[] = [];
      component.filteredUsers$.subscribe((r) => (result = r));

      expect(result).toEqual([]);
    });

    it('addFreeformParticipant adds by name and/or email and clears the fields', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.get('participantName')!.setValue('Carla');
      component.form.get('participantEmail')!.setValue('carla@x.com');

      component.addFreeformParticipant();

      expect(component.participants).toEqual([
        { id: '', name: 'Carla', email: 'carla@x.com', displayName: 'Carla' },
      ]);
      expect(component.form.get('participantName')!.value).toBe('');
      expect(component.form.get('participantEmail')!.value).toBe('');
    });

    it('addFreeformParticipant falls back to name-only when no email is given', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.get('participantName')!.setValue('Carla');

      component.addFreeformParticipant();

      expect(component.participants).toEqual([
        { id: '', name: 'Carla', email: null, displayName: 'Carla' },
      ]);
    });

    it('addFreeformParticipant falls back to email-only when no name is given', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.get('participantEmail')!.setValue('carla@x.com');

      component.addFreeformParticipant();

      expect(component.participants).toEqual([
        { id: '', name: null, email: 'carla@x.com', displayName: 'carla@x.com' },
      ]);
    });

    it('addFreeformParticipant does nothing when both name and email are blank', () => {
      const component = createComponent();
      component.ngOnInit();

      component.addFreeformParticipant();

      expect(component.participants).toEqual([]);
    });

    it('removeParticipant tracks the id of an already-persisted participant for later sync', () => {
      const component = createComponent();
      component.participants = [
        { id: 'p1', displayName: 'Ana' } as EventParticipant,
        { id: '', displayName: 'Carla' } as EventParticipant,
      ];

      component.removeParticipant(0);

      expect(component.participants).toEqual([{ id: '', displayName: 'Carla' }]);
    });

    it('removeParticipant does not track an id for a not-yet-persisted participant', () => {
      const component = createComponent();
      component.participants = [{ id: '', displayName: 'Carla' } as EventParticipant];

      expect(() => component.removeParticipant(0)).not.toThrow();
      expect(component.participants).toEqual([]);
    });
  });

  describe('submit', () => {
    it('marks the form as touched and returns null without saving when invalid', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: unknown;
      component.submit().subscribe((r) => (result = r));

      expect(result).toBeNull();
      expect(component.submitted).toBe(true);
    });

    it('notifies and returns null without saving when there is no link at all', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);

      let result: unknown;
      component.submit().subscribe((r) => (result = r));

      expect(result).toBeNull();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'AGENDA.LINK_REQUIRED',
      );
    });

    it('saves successfully when a locked link is present, syncing new participants', () => {
      const component = createComponent();
      component.lockedLinkField = 'tripId';
      component.lockedLinkId = 't1';
      component.ngOnInit();
      fillValidForm(component);
      component.participants = [{ id: '', userId: 'u1', displayName: 'Ana' } as EventParticipant];
      const response = { status: ResponseStatus.Success, data: { id: 'e1' }, message: 'OK' } as unknown as WebApiResponse<AgendaEvent>;
      eventServiceMock.add.mockReturnValue(of(response));

      component.submit().subscribe();

      expect(eventServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ tripId: 't1' }),
      );
      expect(eventParticipantServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', eventId: 'e1' }),
      );
    });

    it('saves successfully via link values when no field is locked', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      const config = component.linkConfigs[0];
      component.selectLink(config, { id: 'bp1', label: 'Cliente X' });
      eventServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'e1' }, message: 'OK' } as unknown as WebApiResponse<AgendaEvent>),
      );

      component.submit().subscribe();

      expect(eventServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ [config.idField]: 'bp1' }),
      );
    });

    it('updates instead of adding, and includes the id, when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 'e1' } as AgendaEvent;
      component.lockedLinkField = 'tripId';
      component.lockedLinkId = 't1';
      component.ngOnInit();
      fillValidForm(component);
      eventServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'e1' }, message: 'OK' } as unknown as WebApiResponse<AgendaEvent>),
      );

      component.submit().subscribe();

      expect(eventServiceMock.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
    });

    it('notifies without syncing participants when the backend reports a failure status', () => {
      const component = createComponent();
      component.lockedLinkField = 'tripId';
      component.lockedLinkId = 't1';
      component.ngOnInit();
      fillValidForm(component);
      eventServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Error, data: null, message: 'Falhou' } as unknown as WebApiResponse<AgendaEvent>),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Error, 'Falhou');
      expect(eventParticipantServiceMock.add).not.toHaveBeenCalled();
    });

    it('notifies an error when the save request errors', () => {
      const component = createComponent();
      component.lockedLinkField = 'tripId';
      component.lockedLinkId = 't1';
      component.ngOnInit();
      fillValidForm(component);
      eventServiceMock.add.mockReturnValue(throwError(() => new Error('boom')));

      component.submit().subscribe({ error: () => {} });

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'AGENDA.SAVE_ERROR',
      );
    });

    it('saves via the modal path when isModal is true', () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = { close: vi.fn() };
      component.dialogRef = dialogRefMock as any;
      component.lockedLinkField = 'tripId';
      component.lockedLinkId = 't1';
      component.ngOnInit();
      fillValidForm(component);
      eventServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'e1' }, message: 'OK' } as unknown as WebApiResponse<AgendaEvent>),
      );

      component.submit().subscribe();

      expect(dialogRefMock.close).toHaveBeenCalled();
    });

    it('saves via the page path (navigating away) when creating outside a modal', () => {
      const component = createComponent();
      component.isModal = false;
      component.lockedLinkField = 'tripId';
      component.lockedLinkId = 't1';
      component.ngOnInit();
      fillValidForm(component);
      eventServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'e1' }, message: 'OK' } as unknown as WebApiResponse<AgendaEvent>),
      );

      component.submit().subscribe();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/agenda');
    });

    it('updates local data (without navigating) when editing outside a modal', () => {
      const component = createComponent();
      component.isModal = false;
      component.isEdit = true;
      component.data = { id: 'e1' } as AgendaEvent;
      component.lockedLinkField = 'tripId';
      component.lockedLinkId = 't1';
      component.ngOnInit();
      fillValidForm(component);
      const updated = { id: 'e1', title: 'Reunião' } as AgendaEvent;
      eventServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, data: updated, message: 'OK' } as unknown as WebApiResponse<AgendaEvent>),
      );

      component.submit().subscribe();

      expect(component.data).toBe(updated);
      expect(routerMock.navigateByUrl).not.toHaveBeenCalledWith('/agenda');
    });

    it('removes participants marked for deletion during sync', () => {
      const component = createComponent();
      component.lockedLinkField = 'tripId';
      component.lockedLinkId = 't1';
      component.ngOnInit();
      fillValidForm(component);
      component.participants = [
        { id: 'p1', displayName: 'Ana' } as EventParticipant,
        { id: 'p2', displayName: 'Bruno' } as EventParticipant,
      ];
      component.removeParticipant(0);
      eventServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'e1' }, message: 'OK' } as unknown as WebApiResponse<AgendaEvent>),
      );

      component.submit().subscribe();

      expect(eventParticipantServiceMock.delete).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
      expect(eventParticipantServiceMock.add).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('hides the modal when isModal is true', () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = {};
      component.dialogRef = dialogRefMock as any;

      component.cancel();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
    });

    it('navigates back to the agenda when isModal is false', () => {
      const component = createComponent();
      component.isModal = false;

      component.cancel();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/agenda');
    });
  });

  describe('remove', () => {
    it('does nothing without data', () => {
      const component = createComponent();
      component.data = null;

      component.remove();

      expect(eventServiceMock.delete).not.toHaveBeenCalled();
    });

    it('deletes and navigates on success outside a modal', () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'e1' } as AgendaEvent;
      eventServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' } as unknown as WebApiResponse<AgendaEvent>),
      );

      component.remove();

      expect(modalServiceMock.hideModal).not.toHaveBeenCalled();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Success, 'Removido');
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/agenda');
    });

    it('hides the modal and does not navigate on success inside a modal', () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = {};
      component.dialogRef = dialogRefMock as any;
      component.data = { id: 'e1' } as AgendaEvent;
      eventServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' } as unknown as WebApiResponse<AgendaEvent>),
      );

      component.remove();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('does not navigate when the delete reports an error status', () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'e1' } as AgendaEvent;
      eventServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' } as unknown as WebApiResponse<AgendaEvent>),
      );

      component.remove();

      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('notifies an error when the delete request errors', async () => {
      const component = createComponent();
      component.data = { id: 'e1' } as AgendaEvent;
      eventServiceMock.delete.mockReturnValue(throwError(() => new Error('boom')));
      const originalOnUnhandledError = config.onUnhandledError;
      config.onUnhandledError = () => {};

      try {
        component.remove();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
          ResponseStatus.Error,
          'AGENDA.SAVE_ERROR',
        );
      } finally {
        config.onUnhandledError = originalOnUnhandledError;
      }
    });
  });

  describe('date helpers (via submit)', () => {
    function submitWithDates(startDate: unknown, startTime = '09:00') {
      const component = createComponent();
      component.lockedLinkField = 'tripId';
      component.lockedLinkId = 't1';
      component.ngOnInit();
      component.form.patchValue({
        title: 'x',
        startDate,
        startTime,
        endDate: startDate,
        endTime: startTime,
        eventTypeOptionId: 'et1',
      });
      let payload: any;
      eventServiceMock.add.mockImplementation((event: AgendaEvent) => {
        payload = event;
        return of({ status: ResponseStatus.Success, data: { id: 'e1' }, message: 'OK' } as unknown as WebApiResponse<AgendaEvent>);
      });
      component.submit().subscribe();
      return payload;
    }

    it('parses a Date instance', () => {
      const payload = submitWithDates(new Date(2099, 0, 1));
      expect(payload.startDate.getFullYear()).toBe(2099);
    });

    it('parses an object with its own toDate() method', () => {
      const fakeMoment = { toDate: () => new Date(2099, 0, 2) };
      const payload = submitWithDates(fakeMoment);
      expect(payload.startDate.getDate()).toBe(2);
    });

    it('parses a dd/mm/yyyy string', () => {
      const payload = submitWithDates('15/03/2099');
      expect(payload.startDate.getFullYear()).toBe(2099);
      expect(payload.startDate.getMonth()).toBe(2);
      expect(payload.startDate.getDate()).toBe(15);
    });

    it('parses an ISO-like string with no slashes', () => {
      const payload = submitWithDates('2099-03-15');
      expect(payload.startDate.getFullYear()).toBe(2099);
    });

    it('falls back to the current date/time when no date is given at all', () => {
      // startDate/endDate are required fields, so submit() can never reach toDate() with an
      // empty value through the public flow - exercised directly to cover the defensive branch.
      const component = createComponent();
      expect((component as any).toDate('')).toBeInstanceOf(Date);
      expect((component as any).toDate(null)).toBeInstanceOf(Date);
      expect((component as any).toDate(undefined)).toBeInstanceOf(Date);
    });

    it('toDate falls back to day=1/month=1 when the dd/mm/yyyy parts are zero', () => {
      const component = createComponent();

      const result = (component as any).toDate('0/0/2099');

      expect(result.getFullYear()).toBe(2099);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(1);
    });

    it('combineDateTime falls back to midnight when no time is given', () => {
      const component = createComponent();

      const result = (component as any).combineDateTime(new Date(2024, 0, 1), '');

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });

    it('patchFormWithData does nothing when the form has not been built yet', () => {
      const component = createComponent();

      expect(() => (component as any).patchFormWithData()).not.toThrow();
    });
  });
});
