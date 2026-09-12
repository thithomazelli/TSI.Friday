import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import {
  BusinessPartnerService,
  Driver,
  DriverService,
  ModalService,
  NotificationService,
  ResponseStatus,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { config, of, throwError } from 'rxjs';
import { DriverFormComponent } from './driver-form.component';

describe('DriverFormComponent', () => {
  let modalServiceMock: {
    hideModal: ReturnType<typeof vi.fn>;
    showNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let driverServiceMock: {
    add: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let businessPartnerServiceMock: { cpfValidator: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };

  function createComponent(): DriverFormComponent {
    modalServiceMock = { hideModal: vi.fn(), showNotification: vi.fn() };
    notificationServiceMock = { showMessage: vi.fn() };
    driverServiceMock = { add: vi.fn(), update: vi.fn(), delete: vi.fn() };
    businessPartnerServiceMock = { cpfValidator: vi.fn().mockReturnValue(() => null) };
    routerMock = { navigateByUrl: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };

    return new DriverFormComponent(
      new FormBuilder(),
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      driverServiceMock as unknown as DriverService,
      businessPartnerServiceMock as unknown as BusinessPartnerService,
      routerMock as unknown as Router,
      translationServiceMock as unknown as TranslationService,
    );
  }

  function validRawValue() {
    return {
      name: 'João',
      email: 'joao@example.com',
      phone: '',
      mobile: '',
      socialSecurityCard: '52998224725',
      nationalIdCard: '',
      birthday: new Date('1990-01-01'),
      licenseNumber: '12345678901',
      licenseCategory: 'B',
      licenseExpiryDate: new Date('2099-01-01'),
      employmentType: 'CLT',
      admissionDate: null,
      status: 'Active',
      commissionPercentage: 0,
    };
  }

  function fillValidForm(component: DriverFormComponent) {
    component.form.patchValue(validRawValue());
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('exposes translated employment type and status options', () => {
    const component = createComponent();
    expect(component.employmentTypeOptions.length).toBe(3);
    expect(component.statusOptions.length).toBe(3);
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
      component.data = { name: 'Maria' } as Driver;
      component.ngOnInit();
      expect(component.form.get('name')!.value).toBe('Maria');
    });
  });

  describe('ngOnChanges', () => {
    it('patches the form when data changes to a new value after init', () => {
      const component = createComponent();
      component.ngOnInit();
      component.data = { name: 'Maria' } as Driver;

      component.ngOnChanges({ data: { currentValue: component.data } as never });

      expect(component.form.get('name')!.value).toBe('Maria');
    });

    it('does nothing when the changed input is not data', () => {
      const component = createComponent();
      component.ngOnInit();

      component.ngOnChanges({ isEdit: { currentValue: true } as never });

      expect(component.form.get('name')!.value).toBe('');
    });

    it('does nothing when data has no currentValue', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() =>
        component.ngOnChanges({ data: { currentValue: null } as never }),
      ).not.toThrow();
      expect(component.form.get('name')!.value).toBe('');
    });

    it('does not throw when data changes before the form exists', () => {
      const component = createComponent();
      expect(() =>
        component.ngOnChanges({ data: { currentValue: { name: 'Maria' } } as never }),
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
      expect(component.form.get('name')!.touched).toBe(true);
      expect(driverServiceMock.add).not.toHaveBeenCalled();
    });

    it('adds a new driver when not editing', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      driverServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'd1' } } as WebApiResponse<Driver>),
      );

      component.submit().subscribe();

      expect(driverServiceMock.add).toHaveBeenCalled();
    });

    it('merges the raw value into data before saving, and updates when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 'd1' } as Driver;
      component.ngOnInit();
      fillValidForm(component);
      driverServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'd1' } } as WebApiResponse<Driver>),
      );

      component.submit().subscribe();

      expect(driverServiceMock.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'd1', name: 'João' }),
      );
    });

    it('notifies without saving when the backend reports a business-rule failure', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      driverServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'CPF duplicado' } as WebApiResponse<Driver>),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'CPF duplicado',
      );
    });

    it('saves via the modal path when isModal is true', () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = { close: vi.fn() };
      component.dialogRef = dialogRefMock as any;
      component.ngOnInit();
      fillValidForm(component);
      driverServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'd1' }, message: 'OK' } as WebApiResponse<Driver>),
      );

      component.submit().subscribe();

      expect(dialogRefMock.close).toHaveBeenCalled();
    });

    it('saves via the page path when isModal is false', () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      fillValidForm(component);
      driverServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'd1' } } as WebApiResponse<Driver>),
      );

      component.submit().subscribe();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/drivers/d1');
    });

    it('notifies an error when the save request errors', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      driverServiceMock.add.mockReturnValue(throwError(() => new Error('boom')));

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

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/drivers');
    });
  });

  describe('remove', () => {
    it('does nothing without data', () => {
      const component = createComponent();
      component.data = null;

      component.remove();

      expect(driverServiceMock.delete).not.toHaveBeenCalled();
    });

    it('deletes, hides the modal and navigates on success outside a modal', () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'd1' } as Driver;
      driverServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' } as WebApiResponse<Driver>),
      );

      component.remove();

      expect(modalServiceMock.hideModal).not.toHaveBeenCalled();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'Removido',
      );
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/drivers');
    });

    it('hides the modal and does not navigate on success inside a modal', () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = {};
      component.dialogRef = dialogRefMock as any;
      component.data = { id: 'd1' } as Driver;
      driverServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' } as WebApiResponse<Driver>),
      );

      component.remove();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('does not navigate when the delete reports an error', () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'd1' } as Driver;
      driverServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' } as WebApiResponse<Driver>),
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
        component.data = { id: 'd1' } as Driver;
        driverServiceMock.delete.mockReturnValue(throwError(() => new Error('boom')));

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
      component.data = { id: 'd1' } as Driver;
      component.ngOnInit();
      fillValidForm(component);
      driverServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK' } as WebApiResponse<Driver>),
      );

      component.submit().subscribe();

      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
        true,
        'Motorista atualizado',
        'OK',
      );
    });

    it('shows a success notification with the create wording when adding', () => {
      const component = createComponent();
      component.isModal = true;
      component.ngOnInit();
      fillValidForm(component);
      driverServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK' } as WebApiResponse<Driver>),
      );

      component.submit().subscribe();

      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
        true,
        'Motorista adicionado',
        'OK',
      );
    });

    it('does not throw when there is no dialogRef to close', () => {
      const component = createComponent();
      component.isModal = true;
      component.dialogRef = undefined;
      component.ngOnInit();
      fillValidForm(component);
      driverServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK' } as WebApiResponse<Driver>),
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
      driverServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' } as WebApiResponse<Driver>),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'Falhou',
      );
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('notifies without navigating when adding a new driver fails (defensive branch)', () => {
      // submit()'s next handler already short-circuits on a non-Success status before ever
      // calling savePage()/saveModal(), so this exercises the same defensive check those private
      // methods carry on their own, in case they are ever invoked another way.
      const component = createComponent();
      component.isModal = false;

      (component as any).savePage({
        status: ResponseStatus.Error,
        message: 'Falhou',
      } as WebApiResponse<Driver>);

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
      } as WebApiResponse<Driver>);

      expect(dialogRefMock.close).toHaveBeenCalled();
      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(false, '', 'Falhou');
    });
  });
});
