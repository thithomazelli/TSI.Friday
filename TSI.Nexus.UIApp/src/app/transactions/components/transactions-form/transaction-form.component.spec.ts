import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import {
  BusinessPartner,
  BusinessPartnerService,
  ModalService,
  NotificationService,
  Order,
  PaymentCondition,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  ResponseStatus,
  SelectableOptionService,
  Transaction,
  TransactionService,
  TranslationService,
} from '@nexus/core';
import { config, of, throwError } from 'rxjs';
import { TransactionFormComponent } from './transaction-form.component';

describe('TransactionFormComponent', () => {
  let businessPartnerServiceMock: {
    getClients: ReturnType<typeof vi.fn>;
    getSuppliers: ReturnType<typeof vi.fn>;
    addOrUpdateBusinessPartner: ReturnType<typeof vi.fn>;
  };
  let modalServiceMock: {
    hideModal: ReturnType<typeof vi.fn>;
    showSweetConfirmation: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
    showTemplateModal: ReturnType<typeof vi.fn>;
    showConfirmation: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let selectableOptionServiceMock: { getByGroup: ReturnType<typeof vi.fn> };
  let transactionServiceMock: {
    add: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  const businessPartners: BusinessPartner[] = [
    { id: 'bp1', name: 'Cliente A' } as BusinessPartner,
    { id: 'bp2', name: 'Cliente B' } as BusinessPartner,
  ];

  function createComponent(): TransactionFormComponent {
    businessPartnerServiceMock = {
      getClients: vi.fn().mockReturnValue(of({ data: businessPartners })),
      getSuppliers: vi.fn().mockReturnValue(of({ data: businessPartners })),
      addOrUpdateBusinessPartner: vi.fn(),
    };
    modalServiceMock = {
      hideModal: vi.fn(),
      showSweetConfirmation: vi.fn(),
      showSweetNotification: vi.fn(),
      showTemplateModal: vi.fn(),
      showConfirmation: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    routerMock = { navigateByUrl: vi.fn() };
    selectableOptionServiceMock = { getByGroup: vi.fn().mockReturnValue(of({ data: [] })) };
    transactionServiceMock = { add: vi.fn(), update: vi.fn(), delete: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };
    dialogRefMock = { close: vi.fn() };

    const component = new TransactionFormComponent(
      businessPartnerServiceMock as unknown as BusinessPartnerService,
      new FormBuilder(),
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      routerMock as unknown as Router,
      selectableOptionServiceMock as unknown as SelectableOptionService,
      transactionServiceMock as unknown as TransactionService,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
    component.dialogRef = dialogRefMock as unknown as MatDialogRef<any>;
    return component;
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('option getters', () => {
    it('exposes translated status/type/method/condition options', () => {
      const component = createComponent();
      expect(component.statusOptions).toHaveLength(3);
      expect(component.typeOptions).toEqual([
        { label: 'BUSINESS_PARTNER.CLIENT_SINGULAR', value: PaymentType.Incoming },
        { label: 'BUSINESS_PARTNER.SUPPLIER_SINGULAR', value: PaymentType.Outgoing },
      ]);
      expect(component.methodOptions).toHaveLength(3);
      expect(component.conditionOptions).toHaveLength(2);
    });
  });

  describe('ngOnInit', () => {
    it('builds its own form, patches data, and sets up autocomplete/categories', () => {
      const component = createComponent();
      component.data = { description: 'Desc existente' } as Transaction;

      component.ngOnInit();

      expect(component.form.get('description')!.value).toBe('Desc existente');
      expect(businessPartnerServiceMock.getClients).toHaveBeenCalled();
      expect(selectableOptionServiceMock.getByGroup).toHaveBeenCalled();
    });

    it('reuses an externally provided form group instead of building its own', () => {
      const component = createComponent();
      const externalForm = new FormBuilder().group({ type: [PaymentType.Incoming], businessPartnerName: [''] });
      component.formGroup = externalForm;
      component.compact = true;

      component.ngOnInit();

      expect(component.form).toBe(externalForm);
    });

    // A `price` control isn't part of initForm()'s own commonControls - the subscription
    // `this.form.get('price')?.valueChanges.subscribe(...)` in ngOnInit only ever fires when an
    // *external* formGroup supplies one (e.g. a parent embedding this form differently), so these
    // tests wire that in directly via the formGroup @Input rather than the component's own form.
    function externalFormWithPrice() {
      return new FormBuilder().group({
        type: [PaymentType.Incoming],
        businessPartnerName: [''],
        price: [0],
        totalOfPayments: [1],
        paymentTotalPrice: [0],
      });
    }

    it('recomputes paymentTotalPrice from price and totalOfPayments', () => {
      const component = createComponent();
      component.formGroup = externalFormWithPrice();
      component.compact = true;
      component.ngOnInit();

      component.form.get('totalOfPayments')!.setValue(4);
      component.form.get('price')!.setValue(100);

      expect(component.form.get('paymentTotalPrice')!.value).toBe(25);
    });

    it('falls back to a single payment when totalOfPayments is zero or negative', () => {
      const component = createComponent();
      component.formGroup = externalFormWithPrice();
      component.compact = true;
      component.ngOnInit();

      component.form.get('totalOfPayments')!.setValue(0);
      component.form.get('price')!.setValue(50);

      expect(component.form.get('paymentTotalPrice')!.value).toBe(50);
    });

    it('falls back to a single payment when totalOfPayments is a negative number', () => {
      // 0 is falsy and already gets caught by the `?.value || 1` fallback above the ternary, so
      // this needs a genuinely negative (truthy) value to reach the ternary's own false branch.
      const component = createComponent();
      component.formGroup = externalFormWithPrice();
      component.compact = true;
      component.ngOnInit();

      component.form.get('totalOfPayments')!.setValue(-3);
      component.form.get('price')!.setValue(60);

      expect(component.form.get('paymentTotalPrice')!.value).toBe(60);
    });

    it('falls back to a single payment when totalOfPayments is falsy', () => {
      const component = createComponent();
      component.formGroup = externalFormWithPrice();
      component.compact = true;
      component.ngOnInit();

      component.form.get('price')!.setValue(30);

      expect(component.form.get('paymentTotalPrice')!.value).toBe(30);
    });
  });

  describe('ngOnChanges', () => {
    it('patches the form when data changes to a new value', () => {
      const component = createComponent();
      component.ngOnInit();
      component.data = { description: 'Nova' } as Transaction;

      component.ngOnChanges({ data: { currentValue: component.data } as never });

      expect(component.form.get('description')!.value).toBe('Nova');
    });

    it('does nothing when data has no currentValue', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() => component.ngOnChanges({ data: { currentValue: null } as never })).not.toThrow();
      expect(component.form.get('description')!.value).toBe('');
    });

    it('does not throw when data changes before the form exists', () => {
      const component = createComponent();
      component.data = { description: 'X' } as Transaction;

      expect(() =>
        component.ngOnChanges({ data: { currentValue: component.data } as never }),
      ).not.toThrow();
    });

    it('re-initializes the form when isEdit changes after the first change', () => {
      const component = createComponent();
      component.ngOnInit();
      expect(component.form.get('id')).toBeNull();
      component.isEdit = true;

      component.ngOnChanges({ isEdit: { currentValue: true, firstChange: false } as never });

      expect(component.form.get('id')).toBeTruthy();
    });

    it('does not re-initialize the form on the first isEdit change', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.form;

      component.ngOnChanges({ isEdit: { currentValue: false, firstChange: true } as never });

      expect(component.form).toBe(before);
    });
  });

  describe('ngOnDestroy', () => {
    it('unsubscribes all tracked subscriptions', () => {
      const component = createComponent();
      const unsubscribe = vi.fn();
      (component as any)._subscriptions = [{ unsubscribe }];

      component.ngOnDestroy();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('does not throw when there are no subscriptions', () => {
      const component = createComponent();
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('onTypeChanges', () => {
    it('requires businessPartnerName and shows client/order fields for Incoming', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.showClientAndOrder).toBe(true);
      expect(component.form.get('businessPartnerName')!.hasError('required')).toBe(true);
    });

    it('clears the requirement and hides client/order fields for Outgoing', () => {
      const component = createComponent();
      component.ngOnInit();

      component.form.get('type')!.setValue(PaymentType.Outgoing);

      expect(component.showClientAndOrder).toBe(false);
      component.form.get('businessPartnerName')!.setValue('');
      expect(component.form.get('businessPartnerName')!.hasError('required')).toBe(false);
    });

    it('starts with the requirement already cleared when the initial type is Outgoing', () => {
      const component = createComponent();
      component.data = { type: PaymentType.Outgoing, description: 'x' } as Transaction;

      component.ngOnInit();

      expect(component.showClientAndOrder).toBe(false);
      component.form.get('businessPartnerName')!.setValue('');
      expect(component.form.get('businessPartnerName')!.hasError('required')).toBe(false);
    });

    it('re-requires businessPartnerName when switching back to Incoming', () => {
      const component = createComponent();
      component.data = { type: PaymentType.Outgoing, description: 'x' } as Transaction;
      component.ngOnInit();

      component.form.get('type')!.setValue(PaymentType.Incoming);

      expect(component.showClientAndOrder).toBe(true);
      component.form.get('businessPartnerName')!.setValue('');
      expect(component.form.get('businessPartnerName')!.hasError('required')).toBe(true);
    });

    it('does nothing when the form has no type or businessPartnerName control', () => {
      const component = createComponent();
      // setupAutoComplete() (always called at the end of onTypeChanges) itself requires a
      // businessPartnerName control unless compact - set compact so only the guarded block
      // under test is actually exercised without that unrelated call throwing first.
      component.compact = true;
      component.form = new FormBuilder().group({ other: [''] }) as any;

      expect(() => component.onTypeChanges()).not.toThrow();
    });
  });

  describe('submit', () => {
    function fillValidForm(component: TransactionFormComponent) {
      component.form.patchValue({
        type: PaymentType.Outgoing,
        method: PaymentMethod.Cash,
        status: PaymentStatus.Pending,
        date: new Date(),
        category: 'cat1',
        description: 'Desc',
        condition: PaymentCondition.FullPayment,
      });
    }

    it('marks the form as touched and returns null without saving when invalid', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: unknown;
      component.submit().subscribe((r) => (result = r));

      expect(result).toBeNull();
      expect(transactionServiceMock.add).not.toHaveBeenCalled();
    });

    it('adds a new transaction when not editing', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      transactionServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 't1' } }),
      );

      component.submit().subscribe();

      expect(transactionServiceMock.add).toHaveBeenCalled();
    });

    it('merges the raw value into data and updates when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 't1' } as Transaction;
      component.ngOnInit();
      fillValidForm(component);
      transactionServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Salvo', data: { id: 't1' } }),
      );

      component.submit().subscribe();

      expect(transactionServiceMock.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 't1', description: 'Desc' }),
      );
    });

    it('adds instead of updating when isEdit is true but there is no existing data', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();
      fillValidForm(component);
      transactionServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 't1' } }),
      );

      component.submit().subscribe();

      expect(transactionServiceMock.add).toHaveBeenCalled();
      expect(transactionServiceMock.update).not.toHaveBeenCalled();
    });

    it('notifies without saving when the backend reports a business error', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      transactionServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou', data: null }),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Error, 'Falhou');
    });

    it('closes the dialog and notifies on success (modal mode)', () => {
      const component = createComponent();
      component.isModal = true;
      component.ngOnInit();
      fillValidForm(component);
      transactionServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 't1' } }),
      );

      component.submit().subscribe();

      expect(dialogRefMock.close).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith('', 'OK', ResponseStatus.Success);
    });

    it('navigates to the new transaction page on success (page mode)', () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      fillValidForm(component);
      transactionServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 't1' } }),
      );

      component.submit().subscribe();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/transactions/t1');
    });

    it('shows the formatted message and refreshes data when editing (page mode)', () => {
      const component = createComponent();
      component.isEdit = true;
      component.isModal = false;
      component.data = { id: 't1' } as Transaction;
      component.ngOnInit();
      fillValidForm(component);
      transactionServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Salvo', data: { id: 't1', description: 'Nova' } }),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Success, 'Salvo');
      expect(component.data).toEqual({ id: 't1', description: 'Nova' });
    });

    it('notifies an error when saving fails', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      transactionServiceMock.add.mockReturnValue(throwError(() => new Error('fail')));

      component.submit().subscribe({ error: () => {} });

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'COMMON.SAVE_ERROR');
    });
  });

  describe('cancel', () => {
    it('hides the modal when in modal mode', () => {
      const component = createComponent();
      component.isModal = true;

      component.cancel();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
    });

    it('navigates back to the list page when not in modal mode', () => {
      const component = createComponent();
      component.isModal = false;

      component.cancel();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/transactions');
    });
  });

  describe('remove', () => {
    it('purges via notification on success (page mode) and navigates back', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 't1' } as Transaction;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      transactionServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(transactionServiceMock.delete).toHaveBeenCalledWith(component.data);
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/transactions');
    });

    it('hides the dialog and notifies without navigating on success (modal mode)', async () => {
      const component = createComponent();
      component.isModal = true;
      component.data = { id: 't1' } as Transaction;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      transactionServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
      expect(routerMock.navigateByUrl).not.toHaveBeenCalledWith('/transactions');
    });

    it('does not navigate when the delete reports a non-success status (page mode)', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 't1' } as Transaction;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      transactionServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' }),
      );

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('shows an error notification when the delete request fails', async () => {
      const component = createComponent();
      component.data = { id: 't1' } as Transaction;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      transactionServiceMock.delete.mockReturnValue(throwError(() => new Error('fail')));

      const originalOnUnhandledError = config.onUnhandledError;
      config.onUnhandledError = () => {};
      try {
        component.remove();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('error', 'ORDERS.REMOVE_ERROR');
        await new Promise((resolve) => setTimeout(resolve, 0));
      } finally {
        config.onUnhandledError = originalOnUnhandledError;
      }
    });

    it('does nothing further when cancelled outside a modal', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 't1' } as Transaction;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(transactionServiceMock.delete).not.toHaveBeenCalled();
      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
    });

    it('reopens the details modal when cancelled inside a modal', async () => {
      const component = createComponent();
      component.isModal = true;
      component.isEdit = true;
      component.data = { id: 't1' } as Transaction;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isEdit: true, data: component.data, id: 't1' }),
      );
    });
  });

  describe('missingPayments', () => {
    it('is true when parentData total exceeds the payment total already made', () => {
      const component = createComponent();
      component.parentData = { totalPrice: 100 } as Order;
      component.data = { paymentTotalPrice: 50 } as Transaction;

      expect(component.missingPayments()).toBe(true);
    });

    it('is false when the payment total covers the parentData total', () => {
      const component = createComponent();
      component.parentData = { totalPrice: 100 } as Order;
      component.data = { paymentTotalPrice: 100 } as Transaction;

      expect(component.missingPayments()).toBe(false);
    });

    it('falls back to zero for missing parentData/data values', () => {
      const component = createComponent();
      expect(component.missingPayments()).toBe(false);
    });
  });

  describe('onClientBlur', () => {
    it('cleans the selection when the typed name is blank', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('   ');

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('businessPartnerId')!.value).toBeNull();
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('does nothing further when the typed name matches an existing business partner', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Cliente A');

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showConfirmation).not.toHaveBeenCalled();
    });

    it('offers to create a new client for an Incoming transaction when the name matches nothing', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Novo Cliente');
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(translationServiceMock.instant).toHaveBeenCalledWith('BUSINESS_PARTNER.CLIENT_SINGULAR');
      expect(modalServiceMock.showConfirmation).toHaveBeenCalled();
    });

    it('offers to create a new supplier for an Outgoing transaction when the name matches nothing', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('type')!.setValue(PaymentType.Outgoing);
      component.form.get('businessPartnerName')!.setValue('Novo Fornecedor');
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(translationServiceMock.instant).toHaveBeenCalledWith('BUSINESS_PARTNER.SUPPLIER_SINGULAR');
    });

    it('cleans the selection when the user declines creating a new business partner', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Novo Cliente');
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
      expect(component.form.get('businessPartnerId')!.value).toBeNull();
    });

    it('creates and selects the new business partner once confirmed', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Novo Cliente');
      const newPartner = { id: 'bp9', name: 'Novo Cliente' } as BusinessPartner;
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(newPartner) });

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(businessPartnerServiceMock.addOrUpdateBusinessPartner).toHaveBeenCalledWith(newPartner);
      expect(component.form.get('businessPartnerName')!.value).toBe('Novo Cliente');
      expect(component.form.get('businessPartnerId')!.value).toBe('bp9');
    });

    it('cleans the selection when the new-partner modal closes without a result', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Novo Cliente');
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(undefined) });

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('businessPartnerId')!.value).toBeNull();
    });
  });

  describe('loadCategories (private, via ngOnInit)', () => {
    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      selectableOptionServiceMock.getByGroup.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.categories).toEqual([]);
    });

    it('loads categories from the response data', () => {
      const component = createComponent();
      selectableOptionServiceMock.getByGroup.mockReturnValue(
        of({ data: [{ value: 'cat1', label: 'Categoria 1' }] }),
      );

      component.ngOnInit();

      expect(component.categories).toEqual([{ value: 'cat1', label: 'Categoria 1' }]);
    });
  });

  describe('initForm (private, via ngOnInit)', () => {
    it('builds an add-mode form without an id control', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('id')).toBeNull();
    });

    it('builds an edit-mode form with a disabled id-adjacent set of fields', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();

      expect(component.form.get('id')).toBeTruthy();
      expect(component.form.get('businessPartnerName')!.disabled).toBe(true);
      expect(component.form.get('totalOfPayments')!.disabled).toBe(true);
      expect(component.form.get('totalOfExpenses')!.disabled).toBe(true);
      expect(component.form.get('type')!.disabled).toBe(true);
    });

    it('disables the status control when there are no opened payments while editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { hasOpenedPayments: false } as Transaction;

      component.ngOnInit();

      expect(component.form.get('status')!.disabled).toBe(true);
    });

    it('keeps status enabled when there are opened payments while editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { hasOpenedPayments: true } as Transaction;

      component.ngOnInit();

      expect(component.form.get('status')!.disabled).toBe(false);
    });

    it('auto-resolves businessPartnerId from the typed businessPartnerName in add mode', () => {
      const component = createComponent();
      component.ngOnInit();

      component.form.get('businessPartnerName')!.setValue('Cliente B');

      expect(component.form.get('businessPartnerId')!.value).toBe('bp2');
    });

    it('leaves businessPartnerId untouched when the typed name matches nothing', () => {
      const component = createComponent();
      component.ngOnInit();

      component.form.get('businessPartnerName')!.setValue('Ninguém');

      expect(component.form.get('businessPartnerId')!.value).toBeNull();
    });
  });

  describe('patchFormWithData (private, via ngOnInit)', () => {
    it('falls back totalOfPayments/expenses and their price fields when missing', () => {
      const component = createComponent();
      component.data = { description: 'Desc' } as Transaction;

      component.ngOnInit();

      expect(component.form.get('totalOfPayments')!.value).toBe(1);
      expect(component.form.get('paymentTotalPrice')!.value).toBe(0);
      expect(component.form.get('totalOfExpenses')!.value).toBe(0);
      expect(component.form.get('expenseTotalPrice')!.value).toBe(0);
    });

    it('uses the provided totals when present', () => {
      const component = createComponent();
      component.data = {
        description: 'Desc',
        totalOfPayments: 3,
        paymentTotalPrice: 33,
        totalOfExpenses: 2,
        expenseTotalPrice: 22,
      } as Transaction;

      component.ngOnInit();

      expect(component.form.get('totalOfPayments')!.value).toBe(3);
      expect(component.form.get('paymentTotalPrice')!.value).toBe(33);
      expect(component.form.get('totalOfExpenses')!.value).toBe(2);
      expect(component.form.get('expenseTotalPrice')!.value).toBe(22);
    });

    it('does not throw without data', () => {
      const component = createComponent();
      expect(() => component.ngOnInit()).not.toThrow();
    });
  });

  describe('setupAutoComplete (private, via ngOnInit/onTypeChanges)', () => {
    it('does nothing when compact is true', () => {
      const component = createComponent();
      component.compact = true;

      component.ngOnInit();

      expect(businessPartnerServiceMock.getClients).not.toHaveBeenCalled();
    });

    it('fetches suppliers for an Outgoing type', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.get('type')!.setValue(PaymentType.Outgoing);

      expect(businessPartnerServiceMock.getSuppliers).toHaveBeenCalled();
    });

    it('defaults to Incoming when the form has no type control', () => {
      const component = createComponent();
      component.formGroup = new FormBuilder().group({ businessPartnerName: [''] });

      component.ngOnInit();

      expect(businessPartnerServiceMock.getClients).toHaveBeenCalled();
      expect(businessPartnerServiceMock.getSuppliers).not.toHaveBeenCalled();
    });

    it('falls back to an empty array when the business partners response has no data', () => {
      const component = createComponent();
      businessPartnerServiceMock.getClients.mockReturnValue(of({}));

      component.ngOnInit();

      let result: BusinessPartner[] = [];
      component.businessPartnersArray$.subscribe((r) => (result = r));

      expect(result).toEqual([]);
    });
  });

  describe('filteredBusinessPartners$', () => {
    it('emits an empty list when there is no filter value', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: BusinessPartner[] = [];
      component.filteredBusinessPartners$.subscribe((r) => (result = r));

      expect(result).toEqual([]);
    });

    it('filters by name (case-insensitive)', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: BusinessPartner[] = [];
      component.filteredBusinessPartners$.subscribe((r) => (result = r));
      component.form.get('businessPartnerName')!.setValue('cliente a');

      expect(result).toEqual([expect.objectContaining({ id: 'bp1' })]);
    });

    it('treats a business partner with no name as an empty string when filtering', () => {
      const component = createComponent();
      businessPartnerServiceMock.getClients.mockReturnValue(
        of({ data: [{ id: 'bp3', name: undefined } as unknown as BusinessPartner] }),
      );
      component.ngOnInit();

      let result: BusinessPartner[] = [];
      component.filteredBusinessPartners$.subscribe((r) => (result = r));
      component.form.get('businessPartnerName')!.setValue('cliente');

      expect(result).toEqual([]);
    });
  });

  describe('setupStatusWatcher (private, via ngOnInit)', () => {
    it('does nothing when not editing', () => {
      const component = createComponent();
      component.isEdit = false;

      component.ngOnInit();

      expect(component.form.contains('markAllPaymentsAsApproved')).toBe(false);
    });

    it('adds the markAllPaymentsAsApproved control when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { status: PaymentStatus.Pending } as Transaction;

      component.ngOnInit();

      expect(component.form.contains('markAllPaymentsAsApproved')).toBe(true);
    });

    it('does not re-add the control when it already exists', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { status: PaymentStatus.Pending } as Transaction;

      component.ngOnInit();
      const control = component.form.get('markAllPaymentsAsApproved');

      // Simulate a second run (e.g. via ngOnChanges re-init) to exercise the "already exists"
      // branch instead of adding a duplicate control reference.
      (component as any).setupStatusWatcher();

      expect(component.form.get('markAllPaymentsAsApproved')).toBe(control);
    });

    it('sets markAllPaymentsAsApproved false and clears the flag when there are no opened payments', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { status: PaymentStatus.Pending, hasOpenedPayments: false } as Transaction;
      component.ngOnInit();

      component.form.get('status')!.setValue(PaymentStatus.Delayed);

      expect(component.form.get('markAllPaymentsAsApproved')!.value).toBe(false);
      expect((component.data as any).markAllPaymentsAsApproved).toBe(false);
    });

    it('confirms and marks all payments approved when moving to Approved with opened payments', async () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { status: PaymentStatus.Pending, hasOpenedPayments: true } as Transaction;
      component.ngOnInit();
      modalServiceMock.showConfirmation.mockReturnValue({
        afterClosed: () => ({ toPromise: () => Promise.resolve(true) }),
      });

      component.form.get('status')!.setValue(PaymentStatus.Approved);
      await Promise.resolve();
      await Promise.resolve();

      expect(component.form.get('markAllPaymentsAsApproved')!.value).toBe(true);
      expect((component.data as any).markAllPaymentsAsApproved).toBe(true);
    });

    it('reverts the status when the confirmation is declined', async () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { status: PaymentStatus.Pending, hasOpenedPayments: true } as Transaction;
      component.ngOnInit();
      modalServiceMock.showConfirmation.mockReturnValue({
        afterClosed: () => ({ toPromise: () => Promise.resolve(false) }),
      });

      component.form.get('status')!.setValue(PaymentStatus.Approved);
      await Promise.resolve();
      await Promise.resolve();

      expect(component.form.get('status')!.value).toBe(PaymentStatus.Pending);
      expect(component.form.get('markAllPaymentsAsApproved')!.value).toBe(false);
    });

    it('falls back to an empty status when reverting without a data status', async () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { hasOpenedPayments: true } as Transaction;
      component.ngOnInit();
      modalServiceMock.showConfirmation.mockReturnValue({
        afterClosed: () => ({ toPromise: () => Promise.resolve(false) }),
      });

      component.form.get('status')!.setValue(PaymentStatus.Approved);
      await Promise.resolve();
      await Promise.resolve();

      expect(component.form.get('status')!.value).toBe('');
    });

    it('does not throw when data becomes unavailable while the confirmation is pending', async () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { status: PaymentStatus.Pending, hasOpenedPayments: true } as Transaction;
      component.ngOnInit();
      modalServiceMock.showConfirmation.mockReturnValue({
        afterClosed: () => ({ toPromise: () => Promise.resolve(true) }),
      });

      // hasOpenedPayments is read synchronously as the subscribe callback starts, so setting
      // data to null right after triggering it (but before the confirmation promise resolves)
      // exercises the `if (this.data) {...}` guard's false branch further down, without ever
      // hitting the outer `newStatus === Approved && hasOpenedPayments` check's false path.
      component.form.get('status')!.setValue(PaymentStatus.Approved);
      component.data = null;
      await Promise.resolve();
      await Promise.resolve();

      expect(component.form.get('markAllPaymentsAsApproved')!.value).toBe(true);
    });
  });
});
