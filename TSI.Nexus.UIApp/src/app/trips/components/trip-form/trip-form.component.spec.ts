import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import {
  BusinessPartner,
  BusinessPartnerService,
  Driver,
  DriverService,
  ModalService,
  NotificationService,
  ResponseStatus,
  Trip,
  TripDriver,
  TripDriverService,
  TripService,
  TranslationService,
  Vehicle,
  VehicleService,
  WebApiResponse,
} from '@nexus/core';
import { Subject, config, of, throwError } from 'rxjs';
import { TripFormComponent } from './trip-form.component';

describe('TripFormComponent', () => {
  let businessPartnerServiceMock: {
    getClients: ReturnType<typeof vi.fn>;
    addOrUpdateBusinessPartner: ReturnType<typeof vi.fn>;
  };
  let driverServiceMock: { getAll: ReturnType<typeof vi.fn> };
  let modalServiceMock: {
    hideModal: ReturnType<typeof vi.fn>;
    showSweetConfirmation: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
    showTemplateModal: ReturnType<typeof vi.fn>;
    showConfirmation: ReturnType<typeof vi.fn>;
    showNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let tripServiceMock: { add: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let tripDriverAdded$: Subject<TripDriver>;
  let tripDriverServiceMock: {
    tripDriverAdded$: Subject<TripDriver>;
    add: ReturnType<typeof vi.fn>;
  };
  let vehicleServiceMock: { getAll: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  const clients: BusinessPartner[] = [
    { id: 'bp1', name: 'Cliente Um' } as BusinessPartner,
    { id: 'bp2', name: 'Cliente Dois' } as BusinessPartner,
  ];
  const vehicles: Vehicle[] = [
    { id: 'v1', plate: 'ABC1234', brand: 'Ford', model: 'Ka' } as Vehicle,
    { id: 'v2', plate: 'XYZ9876', brand: 'Fiat', model: 'Uno' } as Vehicle,
  ];
  const drivers: Driver[] = [
    { id: 'd1', name: 'João', licenseNumber: '123', licenseExpiryDate: new Date('2099-01-01') } as Driver,
    { id: 'd2', name: 'Maria', licenseNumber: '456', licenseExpiryDate: new Date('2000-01-01') } as Driver,
  ];

  function createComponent(): TripFormComponent {
    businessPartnerServiceMock = {
      getClients: vi.fn().mockReturnValue(of({ data: clients } as WebApiResponse<BusinessPartner[]>)),
      addOrUpdateBusinessPartner: vi.fn(),
    };
    driverServiceMock = { getAll: vi.fn().mockReturnValue(of({ data: drivers } as WebApiResponse<Driver[]>)) };
    modalServiceMock = {
      hideModal: vi.fn(),
      showSweetConfirmation: vi.fn(),
      showSweetNotification: vi.fn(),
      showTemplateModal: vi.fn(),
      showConfirmation: vi.fn(),
      showNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    tripServiceMock = { add: vi.fn(), update: vi.fn(), delete: vi.fn() };
    tripDriverAdded$ = new Subject();
    tripDriverServiceMock = { tripDriverAdded$, add: vi.fn() };
    vehicleServiceMock = { getAll: vi.fn().mockReturnValue(of({ data: vehicles } as WebApiResponse<Vehicle[]>)) };
    routerMock = { navigateByUrl: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };

    return new TripFormComponent(
      businessPartnerServiceMock as unknown as BusinessPartnerService,
      driverServiceMock as unknown as DriverService,
      new FormBuilder(),
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      tripServiceMock as unknown as TripService,
      tripDriverServiceMock as unknown as TripDriverService,
      vehicleServiceMock as unknown as VehicleService,
      routerMock as unknown as Router,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  function fillValidForm(component: TripFormComponent) {
    component.form.patchValue({
      businessPartnerId: 'bp1',
      businessPartnerName: 'Cliente Um',
    });
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds a create-mode form and auto-resolves businessPartnerId from businessPartnerName', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('id')).toBeNull();

      component.form.get('businessPartnerName')!.setValue('Cliente Um');
      expect(component.form.get('businessPartnerId')!.value).toBe('bp1');
    });

    it('leaves businessPartnerId untouched when the name matches no client', () => {
      const component = createComponent();
      component.ngOnInit();

      component.form.get('businessPartnerName')!.setValue('Ninguém');
      expect(component.form.get('businessPartnerId')!.value).toBeNull();
    });

    it('builds an edit-mode form with an id control and disables edit-locked fields', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();

      expect(component.form.get('id')).toBeTruthy();
      expect(component.form.get('businessPartnerName')!.disabled).toBe(true);
      expect(component.form.get('tripNumber')!.disabled).toBe(true);
    });

    it('leaves edit-locked fields enabled when adding', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('businessPartnerName')!.disabled).toBe(false);
      expect(component.form.get('tripNumber')!.disabled).toBe(false);
    });

    it('patches the form, computing paymentTotalPrice by dividing totalPrice by totalOfPayments when adding', () => {
      const component = createComponent();
      component.data = {
        totalPrice: 100,
        transaction: { totalOfPayments: 4 },
      } as unknown as Trip;

      component.ngOnInit();

      expect(component.form.get('transaction.paymentTotalPrice')!.value).toBe(25);
    });

    it('defaults totalOfPayments to 1 when computing paymentTotalPrice while adding', () => {
      const component = createComponent();
      component.data = {
        totalPrice: 100,
        transaction: {},
      } as unknown as Trip;

      component.ngOnInit();

      expect(component.form.get('transaction.paymentTotalPrice')!.value).toBe(100);
    });

    it('uses the existing paymentTotalPrice from data when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = {
        totalPrice: 100,
        transaction: { totalOfPayments: 4, paymentTotalPrice: 42 },
      } as unknown as Trip;

      component.ngOnInit();

      expect(component.form.get('transaction.paymentTotalPrice')!.value).toBe(42);
    });

    it('does not throw and skips patching when there is no data', () => {
      const component = createComponent();
      component.data = null;

      expect(() => component.ngOnInit()).not.toThrow();
    });

    it('loads vehicles/drivers and builds the vehicle plate autocomplete', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.vehicles).toEqual(vehicles);
      expect(component.drivers).toEqual(drivers);

      let result: Vehicle[] = [];
      component.filteredVehiclesByPlate$.subscribe((r) => (result = r));
      component.form.get('vehiclePlate')!.setValue('abc');

      expect(result).toEqual([vehicles[0]]);
    });

    it('falls back to an empty array of drivers when the response has no data', () => {
      const component = createComponent();
      driverServiceMock.getAll.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.drivers).toEqual([]);
    });

    it('falls back to an empty array of vehicles when the response has no data', () => {
      const component = createComponent();
      vehicleServiceMock.getAll.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.vehicles).toEqual([]);
    });

    it('does not match a vehicle with no model when neither plate nor brand match either', () => {
      // The `||` chain short-circuits once plate/brand matches, so a model-only match never
      // actually evaluates the model fallback - only a non-matching vehicle exercises it.
      const component = createComponent();
      vehicleServiceMock.getAll.mockReturnValue(
        of({ data: [{ id: 'v9', plate: 'ZZZ0000', brand: 'Renault', model: undefined } as unknown as Vehicle] }),
      );
      component.ngOnInit();

      let result: Vehicle[] = [];
      component.filteredVehiclesByPlate$.subscribe((r) => (result = r));
      component.form.get('vehiclePlate')!.setValue('unmatched-term');

      expect(result).toEqual([]);
    });

    it('adds a tripDriver from tripDriverAdded$ and notifies success', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();

      tripDriverAdded$.next({ driverId: 'd1' } as TripDriver);

      expect(component.data!.tripDrivers).toEqual([{ driverId: 'd1' }]);
      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
        true,
        '',
        'TRIPS.DRIVER_ADDED_SUCCESS',
      );
    });

    it('ignores a falsy tripDriverAdded$ emission', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();

      expect(() => tripDriverAdded$.next(null as unknown as TripDriver)).not.toThrow();
      expect(modalServiceMock.showNotification).not.toHaveBeenCalled();
    });

    it('ignores tripDriverAdded$ emissions when there is no data', () => {
      const component = createComponent();
      component.data = null;
      component.ngOnInit();

      expect(() => tripDriverAdded$.next({ driverId: 'd1' } as TripDriver)).not.toThrow();
      expect(modalServiceMock.showNotification).not.toHaveBeenCalled();
    });

    it('recomputes totalPrice whenever price or discount changes', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();

      component.form.get('price')!.setValue(100);
      component.form.get('discount')!.setValue(10);

      expect(component.form.get('totalPrice')!.value).toBe(90);
    });

    it('recomputes totalPrice whenever transaction.totalOfPayments changes', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      component.form.get('price')!.setValue(100);

      component.form.get('transaction.totalOfPayments')!.setValue(2);

      expect(component.form.get('transaction.paymentTotalPrice')!.value).toBe(100);
    });
  });

  describe('ngOnChanges', () => {
    it('re-patches the form and rewatches totalOfPayments when data changes after init', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();

      component.data = { totalPrice: 200 } as unknown as Trip;
      component.ngOnChanges({ data: {} as any });

      expect(component.form.get('totalPrice')!.value).toBe(200);
    });

    it('does nothing when the changed input is not data', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();

      expect(() => component.ngOnChanges({ isEdit: {} as any })).not.toThrow();
    });

    it('does not throw when data changes before the form exists', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;

      expect(() => component.ngOnChanges({ data: {} as any })).not.toThrow();
    });
  });

  describe('ngOnDestroy', () => {
    it('unsubscribes the totalOfPayments watcher and other tracked subscriptions', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });

    it('does not throw when called before ngOnInit ever subscribed', () => {
      const component = createComponent();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('submit', () => {
    it('marks the form as touched and returns null without saving when invalid', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();

      let result: unknown;
      component.submit().subscribe((r) => (result = r));

      expect(result).toBeNull();
      expect(component.submitted).toBe(true);
    });

    it('creates a new trip, syncing transaction business partner fields and dropping a null transaction id', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      fillValidForm(component);
      tripServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 't1' } } as WebApiResponse<Trip>),
      );

      component.submit().subscribe();

      const saved = tripServiceMock.add.mock.calls[0][0] as Trip;
      expect(saved.transaction!.businessPartnerId).toBe('bp1');
      expect(saved.transaction!.businessPartnerName).toBe('Cliente Um');
      expect(saved.transaction).not.toHaveProperty('id');
    });

    it('preserves the existing transaction id when editing a trip that already has one', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 't1', transaction: { id: 'tr1' } } as unknown as Trip;
      component.ngOnInit();
      fillValidForm(component);
      tripServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 't1' } } as WebApiResponse<Trip>),
      );

      component.submit().subscribe();

      const saved = tripServiceMock.update.mock.calls[0][0] as Trip;
      expect(saved.transaction!.id).toBe('tr1');
    });

    it('does not sync transaction business partner fields when the transaction section is hidden', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      fillValidForm(component);
      component.canDisplayTransactionForm = false;
      tripServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 't1' } } as WebApiResponse<Trip>),
      );

      component.submit().subscribe();

      const saved = tripServiceMock.add.mock.calls[0][0] as Trip;
      expect(saved.transaction!.businessPartnerId).toBeUndefined();
    });

    it('does not throw when there is no data', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      fillValidForm(component);
      component.data = null;
      tripServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 't1' } } as WebApiResponse<Trip>),
      );

      expect(() => component.submit().subscribe()).not.toThrow();
    });

    it('notifies without saving when the backend reports a business-rule failure', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      fillValidForm(component);
      tripServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' } as WebApiResponse<Trip>),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Error, 'Falhou');
    });

    it('notifies an error when the save request errors', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      fillValidForm(component);
      tripServiceMock.add.mockReturnValue(throwError(() => new Error('boom')));

      component.submit().subscribe({ error: () => {} });

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'Erro ao salvar');
    });

    describe('flushStagedTripDrivers', () => {
      it('saves directly via the modal path with no staged drivers', () => {
        const component = createComponent();
        component.isModal = true;
        const dialogRefMock = { close: vi.fn() };
        component.dialogRef = dialogRefMock as any;
        component.data = {} as unknown as Trip;
        component.ngOnInit();
        fillValidForm(component);
        tripServiceMock.add.mockReturnValue(
          of({ status: ResponseStatus.Success, data: { id: 't1' }, message: 'OK' } as WebApiResponse<Trip>),
        );

        component.submit().subscribe();

        expect(dialogRefMock.close).toHaveBeenCalled();
        expect(tripDriverServiceMock.add).not.toHaveBeenCalled();
      });

      it('saves directly via the page path with no staged drivers', () => {
        const component = createComponent();
        component.isModal = false;
        component.data = {} as unknown as Trip;
        component.ngOnInit();
        fillValidForm(component);
        tripServiceMock.add.mockReturnValue(
          of({ status: ResponseStatus.Success, data: { id: 't1' } } as WebApiResponse<Trip>),
        );

        component.submit().subscribe();

        expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/trips/t1');
      });

      it('flushes staged trip drivers before finishing when creating with staged drivers and a new id', () => {
        const component = createComponent();
        component.isModal = false;
        component.data = {
          tripDrivers: [{ driverId: 'd1' } as TripDriver],
        } as unknown as Trip;
        component.ngOnInit();
        fillValidForm(component);
        tripServiceMock.add.mockReturnValue(
          of({ status: ResponseStatus.Success, data: { id: 't1' } } as WebApiResponse<Trip>),
        );
        tripDriverServiceMock.add.mockReturnValue(of({}));

        component.submit().subscribe();

        expect(tripDriverServiceMock.add).toHaveBeenCalledWith(
          expect.objectContaining({ driverId: 'd1', tripId: 't1' }),
        );
        expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/trips/t1');
      });

      it('does not flush staged drivers when editing, even if data has staged drivers', () => {
        const component = createComponent();
        component.isModal = false;
        component.isEdit = true;
        component.data = {
          id: 't1',
          tripDrivers: [{ driverId: 'd1' } as TripDriver],
        } as unknown as Trip;
        component.ngOnInit();
        fillValidForm(component);
        tripServiceMock.update.mockReturnValue(
          of({ status: ResponseStatus.Success, data: { id: 't1' } } as WebApiResponse<Trip>),
        );

        component.submit().subscribe();

        expect(tripDriverServiceMock.add).not.toHaveBeenCalled();
      });

      it('does not flush staged drivers when the response carries no new trip id', () => {
        const component = createComponent();
        component.isModal = false;
        component.data = {
          tripDrivers: [{ driverId: 'd1' } as TripDriver],
        } as unknown as Trip;
        component.ngOnInit();
        fillValidForm(component);
        tripServiceMock.add.mockReturnValue(
          of({ status: ResponseStatus.Success, data: {} } as unknown as WebApiResponse<Trip>),
        );

        expect(() => component.submit().subscribe()).not.toThrow();
        expect(tripDriverServiceMock.add).not.toHaveBeenCalled();
      });
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

    it('navigates back to the list when isModal is false', () => {
      const component = createComponent();
      component.isModal = false;

      component.cancel();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/trips');
    });
  });

  describe('remove', () => {
    it('deletes and notifies success outside a modal when confirmed', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 't1' } as Trip;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      tripServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' } as WebApiResponse<Trip>),
      );

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith('', 'Removido', ResponseStatus.Success);
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/trips');
    });

    it('hides the modal and does not navigate on success inside a modal', async () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = {};
      component.dialogRef = dialogRefMock as any;
      component.data = { id: 't1' } as Trip;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      tripServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' } as WebApiResponse<Trip>),
      );

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('does not navigate when the delete reports an error status', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 't1' } as Trip;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      tripServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' } as WebApiResponse<Trip>),
      );

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('notifies an error when the delete request fails', async () => {
      const originalOnUnhandledError = config.onUnhandledError;
      config.onUnhandledError = () => {};
      try {
        const component = createComponent();
        component.data = { id: 't1' } as Trip;
        modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
        tripServiceMock.delete.mockReturnValue(throwError(() => new Error('boom')));

        component.remove();
        await Promise.resolve();
        await Promise.resolve();

        expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('error', 'Erro ao remover');

        await new Promise((resolve) => setTimeout(resolve, 0));
      } finally {
        config.onUnhandledError = originalOnUnhandledError;
      }
    });

    it('reopens the details modal when the deletion is cancelled inside a modal', async () => {
      const component = createComponent();
      component.isModal = true;
      component.isEdit = true;
      component.data = { id: 't1' } as Trip;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isEdit: true, data: component.data, id: 't1' }),
      );
    });

    it('does nothing further when the deletion is cancelled outside a modal', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 't1' } as Trip;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
      expect(tripServiceMock.delete).not.toHaveBeenCalled();
    });
  });

  describe('transactionFormGroup', () => {
    it('returns the transaction form group', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();

      expect(component.transactionFormGroup.get('method')).toBeTruthy();
    });
  });

  describe('onClientBlur', () => {
    it('cleans the selection when the typed name is blank', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('   ');

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('businessPartnerId')!.value).toBe('');
      expect(component.form.get('businessPartnerId')!.hasError('required')).toBe(true);
    });

    it('does nothing further when the typed name matches an existing client', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Cliente Um');

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showConfirmation).not.toHaveBeenCalled();
    });

    it('offers to create a new client, then applies it once created', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Cliente Novo');

      const newClient = { id: 'bp9', name: 'Cliente Novo' } as BusinessPartner;
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(newClient) });

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(businessPartnerServiceMock.addOrUpdateBusinessPartner).toHaveBeenCalledWith(newClient);
      expect(component.form.get('businessPartnerId')!.value).toBe('bp9');
      expect(component.form.get('businessPartnerName')!.value).toBe('Cliente Novo');
    });

    it('cleans the selection when the new-client modal closes without a result', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Cliente Novo');

      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(undefined) });

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('businessPartnerId')!.value).toBe('');
    });

    it('cleans the selection when the user declines creating a new client', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Cliente Novo');

      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
      expect(component.form.get('businessPartnerId')!.value).toBe('');
    });
  });

  describe('openTripDriverModal', () => {
    it('opens the trip driver modal with the current tripDrivers as parentData', () => {
      const component = createComponent();
      component.data = { tripDrivers: [{ driverId: 'd1' } as TripDriver] } as unknown as Trip;

      component.openTripDriverModal();

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isEdit: false, parentData: [{ driverId: 'd1' }] }),
      );
    });

    it('falls back to an empty array when there is no data yet', () => {
      const component = createComponent();
      component.data = null;

      component.openTripDriverModal();

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ parentData: [] }),
      );
    });
  });

  describe('selectVehicle', () => {
    it('does nothing when no vehicle is given', () => {
      const component = createComponent();

      expect(() => component.selectVehicle(null as unknown as Vehicle)).not.toThrow();
    });

    it('patches the form with the selected vehicle', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();

      component.selectVehicle(vehicles[0]);

      expect(component.form.get('vehicleId')!.value).toBe('v1');
      expect(component.form.get('vehiclePlate')!.value).toBe('ABC1234');
    });
  });

  describe('onVehiclePlateBlur', () => {
    it('cleans the selection when the typed plate is blank', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      component.form.get('vehiclePlate')!.setValue('   ');

      component.onVehiclePlateBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('vehicleId')!.value).toBeNull();
    });

    it('selects the matching vehicle when the plate is found', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      component.form.get('vehiclePlate')!.setValue('ABC1234');

      component.onVehiclePlateBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('vehicleId')!.value).toBe('v1');
      expect(modalServiceMock.showSweetNotification).not.toHaveBeenCalled();
    });

    it('warns and cleans the selection when the plate matches no vehicle', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      component.form.get('vehiclePlate')!.setValue('NOMATCH');

      component.onVehiclePlateBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        'TRIPS.VEHICLE_NOT_FOUND_TITLE',
        'TRIPS.VEHICLE_NOT_FOUND_MESSAGE',
        'warning',
      );
      expect(component.form.get('vehicleId')!.value).toBeNull();
    });
  });

  describe('openVehiclePickerModal', () => {
    it('selects the picked vehicle', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(vehicles[0]) });

      component.openVehiclePickerModal();

      expect(component.form.get('vehicleId')!.value).toBe('v1');
    });

    it('does nothing when the picker closes without a vehicle', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(undefined) });

      expect(() => component.openVehiclePickerModal()).not.toThrow();
      expect(component.form.get('vehicleId')!.value).toBeNull();
    });
  });

  describe('filteredVehiclesByPlate$', () => {
    it('matches by brand and model as well as plate', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();

      let result: Vehicle[] = [];
      component.filteredVehiclesByPlate$.subscribe((r) => (result = r));
      component.form.get('vehiclePlate')!.setValue('uno');

      expect(result).toEqual([vehicles[1]]);
    });

    it('treats a non-string emission as an empty filter', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();

      let result: Vehicle[] = [];
      component.filteredVehiclesByPlate$.subscribe((r) => (result = r));
      component.form.get('vehiclePlate')!.setValue(vehicles[0] as unknown as string);

      expect(result).toEqual([]);
    });
  });

  describe('inline trip driver form', () => {
    describe('filteredInlineDriversByName$', () => {
      it('emits an empty list when there is no filter value', () => {
        const component = createComponent();
        component.data = {} as unknown as Trip;
        component.ngOnInit();

        let result: unknown[] = [];
        component.filteredInlineDriversByName$.subscribe((r) => (result = r));

        expect(result).toEqual([]);
      });

      it('filters by name and flags alreadyUsed/licenseExpired', () => {
        const component = createComponent();
        component.data = { tripDrivers: [{ driverId: 'd2' } as TripDriver] } as unknown as Trip;
        component.ngOnInit();

        let result: any[] = [];
        component.filteredInlineDriversByName$.subscribe((r) => (result = r));
        component.inlineTripDriverForm.get('driverName')!.setValue('maria');

        expect(result).toEqual([
          expect.objectContaining({ id: 'd2', alreadyUsed: true, licenseExpired: true }),
        ]);
      });

      it('flags a driver with no expiry date as not expired', () => {
        const component = createComponent();
        driverServiceMock.getAll.mockReturnValue(
          of({
            data: [{ id: 'd9', name: 'Sem Data', licenseExpiryDate: undefined } as unknown as Driver],
          }),
        );
        component.data = {} as unknown as Trip;
        component.ngOnInit();

        let result: any[] = [];
        component.filteredInlineDriversByName$.subscribe((r) => (result = r));
        component.inlineTripDriverForm.get('driverName')!.setValue('sem data');

        expect(result).toEqual([expect.objectContaining({ id: 'd9', licenseExpired: false })]);
      });

      it('treats a driver with no name as an empty string when filtering', () => {
        const component = createComponent();
        driverServiceMock.getAll.mockReturnValue(
          of({ data: [{ id: 'd9', name: undefined } as unknown as Driver] }),
        );
        component.data = {} as unknown as Trip;
        component.ngOnInit();

        let result: any[] = [];
        component.filteredInlineDriversByName$.subscribe((r) => (result = r));
        component.inlineTripDriverForm.get('driverName')!.setValue('anything');

        expect(result).toEqual([]);
      });

      it('treats a non-string emission as an empty filter', () => {
        const component = createComponent();
        component.data = {} as unknown as Trip;
        component.ngOnInit();

        let result: unknown[] = [];
        component.filteredInlineDriversByName$.subscribe((r) => (result = r));
        component.inlineTripDriverForm.get('driverName')!.setValue(drivers[0] as unknown as string);

        expect(result).toEqual([]);
      });
    });

    describe('onInlineDriverNameBlur', () => {
      it('cleans the selection when the typed name is blank', () => {
        vi.useFakeTimers();
        const component = createComponent();
        component.data = {} as unknown as Trip;
        component.ngOnInit();
        component.inlineTripDriverForm.get('driverName')!.setValue('   ');

        component.onInlineDriverNameBlur();
        vi.advanceTimersByTime(200);

        expect(component.inlineTripDriverForm.get('driverId')!.value).toBeNull();
      });

      it('does nothing further when the typed name matches an existing driver', () => {
        vi.useFakeTimers();
        const component = createComponent();
        component.data = {} as unknown as Trip;
        component.ngOnInit();
        component.inlineTripDriverForm.get('driverName')!.setValue('João');

        component.onInlineDriverNameBlur();
        vi.advanceTimersByTime(200);

        expect(modalServiceMock.showConfirmation).not.toHaveBeenCalled();
      });

      it('offers to create a new driver, then selects it once created', () => {
        vi.useFakeTimers();
        const component = createComponent();
        component.data = {} as unknown as Trip;
        component.ngOnInit();
        component.inlineTripDriverForm.get('driverName')!.setValue('Novo Motorista');

        const newDriver = { id: 'd9', name: 'Novo Motorista', licenseNumber: '999' } as Driver;
        modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
        modalServiceMock.showTemplateModal.mockReturnValue({
          afterClosed: () => of({ data: newDriver } as WebApiResponse<Driver>),
        });

        component.onInlineDriverNameBlur();
        vi.advanceTimersByTime(200);

        expect(component.drivers).toContainEqual(newDriver);
        expect(component.inlineTripDriverForm.get('driverId')!.value).toBe('d9');
      });

      it('cleans the selection when the new-driver modal closes without a result', () => {
        vi.useFakeTimers();
        const component = createComponent();
        component.data = {} as unknown as Trip;
        component.ngOnInit();
        component.inlineTripDriverForm.get('driverName')!.setValue('Novo Motorista');

        modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
        modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(undefined) });

        component.onInlineDriverNameBlur();
        vi.advanceTimersByTime(200);

        expect(component.inlineTripDriverForm.get('driverId')!.value).toBeNull();
      });

      it('cleans the selection when the user declines creating a new driver', () => {
        vi.useFakeTimers();
        const component = createComponent();
        component.data = {} as unknown as Trip;
        component.ngOnInit();
        component.inlineTripDriverForm.get('driverName')!.setValue('Novo Motorista');

        modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

        component.onInlineDriverNameBlur();
        vi.advanceTimersByTime(200);

        expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
        expect(component.inlineTripDriverForm.get('driverId')!.value).toBeNull();
      });
    });

    describe('selectInlineTripDriver', () => {
      it('does nothing when no driver is given', () => {
        const component = createComponent();

        expect(() => component.selectInlineTripDriver(null as unknown as Driver)).not.toThrow();
      });

      it('patches the inline form with the selected driver', () => {
        const component = createComponent();
        component.data = {} as unknown as Trip;
        component.ngOnInit();

        component.selectInlineTripDriver(drivers[0]);

        expect(component.inlineTripDriverForm.get('driverId')!.value).toBe('d1');
        expect(component.inlineTripDriverForm.get('driverName')!.value).toBe('João');
      });

      it('warns and cleans the selection when the driver was already added', () => {
        const component = createComponent();
        component.data = { tripDrivers: [{ driverId: 'd1' } as TripDriver] } as unknown as Trip;
        component.ngOnInit();

        component.selectInlineTripDriver(drivers[0]);

        expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
          false,
          'TRIPS.DRIVER_ALREADY_ADDED_TITLE',
          'TRIPS.DRIVER_ALREADY_ADDED_MESSAGE',
        );
        expect(component.inlineTripDriverForm.get('driverId')!.value).toBeNull();
      });
    });

    describe('addInlineTripDriver', () => {
      it('does nothing without a selected driverId', () => {
        const component = createComponent();
        component.data = {} as unknown as Trip;
        component.ngOnInit();

        component.addInlineTripDriver();

        expect(component.data!.tripDrivers).toBeUndefined();
      });

      it('does nothing without data', () => {
        const component = createComponent();
        component.data = {} as unknown as Trip;
        component.ngOnInit();
        component.inlineTripDriverForm.patchValue({ driverId: 'd1', amount: 100 });
        component.data = null;

        expect(() => component.addInlineTripDriver()).not.toThrow();
      });

      it('appends a staged tripDriver and resets the inline form', () => {
        const component = createComponent();
        component.data = {} as unknown as Trip;
        component.ngOnInit();
        component.inlineTripDriverForm.patchValue({
          driverId: 'd1',
          driverName: 'João',
          driverLicenseNumber: '123',
          amount: 100,
        });

        component.addInlineTripDriver();

        expect(component.data!.tripDrivers).toEqual([
          expect.objectContaining({ driverId: 'd1', driverName: 'João', amount: 100 }),
        ]);
        expect(component.inlineTripDriverForm.get('driverId')!.value).toBeNull();
      });

      it('treats a non-numeric amount as zero', () => {
        const component = createComponent();
        component.data = {} as unknown as Trip;
        component.ngOnInit();
        component.inlineTripDriverForm.patchValue({ driverId: 'd1', amount: '' });

        component.addInlineTripDriver();

        expect(component.data!.tripDrivers![0].amount).toBe(0);
      });
    });

    describe('removeTripDriver', () => {
      it('does nothing when there are no tripDrivers', () => {
        const component = createComponent();
        component.data = {} as unknown as Trip;

        expect(() => component.removeTripDriver(0)).not.toThrow();
      });

      it('removes the tripDriver at the given index', () => {
        const component = createComponent();
        component.data = {
          tripDrivers: [{ driverId: 'd1' } as TripDriver, { driverId: 'd2' } as TripDriver],
        } as unknown as Trip;

        component.removeTripDriver(0);

        expect(component.data!.tripDrivers).toEqual([{ driverId: 'd2' }]);
      });
    });
  });

  describe('filteredBusinessPartners$', () => {
    it('emits an empty list when there is no filter value', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();

      let result: BusinessPartner[] = [];
      component.filteredBusinessPartners$.subscribe((r) => (result = r));

      expect(result).toEqual([]);
    });

    it('falls back to an empty array of clients when the response has no data', () => {
      const component = createComponent();
      businessPartnerServiceMock.getClients.mockReturnValue(of({}));
      component.data = {} as unknown as Trip;
      component.ngOnInit();

      let result: BusinessPartner[] = [];
      component.filteredBusinessPartners$.subscribe((r) => (result = r));
      component.form.get('businessPartnerName')!.setValue('anything');

      expect(result).toEqual([]);
    });

    it('treats a client with no name as an empty string when filtering', () => {
      const component = createComponent();
      businessPartnerServiceMock.getClients.mockReturnValue(
        of({ data: [{ id: 'bp9', name: undefined } as unknown as BusinessPartner] }),
      );
      component.data = {} as unknown as Trip;
      component.ngOnInit();

      let result: BusinessPartner[] = [];
      component.filteredBusinessPartners$.subscribe((r) => (result = r));
      component.form.get('businessPartnerName')!.setValue('anything');

      expect(result).toEqual([]);
    });

    it('filters clients by name (case-insensitive)', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();

      let result: BusinessPartner[] = [];
      component.filteredBusinessPartners$.subscribe((r) => (result = r));
      component.form.get('businessPartnerName')!.setValue('cliente um');

      expect(result).toEqual([clients[0]]);
    });
  });

  describe('addTransactionForm (direct call)', () => {
    it('does not re-add the transaction group when one already exists', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      const existingGroup = component.form.get('transaction');

      expect(() => (component as any).addTransactionForm()).not.toThrow();

      expect(component.form.get('transaction')).toBe(existingGroup);
    });
  });

  describe('updateTotalPriceFields', () => {
    it('does not touch the transaction paymentTotalPrice while editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      const before = component.form.get('transaction.paymentTotalPrice')!.value;

      component.form.get('price')!.setValue(500);
      (component as any).updateTotalPriceFields();

      expect(component.form.get('transaction.paymentTotalPrice')!.value).toBe(before);
    });

    it('treats a non-numeric price as zero', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      component.form.get('price')!.setValue('' as any);

      (component as any).updateTotalPriceFields();

      expect(component.form.get('totalPrice')!.value).toBe(0);
    });
  });

  describe('setupTotalOfPaymentsWatcher (direct call)', () => {
    it('does not throw when the form has no transaction group', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      component.form.removeControl('transaction');

      expect(() => (component as any).setupTotalOfPaymentsWatcher()).not.toThrow();
    });

    it('does not throw when the transaction group has no totalOfPayments control', () => {
      const component = createComponent();
      component.data = {} as unknown as Trip;
      component.ngOnInit();
      component.transactionFormGroup.removeControl('totalOfPayments');

      expect(() => (component as any).setupTotalOfPaymentsWatcher()).not.toThrow();
    });
  });

  describe('saveModal / savePage (via submit)', () => {
    it('saveModal shows a failure notification when the status is not Success', () => {
      const component = createComponent();
      const dialogRefMock = { close: vi.fn() };
      component.dialogRef = dialogRefMock as any;

      (component as any).saveModal({
        status: ResponseStatus.Error,
        message: 'Falhou',
      } as WebApiResponse<Trip>);

      expect(dialogRefMock.close).toHaveBeenCalled();
      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(false, 'Viagem adicionada', 'Falhou');
    });

    it('savePage notifies and updates local data when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 't1' } as Trip;
      const updated = { id: 't1', tripNumber: 'T-2' } as Trip;

      (component as any).savePage({
        status: ResponseStatus.Success,
        message: 'OK',
        data: updated,
      } as WebApiResponse<Trip>);

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Success, 'OK');
      expect(component.data).toBe(updated);
    });
  });
});
