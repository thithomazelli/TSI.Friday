import { HttpClient } from '@angular/common/http';
import { FormBuilder } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import {
  Address,
  AddressService,
  ModalService,
  NotificationService,
  ResponseStatus,
  SelectableOptionService,
  TranslationService,
} from '@nexus/core';
import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AddressFormComponent } from './address-form.component';
import { AddressDetailsModalComponent } from '../address-details-modal/address-details-modal.component';

describe('AddressFormComponent', () => {
  let addressServiceMock: {
    add: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let httpMock: { get: ReturnType<typeof vi.fn> };
  let modalServiceMock: {
    showSweetNotification: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetConfirmation: ReturnType<typeof vi.fn>;
    showTemplateModal: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let selectableOptionServiceMock: { getByGroup: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(): AddressFormComponent {
    addressServiceMock = { add: vi.fn(), update: vi.fn(), delete: vi.fn() };
    httpMock = { get: vi.fn().mockReturnValue(of([])) };
    modalServiceMock = {
      showSweetNotification: vi.fn(),
      hideModal: vi.fn(),
      showSweetConfirmation: vi.fn(),
      showTemplateModal: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    selectableOptionServiceMock = {
      getByGroup: vi.fn().mockReturnValue(of({ data: [] })),
    };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };
    dialogRefMock = { close: vi.fn() };

    const component = new AddressFormComponent(
      addressServiceMock as unknown as AddressService,
      new FormBuilder(),
      httpMock as unknown as HttpClient,
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      selectableOptionServiceMock as unknown as SelectableOptionService,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
    component.dialogRef = dialogRefMock as unknown as MatDialogRef<AddressDetailsModalComponent>;
    return component;
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds its own form, loads states, and loads address type options', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('name')).toBeTruthy();
      expect(httpMock.get).toHaveBeenCalled();
      expect(selectableOptionServiceMock.getByGroup).toHaveBeenCalled();
    });

    it('reuses an externally provided form group instead of building its own', () => {
      const component = createComponent();
      const externalForm = new FormBuilder().group({ name: [''] });
      component.formGroup = externalForm;

      component.ngOnInit();

      expect(component.form).toBe(externalForm);
    });
  });

  describe('submit', () => {
    it('marks the form touched and emits null when invalid', () => {
      const component = createComponent();
      component.ngOnInit();

      let value: unknown;
      component.submit().subscribe((v) => (value = v));

      expect(value).toBeNull();
      expect(addressServiceMock.add).not.toHaveBeenCalled();
    });

    it('adds a new address and closes the dialog on success', () => {
      const component = createComponent();
      component.ngOnInit();
      addressServiceMock.add.mockReturnValue(
        of({ value: {}, message: 'Salvo', status: 'success' }),
      );

      component.form.setValue({
        name: 'Casa',
        type: 'Home',
        zipCode: '12345678',
        state: 'SP',
        city: 'São Paulo',
        street: 'Rua A',
        number: 10,
        comments: '',
        businessPartnerId: '',
        country: 'BR',
        isDefault: false,
      });
      component.submit().subscribe();

      expect(addressServiceMock.add).toHaveBeenCalled();
      expect(dialogRefMock.close).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Salvo',
        'success',
      );
    });

    it('shows an error notification when saving fails', () => {
      const component = createComponent();
      component.ngOnInit();
      addressServiceMock.add.mockReturnValue(throwError(() => new Error('fail')));

      component.form.setValue({
        name: 'Casa',
        type: 'Home',
        zipCode: '12345678',
        state: 'SP',
        city: 'São Paulo',
        street: 'Rua A',
        number: 10,
        comments: '',
        businessPartnerId: '',
        country: 'BR',
        isDefault: false,
      });
      component.submit().subscribe({ error: () => {} });

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'error',
        'Erro ao salvar',
      );
    });
  });

  describe('cancel', () => {
    it('hides the modal', () => {
      const component = createComponent();
      component.cancel();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
    });
  });

  describe('remove', () => {
    it('deletes the address and notifies when the user confirms', async () => {
      const component = createComponent();
      component.ngOnInit();
      component.data = { id: 'a1' } as Address;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      addressServiceMock.delete.mockReturnValue(
        of({ value: {}, message: 'Removido', status: ResponseStatus.Success }),
      );

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(addressServiceMock.delete).toHaveBeenCalledWith(component.data);
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Removido',
        ResponseStatus.Success,
      );
    });

    it('shows an error notification when the delete fails', async () => {
      const component = createComponent();
      component.ngOnInit();
      component.data = { id: 'a1' } as Address;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      addressServiceMock.delete.mockReturnValue(throwError(() => new Error('fail')));

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'error',
        'Erro ao remover',
      );
    });
  });

  describe('trackBy helpers', () => {
    it('trackByEstadoId falls back to index when there is no id', () => {
      const component = createComponent();
      expect(component.trackByEstadoId(2, { sigla: 'SP', nome: 'São Paulo' })).toBe(2);
      expect(component.trackByEstadoId(2, { id: 5, sigla: 'SP', nome: 'São Paulo' })).toBe(5);
    });

    it('trackByCidadeId falls back to index when there is no id', () => {
      const component = createComponent();
      expect(component.trackByCidadeId(1, { nome: 'São Paulo' })).toBe(1);
      expect(component.trackByCidadeId(1, { id: 7, nome: 'São Paulo' })).toBe(7);
    });
  });
});
