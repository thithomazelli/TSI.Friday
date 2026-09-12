import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import {
  Address,
  BusinessPartnerService,
  BusinessPartnerType,
  Individual,
  ModalService,
  NotificationService,
  ResponseStatus,
} from '@nexus/core';
import { of } from 'rxjs';
import { BusinessPartnerFormComponent } from './business-partner-form.component';
import { BusinessPartnerDetailsModalComponent } from '../business-partner-details-modal/business-partner-details-modal.component';

describe('BusinessPartnerFormComponent', () => {
  let businessPartnerServiceMock: {
    add: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    cpfValidator: ReturnType<typeof vi.fn>;
    cnpjValidator: ReturnType<typeof vi.fn>;
  };
  let modalServiceMock: {
    hideModal: ReturnType<typeof vi.fn>;
    showSweetConfirmation: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
    showNotification: ReturnType<typeof vi.fn>;
    showTemplateModal: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(data: Partial<Individual> = {}): BusinessPartnerFormComponent {
    businessPartnerServiceMock = {
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      cpfValidator: vi.fn().mockReturnValue(() => null),
      cnpjValidator: vi.fn().mockReturnValue(() => null),
    };
    modalServiceMock = {
      hideModal: vi.fn(),
      showSweetConfirmation: vi.fn(),
      showSweetNotification: vi.fn(),
      showNotification: vi.fn(),
      showTemplateModal: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    routerMock = { navigateByUrl: vi.fn() };
    cdrMock = { markForCheck: vi.fn() };
    dialogRefMock = { close: vi.fn() };

    const component = new BusinessPartnerFormComponent(
      businessPartnerServiceMock as unknown as BusinessPartnerService,
      new FormBuilder(),
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      routerMock as unknown as Router,
      cdrMock as unknown as ChangeDetectorRef,
    );
    component.dialogRef = dialogRefMock as unknown as MatDialogRef<BusinessPartnerDetailsModalComponent>;
    component.data = { type: BusinessPartnerType.Client, addresses: [], ...data } as Individual;
    return component;
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds the form with the common controls', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('name')).toBeTruthy();
      expect(component.form.get('email')).toBeTruthy();
      expect(component.form.get('socialSecurityCard')).toBeTruthy();
    });

    it('starts the address panel open when adding a new partner', () => {
      const component = createComponent();
      component.isEdit = false;
      component.ngOnInit();

      expect(component.addressPanelMode).toBe('form');
    });

    it('starts the address panel collapsed when editing a partner with an existing address', () => {
      const component = createComponent({
        addresses: [{ id: 'a1' } as Address],
      });
      component.isEdit = true;
      component.ngOnInit();

      expect(component.addressPanelMode).toBe('list');
    });
  });

  describe('canAddAddress', () => {
    it('requires a valid address form for a Client partner', () => {
      const component = createComponent();
      component.compact = true;
      component.ngOnInit();

      expect(component.canAddAddress).toBe(false);

      component.addressFormGroup.patchValue({
        name: 'Casa',
        type: 'Home',
        zipCode: '12345678',
        state: 'SP',
        city: 'São Paulo',
        street: 'Rua A',
        number: 10,
        country: 'BR',
      });

      expect(component.canAddAddress).toBe(true);
    });

    it('only requires the essential fields for a Supplier partner', () => {
      const component = createComponent({ type: BusinessPartnerType.Supplier });
      component.compact = true;
      component.ngOnInit();

      component.addressFormGroup.patchValue({
        type: 'Home',
        zipCode: '12345678',
        street: 'Rua A',
        number: 10,
        state: 'SP',
        city: 'São Paulo',
        name: 'Casa',
      });

      expect(component.canAddAddress).toBe(true);
    });
  });

  describe('submit', () => {
    it('rejects an invalid form without saving', () => {
      const component = createComponent();
      component.ngOnInit();

      let value: unknown;
      component.submit().subscribe((v) => (value = v));

      expect(value).toBeNull();
      expect(businessPartnerServiceMock.add).not.toHaveBeenCalled();
    });

    function fillValidForm(component: BusinessPartnerFormComponent) {
      component.form.patchValue({
        name: 'Ana',
        email: 'ana@example.com',
        documentType: 'Física',
        socialSecurityCard: '52998224725',
        phone: '',
        mobile: '',
      });
    }

    it('saves and navigates to the new partner page on success (page mode)', () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      fillValidForm(component);
      businessPartnerServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'bp1' } }),
      );

      component.submit().subscribe();

      expect(businessPartnerServiceMock.add).toHaveBeenCalled();
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/clients/bp1');
    });

    it('closes the dialog and shows a success notification on success (modal mode)', () => {
      const component = createComponent();
      component.isModal = true;
      component.ngOnInit();
      fillValidForm(component);
      businessPartnerServiceMock.add.mockReturnValue(
        of({
          status: ResponseStatus.Success,
          message: 'OK',
          data: { id: 'bp1', type: BusinessPartnerType.Client },
        }),
      );

      component.submit().subscribe();

      expect(dialogRefMock.close).toHaveBeenCalled();
      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
        true,
        'Cliente adicionado',
        'OK',
      );
    });

    it('shows the returned message without navigating when the backend reports a business error', () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      fillValidForm(component);
      businessPartnerServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'CPF já cadastrado', data: null }),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'CPF já cadastrado',
      );
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('hides the modal when in modal mode', () => {
      const component = createComponent();
      component.isModal = true;
      component.ngOnInit();

      component.cancel();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
    });

    it('navigates back to the list page when not in modal mode', () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();

      component.cancel();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/clients');
    });
  });

  describe('address panel', () => {
    function fillValidAddressForm(component: BusinessPartnerFormComponent) {
      component.addressFormGroup.patchValue({
        name: 'Casa',
        type: 'Home',
        zipCode: '12345678',
        state: 'SP',
        city: 'São Paulo',
        street: 'Rua A',
        number: 10,
        country: 'BR',
      });
    }

    it('adds a new address and reopens the form for the next one in add mode', () => {
      const component = createComponent();
      component.compact = true;
      component.isEdit = false;
      component.ngOnInit();
      fillValidAddressForm(component);

      const address = component.addressFormGroup.value as Address;
      component.saveAddress(address);

      expect(component.data?.addresses?.some((a) => a.street === 'Rua A')).toBe(true);
      expect(component.addressPanelMode).toBe('form');
    });

    it('collapses back to the list after saving in edit mode', () => {
      const component = createComponent();
      component.compact = true;
      component.isEdit = true;
      component.ngOnInit();
      fillValidAddressForm(component);

      component.saveAddress(component.addressFormGroup.value as Address);

      expect(component.addressPanelMode).toBe('list');
    });

    it('cancelAddress resets to the list view', () => {
      const component = createComponent();
      component.compact = true;
      component.ngOnInit();
      component.addressPanelMode = 'form';

      component.cancelAddress();

      expect(component.addressPanelMode).toBe('list');
      expect(component.selectedAddressIndex).toBeNull();
    });

    it('displayNewAddress opens the form with no selected address', () => {
      const component = createComponent();
      component.compact = true;
      component.ngOnInit();

      component.displayNewAddress();

      expect(component.addressPanelMode).toBe('form');
      expect(component.selectedAddressIndex).toBeNull();
    });
  });

  describe('remove', () => {
    it('deletes the partner and navigates back on success (page mode)', async () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      businessPartnerServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(businessPartnerServiceMock.delete).toHaveBeenCalledWith(component.data);
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/clients');
    });
  });
});
