import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import {
  BusinessPartner,
  BusinessPartnerService,
  CurrencyService,
  ModalService,
  NotificationService,
  Order,
  OrderProduct,
  OrderProductService,
  OrderService,
  OrderStatus,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';
import { Subject, config, of, throwError } from 'rxjs';
import { OrderFormComponent } from './order-form.component';

describe('OrderFormComponent', () => {
  let businessPartnerServiceMock: {
    getClients: ReturnType<typeof vi.fn>;
    addOrUpdateBusinessPartner: ReturnType<typeof vi.fn>;
  };
  let currencyServiceMock: { formatCurrencyBRL: ReturnType<typeof vi.fn> };
  let modalServiceMock: {
    hideModal: ReturnType<typeof vi.fn>;
    showSweetConfirmation: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
    showTemplateModal: ReturnType<typeof vi.fn>;
    showConfirmation: ReturnType<typeof vi.fn>;
    showNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let orderProductAdded$: Subject<OrderProduct | null>;
  let orderServiceMock: { add: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let orderProductServiceMock: { orderProductAdded$: Subject<OrderProduct | null> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  const businessPartners: BusinessPartner[] = [
    { id: 'bp1', name: 'Cliente A' } as BusinessPartner,
    { id: 'bp2', name: 'Cliente B' } as BusinessPartner,
  ];

  function createComponent(): OrderFormComponent {
    businessPartnerServiceMock = {
      getClients: vi.fn().mockReturnValue(of({ data: businessPartners })),
      addOrUpdateBusinessPartner: vi.fn(),
    };
    currencyServiceMock = { formatCurrencyBRL: vi.fn((v: number) => `R$ ${v}`) };
    modalServiceMock = {
      hideModal: vi.fn(),
      showSweetConfirmation: vi.fn(),
      showSweetNotification: vi.fn(),
      showTemplateModal: vi.fn(),
      showConfirmation: vi.fn(),
      showNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    orderProductAdded$ = new Subject();
    orderServiceMock = { add: vi.fn(), update: vi.fn(), delete: vi.fn() };
    orderProductServiceMock = { orderProductAdded$ };
    routerMock = { navigateByUrl: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };
    dialogRefMock = { close: vi.fn() };

    const component = new OrderFormComponent(
      businessPartnerServiceMock as unknown as BusinessPartnerService,
      currencyServiceMock as unknown as CurrencyService,
      new FormBuilder(),
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      orderServiceMock as unknown as OrderService,
      orderProductServiceMock as unknown as OrderProductService,
      routerMock as unknown as Router,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
    component.dialogRef = dialogRefMock as unknown as MatDialogRef<any>;
    component.data = { orderProducts: [] } as unknown as Order;
    return component;
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('orderStatusOptions / trackByOptionValue', () => {
    it('exposes translated status options', () => {
      const component = createComponent();
      expect(component.orderStatusOptions).toEqual([
        { value: OrderStatus.Open, label: 'QUOTES.STATUS_OPEN' },
        { value: OrderStatus.Closed, label: 'QUOTES.STATUS_CLOSED' },
        { value: OrderStatus.WaitingPayment, label: 'QUOTES.STATUS_WAITING_PAYMENT' },
      ]);
    });

    it('returns the option value', () => {
      const component = createComponent();
      expect(component.trackByOptionValue(0, { value: 'Open', label: 'x' })).toBe('Open');
    });
  });

  describe('ngOnInit', () => {
    it('builds the form and loads business partners', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('businessPartnerId')).toBeTruthy();
      expect(businessPartnerServiceMock.getClients).toHaveBeenCalled();
    });

    it('appends a product, recomputes totals, and notifies on orderProductAdded$', () => {
      const component = createComponent();
      component.ngOnInit();
      const product = { totalPrice: 50 } as OrderProduct;

      orderProductAdded$.next(product);

      expect(component.data!.orderProducts).toEqual([product]);
      expect(component.form.get('price')!.value).toBe(50);
      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(true, '', 'ORDERS.PRODUCT_ADDED_SUCCESS');
    });

    it('ignores orderProductAdded$ when there is no product or no data', () => {
      const component = createComponent();
      component.ngOnInit();

      orderProductAdded$.next(null);
      component.data = null;
      orderProductAdded$.next({ totalPrice: 10 } as OrderProduct);

      expect(modalServiceMock.showNotification).not.toHaveBeenCalled();
    });

    it('falls back to an empty array when data has no orderProducts yet', () => {
      const component = createComponent();
      component.data = {} as unknown as Order;
      component.ngOnInit();
      const product = { totalPrice: 0 } as OrderProduct;

      orderProductAdded$.next(product);

      expect(component.data!.orderProducts).toEqual([product]);
      expect(component.form.get('price')!.value).toBe(0);
    });
  });

  describe('ngOnChanges', () => {
    it('re-patches the form and rewires the totalOfPayments watcher when data changes', () => {
      const component = createComponent();
      component.ngOnInit();
      component.data = { orderProducts: [], description: 'Nova' } as unknown as Order;

      component.ngOnChanges({ data: {} as never });

      expect(component.form.get('description')!.value).toBe('Nova');
    });

    it('does nothing when the changed input is not data', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() => component.ngOnChanges({ isEdit: {} as never })).not.toThrow();
    });

    it('does not throw when data changes before the form exists', () => {
      const component = createComponent();
      component.data = { orderProducts: [] } as unknown as Order;

      expect(() => component.ngOnChanges({ data: {} as never })).not.toThrow();
    });
  });

  describe('ngOnDestroy', () => {
    it('unsubscribes the totalOfPayments watcher and tracked subscriptions', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });

    it('does not throw when there is no totalOfPayments watcher yet', () => {
      const component = createComponent();
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('submit', () => {
    function fillValidForm(component: OrderFormComponent) {
      component.form.patchValue({
        businessPartnerId: 'bp1',
        businessPartnerName: 'Cliente A',
        date: new Date(),
        status: OrderStatus.Open,
      });
    }

    it('marks the form as touched and returns null without saving when invalid', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: unknown;
      component.submit().subscribe((r) => (result = r));

      expect(result).toBeNull();
      expect(orderServiceMock.add).not.toHaveBeenCalled();
    });

    it('propagates client fields into the transaction sub-form when canDisplayTransactionForm', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      orderServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'o1' } }),
      );

      component.submit().subscribe();

      expect(orderServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction: expect.objectContaining({ businessPartnerId: 'bp1', businessPartnerName: 'Cliente A' }),
        }),
      );
    });

    it('does not touch the transaction sub-form when canDisplayTransactionForm is false', () => {
      const component = createComponent();
      component.canDisplayTransactionForm = false;
      component.ngOnInit();
      fillValidForm(component);
      orderServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'o1' } }),
      );

      expect(() => component.submit().subscribe()).not.toThrow();
    });

    it('does not throw when canDisplayTransactionForm is true but the form has no transaction group', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.removeControl('transaction');
      fillValidForm(component);
      orderServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'o1' } }),
      );

      expect(() => component.submit().subscribe()).not.toThrow();
    });

    it('does not throw when there is no data to assign the raw form value onto', () => {
      const component = createComponent();
      component.data = null;
      component.ngOnInit();
      fillValidForm(component);
      orderServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'o1' } }),
      );

      expect(() => component.submit().subscribe()).not.toThrow();
    });

    it('preserves the existing transaction id', () => {
      const component = createComponent();
      component.data = { orderProducts: [], transaction: { id: 'tx1' } } as unknown as Order;
      component.ngOnInit();
      fillValidForm(component);
      orderServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'o1' } }),
      );

      component.submit().subscribe();

      expect(orderServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ transaction: expect.objectContaining({ id: 'tx1' }) }),
      );
    });

    it('deletes a null transaction id before saving', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      orderServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'o1' } }),
      );

      component.submit().subscribe();

      expect('id' in (component.data as any).transaction).toBe(false);
    });

    it('updates when editing an existing order', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 'o1', orderProducts: [] } as unknown as Order;
      component.ngOnInit();
      fillValidForm(component);
      orderServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Salvo', data: { id: 'o1' } }),
      );

      component.submit().subscribe();

      expect(orderServiceMock.update).toHaveBeenCalled();
      expect(orderServiceMock.add).not.toHaveBeenCalled();
    });

    it('notifies without saving when the backend reports a business error', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      orderServiceMock.add.mockReturnValue(
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
      orderServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'o1' } }),
      );

      component.submit().subscribe();

      expect(dialogRefMock.close).toHaveBeenCalled();
      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(true, 'ORDERS.ORDER_ADDED', 'OK');
    });

    it('navigates to the new order page on success (page mode)', () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      fillValidForm(component);
      orderServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'o1' } }),
      );

      component.submit().subscribe();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/orders/o1');
    });

    it('shows the message and refreshes data when editing (page mode)', () => {
      const component = createComponent();
      component.isEdit = true;
      component.isModal = false;
      component.data = { id: 'o1', orderProducts: [] } as unknown as Order;
      component.ngOnInit();
      fillValidForm(component);
      orderServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Salvo', data: { id: 'o1', description: 'Nova' } }),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Success, 'Salvo');
      expect(component.data).toEqual({ id: 'o1', description: 'Nova' });
    });

    it('notifies an error when saving fails', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      orderServiceMock.add.mockReturnValue(throwError(() => new Error('fail')));

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

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/orders');
    });
  });

  describe('remove', () => {
    it('deletes and navigates back on success (page mode)', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'o1', orderProducts: [] } as unknown as Order;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      orderServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(orderServiceMock.delete).toHaveBeenCalledWith(component.data);
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/orders');
    });

    it('hides the dialog and notifies without navigating on success (modal mode)', async () => {
      const component = createComponent();
      component.isModal = true;
      component.data = { id: 'o1', orderProducts: [] } as unknown as Order;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      orderServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
      expect(routerMock.navigateByUrl).not.toHaveBeenCalledWith('/orders');
    });

    it('does not navigate when the delete reports a non-success status (page mode)', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'o1', orderProducts: [] } as unknown as Order;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      orderServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' }),
      );

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('shows an error notification when the delete request fails', async () => {
      const component = createComponent();
      component.data = { id: 'o1', orderProducts: [] } as unknown as Order;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      orderServiceMock.delete.mockReturnValue(throwError(() => new Error('fail')));

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
      component.data = { id: 'o1', orderProducts: [] } as unknown as Order;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(orderServiceMock.delete).not.toHaveBeenCalled();
      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
    });

    it('reopens the details modal when cancelled inside a modal', async () => {
      const component = createComponent();
      component.isModal = true;
      component.isEdit = true;
      component.data = { id: 'o1', orderProducts: [] } as unknown as Order;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isEdit: true, data: component.data, id: 'o1' }),
      );
    });
  });

  describe('removeProduct', () => {
    it('does nothing when there are no orderProducts', () => {
      const component = createComponent();
      component.data = { orderProducts: undefined } as unknown as Order;

      expect(() => component.removeProduct(0)).not.toThrow();
    });

    it('removes the product at the given index and recomputes totals', () => {
      const component = createComponent();
      component.ngOnInit();
      component.data!.orderProducts = [{ totalPrice: 10 } as OrderProduct, { totalPrice: 20 } as OrderProduct];

      component.removeProduct(0);

      expect(component.data!.orderProducts).toEqual([{ totalPrice: 20 }]);
      expect(component.form.get('price')!.value).toBe(20);
    });
  });

  describe('openOrderProductsModal', () => {
    it('opens the products modal with merged data and form values', () => {
      const component = createComponent();
      component.ngOnInit();

      component.openOrderProductsModal();

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isEdit: false, id: null, parentId: null }),
      );
    });
  });

  describe('onProductPickerItemAdded', () => {
    it('does nothing without data', () => {
      const component = createComponent();
      component.data = null;

      expect(() => component.onProductPickerItemAdded({ totalPrice: 10 } as OrderProduct)).not.toThrow();
    });

    it('appends the item and recomputes totals', () => {
      const component = createComponent();
      component.ngOnInit();

      component.onProductPickerItemAdded({ totalPrice: 15 } as OrderProduct);

      expect(component.data!.orderProducts).toEqual([{ totalPrice: 15 }]);
      expect(component.form.get('price')!.value).toBe(15);
    });

    it('falls back to an empty array when data has no orderProducts yet', () => {
      const component = createComponent();
      component.data = {} as unknown as Order;
      component.ngOnInit();

      component.onProductPickerItemAdded({ totalPrice: 20 } as OrderProduct);

      expect(component.data!.orderProducts).toEqual([{ totalPrice: 20 }]);
    });
  });

  describe('transactionFormGroup', () => {
    it('returns the transaction sub-form group', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.transactionFormGroup.get('type')).toBeTruthy();
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

      expect(component.form.get('businessPartnerId')!.value).toBe('');
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

    it('offers to create a new client when the name matches nothing', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Novo Cliente');
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showConfirmation).toHaveBeenCalled();
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
      expect(component.form.get('businessPartnerId')!.value).toBe('');
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

      expect(component.form.get('businessPartnerId')!.value).toBe('');
    });
  });

  describe('initForm (private, via ngOnInit)', () => {
    it('builds an add-mode form without an id control', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('id')).toBeNull();
    });

    it('builds an edit-mode form with an id control', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();

      expect(component.form.get('id')).toBeTruthy();
    });

    it('disables businessPartnerName when data already has a businessPartnerId', () => {
      const component = createComponent();
      component.data = { orderProducts: [], businessPartnerId: 'bp1' } as unknown as Order;

      component.ngOnInit();

      expect(component.form.get('businessPartnerName')!.disabled).toBe(true);
    });

    it('does not add a duplicate transaction group when one already exists', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.form.get('transaction');

      (component as any).addTransactionForm();

      expect(component.form.get('transaction')).toBe(before);
    });

    it('auto-resolves businessPartnerId from the typed name in add mode', () => {
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
    it('computes paymentTotalPrice from totalPrice/totalOfPayments in add mode', () => {
      const component = createComponent();
      component.data = { orderProducts: [], totalPrice: 100, transaction: { totalOfPayments: 4 } } as unknown as Order;

      component.ngOnInit();

      expect(component.transactionFormGroup.get('paymentTotalPrice')!.value).toBe(25);
    });

    it('defaults totalOfPayments to 1 when missing in add mode', () => {
      const component = createComponent();
      component.data = { orderProducts: [], totalPrice: 40 } as unknown as Order;

      component.ngOnInit();

      expect(component.transactionFormGroup.get('paymentTotalPrice')!.value).toBe(40);
    });

    it('falls back to zero totalPrice in add mode', () => {
      const component = createComponent();
      component.data = { orderProducts: [] } as unknown as Order;

      component.ngOnInit();

      expect(component.transactionFormGroup.get('paymentTotalPrice')!.value).toBe(0);
    });

    it('uses the stored paymentTotalPrice directly when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = {
        orderProducts: [],
        transaction: { paymentTotalPrice: 77 },
      } as unknown as Order;

      component.ngOnInit();

      expect(component.transactionFormGroup.get('paymentTotalPrice')!.value).toBe(77);
    });

    it('defaults the transaction id to null when missing', () => {
      const component = createComponent();
      component.data = { orderProducts: [] } as unknown as Order;

      component.ngOnInit();

      expect(component.transactionFormGroup.get('id')!.value).toBeNull();
    });

    it('does not throw without data', () => {
      const component = createComponent();
      component.data = null;
      expect(() => component.ngOnInit()).not.toThrow();
    });
  });

  describe('setupAutoComplete (private, via ngOnInit) / filteredBusinessPartners$', () => {
    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      businessPartnerServiceMock.getClients.mockReturnValue(of({}));

      component.ngOnInit();

      let result: BusinessPartner[] = [];
      component.businessPartnersArray$.subscribe((r) => (result = r));

      expect(result).toEqual([]);
    });

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

  describe('disableEditFields (private, via ngOnInit)', () => {
    it('disables businessPartnerName and orderNumber when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();

      expect(component.form.get('businessPartnerName')!.disabled).toBe(true);
      expect(component.form.get('orderNumber')!.disabled).toBe(true);
    });

    it('leaves fields enabled when not editing', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('orderNumber')!.disabled).toBe(false);
    });
  });

  describe('totalPriceChange (private, via ngOnInit)', () => {
    it('recomputes totalPrice when discount changes', () => {
      const component = createComponent();
      component.ngOnInit();
      component.data!.orderProducts = [{ totalPrice: 100 } as OrderProduct];
      component.form.get('price')!.setValue(100);

      component.form.get('discount')!.setValue(10);

      expect(component.form.get('totalPrice')!.value).toBeCloseTo(90);
    });
  });

  describe('updateTotalPriceFields (private, via removeProduct/onProductPickerItemAdded)', () => {
    it('treats a non-numeric price/discount as zero', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.get('price')!.setValue('' as any);
      component.form.get('discount')!.setValue('' as any);

      (component as any).updateTotalPriceFields();

      expect(component.form.get('totalPrice')!.value).toBe(0);
    });

    it('syncs the transaction paymentTotalPrice only when not editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 'o1', orderProducts: [] } as unknown as Order;
      component.ngOnInit();
      const before = component.transactionFormGroup.get('paymentTotalPrice')!.value;
      component.form.get('price')!.setValue(500);

      (component as any).updateTotalPriceFields();

      expect(component.transactionFormGroup.get('paymentTotalPrice')!.value).toBe(before);
    });
  });

  describe('setupTotalOfPaymentsWatcher (private, via ngOnInit/ngOnChanges)', () => {
    it('recomputes totals when totalOfPayments changes', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.get('price')!.setValue(100);

      component.transactionFormGroup.get('totalOfPayments')!.setValue(2);

      expect(component.transactionFormGroup.get('paymentTotalPrice')!.value).toBe(100);
    });

    it('replaces the previous watcher instead of stacking subscriptions', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = (component as any).totalOfPaymentsSubscription;

      (component as any).setupTotalOfPaymentsWatcher();

      expect((component as any).totalOfPaymentsSubscription).not.toBe(before);
      expect(before.closed).toBe(true);
    });

    it('does nothing when the form has no transaction group', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.removeControl('transaction');

      expect(() => (component as any).setupTotalOfPaymentsWatcher()).not.toThrow();
    });
  });
});
