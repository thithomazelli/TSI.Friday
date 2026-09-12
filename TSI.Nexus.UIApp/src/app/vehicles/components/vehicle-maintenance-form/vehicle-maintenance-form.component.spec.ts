import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ModalService,
  NotificationService,
  ResponseStatus,
  TranslationService,
  Vehicle,
  VehicleMaintenance,
  VehicleMaintenanceProduct,
  VehicleMaintenanceService,
  VehicleService,
  WebApiResponse,
} from '@nexus/core';
import { config, of, throwError } from 'rxjs';
import { VehicleMaintenanceFormComponent } from './vehicle-maintenance-form.component';

describe('VehicleMaintenanceFormComponent', () => {
  let modalServiceMock: {
    hideModal: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let vehicleMaintenanceServiceMock: {
    add: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let vehicleServiceMock: { getAll: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  function createComponent(): VehicleMaintenanceFormComponent {
    modalServiceMock = { hideModal: vi.fn() };
    notificationServiceMock = { showMessage: vi.fn() };
    vehicleMaintenanceServiceMock = { add: vi.fn(), update: vi.fn(), delete: vi.fn() };
    vehicleServiceMock = {
      getAll: vi.fn().mockReturnValue(of({ data: [{ id: 'v1' } as Vehicle] })),
    };
    routerMock = { navigateByUrl: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };

    return new VehicleMaintenanceFormComponent(
      new FormBuilder(),
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      vehicleMaintenanceServiceMock as unknown as VehicleMaintenanceService,
      vehicleServiceMock as unknown as VehicleService,
      routerMock as unknown as Router,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  function fillValidForm(component: VehicleMaintenanceFormComponent) {
    component.form.patchValue({
      type: 'Preventive',
      description: 'Troca de óleo',
      scheduledDate: '2099-01-01',
      cost: 100,
      status: 'Scheduled',
      vehicleId: 'v1',
    });
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('exposes translated type and status options', () => {
    const component = createComponent();
    expect(component.typeOptions.length).toBe(2);
    expect(component.statusOptions.length).toBe(5);
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

    it('loads the vehicle list and marks for check when there is no pre-set vehicleId', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(vehicleServiceMock.getAll).toHaveBeenCalled();
      expect(component.vehicles).toEqual([{ id: 'v1' }]);
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('falls back to an empty vehicle list when the response has no data', () => {
      const component = createComponent();
      vehicleServiceMock.getAll.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.vehicles).toEqual([]);
    });

    it('does not load the vehicle list when embedded with a pre-set vehicleId', () => {
      const component = createComponent();
      component.vehicleId = 'v1';

      component.ngOnInit();

      expect(vehicleServiceMock.getAll).not.toHaveBeenCalled();
    });

    it('marks vehicleId as not required when pre-set', () => {
      const component = createComponent();
      component.vehicleId = 'v1';
      component.ngOnInit();

      expect(component.form.get('vehicleId')!.hasError('required')).toBe(false);
      component.form.get('vehicleId')!.setValue(null);
      expect(component.form.get('vehicleId')!.valid).toBe(true);
    });

    it('patches the form and product list with the provided data', () => {
      const component = createComponent();
      component.data = {
        description: 'Revisão',
        vehicleMaintenanceProducts: [{ id: 'p1' } as VehicleMaintenanceProduct],
      } as VehicleMaintenance;

      component.ngOnInit();

      expect(component.form.get('description')!.value).toBe('Revisão');
      expect(component.vehicleMaintenanceProducts).toEqual([{ id: 'p1' }]);
    });

    it('defaults the product list to empty when data has none', () => {
      const component = createComponent();
      component.data = { description: 'Revisão' } as VehicleMaintenance;

      component.ngOnInit();

      expect(component.vehicleMaintenanceProducts).toEqual([]);
    });
  });

  describe('ngOnChanges', () => {
    it('re-patches the form when data changes after init', () => {
      const component = createComponent();
      component.ngOnInit();
      component.data = { description: 'Revisão' } as VehicleMaintenance;

      component.ngOnChanges({ data: { currentValue: component.data } as never });

      expect(component.form.get('description')!.value).toBe('Revisão');
    });

    it('does nothing when the changed input is not data', () => {
      const component = createComponent();
      component.ngOnInit();

      component.ngOnChanges({ isEdit: { currentValue: true } as never });

      expect(component.form.get('description')!.value).toBe('');
    });

    it('does nothing when data has no currentValue', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() =>
        component.ngOnChanges({ data: { currentValue: null } as never }),
      ).not.toThrow();
      expect(component.form.get('description')!.value).toBe('');
    });

    it('does not throw when data changes before the form exists', () => {
      const component = createComponent();
      component.data = { description: 'Revisão' } as VehicleMaintenance;

      expect(() =>
        component.ngOnChanges({ data: { currentValue: component.data } as never }),
      ).not.toThrow();
    });
  });

  describe('product picker', () => {
    it('appends an added item', () => {
      const component = createComponent();
      component.onProductPickerItemAdded({ id: 'p1' } as VehicleMaintenanceProduct);
      component.onProductPickerItemAdded({ id: 'p2' } as VehicleMaintenanceProduct);

      expect(component.vehicleMaintenanceProducts).toEqual([{ id: 'p1' }, { id: 'p2' }]);
    });

    it('removes a product by index', () => {
      const component = createComponent();
      component.vehicleMaintenanceProducts = [
        { id: 'p1' } as VehicleMaintenanceProduct,
        { id: 'p2' } as VehicleMaintenanceProduct,
      ];

      component.removeProduct(0);

      expect(component.vehicleMaintenanceProducts).toEqual([{ id: 'p2' }]);
    });
  });

  describe('submit', () => {
    it('marks the form as touched and returns null without saving when invalid', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: unknown;
      component.submit().subscribe((r) => (result = r));

      expect(result).toBeNull();
      expect(component.form.get('description')!.touched).toBe(true);
      expect(vehicleMaintenanceServiceMock.add).not.toHaveBeenCalled();
    });

    it('uses the form vehicleId when there is no pre-set vehicleId', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      vehicleMaintenanceServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'm1' } } as WebApiResponse<VehicleMaintenance>),
      );

      component.submit().subscribe();

      expect(vehicleMaintenanceServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ vehicleId: 'v1' }),
      );
    });

    it('prefers the pre-set vehicleId over the form value', () => {
      const component = createComponent();
      component.vehicleId = 'preset-vehicle';
      component.ngOnInit();
      fillValidForm(component);
      vehicleMaintenanceServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'm1' } } as WebApiResponse<VehicleMaintenance>),
      );

      component.submit().subscribe();

      expect(vehicleMaintenanceServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ vehicleId: 'preset-vehicle' }),
      );
    });

    it('includes the current product list in the saved payload', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      component.vehicleMaintenanceProducts = [{ id: 'p1' } as VehicleMaintenanceProduct];
      vehicleMaintenanceServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'm1' } } as WebApiResponse<VehicleMaintenance>),
      );

      component.submit().subscribe();

      expect(vehicleMaintenanceServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ vehicleMaintenanceProducts: [{ id: 'p1' }] }),
      );
    });

    it('updates instead of adding when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 'm1' } as VehicleMaintenance;
      component.ngOnInit();
      fillValidForm(component);
      vehicleMaintenanceServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'm1' } } as WebApiResponse<VehicleMaintenance>),
      );

      component.submit().subscribe();

      expect(vehicleMaintenanceServiceMock.update).toHaveBeenCalled();
    });

    it('notifies without saving when the backend reports a business-rule failure', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      vehicleMaintenanceServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' } as WebApiResponse<VehicleMaintenance>),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'Falhou',
      );
    });

    it('saves via the modal path when isModal is true', () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = { close: vi.fn() };
      component.dialogRef = dialogRefMock as any;
      component.ngOnInit();
      fillValidForm(component);
      vehicleMaintenanceServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'm1' }, message: 'OK' } as WebApiResponse<VehicleMaintenance>),
      );

      component.submit().subscribe();

      expect(dialogRefMock.close).toHaveBeenCalled();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Success, 'OK');
    });

    it('saves via the page path when isModal is false', () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      fillValidForm(component);
      vehicleMaintenanceServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'm1' } } as WebApiResponse<VehicleMaintenance>),
      );

      component.submit().subscribe();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/vehicle-maintenances/m1');
    });

    it('notifies an error when the save request errors', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      vehicleMaintenanceServiceMock.add.mockReturnValue(throwError(() => new Error('boom')));

      component.submit().subscribe({ error: () => {} });

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'VEHICLES.SAVE_MAINTENANCE_ERROR',
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

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/vehicle-maintenances');
    });
  });

  describe('remove', () => {
    it('does nothing without data', () => {
      const component = createComponent();
      component.data = null;

      component.remove();

      expect(vehicleMaintenanceServiceMock.delete).not.toHaveBeenCalled();
    });

    it('deletes, hides the modal and navigates on success outside a modal', () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'm1' } as VehicleMaintenance;
      vehicleMaintenanceServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' } as WebApiResponse<VehicleMaintenance>),
      );

      component.remove();

      expect(modalServiceMock.hideModal).not.toHaveBeenCalled();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'Removido',
      );
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/vehicle-maintenances');
    });

    it('hides the modal and does not navigate on success inside a modal', () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = {};
      component.dialogRef = dialogRefMock as any;
      component.data = { id: 'm1' } as VehicleMaintenance;
      vehicleMaintenanceServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' } as WebApiResponse<VehicleMaintenance>),
      );

      component.remove();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('does not navigate when the delete reports an error', () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'm1' } as VehicleMaintenance;
      vehicleMaintenanceServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' } as WebApiResponse<VehicleMaintenance>),
      );

      component.remove();

      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('notifies an error when the delete request errors', async () => {
      const originalOnUnhandledError = config.onUnhandledError;
      config.onUnhandledError = () => {};
      try {
        const component = createComponent();
        component.data = { id: 'm1' } as VehicleMaintenance;
        vehicleMaintenanceServiceMock.delete.mockReturnValue(throwError(() => new Error('boom')));

        component.remove();

        expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
          ResponseStatus.Error,
          'VEHICLES.SAVE_MAINTENANCE_ERROR',
        );

        await new Promise((resolve) => setTimeout(resolve, 0));
      } finally {
        config.onUnhandledError = originalOnUnhandledError;
      }
    });
  });

  describe('savePage (via submit)', () => {
    it('notifies and marks for check when editing successfully', () => {
      const component = createComponent();
      component.isModal = false;
      component.isEdit = true;
      component.data = { id: 'm1' } as VehicleMaintenance;
      component.ngOnInit();
      fillValidForm(component);
      vehicleMaintenanceServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'm1' }, message: 'OK' } as WebApiResponse<VehicleMaintenance>),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Success, 'OK');
      expect(component.data).toEqual({ id: 'm1' });
    });

    it('notifies without navigating when adding a new maintenance fails (defensive branch)', () => {
      const component = createComponent();
      component.isModal = false;

      (component as any).savePage({
        status: ResponseStatus.Error,
        message: 'Falhou',
      } as WebApiResponse<VehicleMaintenance>);

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'Falhou',
      );
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe('saveModal (via submit)', () => {
    it('does not throw when there is no dialogRef to close', () => {
      const component = createComponent();
      component.isModal = true;
      component.dialogRef = undefined;
      component.ngOnInit();
      fillValidForm(component);
      vehicleMaintenanceServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK' } as WebApiResponse<VehicleMaintenance>),
      );

      expect(() => component.submit().subscribe()).not.toThrow();
    });
  });
});
