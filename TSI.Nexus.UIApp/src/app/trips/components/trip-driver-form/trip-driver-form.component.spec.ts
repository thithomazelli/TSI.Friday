import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import {
  Driver,
  DriverService,
  ModalService,
  NotificationService,
  TranslationService,
  TripDriver,
  TripDriverService,
  WebApiResponse,
} from '@nexus/core';
import { config, of, throwError } from 'rxjs';
import { TripDriverFormComponent } from './trip-driver-form.component';

describe('TripDriverFormComponent', () => {
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
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let tripDriverServiceMock: {
    addTemporary: ReturnType<typeof vi.fn>;
    add: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  const drivers: Driver[] = [
    {
      id: 'd1',
      name: 'João',
      licenseNumber: 'L1',
      licenseExpiryDate: new Date('2099-01-01'),
    } as Driver,
    {
      id: 'd2',
      name: 'Maria',
      licenseNumber: 'L2',
      licenseExpiryDate: new Date('2000-01-01'),
    } as Driver,
    {
      id: 'd3',
      name: 'Carlos',
      licenseNumber: 'L3',
      licenseExpiryDate: undefined,
    } as unknown as Driver,
    {
      id: 'd4',
      name: 'Paula',
      licenseNumber: 'L4',
      licenseExpiryDate: 'not-a-date' as unknown as Date,
    } as Driver,
    {
      id: 'd5',
      name: undefined,
      licenseNumber: 'L5',
      licenseExpiryDate: null,
    } as unknown as Driver,
  ];

  function createComponent(): TripDriverFormComponent {
    driverServiceMock = {
      getAll: vi
        .fn()
        .mockReturnValue(of({ data: drivers } as WebApiResponse<Driver[]>)),
    };
    modalServiceMock = {
      hideModal: vi.fn(),
      showSweetConfirmation: vi.fn(),
      showSweetNotification: vi.fn(),
      showTemplateModal: vi.fn(),
      showConfirmation: vi.fn(),
      showNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    tripDriverServiceMock = {
      addTemporary: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    cdrMock = { markForCheck: vi.fn() };

    return new TripDriverFormComponent(
      driverServiceMock as unknown as DriverService,
      new FormBuilder(),
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      translationServiceMock as unknown as TranslationService,
      tripDriverServiceMock as unknown as TripDriverService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('initializes a create-mode form without an id control and auto-resolves driverId from driverName', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('id')).toBeNull();

      component.form.get('driverName')!.setValue('João');
      expect(component.form.get('driverId')!.value).toBe('d1');
    });

    it('leaves driverId untouched when the typed driverName matches no driver', () => {
      const component = createComponent();
      component.ngOnInit();

      component.form.get('driverName')!.setValue('Ninguém');
      expect(component.form.get('driverId')!.value).toBe('');
    });

    it('initializes an edit-mode form with an id control and disables driverName', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();

      expect(component.form.get('id')).toBeTruthy();
      expect(component.form.get('driverName')!.disabled).toBe(true);
    });

    it('patches the form with the provided data', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 't1', driverName: 'João', amount: 100 } as TripDriver;
      component.ngOnInit();

      expect(component.form.get('driverName')!.value).toBe('João');
      expect(component.form.get('amount')!.value).toBe(100);
    });
  });

  describe('ngOnChanges', () => {
    it('re-patches the form when data changes after init', () => {
      const component = createComponent();
      component.ngOnInit();

      component.data = { id: 't1', driverName: 'Maria' } as TripDriver;
      component.ngOnChanges({ data: {} as any });

      expect(component.form.get('driverName')!.value).toBe('Maria');
    });

    it('does nothing when the changed input is not data', () => {
      const component = createComponent();
      component.ngOnInit();

      component.ngOnChanges({ isEdit: {} as any });

      expect(component.form.get('driverName')!.value).toBe('');
    });

    it('does not throw when data changes before the form exists', () => {
      const component = createComponent();
      component.data = { id: 't1' } as TripDriver;

      expect(() => component.ngOnChanges({ data: {} as any })).not.toThrow();
    });
  });

  describe('ngOnDestroy', () => {
    it('unsubscribes the driverName auto-resolve subscription', () => {
      const component = createComponent();
      component.ngOnInit();

      component.ngOnDestroy();
      component.form.get('driverName')!.setValue('João');

      expect(component.form.get('driverId')!.value).toBe('');
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
      expect(component.form.get('driverId')!.touched).toBe(true);
    });

    it('creates a temporary trip driver when there is no parentId', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.setValue({
        driverId: 'd1',
        driverName: 'João',
        driverLicenseNumber: 'L1',
        driverLicenseExpiryDate: null,
        amount: 100,
      });
      const response = { message: 'OK', status: 'success' } as unknown as WebApiResponse<TripDriver>;
      tripDriverServiceMock.addTemporary.mockReturnValue(of(response));

      component.submit().subscribe();

      expect(tripDriverServiceMock.addTemporary).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith('', 'OK', 'success');
    });

    it('adds a new trip driver against the parent trip when creating with a parentId', () => {
      const component = createComponent();
      component.parentId = 'trip1';
      component.ngOnInit();
      component.form.setValue({
        driverId: 'd1',
        driverName: 'João',
        driverLicenseNumber: 'L1',
        driverLicenseExpiryDate: null,
        amount: 100,
      });
      const response = { message: 'OK', status: 'success' } as unknown as WebApiResponse<TripDriver>;
      tripDriverServiceMock.add.mockReturnValue(of(response));

      component.submit().subscribe();

      expect(tripDriverServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ tripId: 'trip1' }),
      );
    });

    it('merges the raw form value into data and updates when editing with a parentId', () => {
      const component = createComponent();
      component.parentId = 'trip1';
      component.isEdit = true;
      component.data = { id: 'td1' } as TripDriver;
      component.ngOnInit();
      component.form.get('driverId')!.setValue('d1');
      component.form.get('amount')!.setValue(50);
      const response = { message: 'Updated', status: 'success' } as unknown as WebApiResponse<TripDriver>;
      tripDriverServiceMock.update.mockReturnValue(of(response));

      component.submit().subscribe();

      expect(component.data).toMatchObject({ id: 'td1', driverId: 'd1', amount: 50 });
      expect(tripDriverServiceMock.update).toHaveBeenCalled();
      expect(modalServiceMock.hideModal).not.toHaveBeenCalled();
    });

    it('closes the dialog when saving succeeds and a dialogRef is present', () => {
      const component = createComponent();
      const dialogRefMock = { close: vi.fn() };
      component.dialogRef = dialogRefMock as any;
      component.ngOnInit();
      component.form.get('driverId')!.setValue('d1');
      component.form.get('amount')!.setValue(10);
      const response = { message: 'OK', status: 'success' } as unknown as WebApiResponse<TripDriver>;
      tripDriverServiceMock.addTemporary.mockReturnValue(of(response));

      component.submit().subscribe();

      expect(dialogRefMock.close).toHaveBeenCalledWith(response);
    });

    it('notifies an error when saving fails', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.get('driverId')!.setValue('d1');
      component.form.get('amount')!.setValue(10);
      tripDriverServiceMock.addTemporary.mockReturnValue(throwError(() => new Error('boom')));

      component.submit().subscribe({ error: () => {} });

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'Error',
        'COMMON.SAVE_ERROR',
      );
    });
  });

  it('cancel hides the modal via the dialogRef', () => {
    const component = createComponent();
    const dialogRefMock = {};
    component.dialogRef = dialogRefMock as any;

    component.cancel();

    expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
  });

  describe('remove', () => {
    it('deletes the trip driver and notifies success when confirmed', async () => {
      const component = createComponent();
      component.data = { id: 'td1' } as TripDriver;
      component.ngOnInit();
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      const response = { message: 'Removed', status: 'success' } as unknown as WebApiResponse<TripDriver>;
      tripDriverServiceMock.delete.mockReturnValue(of(response));

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith();
      expect(tripDriverServiceMock.delete).toHaveBeenCalledWith(component.data);
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith('', 'Removed', 'success');
    });

    it('notifies an error when the delete request fails', async () => {
      // remove() subscribes with no error callback, same as the production code path - RxJS
      // reports that as an unhandled error via a scheduled setTimeout (see reportUnhandledError)
      // after the tap side-effect below runs, so this test silences that reporting until that
      // macrotask has actually fired before restoring the original hook.
      const originalOnUnhandledError = config.onUnhandledError;
      config.onUnhandledError = () => {};
      try {
        const component = createComponent();
        component.data = { id: 'td1' } as TripDriver;
        component.ngOnInit();
        modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
        tripDriverServiceMock.delete.mockReturnValue(throwError(() => new Error('boom')));

        expect(() => component.remove()).not.toThrow();
        await Promise.resolve();
        await Promise.resolve();

        expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
          'error',
          'COMMON.SAVE_ERROR',
        );

        await new Promise((resolve) => setTimeout(resolve, 0));
      } finally {
        config.onUnhandledError = originalOnUnhandledError;
      }
    });

    it('re-opens the details modal when the deletion is cancelled', async () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 'td1' } as TripDriver;
      component.parentId = 'trip1';
      component.parentData = [];
      component.ngOnInit();
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isEdit: true,
          data: component.data,
          id: 'td1',
          parentId: 'trip1',
          parentData: [],
        }),
      );
    });
  });

  describe('onDriverNameBlur', () => {
    it('cleans the selection when the typed name is blank', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('driverName')!.setValue('   ');

      component.onDriverNameBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('driverId')!.value).toBe('');
      expect(component.form.get('driverId')!.hasError('required')).toBe(true);
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('does nothing further when the typed name matches an existing driver', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('driverName')!.setValue('João');

      component.onDriverNameBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showConfirmation).not.toHaveBeenCalled();
    });

    it('offers to create a new driver, then selects it once created', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('driverName')!.setValue('Novo Motorista');

      const newDriver = { id: 'd9', name: 'Novo Motorista', licenseNumber: 'L9', licenseExpiryDate: null } as unknown as Driver;
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({
        afterClosed: () => of({ data: newDriver } as WebApiResponse<Driver>),
      });

      component.onDriverNameBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showConfirmation).toHaveBeenCalled();
      expect(modalServiceMock.showTemplateModal).toHaveBeenCalled();
      expect(component.form.get('driverId')!.value).toBe('d9');
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('cleans the selection when the new-driver modal closes without data', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('driverName')!.setValue('Novo Motorista');

      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(undefined) });

      component.onDriverNameBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('driverId')!.value).toBe('');
      expect(component.form.get('driverId')!.hasError('required')).toBe(true);
    });

    it('cleans the selection when the user declines creating a new driver', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('driverName')!.setValue('Novo Motorista');

      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.onDriverNameBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
      expect(component.form.get('driverId')!.value).toBe('');
      expect(component.form.get('driverId')!.hasError('required')).toBe(true);
    });
  });

  describe('selectDriver', () => {
    it('does nothing when no driver is given', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() => component.selectDriver(null as unknown as Driver)).not.toThrow();
      expect(component.form.get('driverId')!.value).toBe('');
    });

    it('notifies and cleans the selection when the driver is already attached to the trip', () => {
      const component = createComponent();
      component.data = { id: 'td1' } as TripDriver;
      component.parentData = [{ id: 'td2', driverId: 'd1' } as TripDriver];
      component.ngOnInit();

      component.selectDriver(drivers[0]);

      expect(modalServiceMock.showNotification).toHaveBeenCalled();
      expect(component.form.get('driverId')!.value).toBe('');
    });

    it('re-adds the driverId control if missing, then patches the selected driver', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.removeControl('driverId');

      component.selectDriver(drivers[0]);

      expect(component.form.get('driverId')!.value).toBe('d1');
      expect(component.form.get('driverName')!.value).toBe('João');
      expect(component.form.get('driverLicenseNumber')!.value).toBe('L1');
    });

    it('patches the selected driver onto the form', () => {
      const component = createComponent();
      component.ngOnInit();

      component.selectDriver(drivers[0]);

      expect(component.form.get('driverId')!.value).toBe('d1');
      expect(component.form.get('driverLicenseExpiryDate')!.value).toEqual(
        drivers[0].licenseExpiryDate,
      );
    });
  });

  describe('filteredDriversByName$ / autocomplete', () => {
    it('emits an empty list when there is no filter value', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: Driver[] = [];
      component.filteredDriversByName$.subscribe((r) => (result = r));

      expect(result).toEqual([]);
    });

    it('filters by name (case-insensitive) and flags alreadyUsed/licenseExpired drivers', () => {
      const component = createComponent();
      component.data = { id: 'td-current' } as TripDriver;
      component.parentData = [{ id: 'td-other', driverId: 'd1' } as TripDriver];
      component.ngOnInit();

      let result: Driver[] = [];
      component.filteredDriversByName$.subscribe((r) => (result = r));
      component.form.get('driverName')!.setValue('joão');

      expect(result).toEqual([
        expect.objectContaining({ id: 'd1', alreadyUsed: true, licenseExpired: false }),
      ]);
    });

    it('does not flag a driver as alreadyUsed when the match belongs to the record being edited', () => {
      const component = createComponent();
      component.data = { id: 'td-other' } as TripDriver;
      component.parentData = [{ id: 'td-other', driverId: 'd1' } as TripDriver];
      component.ngOnInit();

      let result: Driver[] = [];
      component.filteredDriversByName$.subscribe((r) => (result = r));
      component.form.get('driverName')!.setValue('joão');

      expect(result[0]).toMatchObject({ id: 'd1', alreadyUsed: false });
    });

    it('flags a driver with a past license expiry date', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: Driver[] = [];
      component.filteredDriversByName$.subscribe((r) => (result = r));
      component.form.get('driverName')!.setValue('maria');

      expect(result[0]).toMatchObject({ id: 'd2', licenseExpired: true });
    });

    it('treats a missing license expiry date as not expired', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: Driver[] = [];
      component.filteredDriversByName$.subscribe((r) => (result = r));
      component.form.get('driverName')!.setValue('carlos');

      expect(result[0]).toMatchObject({ id: 'd3', licenseExpired: false });
    });

    it('treats an unparseable license expiry date as not expired', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: Driver[] = [];
      component.filteredDriversByName$.subscribe((r) => (result = r));
      component.form.get('driverName')!.setValue('paula');

      expect(result[0]).toMatchObject({ id: 'd4', licenseExpired: false });
    });

    it('treats a nameless driver as an empty string when filtering', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: Driver[] = [];
      component.filteredDriversByName$.subscribe((r) => (result = r));
      component.form.get('driverName')!.setValue('maria');

      expect(result.find((d) => d.id === 'd5')).toBeUndefined();
    });

    it('coerces a non-string driverName value to an empty filter', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: Driver[] = [];
      component.filteredDriversByName$.subscribe((r) => (result = r));
      component.form.get('driverName')!.setValue(123 as unknown as string);

      expect(result).toEqual([]);
    });
  });

  describe('driversArray$', () => {
    it('falls back to an empty array when the response carries no data', () => {
      const component = createComponent();
      driverServiceMock.getAll.mockReturnValue(of({} as WebApiResponse<Driver[]>));
      component.ngOnInit();

      let result: Driver[] = [];
      component.driversArray$.subscribe((r) => (result = r));

      expect(result).toEqual([]);
    });
  });
});
