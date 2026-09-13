import { FormBuilder } from '@angular/forms';
import {
  ModalService,
  NotificationService,
  Order,
  Payment,
  PaymentCondition,
  PaymentMethod,
  PaymentService,
  PaymentStatus,
  PaymentType,
  SelectableOptionService,
  Transaction,
  TranslationService,
  Trip,
  WebApiResponse,
} from '@nexus/core';
import { config, of, throwError } from 'rxjs';
import { PaymentFormComponent } from './payment-form.component';

describe('PaymentFormComponent', () => {
  let modalServiceMock: {
    hideModal: ReturnType<typeof vi.fn>;
    showSweetConfirmation: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
    showTemplateModal: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let paymentServiceMock: {
    add: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let selectableOptionServiceMock: { getByGroup: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };

  function createComponent(): PaymentFormComponent {
    modalServiceMock = {
      hideModal: vi.fn(),
      showSweetConfirmation: vi.fn(),
      showSweetNotification: vi.fn(),
      showTemplateModal: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    paymentServiceMock = { add: vi.fn(), update: vi.fn(), delete: vi.fn() };
    selectableOptionServiceMock = { getByGroup: vi.fn().mockReturnValue(of({ data: [] })) };
    translationServiceMock = { instant: vi.fn((key: string) => key) };

    return new PaymentFormComponent(
      new FormBuilder(),
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      paymentServiceMock as unknown as PaymentService,
      selectableOptionServiceMock as unknown as SelectableOptionService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  function validRawValue() {
    return {
      type: PaymentType.Incoming,
      status: PaymentStatus.Pending,
      condition: PaymentCondition.FullPayment,
      method: PaymentMethod.Cash,
      category: 'cat1',
      date: new Date(),
      description: 'Pagamento',
      installmentNumber: 0,
      price: 100,
    };
  }

  function fillValidForm(component: PaymentFormComponent) {
    component.form.patchValue(validRawValue());
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('option getters', () => {
    it('exposes translated status, type, method and condition options', () => {
      const component = createComponent();

      expect(component.statusOptions).toEqual([
        { label: 'REPORTS.STATUS_OPEN', value: PaymentStatus.Pending },
        { label: 'REPORTS.STATUS_PAID', value: PaymentStatus.Approved },
        { label: 'REPORTS.STATUS_DELAYED', value: PaymentStatus.Delayed },
      ]);
      expect(component.typeOptions).toEqual([
        { label: 'REPORTS.INCOMING', value: PaymentType.Incoming },
        { label: 'REPORTS.OUTGOING', value: PaymentType.Outgoing },
      ]);
      expect(component.methodOptions).toEqual([
        { label: 'TRANSACTIONS.METHOD_CASH', value: PaymentMethod.Cash },
        { label: 'TRANSACTIONS.METHOD_PIX', value: PaymentMethod.Pix },
        { label: 'TRANSACTIONS.METHOD_CREDIT_CARD', value: PaymentMethod.CreditCard },
      ]);
      expect(component.conditionOptions).toEqual([
        { label: 'TRANSACTIONS.FULL_PAYMENT', value: PaymentCondition.FullPayment },
        { label: 'TRANSACTIONS.IN_PAYMENTS', value: PaymentCondition.InInstallments },
      ]);
    });
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
      component.data = { description: 'Pgto existente' } as Payment;

      component.ngOnInit();

      expect(component.form.get('description')!.value).toBe('Pgto existente');
    });

    it('disables the form when the payment is already Approved', () => {
      const component = createComponent();
      component.data = { status: PaymentStatus.Approved } as Payment;

      component.ngOnInit();

      expect(component.form.disabled).toBe(true);
    });

    it('does not disable the form when there is no data', () => {
      const component = createComponent();

      component.ngOnInit();

      expect(component.form.disabled).toBe(false);
    });

    it('disables businessPartnerName, orderNumber and type when editing', () => {
      const component = createComponent();
      component.isEdit = true;

      component.ngOnInit();

      expect(component.form.get('businessPartnerName')!.disabled).toBe(true);
      expect(component.form.get('orderNumber')!.disabled).toBe(true);
      expect(component.form.get('type')!.disabled).toBe(true);
    });

    it('loads categories and falls back to an empty array when the response has no data', () => {
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

    it('builds the transaction-derived fields from Order-like parentData', () => {
      const component = createComponent();
      component.parentData = {
        id: 'o1',
        transactionId: 't1',
        transaction: { description: 'Desc do pedido' },
        businessPartnerId: 'bp1',
        businessPartnerName: 'Cliente',
        orderNumber: 'ORD-1',
      } as unknown as Order;

      component.ngOnInit();

      expect(component.form.get('transactionId')!.value).toBe('t1');
      expect(component.form.get('transactionDescription')!.value).toBe('Desc do pedido');
      expect(component.form.get('orderId')!.value).toBe('o1');
      expect(component.form.get('tripId')!.value).toBe('');
    });

    it('builds the transaction-derived fields from Trip-like parentData', () => {
      const component = createComponent();
      component.parentData = {
        id: 'trip1',
        transactionId: 't2',
        transaction: null,
        tripNumber: 'TRIP-1',
      } as unknown as Trip;

      component.ngOnInit();

      expect(component.form.get('tripId')!.value).toBe('trip1');
      expect(component.form.get('orderId')!.value).toBe('');
      expect(component.form.get('transactionDescription')!.value).toBe('');
    });

    it('falls back to empty strings when Order-like parentData has no transactionId or id', () => {
      const component = createComponent();
      component.parentData = {
        id: '',
        transactionId: '',
        transaction: undefined,
        orderNumber: 'ORD-2',
      } as unknown as Order;

      component.ngOnInit();

      expect(component.form.get('transactionId')!.value).toBe('');
      expect(component.form.get('orderId')!.value).toBe('');
    });

    it('falls back to an empty tripId when Trip-like parentData has no id', () => {
      const component = createComponent();
      component.parentData = {
        id: '',
        transactionId: 't3',
        tripNumber: 'TRIP-2',
      } as unknown as Trip;

      component.ngOnInit();

      expect(component.form.get('tripId')!.value).toBe('');
    });

    it('builds the transaction-derived fields from Transaction-like parentData', () => {
      const component = createComponent();
      component.parentId = 'tx1';
      component.parentData = {
        description: 'Desc da transacao',
        orderId: 'o2',
        tripId: 'trip2',
      } as unknown as Transaction;

      component.ngOnInit();

      expect(component.form.get('transactionDescription')!.value).toBe('Desc da transacao');
      expect(component.form.get('orderId')!.value).toBe('o2');
      expect(component.form.get('tripId')!.value).toBe('trip2');
      expect(component.form.get('transactionId')!.value).toBe('tx1');
    });

    it('falls back to empty transactionId when there is no parentId for a Transaction parent', () => {
      const component = createComponent();
      component.parentId = null;
      component.parentData = { description: '', orderId: '', tripId: '' } as unknown as Transaction;

      component.ngOnInit();

      expect(component.form.get('transactionId')!.value).toBe('');
    });

    it('leaves the transaction-derived fields empty when there is no parentData', () => {
      const component = createComponent();

      component.ngOnInit();

      expect(component.form.get('transactionId')!.value).toBe('');
      expect(component.form.get('orderId')!.value).toBe('');
      expect(component.form.get('tripId')!.value).toBe('');
    });
  });

  describe('ngOnChanges', () => {
    it('patches the form when data changes to a new value after init', () => {
      const component = createComponent();
      component.ngOnInit();
      component.data = { description: 'Novo' } as Payment;

      component.ngOnChanges({ data: { currentValue: component.data } as never });

      expect(component.form.get('description')!.value).toBe('Novo');
    });

    it('does nothing when the changed input is not data', () => {
      const component = createComponent();
      component.ngOnInit();

      component.ngOnChanges({ compact: { currentValue: true } as never });

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

    it('does nothing when there is no form yet', () => {
      const component = createComponent();

      expect(() =>
        component.ngOnChanges({ data: { currentValue: { description: 'X' } } as never }),
      ).not.toThrow();
    });

    it('re-initializes the form when isEdit changes after the first change', () => {
      const component = createComponent();
      component.ngOnInit();
      expect(component.form.get('id')).toBeNull();
      component.isEdit = true;

      component.ngOnChanges({
        isEdit: { currentValue: true, firstChange: false } as never,
      });

      expect(component.form.get('id')).toBeTruthy();
    });

    it('does not re-initialize the form on the first isEdit change', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.form;

      component.ngOnChanges({
        isEdit: { currentValue: false, firstChange: true } as never,
      });

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

    it('does not throw when there are no subscriptions to clean up', () => {
      const component = createComponent();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('submit', () => {
    it('marks the form as touched and returns null without saving when invalid', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: unknown;
      component.submit().subscribe((r) => (result = r));

      expect(result).toBeNull();
      expect(component.form.get('type')!.touched).toBe(true);
      expect(paymentServiceMock.add).not.toHaveBeenCalled();
    });

    it('adds a new payment when not editing and there is no existing data', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      paymentServiceMock.add.mockReturnValue(
        of({ status: 'Success', message: 'OK', data: { id: 'p1' } } as WebApiResponse<Payment>),
      );

      component.submit().subscribe();

      expect(paymentServiceMock.add).toHaveBeenCalled();
    });

    it('merges the raw value into data before saving, and updates when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 'p1' } as Payment;
      component.ngOnInit();
      fillValidForm(component);
      paymentServiceMock.update.mockReturnValue(
        of({ status: 'Success', message: 'OK', data: { id: 'p1' } } as WebApiResponse<Payment>),
      );

      component.submit().subscribe();

      expect(paymentServiceMock.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'p1', description: 'Pagamento' }),
      );
    });

    it('adds instead of updating when isEdit is true but there is no existing data', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();
      fillValidForm(component);
      paymentServiceMock.add.mockReturnValue(
        of({ status: 'Success', message: 'OK', data: { id: 'p1' } } as WebApiResponse<Payment>),
      );

      component.submit().subscribe();

      expect(paymentServiceMock.add).toHaveBeenCalled();
      expect(paymentServiceMock.update).not.toHaveBeenCalled();
    });

    it('closes the dialog and shows a sweet notification on success', () => {
      const component = createComponent();
      const dialogRefMock = { close: vi.fn() };
      component.dialogRef = dialogRefMock as any;
      component.ngOnInit();
      fillValidForm(component);
      paymentServiceMock.add.mockReturnValue(
        of({ status: 'Success', message: 'Salvo com sucesso' } as WebApiResponse<Payment>),
      );

      component.submit().subscribe();

      expect(dialogRefMock.close).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Salvo com sucesso' }),
      );
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Salvo com sucesso',
        'Success',
      );
    });

    it('notifies an error when the save request errors', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      paymentServiceMock.add.mockReturnValue(throwError(() => new Error('boom')));

      component.submit().subscribe({ error: () => {} });

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'Error',
        'COMMON.SAVE_ERROR',
      );
    });
  });

  describe('cancel', () => {
    it('hides the modal via the dialogRef', () => {
      const component = createComponent();
      const dialogRefMock = {};
      component.dialogRef = dialogRefMock as any;

      component.cancel();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
    });
  });

  describe('remove', () => {
    it('hides the current modal and deletes when confirmed, notifying via the modal path', async () => {
      const component = createComponent();
      component.isModal = true;
      component.data = { id: 'p1' } as Payment;
      const dialogRefMock = {};
      component.dialogRef = dialogRefMock as any;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      paymentServiceMock.delete.mockReturnValue(
        of({ status: 'Success', message: 'Removido' } as WebApiResponse<Payment>),
      );

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith();
      expect(paymentServiceMock.delete).toHaveBeenCalledWith(component.data);
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Removido',
        'Success',
      );
    });

    it('deletes and notifies without hiding the dialogRef when not a modal', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'p1' } as Payment;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      paymentServiceMock.delete.mockReturnValue(
        of({ status: 'Success', message: 'Removido' } as WebApiResponse<Payment>),
      );

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Removido',
        'Success',
      );
    });

    it('notifies an error when the delete request errors', async () => {
      const component = createComponent();
      component.data = { id: 'p1' } as Payment;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      paymentServiceMock.delete.mockReturnValue(throwError(() => new Error('fail')));

      const originalOnUnhandledError = config.onUnhandledError;
      config.onUnhandledError = () => {};
      try {
        component.remove();
        await Promise.resolve();
        await Promise.resolve();

        expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
          'error',
          'ORDERS.REMOVE_ERROR',
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      } finally {
        config.onUnhandledError = originalOnUnhandledError;
      }
    });

    it('does not delete and reopens the modal when cancelled inside a modal', async () => {
      const component = createComponent();
      component.isModal = true;
      component.isEdit = true;
      component.data = { id: 'p1' } as Payment;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(paymentServiceMock.delete).not.toHaveBeenCalled();
      // Reopening the modal goes through a dynamic `import(...)` of
      // PaymentDetailsModalComponent, which is impractical to assert on
      // meaningfully in this spec (see product-form.component.spec.ts for
      // the same accepted residual pattern).
    });

    it('does nothing further when cancelled outside a modal', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'p1' } as Payment;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(paymentServiceMock.delete).not.toHaveBeenCalled();
      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
    });
  });
});
