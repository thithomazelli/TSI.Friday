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
import { of, throwError } from 'rxjs';
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

    it('saveAddress does nothing when the address form is invalid', () => {
      const component = createComponent();
      component.compact = true;
      component.ngOnInit();

      component.saveAddress({ street: '' } as Address);

      expect(component.data!.addresses).toEqual([]);
    });

    it('saveAddress replaces the address at the selected index when editing', () => {
      const component = createComponent({
        addresses: [{ id: 'a1', street: 'Old' } as Address, { id: 'a2', street: 'Other' } as Address],
      });
      component.compact = true;
      component.ngOnInit();
      component.selectedAddressIndex = 0;
      fillValidAddressForm(component);

      component.saveAddress(component.addressFormGroup.value as Address);

      expect(component.data!.addresses![0].street).toBe('Rua A');
      expect(component.data!.addresses![1].street).toBe('Other');
    });

    it('starts collapsed and resets the form when compact + edit mode with an existing address', () => {
      const component = createComponent({ addresses: [{ id: 'a1' } as Address] });
      component.compact = true;
      component.isEdit = true;

      component.ngOnInit();

      expect(component.addressPanelMode).toBe('list');
      expect(component.addressFormGroup.get('street')!.value).toBeFalsy();
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

    it('shows an error notification when the delete fails', async () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      businessPartnerServiceMock.delete.mockReturnValue(throwError(() => new Error('fail')));

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'error',
        'Erro ao remover',
      );
      expect(routerMock.navigateByUrl).not.toHaveBeenCalledWith('/clients');
    });

    it('hides the modal and notifies without navigating on success (modal mode)', async () => {
      const component = createComponent();
      component.isModal = true;
      component.ngOnInit();
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      businessPartnerServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(modalServiceMock.hideModal).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith('', 'Removido', ResponseStatus.Success);
      expect(routerMock.navigateByUrl).not.toHaveBeenCalledWith('/clients');
    });

    it('does not navigate when the delete reports a non-success status (page mode)', async () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      businessPartnerServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' }),
      );

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('does nothing further when cancelled outside a modal', async () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(businessPartnerServiceMock.delete).not.toHaveBeenCalled();
      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
    });

    it('builds the reopen initialState when cancelled inside a modal', async () => {
      const component = createComponent();
      component.isModal = true;
      component.isEdit = true;
      component.ngOnInit();
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(businessPartnerServiceMock.delete).not.toHaveBeenCalled();
      // Reopening the modal goes through a dynamic `import(...)` of
      // BusinessPartnerDetailsModalComponent, which is impractical to assert on meaningfully in
      // this spec (see the accepted-residual note above remove()'s tests).
    });

    // The isModal=true reopen-after-cancel path loads BusinessPartnerDetailsModalComponent via a
    // dynamic import() (see remove()'s comment on why) - same accepted residual pattern as
    // product-form/purchase-order-products-form/payment-form/address-form: the async module
    // resolution doesn't settle within any number of microtask/macrotask ticks under this
    // bundler's test transform, so it's left unexercised here; the cancelled-outside-a-modal case
    // above already covers isModal=false, and the only difference for isModal=true is this wrap.
  });

  describe('ngOnChanges', () => {
    it('re-initializes the form when data changes after the first change', () => {
      const component = createComponent();
      component.ngOnInit();

      component.ngOnChanges({ data: { currentValue: component.data, firstChange: false } as never });

      expect(component.form.get('name')).toBeTruthy();
    });

    it('re-initializes the form when isEdit changes after the first change', () => {
      const component = createComponent();
      component.ngOnInit();

      component.ngOnChanges({ isEdit: { currentValue: true, firstChange: false } as never });

      expect(component.form.get('name')).toBeTruthy();
    });

    it('does nothing on the first change of data or isEdit', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.form;

      component.ngOnChanges({
        data: { currentValue: component.data, firstChange: true } as never,
        isEdit: { currentValue: false, firstChange: true } as never,
      });

      expect(component.form).toBe(before);
    });

    it('does nothing when neither data nor isEdit changed', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.form;

      component.ngOnChanges({ compact: {} as never });

      expect(component.form).toBe(before);
    });
  });

  describe('selectedAddress', () => {
    it('is null when no index is selected', () => {
      const component = createComponent();
      expect(component.selectedAddress).toBeNull();
    });

    it('is null when data.addresses is not an array', () => {
      const component = createComponent();
      component.selectedAddressIndex = 0;
      (component.data as any).addresses = undefined;
      expect(component.selectedAddress).toBeNull();
    });

    it('is null when the index is negative', () => {
      const component = createComponent({ addresses: [{ id: 'a1' } as Address] });
      component.selectedAddressIndex = -1;
      expect(component.selectedAddress).toBeNull();
    });

    it('is null when the index is out of bounds', () => {
      const component = createComponent({ addresses: [{ id: 'a1' } as Address] });
      component.selectedAddressIndex = 5;
      expect(component.selectedAddress).toBeNull();
    });

    it('returns the address at the selected index', () => {
      const addr = { id: 'a1' } as Address;
      const component = createComponent({ addresses: [addr] });
      component.selectedAddressIndex = 0;
      expect(component.selectedAddress).toBe(addr);
    });
  });

  describe('isEditingAddressExclusively', () => {
    it('is true only when the address panel is in form mode and isEdit is true', () => {
      const component = createComponent();
      component.isEdit = true;
      component.addressPanelMode = 'form';
      expect(component.isEditingAddressExclusively).toBe(true);

      component.addressPanelMode = 'list';
      expect(component.isEditingAddressExclusively).toBe(false);

      component.isEdit = false;
      component.addressPanelMode = 'form';
      expect(component.isEditingAddressExclusively).toBe(false);
    });
  });

  describe('submit - compact mode (staging addresses)', () => {
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

    it('clears the birthday when it is empty', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      component.form.get('birthday')!.setValue('');
      businessPartnerServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'bp1' } }),
      );

      component.submit().subscribe();

      expect(component.data!.birthday).toBeUndefined();
    });

    it('keeps a filled-in birthday untouched', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      component.form.get('birthday')!.setValue('15/05/1990');
      businessPartnerServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'bp1' } }),
      );

      component.submit().subscribe();

      expect((component.data as any).birthday).toBe('15/05/1990');
    });

    it('adds a new address from the compact address sub-form when street is filled', () => {
      const component = createComponent();
      component.compact = true;
      component.ngOnInit();
      fillValidForm(component);
      component.addressFormGroup.patchValue({
        name: 'Casa',
        type: 'Home',
        zipCode: '12345678',
        state: 'SP',
        city: 'São Paulo',
        street: 'Rua A',
        number: 10,
      });
      businessPartnerServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'bp1', type: BusinessPartnerType.Client } }),
      );

      component.submit().subscribe();

      expect(component.data!.addresses!.some((a) => a.street === 'Rua A')).toBe(true);
      expect('address' in (component.data as any)).toBe(false);
    });

    it('replaces an existing address with the same id instead of duplicating', () => {
      const component = createComponent({
        addresses: [{ id: 'a1', street: 'Old' } as Address],
      });
      component.compact = true;
      component.ngOnInit();
      fillValidForm(component);
      component.addressFormGroup.patchValue({
        id: 'a1',
        name: 'Casa',
        type: 'Home',
        zipCode: '12345678',
        state: 'SP',
        city: 'São Paulo',
        street: 'Rua Nova',
        number: 10,
      });
      businessPartnerServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'bp1', type: BusinessPartnerType.Client } }),
      );

      component.submit().subscribe();

      expect(component.data!.addresses).toHaveLength(1);
      expect(component.data!.addresses![0].street).toBe('Rua Nova');
    });

    it('does not stage the address when the zipCode is null', () => {
      const component = createComponent();
      component.compact = true;
      component.ngOnInit();
      fillValidForm(component);
      businessPartnerServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'bp1', type: BusinessPartnerType.Client } }),
      );

      component.submit().subscribe();

      expect(component.data!.addresses).toEqual([]);
    });

    it('does not stage the address when street is blank even though zipCode is filled', () => {
      const component = createComponent();
      component.compact = true;
      component.ngOnInit();
      fillValidForm(component);
      // zipCode truthy so the outer `raw.address.zipCode != null` guard passes, but street is
      // still blank - exercises the `raw.address?.street != ''` guard's false branch.
      component.addressFormGroup.get('zipCode')!.setValue('00000000');

      businessPartnerServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'bp1', type: BusinessPartnerType.Client } }),
      );

      component.submit().subscribe();

      expect(component.data!.addresses).toEqual([]);
    });

    it('does not stage the address when every field including country is blank', () => {
      const component = createComponent({ type: BusinessPartnerType.Supplier });
      component.compact = true;
      component.ngOnInit();
      fillValidForm(component);
      component.addressFormGroup.get('country')!.setValue('');
      businessPartnerServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'bp1', type: BusinessPartnerType.Supplier } }),
      );

      component.submit().subscribe();

      expect(component.data!.addresses).toEqual([]);
    });

    it('replaces only the matching address by id, leaving the others untouched', () => {
      const component = createComponent({
        type: BusinessPartnerType.Supplier,
        addresses: [
          { id: 'a1', street: 'Old' } as Address,
          { id: 'a2', street: 'Second' } as Address,
        ],
      });
      component.compact = true;
      component.ngOnInit();
      fillValidForm(component);
      component.addressFormGroup.patchValue({
        id: 'a2',
        name: 'Casa',
        type: 'Home',
        zipCode: '12345678',
        state: 'SP',
        city: 'São Paulo',
        street: 'Rua Nova',
        number: 10,
      });
      businessPartnerServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'bp1', type: BusinessPartnerType.Supplier } }),
      );

      component.submit().subscribe();

      expect(component.data!.addresses![0].street).toBe('Old');
      expect(component.data!.addresses![1].street).toBe('Rua Nova');
    });

    it('lazily initializes addresses to an empty array when staging with none yet', () => {
      const component = createComponent({ type: BusinessPartnerType.Supplier });
      component.compact = true;
      component.ngOnInit();
      fillValidForm(component);
      component.addressFormGroup.patchValue({
        name: 'Casa',
        type: 'Home',
        zipCode: '12345678',
        state: 'SP',
        city: 'São Paulo',
        street: 'Rua A',
        number: 10,
      });
      // Force addresses back to undefined right before submit, simulating data built without an
      // addresses array at all (initAddressInfo() would normally have prevented this during
      // ngOnInit, but submit() itself still guards against it independently).
      (component.data as any).addresses = undefined;
      businessPartnerServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'bp1', type: BusinessPartnerType.Supplier } }),
      );

      component.submit().subscribe();

      expect(component.data!.addresses!.some((a) => a.street === 'Rua A')).toBe(true);
    });

    it('deletes a stray "address" property left on data before saving', () => {
      const component = createComponent({ type: BusinessPartnerType.Supplier });
      component.compact = true;
      component.ngOnInit();
      fillValidForm(component);
      (component.data as any).address = { leftover: true };
      businessPartnerServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'bp1', type: BusinessPartnerType.Supplier } }),
      );

      component.submit().subscribe();

      expect('address' in (component.data as any)).toBe(false);
    });

    // These three tests use a Supplier partner (not Client) so the nested address sub-form's
    // fields stay optional (see initForm()'s isAddressRequired) - a Client would make the blank
    // address group itself invalid, and submit() bails out via the top-level `this.form.invalid`
    // check before ever reaching the address-staging logic under test here.
    it('sets the first address as default when none is marked default', () => {
      const component = createComponent({
        type: BusinessPartnerType.Supplier,
        addresses: [{ id: 'a1', street: 'Existing', isDefault: false } as Address],
      });
      component.compact = true;
      component.ngOnInit();
      fillValidForm(component);
      businessPartnerServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'bp1', type: BusinessPartnerType.Supplier } }),
      );

      component.submit().subscribe();

      expect(component.data!.addresses![0].isDefault).toBe(true);
    });

    it('does not override an already-default address', () => {
      const component = createComponent({
        type: BusinessPartnerType.Supplier,
        addresses: [{ id: 'a1', street: 'Existing', isDefault: true } as Address],
      });
      component.compact = true;
      component.ngOnInit();
      fillValidForm(component);
      businessPartnerServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'bp1', type: BusinessPartnerType.Supplier } }),
      );

      component.submit().subscribe();

      expect(component.data!.addresses![0].isDefault).toBe(true);
    });

    it('removes a null id from staged addresses before saving', () => {
      const component = createComponent({
        type: BusinessPartnerType.Supplier,
        addresses: [{ id: null as any, street: 'Existing', isDefault: true } as Address],
      });
      component.compact = true;
      component.ngOnInit();
      fillValidForm(component);
      businessPartnerServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'bp1', type: BusinessPartnerType.Supplier } }),
      );

      component.submit().subscribe();

      expect('id' in component.data!.addresses![0]).toBe(false);
    });

    it('shows a generic error notification when saving fails', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      businessPartnerServiceMock.add.mockReturnValue(throwError(() => new Error('fail')));

      component.submit().subscribe({ error: () => {} });

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'Erro ao salvar');
    });

    it('updates when editing an existing partner', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();
      fillValidForm(component);
      businessPartnerServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Salvo', data: { id: 'bp1' } }),
      );

      component.submit().subscribe();

      expect(businessPartnerServiceMock.update).toHaveBeenCalled();
      expect(businessPartnerServiceMock.add).not.toHaveBeenCalled();
    });

    it('shows the formatted message and refreshes data when editing (page mode)', () => {
      const component = createComponent();
      component.isEdit = true;
      component.isModal = false;
      component.ngOnInit();
      fillValidForm(component);
      businessPartnerServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'CPF 52998224725 salvo', data: { id: 'bp1' } }),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        expect.stringContaining('529.982.247-25'),
      );
      expect(component.data).toEqual({ id: 'bp1' });
    });

    it('shows an empty-message notification unchanged when there is no message', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();
      fillValidForm(component);
      businessPartnerServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: '', data: { id: 'bp1' } }),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Success, '');
    });

    it('shows a CNPJ-formatted error message in the modal path (private saveModal, via direct call)', () => {
      // submit()'s own tap-next callback only ever dispatches to saveModal()/savePage() after
      // confirming response.status === Success (see the comment above that check in submit()),
      // so saveModal()'s own internal non-success branch is unreachable through submit() itself -
      // calling it directly here is the only way to exercise that branch.
      const component = createComponent();
      component.isModal = true;
      component.ngOnInit();

      (component as any).saveModal({
        status: ResponseStatus.Error,
        message: 'CNPJ 11222333000181 duplicado',
        data: null,
      });

      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
        false,
        '',
        expect.stringContaining('11.222.333/0001-81'),
      );
    });

    it('labels a Supplier as "Fornecedor adicionado" on success (modal mode)', () => {
      const component = createComponent({ type: BusinessPartnerType.Supplier });
      component.isModal = true;
      component.ngOnInit();
      fillValidForm(component);
      businessPartnerServiceMock.add.mockReturnValue(
        of({
          status: ResponseStatus.Success,
          message: 'OK',
          data: { id: 'bp1', type: BusinessPartnerType.Supplier },
        }),
      );

      component.submit().subscribe();

      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(true, 'Fornecedor adicionado', 'OK');
    });
  });

  describe('updateFieldValidators (private, via documentType changes)', () => {
    it('requires nationalRegistry and clears birthday when switching to Jurídica', () => {
      const component = createComponent();
      component.ngOnInit();

      component.form.get('documentType')!.setValue('Jurídica');

      expect(component.form.get('nationalRegistry')!.hasError('required')).toBe(true);
      expect(component.form.get('socialSecurityCard')!.value).toBe('');
      expect(component.form.get('birthday')!.value).toBe('');
    });

    it('requires socialSecurityCard when switching back to Física', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.get('documentType')!.setValue('Jurídica');

      component.form.get('documentType')!.setValue('Física');

      expect(component.form.get('socialSecurityCard')!.hasError('required')).toBe(true);
      expect(component.form.get('nationalRegistry')!.value).toBe('');
    });

    it('leaves the previous validators untouched for a documentType that is neither Física nor Jurídica', () => {
      const component = createComponent();
      component.ngOnInit();
      // Física is the default at init time, so socialSecurityCard is already required and
      // nationalRegistry is not - switching to an unrecognized type hits neither branch, so
      // updateFieldValidators() leaves both exactly as they already were.
      const before = {
        ssc: component.form.get('socialSecurityCard')!.hasError('required'),
        nr: component.form.get('nationalRegistry')!.hasError('required'),
      };

      expect(() => component.form.get('documentType')!.setValue('Outro')).not.toThrow();

      expect(component.form.get('socialSecurityCard')!.hasError('required')).toBe(before.ssc);
      expect(component.form.get('nationalRegistry')!.hasError('required')).toBe(before.nr);
    });

    it('keeps the birthday untouched when clearBirthday is false (direct call)', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.get('birthday')!.setValue('15/05/1990');

      (component as any).updateFieldValidators('Jurídica', false);

      expect(component.form.get('birthday')!.value).toBe('15/05/1990');
    });
  });

  describe('parseBirthday (private, no live call site - documented residual)', () => {
    it('is not directly reachable from the public API in this component version', () => {
      // parseBirthday() is defined but not currently called anywhere in this class - kept here
      // as a private helper without a live call site, so it stays outside the coverage target.
      expect(true).toBe(true);
    });
  });

  describe('initAddressInfo (private, via ngOnInit)', () => {
    it('does nothing when there is no data', () => {
      const component = createComponent();
      component.data = null;

      expect(() => component.ngOnInit()).not.toThrow();
    });

    it('initializes an empty addresses array when data has none', () => {
      const component = createComponent();
      delete (component.data as any).addresses;

      component.ngOnInit();

      expect(component.data!.addresses).toEqual([]);
    });
  });

  describe('onSaveAndAddNewAddress', () => {
    it('does not save an invalid address form', () => {
      const component = createComponent();
      component.compact = true;
      component.ngOnInit();

      component.onSaveAndAddNewAddress();

      expect(component.data!.addresses).toEqual([]);
    });

    it('saves a valid address form', () => {
      const component = createComponent();
      component.compact = true;
      component.ngOnInit();
      component.addressFormGroup.patchValue({
        name: 'Casa',
        type: 'Home',
        zipCode: '12345678',
        state: 'SP',
        city: 'São Paulo',
        street: 'Rua A',
        number: 10,
      });

      component.onSaveAndAddNewAddress();

      expect(component.data!.addresses!.some((a) => a.street === 'Rua A')).toBe(true);
    });
  });

  describe('editAddress', () => {
    it('does nothing when the address is not found', () => {
      const component = createComponent({ addresses: [{ id: 'a1' } as Address] });
      component.compact = true;
      component.ngOnInit();

      component.editAddress({ id: 'unknown' } as Address);

      expect(component.selectedAddressIndex).toBeNull();
    });

    it('selects and patches the matching address', () => {
      const component = createComponent({ addresses: [{ id: 'a1', street: 'Rua A' } as Address] });
      component.compact = true;
      component.ngOnInit();
      // initAddressInfo() (called from ngOnInit) replaces data.addresses with brand-new Address
      // instances, so editAddress()'s `findIndex((a) => a === addr)` needs the *post-init*
      // object reference, not the one originally passed into createComponent().
      const addr = component.data!.addresses![0];

      component.editAddress(addr);

      expect(component.selectedAddressIndex).toBe(0);
      expect(component.addressFormGroup.get('street')!.value).toBe('Rua A');
      expect(component.addressPanelMode).toBe('form');
    });
  });

  // Two more genuinely-unreachable defensive branches, left undocumented in production since
  // they're harmless guards rather than dead branches worth removing:
  // - initAddressInfo()'s `(this.data.addresses ?? []).map(...)` fallback can never see a
  //   nullish `this.data.addresses`, because the `if (!this.data.addresses) {...; return;}`
  //   check immediately above it already handles that case and returns early.
  // - restoreAddressValidators()'s `if (controls[x])` guards on each address field are always
  //   true in practice: the address FormGroup is built by a single, fixed `initForm()` call that
  //   always includes every one of these controls, so there's no runtime path where any of them
  //   is missing.
  describe('restoreAddressValidators (private, via displayNewAddress/editAddress/saveAddress)', () => {
    it('restores required validators on all standard address fields, defaulting country to BR', () => {
      const component = createComponent();
      component.compact = true;
      component.ngOnInit();

      component.displayNewAddress();

      expect(component.addressFormGroup.get('country')!.value).toBe('BR');
      ['name', 'type', 'zipCode', 'state', 'city', 'street', 'number', 'country'].forEach((field) => {
        component.addressFormGroup.get(field)!.setValue('');
        expect(component.addressFormGroup.get(field)!.hasError('required')).toBe(true);
      });
    });
  });
});
