import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ModalService,
  NotificationService,
  ResponseStatus,
  TranslationService,
  Vehicle,
  VehicleService,
  WebApiResponse,
} from '@nexus/core';
import { config, of, throwError } from 'rxjs';
import { VehicleFormComponent } from './vehicle-form.component';

describe('VehicleFormComponent', () => {
  let modalServiceMock: {
    hideModal: ReturnType<typeof vi.fn>;
    showNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let vehicleServiceMock: {
    add: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };

  function createComponent(): VehicleFormComponent {
    modalServiceMock = { hideModal: vi.fn(), showNotification: vi.fn() };
    notificationServiceMock = { showMessage: vi.fn() };
    vehicleServiceMock = { add: vi.fn(), update: vi.fn(), delete: vi.fn() };
    routerMock = { navigateByUrl: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };

    return new VehicleFormComponent(
      new FormBuilder(),
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      vehicleServiceMock as unknown as VehicleService,
      routerMock as unknown as Router,
      translationServiceMock as unknown as TranslationService,
    );
  }

  function validRawValue() {
    return {
      plate: 'ABC1234',
      renavam: '',
      chassis: '',
      brand: 'Mercedes',
      model: 'Sprinter',
      manufactureYear: 2020,
      modelYear: 2020,
      seatCapacity: 16,
      type: 'Van',
      status: 'Available',
      pricePerKm: 1.5,
      dailyRate: 100,
      odometer: 0,
    };
  }

  function fillValidForm(component: VehicleFormComponent) {
    component.form.patchValue(validRawValue());
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('exposes translated type and status options', () => {
    const component = createComponent();
    expect(component.typeOptions.length).toBe(5);
    expect(component.statusOptions.length).toBe(4);
  });

  describe('ngOnInit', () => {
    it('builds a form without an id control when adding', () => {
      const component = createComponent();
      component.ngOnInit();
      expect(component.form.get('id')).toBeNull();
    });

    it('builds a form with an id control when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();
      expect(component.form.get('id')).toBeTruthy();
    });

    it('patches the form with the provided data', () => {
      const component = createComponent();
      component.data = { plate: 'XYZ9876' } as Vehicle;
      component.ngOnInit();
      expect(component.form.get('plate')!.value).toBe('XYZ9876');
    });
  });

  describe('ngOnChanges', () => {
    it('patches the form when data changes to a new value after init', () => {
      const component = createComponent();
      component.ngOnInit();
      component.data = { plate: 'XYZ9876' } as Vehicle;

      component.ngOnChanges({ data: { currentValue: component.data } as never });

      expect(component.form.get('plate')!.value).toBe('XYZ9876');
    });

    it('does nothing when the changed input is not data', () => {
      const component = createComponent();
      component.ngOnInit();

      component.ngOnChanges({ isEdit: { currentValue: true } as never });

      expect(component.form.get('plate')!.value).toBe('');
    });

    it('does nothing when data has no currentValue', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() =>
        component.ngOnChanges({ data: { currentValue: null } as never }),
      ).not.toThrow();
      expect(component.form.get('plate')!.value).toBe('');
    });

    it('does not throw when data changes before the form exists', () => {
      const component = createComponent();
      expect(() =>
        component.ngOnChanges({ data: { currentValue: { plate: 'XYZ9876' } } as never }),
      ).not.toThrow();
    });
  });

  describe('submit', () => {
    it('marks the form as touched and returns null without saving when invalid', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: unknown;
      component.submit().subscribe((r) => (result = r));

      expect(result).toBeNull();
      expect(component.form.get('plate')!.touched).toBe(true);
      expect(vehicleServiceMock.add).not.toHaveBeenCalled();
    });

    it('adds a new vehicle when not editing', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      vehicleServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'v1' } } as WebApiResponse<Vehicle>),
      );

      component.submit().subscribe();

      expect(vehicleServiceMock.add).toHaveBeenCalled();
    });

    it('merges the raw value into data before saving, and updates when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 'v1' } as Vehicle;
      component.ngOnInit();
      fillValidForm(component);
      vehicleServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'v1' } } as WebApiResponse<Vehicle>),
      );

      component.submit().subscribe();

      expect(vehicleServiceMock.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'v1', plate: 'ABC1234' }),
      );
    });

    it('notifies without saving when the backend reports a business-rule failure', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      vehicleServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Placa duplicada' } as WebApiResponse<Vehicle>),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'Placa duplicada',
      );
    });

    it('saves via the modal path when isModal is true', () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = { close: vi.fn() };
      component.dialogRef = dialogRefMock as any;
      component.ngOnInit();
      fillValidForm(component);
      vehicleServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'v1' }, message: 'OK' } as WebApiResponse<Vehicle>),
      );

      component.submit().subscribe();

      expect(dialogRefMock.close).toHaveBeenCalled();
    });

    it('saves via the page path when isModal is false', () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      fillValidForm(component);
      vehicleServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'v1' } } as WebApiResponse<Vehicle>),
      );

      component.submit().subscribe();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/vehicles/v1');
    });

    it('notifies an error when the save request errors', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      vehicleServiceMock.add.mockReturnValue(throwError(() => new Error('boom')));

      component.submit().subscribe({ error: () => {} });

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'Erro ao salvar',
      );
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

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/vehicles');
    });
  });

  describe('remove', () => {
    it('does nothing without data', () => {
      const component = createComponent();
      component.data = null;

      component.remove();

      expect(vehicleServiceMock.delete).not.toHaveBeenCalled();
    });

    it('deletes, hides the modal and navigates on success outside a modal', () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'v1' } as Vehicle;
      vehicleServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' } as WebApiResponse<Vehicle>),
      );

      component.remove();

      expect(modalServiceMock.hideModal).not.toHaveBeenCalled();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'Removido',
      );
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/vehicles');
    });

    it('hides the modal and does not navigate on success inside a modal', () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = {};
      component.dialogRef = dialogRefMock as any;
      component.data = { id: 'v1' } as Vehicle;
      vehicleServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' } as WebApiResponse<Vehicle>),
      );

      component.remove();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('does not navigate when the delete reports an error', () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'v1' } as Vehicle;
      vehicleServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' } as WebApiResponse<Vehicle>),
      );

      component.remove();

      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('notifies an error when the delete request errors', async () => {
      // remove() subscribes with no error callback, so RxJS reports the error via a scheduled
      // setTimeout (see reportUnhandledError) after the tap side-effect below runs - silence that
      // reporting until the macrotask has actually fired before restoring the original hook.
      const originalOnUnhandledError = config.onUnhandledError;
      config.onUnhandledError = () => {};
      try {
        const component = createComponent();
        component.data = { id: 'v1' } as Vehicle;
        vehicleServiceMock.delete.mockReturnValue(throwError(() => new Error('boom')));

        component.remove();

        expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
          ResponseStatus.Error,
          'Erro ao remover',
        );

        await new Promise((resolve) => setTimeout(resolve, 0));
      } finally {
        config.onUnhandledError = originalOnUnhandledError;
      }
    });
  });

  describe('saveModal (via submit)', () => {
    it('shows a success notification with the edit wording when editing', () => {
      const component = createComponent();
      component.isModal = true;
      component.isEdit = true;
      component.data = { id: 'v1' } as Vehicle;
      component.ngOnInit();
      fillValidForm(component);
      vehicleServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK' } as WebApiResponse<Vehicle>),
      );

      component.submit().subscribe();

      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
        true,
        'VEHICLES.VEHICLE_UPDATED',
        'OK',
      );
    });

    it('shows a success notification with the create wording when adding', () => {
      const component = createComponent();
      component.isModal = true;
      component.ngOnInit();
      fillValidForm(component);
      vehicleServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK' } as WebApiResponse<Vehicle>),
      );

      component.submit().subscribe();

      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
        true,
        'VEHICLES.VEHICLE_ADDED',
        'OK',
      );
    });

    it('does not throw when there is no dialogRef to close', () => {
      const component = createComponent();
      component.isModal = true;
      component.dialogRef = undefined;
      component.ngOnInit();
      fillValidForm(component);
      vehicleServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK' } as WebApiResponse<Vehicle>),
      );

      expect(() => component.submit().subscribe()).not.toThrow();
    });
  });

  describe('savePage (via submit)', () => {
    it('notifies without navigating when the save reports an error', () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      fillValidForm(component);
      vehicleServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' } as WebApiResponse<Vehicle>),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'Falhou',
      );
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('notifies without navigating when adding a new vehicle fails (defensive branch)', () => {
      const component = createComponent();
      component.isModal = false;

      (component as any).savePage({
        status: ResponseStatus.Error,
        message: 'Falhou',
      } as WebApiResponse<Vehicle>);

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'Falhou',
      );
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe('saveModal (defensive branch)', () => {
    it('shows a failure notification when the status is not Success', () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = { close: vi.fn() };
      component.dialogRef = dialogRefMock as any;

      (component as any).saveModal({
        status: ResponseStatus.Error,
        message: 'Falhou',
      } as WebApiResponse<Vehicle>);

      expect(dialogRefMock.close).toHaveBeenCalled();
      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(false, '', 'Falhou');
    });
  });
});
