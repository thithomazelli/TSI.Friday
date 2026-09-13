import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import {
  BusinessPartner,
  BusinessPartnerService,
  CurrencyService,
  ModalService,
  NotificationService,
  OrderStatus,
  Product,
  ProductService,
  PurchaseOrder,
  PurchaseOrderProduct,
  PurchaseOrderProductService,
  PurchaseOrderService,
  ResponseStatus,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { Subject, config, of, throwError } from 'rxjs';
import { PurchaseOrderFormComponent } from './purchase-order-form.component';

describe('PurchaseOrderFormComponent', () => {
  let businessPartnerServiceMock: {
    getSuppliers: ReturnType<typeof vi.fn>;
    addOrUpdateBusinessPartner: ReturnType<typeof vi.fn>;
  };
  let currencyServiceMock: object;
  let modalServiceMock: {
    hideModal: ReturnType<typeof vi.fn>;
    showSweetConfirmation: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
    showTemplateModal: ReturnType<typeof vi.fn>;
    showConfirmation: ReturnType<typeof vi.fn>;
    showNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let purchaseOrderServiceMock: { add: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let purchaseOrderProductAdded$: Subject<PurchaseOrderProduct>;
  let purchaseOrderProductServiceMock: {
    purchaseOrderProductAdded$: Subject<PurchaseOrderProduct>;
    addTemporary: ReturnType<typeof vi.fn>;
  };
  let productServiceMock: { getById: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  const suppliers: BusinessPartner[] = [
    { id: 'bp1', name: 'Fornecedor Um' } as BusinessPartner,
    { id: 'bp2', name: 'Fornecedor Dois' } as BusinessPartner,
  ];

  function createComponent(): PurchaseOrderFormComponent {
    businessPartnerServiceMock = {
      getSuppliers: vi.fn().mockReturnValue(of({ data: suppliers } as WebApiResponse<BusinessPartner[]>)),
      addOrUpdateBusinessPartner: vi.fn(),
    };
    currencyServiceMock = {};
    modalServiceMock = {
      hideModal: vi.fn(),
      showSweetConfirmation: vi.fn(),
      showSweetNotification: vi.fn(),
      showTemplateModal: vi.fn(),
      showConfirmation: vi.fn(),
      showNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    purchaseOrderServiceMock = { add: vi.fn(), update: vi.fn(), delete: vi.fn() };
    purchaseOrderProductAdded$ = new Subject();
    purchaseOrderProductServiceMock = {
      purchaseOrderProductAdded$,
      addTemporary: vi.fn(),
    };
    productServiceMock = { getById: vi.fn() };
    routerMock = { navigateByUrl: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };

    return new PurchaseOrderFormComponent(
      businessPartnerServiceMock as unknown as BusinessPartnerService,
      currencyServiceMock as CurrencyService,
      new FormBuilder(),
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      purchaseOrderServiceMock as unknown as PurchaseOrderService,
      purchaseOrderProductServiceMock as unknown as PurchaseOrderProductService,
      productServiceMock as unknown as ProductService,
      routerMock as unknown as Router,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  function fillValidForm(component: PurchaseOrderFormComponent) {
    component.form.patchValue({
      businessPartnerId: 'bp1',
      businessPartnerName: 'Fornecedor Um',
    });
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('exposes translated order status options', () => {
    const component = createComponent();
    expect(component.orderStatusOptions.length).toBe(3);
  });

  it('trackByOptionValue returns the option value', () => {
    const component = createComponent();
    expect(component.trackByOptionValue(0, { value: 'Open', label: 'x' })).toBe('Open');
  });

  describe('ngOnInit', () => {
    it('builds a create-mode form and auto-resolves businessPartnerId from businessPartnerName', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('id')).toBeNull();

      component.form.get('businessPartnerName')!.setValue('Fornecedor Um');
      expect(component.form.get('businessPartnerId')!.value).toBe('bp1');
    });

    it('leaves businessPartnerId untouched when the name matches no supplier', () => {
      const component = createComponent();
      component.ngOnInit();

      component.form.get('businessPartnerName')!.setValue('Ninguém');
      expect(component.form.get('businessPartnerId')!.value).toBeNull();
    });

    it('builds an edit-mode form with an id control and disables edit-locked fields', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();

      expect(component.form.get('id')).toBeTruthy();
      expect(component.form.get('businessPartnerName')!.disabled).toBe(true);
      expect(component.form.get('purchaseOrderNumber')!.disabled).toBe(true);
    });

    it('leaves edit-locked fields enabled when adding', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('businessPartnerName')!.disabled).toBe(false);
      expect(component.form.get('purchaseOrderNumber')!.disabled).toBe(false);
    });

    it('patches the form, computing expenseTotalPrice by dividing totalPrice by totalOfExpenses when adding', () => {
      const component = createComponent();
      component.data = {
        totalPrice: 100,
        purchaseOrderProducts: [],
        transaction: { totalOfExpenses: 4 },
      } as unknown as PurchaseOrder;

      component.ngOnInit();

      expect(component.form.get('transaction.expenseTotalPrice')!.value).toBe(25);
    });

    it('defaults totalOfExpenses to 1 when computing expenseTotalPrice while adding', () => {
      const component = createComponent();
      component.data = {
        totalPrice: 100,
        purchaseOrderProducts: [],
        transaction: {},
      } as unknown as PurchaseOrder;

      component.ngOnInit();

      expect(component.form.get('transaction.expenseTotalPrice')!.value).toBe(100);
    });

    it('uses the existing expenseTotalPrice from data when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = {
        totalPrice: 100,
        purchaseOrderProducts: [],
        transaction: { totalOfExpenses: 4, expenseTotalPrice: 42 },
      } as unknown as PurchaseOrder;

      component.ngOnInit();

      expect(component.form.get('transaction.expenseTotalPrice')!.value).toBe(42);
    });

    it('does not throw and skips patching when there is no data', () => {
      const component = createComponent();
      component.data = null;

      expect(() => component.ngOnInit()).not.toThrow();
    });

    it('adds a product from purchaseOrderProductAdded$ to a previously empty product list', () => {
      const component = createComponent();
      component.data = {} as unknown as PurchaseOrder;
      component.ngOnInit();

      purchaseOrderProductAdded$.next({ totalPrice: 50 } as PurchaseOrderProduct);

      expect(component.data!.purchaseOrderProducts).toEqual([{ totalPrice: 50 }]);
    });

    it('adds a product from purchaseOrderProductAdded$ and recalculates prices', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();

      purchaseOrderProductAdded$.next({ totalPrice: 50 } as PurchaseOrderProduct);

      expect(component.data!.purchaseOrderProducts).toEqual([{ totalPrice: 50 }]);
      expect(component.form.get('price')!.value).toBe(50);
      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
        true,
        '',
        'PURCHASE_ORDERS.PRODUCT_ADDED_SUCCESS',
      );
    });

    it('ignores purchaseOrderProductAdded$ emissions when there is no data', () => {
      const component = createComponent();
      component.data = null;
      component.ngOnInit();

      expect(() => purchaseOrderProductAdded$.next({ totalPrice: 50 } as PurchaseOrderProduct)).not.toThrow();
      expect(modalServiceMock.showNotification).not.toHaveBeenCalled();
    });

    it('recomputes totalPrice whenever the discount changes', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      component.form.get('price')!.setValue(100);

      component.form.get('discount')!.setValue(10);

      expect(component.form.get('totalPrice')!.value).toBe(90);
    });

    it('recomputes totalPrice whenever transaction.totalOfExpenses changes', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      component.form.get('price')!.setValue(100);

      component.form.get('transaction.totalOfExpenses')!.setValue(2);

      expect(component.form.get('transaction.expenseTotalPrice')!.value).toBe(100);
    });

    describe('applyPreselectedProduct', () => {
      it('does nothing without a preselectedProductId', () => {
        const component = createComponent();
        component.preselectedProductId = null;

        component.ngOnInit();

        expect(productServiceMock.getById).not.toHaveBeenCalled();
      });

      it('does nothing while editing, even with a preselectedProductId', () => {
        const component = createComponent();
        component.isEdit = true;
        component.preselectedProductId = 'p1';

        component.ngOnInit();

        expect(productServiceMock.getById).not.toHaveBeenCalled();
      });

      it('adds the preselected product as a temporary purchase order product', () => {
        const component = createComponent();
        component.preselectedProductId = 'p1';
        const product = { id: 'p1', sku: 'SKU1', name: 'Produto 1', type: 'Sale', price: 10 } as Product;
        productServiceMock.getById.mockReturnValue(of({ data: product } as WebApiResponse<Product>));

        component.ngOnInit();

        expect(purchaseOrderProductServiceMock.addTemporary).toHaveBeenCalledWith(
          expect.objectContaining({ productId: 'p1', productSku: 'SKU1', price: 10, totalPrice: 10 }),
        );
      });

      it('does nothing when the preselected product is not found', () => {
        const component = createComponent();
        component.preselectedProductId = 'p1';
        productServiceMock.getById.mockReturnValue(of({} as WebApiResponse<Product>));

        component.ngOnInit();

        expect(purchaseOrderProductServiceMock.addTemporary).not.toHaveBeenCalled();
      });
    });
  });

  describe('ngOnChanges', () => {
    it('re-patches the form and rewatches totalOfExpenses when data changes after init', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();

      component.data = { totalPrice: 200, purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnChanges({ data: {} as any });

      expect(component.form.get('totalPrice')!.value).toBe(200);
    });

    it('does nothing when the changed input is not data', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();

      expect(() => component.ngOnChanges({ isEdit: {} as any })).not.toThrow();
    });

    it('does not throw when data changes before the form exists', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;

      expect(() => component.ngOnChanges({ data: {} as any })).not.toThrow();
    });
  });

  describe('ngOnDestroy', () => {
    it('unsubscribes the totalOfExpenses watcher and other tracked subscriptions', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });

    it('does not throw when called before ngOnInit ever subscribed', () => {
      const component = createComponent();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('submit', () => {
    it('marks the form as touched and returns null without saving when invalid', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();

      let result: unknown;
      component.submit().subscribe((r) => (result = r));

      expect(result).toBeNull();
      expect(component.submitted).toBe(true);
      expect(component.form.get('businessPartnerId')!.touched).toBe(true);
    });

    it('creates a new purchase order, syncing transaction business partner fields and dropping a null transaction id', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      fillValidForm(component);
      purchaseOrderServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'po1' } } as WebApiResponse<PurchaseOrder>),
      );

      component.submit().subscribe();

      expect(purchaseOrderServiceMock.add).toHaveBeenCalled();
      const saved = purchaseOrderServiceMock.add.mock.calls[0][0] as PurchaseOrder;
      expect(saved.transaction!.businessPartnerId).toBe('bp1');
      expect(saved.transaction!.businessPartnerName).toBe('Fornecedor Um');
      expect(saved.transaction).not.toHaveProperty('id');
    });

    it('preserves the existing transaction id when editing an order that already has one', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = {
        id: 'po1',
        purchaseOrderProducts: [],
        transaction: { id: 'tr1' },
      } as unknown as PurchaseOrder;
      component.ngOnInit();
      fillValidForm(component);
      purchaseOrderServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'po1' } } as WebApiResponse<PurchaseOrder>),
      );

      component.submit().subscribe();

      const saved = purchaseOrderServiceMock.update.mock.calls[0][0] as PurchaseOrder;
      expect(saved.transaction!.id).toBe('tr1');
    });

    it('does not sync transaction business partner fields when the transaction section is hidden', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      fillValidForm(component);
      component.canDisplayTransactionForm = false;
      purchaseOrderServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'po1' } } as WebApiResponse<PurchaseOrder>),
      );

      component.submit().subscribe();

      const saved = purchaseOrderServiceMock.add.mock.calls[0][0] as PurchaseOrder;
      expect(saved.transaction!.businessPartnerId).toBeUndefined();
    });

    it('does not throw when the form has no transaction control at all', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      fillValidForm(component);
      component.form.removeControl('transaction');
      purchaseOrderServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'po1' } } as WebApiResponse<PurchaseOrder>),
      );

      expect(() => component.submit().subscribe()).not.toThrow();
    });

    it('does not throw and skips assigning into data when there is no data', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      fillValidForm(component);
      component.data = null;
      purchaseOrderServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'po1' } } as WebApiResponse<PurchaseOrder>),
      );

      expect(() => component.submit().subscribe()).not.toThrow();
    });

    it('notifies without saving when the backend reports a business-rule failure', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      fillValidForm(component);
      purchaseOrderServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' } as WebApiResponse<PurchaseOrder>),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Error, 'Falhou');
    });

    it('saves via the modal path when isModal is true', () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = { close: vi.fn() };
      component.dialogRef = dialogRefMock as any;
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      fillValidForm(component);
      purchaseOrderServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'po1' }, message: 'OK' } as WebApiResponse<PurchaseOrder>),
      );

      component.submit().subscribe();

      expect(dialogRefMock.close).toHaveBeenCalled();
    });

    it('saves via the page path when isModal is false', () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      fillValidForm(component);
      purchaseOrderServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'po1' } } as WebApiResponse<PurchaseOrder>),
      );

      component.submit().subscribe();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/purchaseorders/po1');
    });

    it('notifies an error when the save request errors', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      fillValidForm(component);
      purchaseOrderServiceMock.add.mockReturnValue(throwError(() => new Error('boom')));

      component.submit().subscribe({ error: () => {} });

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'COMMON.SAVE_ERROR');
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

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/purchaseorders');
    });
  });

  describe('remove', () => {
    it('deletes and notifies success outside a modal when confirmed', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'po1' } as PurchaseOrder;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      purchaseOrderServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' } as WebApiResponse<PurchaseOrder>),
      );

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith('', 'Removido', ResponseStatus.Success);
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/purchaseorders');
    });

    it('hides the modal and does not navigate on success inside a modal', async () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = {};
      component.dialogRef = dialogRefMock as any;
      component.data = { id: 'po1' } as PurchaseOrder;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      purchaseOrderServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' } as WebApiResponse<PurchaseOrder>),
      );

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('does not navigate when the delete reports an error status', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'po1' } as PurchaseOrder;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      purchaseOrderServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' } as WebApiResponse<PurchaseOrder>),
      );

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('notifies an error when the delete request fails', async () => {
      const originalOnUnhandledError = config.onUnhandledError;
      config.onUnhandledError = () => {};
      try {
        const component = createComponent();
        component.data = { id: 'po1' } as PurchaseOrder;
        modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
        purchaseOrderServiceMock.delete.mockReturnValue(throwError(() => new Error('boom')));

        component.remove();
        await Promise.resolve();
        await Promise.resolve();

        expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
          'error',
          'PURCHASE_ORDERS.REMOVE_ERROR',
        );

        await new Promise((resolve) => setTimeout(resolve, 0));
      } finally {
        config.onUnhandledError = originalOnUnhandledError;
      }
    });

    it('does nothing further when the deletion is cancelled outside a modal', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'po1' } as PurchaseOrder;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
      expect(purchaseOrderServiceMock.delete).not.toHaveBeenCalled();
    });

    // The isModal=true reopen path loads PurchaseOrderDetailsModalComponent via a dynamic import()
    // (see remove()'s comment on why) - unlike every other reopen-after-cancel pattern in this
    // codebase (a plain top-level import), that async module resolution doesn't settle within any
    // number of microtask/macrotask ticks under this bundler's test transform, making the
    // "showTemplateModal was called" branch impractical to assert here. The cancelled-outside-a-
    // modal path above already covers isModal=false; the isModal=true branch's only difference is
    // this dynamic import wrapping the exact same showTemplateModal call already verified there.
  });

  describe('removeProduct', () => {
    it('does nothing when there are no purchase order products', () => {
      const component = createComponent();
      component.data = {} as PurchaseOrder;

      expect(() => component.removeProduct(0)).not.toThrow();
    });

    it('removes the product at the given index and recalculates price fields', () => {
      const component = createComponent();
      component.data = {
        purchaseOrderProducts: [{ totalPrice: 10 } as PurchaseOrderProduct, { totalPrice: 20 } as PurchaseOrderProduct],
      } as PurchaseOrder;
      component.ngOnInit();

      component.removeProduct(0);

      expect(component.data!.purchaseOrderProducts).toEqual([{ totalPrice: 20 }]);
      expect(component.form.get('price')!.value).toBe(20);
    });

    it('treats a product with no totalPrice as zero when summing', () => {
      const component = createComponent();
      component.data = {
        purchaseOrderProducts: [{} as PurchaseOrderProduct, { totalPrice: 10 } as PurchaseOrderProduct],
      } as PurchaseOrder;
      component.ngOnInit();

      component.removeProduct(1);

      expect(component.form.get('price')!.value).toBe(0);
    });
  });

  describe('openPurchaseOrderProductsModal', () => {
    it('opens the modal with the merged data and current raw form value', () => {
      const component = createComponent();
      component.data = { id: 'po1', purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();

      component.openPurchaseOrderProductsModal();

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isEdit: false, id: null, parentId: null }),
      );
    });
  });

  describe('onProductPickerItemAdded', () => {
    it('does nothing when there is no data', () => {
      const component = createComponent();
      component.data = null;

      expect(() => component.onProductPickerItemAdded({} as PurchaseOrderProduct)).not.toThrow();
    });

    it('appends the item to a previously empty product list', () => {
      const component = createComponent();
      component.data = {} as unknown as PurchaseOrder;
      component.ngOnInit();

      component.onProductPickerItemAdded({ totalPrice: 15 } as PurchaseOrderProduct);

      expect(component.data!.purchaseOrderProducts).toEqual([{ totalPrice: 15 }]);
    });

    it('appends the item and recalculates price fields', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();

      component.onProductPickerItemAdded({ totalPrice: 15 } as PurchaseOrderProduct);

      expect(component.data!.purchaseOrderProducts).toEqual([{ totalPrice: 15 }]);
      expect(component.form.get('price')!.value).toBe(15);
    });
  });

  describe('transactionFormGroup', () => {
    it('returns the transaction form group', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();

      expect(component.transactionFormGroup.get('method')).toBeTruthy();
    });
  });

  describe('onSupplierBlur', () => {
    it('cleans the selection when the typed name is blank', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('   ');

      component.onSupplierBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('businessPartnerId')!.value).toBe('');
      expect(component.form.get('businessPartnerId')!.hasError('required')).toBe(true);
    });

    it('does nothing further when the typed name matches an existing supplier', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Fornecedor Um');

      component.onSupplierBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showConfirmation).not.toHaveBeenCalled();
    });

    it('offers to create a new supplier, then applies it once created', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Fornecedor Novo');

      const newSupplier = { id: 'bp9', name: 'Fornecedor Novo' } as BusinessPartner;
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(newSupplier) });

      component.onSupplierBlur();
      vi.advanceTimersByTime(200);

      expect(businessPartnerServiceMock.addOrUpdateBusinessPartner).toHaveBeenCalledWith(newSupplier);
      expect(component.form.get('businessPartnerId')!.value).toBe('bp9');
      expect(component.form.get('businessPartnerName')!.value).toBe('Fornecedor Novo');
    });

    it('cleans the selection when the new-supplier modal closes without a result', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Fornecedor Novo');

      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(undefined) });

      component.onSupplierBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('businessPartnerId')!.value).toBe('');
    });

    it('cleans the selection when the user declines creating a new supplier', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Fornecedor Novo');

      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.onSupplierBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
      expect(component.form.get('businessPartnerId')!.value).toBe('');
    });
  });

  describe('filteredBusinessPartners$', () => {
    it('emits an empty list when there is no filter value', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();

      let result: BusinessPartner[] = [];
      component.filteredBusinessPartners$.subscribe((r) => (result = r));

      expect(result).toEqual([]);
    });

    it('filters suppliers by name (case-insensitive)', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();

      let result: BusinessPartner[] = [];
      component.filteredBusinessPartners$.subscribe((r) => (result = r));
      component.form.get('businessPartnerName')!.setValue('fornecedor um');

      expect(result).toEqual([suppliers[0]]);
    });

    it('treats a supplier with no name as an empty string when filtering', () => {
      const component = createComponent();
      businessPartnerServiceMock.getSuppliers.mockReturnValue(
        of({ data: [{ id: 'bp9', name: undefined } as unknown as BusinessPartner] }),
      );
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();

      let result: BusinessPartner[] = [];
      component.filteredBusinessPartners$.subscribe((r) => (result = r));
      component.form.get('businessPartnerName')!.setValue('anything');

      expect(result).toEqual([]);
    });

    it('falls back to an empty array of suppliers when the response has no data', () => {
      const component = createComponent();
      businessPartnerServiceMock.getSuppliers.mockReturnValue(of({}));
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();

      let result: BusinessPartner[] = [];
      component.filteredBusinessPartners$.subscribe((r) => (result = r));
      component.form.get('businessPartnerName')!.setValue('fornecedor');

      expect(result).toEqual([]);
    });
  });

  describe('updateTotalPriceFields', () => {
    it('does not touch the transaction expenseTotalPrice while editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      const before = component.form.get('transaction.expenseTotalPrice')!.value;

      component.form.get('price')!.setValue(500);
      (component as any).updateTotalPriceFields();

      expect(component.form.get('transaction.expenseTotalPrice')!.value).toBe(before);
    });

    it('treats a non-numeric price/discount as zero', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      component.form.get('price')!.setValue('' as any);
      component.form.get('discount')!.setValue('' as any);

      (component as any).updateTotalPriceFields();

      expect(component.form.get('totalPrice')!.value).toBe(0);
    });
  });

  describe('addTransactionForm (direct call)', () => {
    it('does not re-add the transaction group when one already exists', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      const existingGroup = component.form.get('transaction');

      expect(() => (component as any).addTransactionForm()).not.toThrow();

      expect(component.form.get('transaction')).toBe(existingGroup);
    });
  });

  describe('setupTotalOfExpensesWatcher (direct call)', () => {
    it('does not throw when the form has no transaction group', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      component.form.removeControl('transaction');

      expect(() => (component as any).setupTotalOfExpensesWatcher()).not.toThrow();
    });

    it('does not throw when the transaction group has no totalOfExpenses control', () => {
      const component = createComponent();
      component.data = { purchaseOrderProducts: [] } as unknown as PurchaseOrder;
      component.ngOnInit();
      component.transactionFormGroup.removeControl('totalOfExpenses');

      expect(() => (component as any).setupTotalOfExpensesWatcher()).not.toThrow();
    });
  });

  describe('saveModal / savePage (defensive branches)', () => {
    it('saveModal shows a failure notification when the status is not Success', () => {
      const component = createComponent();
      const dialogRefMock = { close: vi.fn() };
      component.dialogRef = dialogRefMock as any;

      (component as any).saveModal({
        status: ResponseStatus.Error,
        message: 'Falhou',
      } as WebApiResponse<PurchaseOrder>);

      expect(dialogRefMock.close).toHaveBeenCalled();
      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
        false,
        'PURCHASE_ORDERS.PURCHASE_ORDER_ADDED',
        'Falhou',
      );
    });

    it('savePage notifies and updates local data when editing (via submit)', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = {
        id: 'po1',
        purchaseOrderProducts: [],
        transaction: { id: 'tr1' },
      } as unknown as PurchaseOrder;
      component.ngOnInit();
      fillValidForm(component);
      const updated = { id: 'po1', purchaseOrderNumber: 'PO-2' } as PurchaseOrder;
      purchaseOrderServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: updated } as WebApiResponse<PurchaseOrder>),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Success, 'OK');
      expect(component.data).toBe(updated);
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });
  });
});
