import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import {
  ModalService,
  NotificationService,
  Product,
  ProductService,
  ProductType,
  VehicleMaintenanceProduct,
  VehicleMaintenanceProductService,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { config, of, throwError } from 'rxjs';
import { VehicleMaintenanceProductFormComponent } from './vehicle-maintenance-products-form.component';

describe('VehicleMaintenanceProductFormComponent', () => {
  let modalServiceMock: {
    hideModal: ReturnType<typeof vi.fn>;
    showSweetConfirmation: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
    showTemplateModal: ReturnType<typeof vi.fn>;
    showConfirmation: ReturnType<typeof vi.fn>;
    showNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let vehicleMaintenanceProductServiceMock: {
    add: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let productServiceMock: { getAll: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  const products: Product[] = [
    { id: 'p1', sku: 'SKU1', name: 'Produto 1', price: 10, type: ProductType.Sale, quantityInStock: 5 } as Product,
    { id: 'p2', sku: 'SKU2', name: 'Produto 2', price: 20, type: ProductType.Rental, quantityInStock: 3 } as Product,
    { id: 'p3', sku: undefined, name: undefined, price: 30, type: ProductType.Sale } as unknown as Product,
  ];

  function createComponent(): VehicleMaintenanceProductFormComponent {
    modalServiceMock = {
      hideModal: vi.fn(),
      showSweetConfirmation: vi.fn(),
      showSweetNotification: vi.fn(),
      showTemplateModal: vi.fn(),
      showConfirmation: vi.fn(),
      showNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    vehicleMaintenanceProductServiceMock = { add: vi.fn(), update: vi.fn(), delete: vi.fn() };
    productServiceMock = {
      getAll: vi.fn().mockReturnValue(of({ data: products } as WebApiResponse<Product[]>)),
    };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };

    return new VehicleMaintenanceProductFormComponent(
      new FormBuilder(),
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      vehicleMaintenanceProductServiceMock as unknown as VehicleMaintenanceProductService,
      productServiceMock as unknown as ProductService,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('exposes translated product type options', () => {
    const component = createComponent();
    expect(component.productTypeOptions.length).toBe(3);
  });

  it('trackByOptionValue returns the option value', () => {
    const component = createComponent();
    expect(component.trackByOptionValue(0, { value: 'Sale', label: 'x' })).toBe('Sale');
  });

  describe('ngOnInit', () => {
    it('initializes a create-mode form and auto-resolves productId from productName', async () => {
      const component = createComponent();
      await component.ngOnInit();

      expect(component.form.get('id')).toBeNull();

      component.form.get('productName')!.setValue('Produto 1');
      expect(component.form.get('productId')!.value).toBe('p1');
    });

    it('leaves productId untouched when productName matches no product', async () => {
      const component = createComponent();
      await component.ngOnInit();

      component.form.get('productName')!.setValue('Ninguém');
      expect(component.form.get('productId')!.value).toBe('');
    });

    it('initializes an edit-mode form with an id control and disables sku/name', async () => {
      const component = createComponent();
      component.isEdit = true;
      await component.ngOnInit();

      expect(component.form.get('id')).toBeTruthy();
      expect(component.form.get('productSku')!.disabled).toBe(true);
      expect(component.form.get('productName')!.disabled).toBe(true);
    });

    it('leaves sku/name enabled when not editing', async () => {
      const component = createComponent();
      await component.ngOnInit();

      expect(component.form.get('productSku')!.disabled).toBe(false);
      expect(component.form.get('productName')!.disabled).toBe(false);
    });

    it('patches the form with the provided data', async () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { productName: 'Produto 1', quantity: 5 } as VehicleMaintenanceProduct;
      await component.ngOnInit();

      expect(component.form.get('quantity')!.value).toBe(5);
    });

    it('does not throw without data', async () => {
      const component = createComponent();
      await expect(component.ngOnInit()).resolves.not.toThrow();
    });

    it('recomputes totalPrice on init and whenever price/quantity/discount change', async () => {
      vi.useFakeTimers();
      const component = createComponent();
      await component.ngOnInit();
      vi.advanceTimersByTime(0);

      component.form.get('price')!.setValue(100);
      component.form.get('quantity')!.setValue(2);
      component.form.get('discount')!.setValue(10);

      expect(component.form.get('totalPrice')!.value).toBeCloseTo(180);
    });
  });

  describe('ngOnChanges', () => {
    it('re-patches the form when data changes after init', async () => {
      const component = createComponent();
      await component.ngOnInit();

      component.data = { quantity: 9 } as VehicleMaintenanceProduct;
      component.ngOnChanges({ data: {} as any });

      expect(component.form.get('quantity')!.value).toBe(9);
    });

    it('does nothing when the changed input is not data', async () => {
      const component = createComponent();
      await component.ngOnInit();

      component.ngOnChanges({ isEdit: {} as any });

      expect(component.form.get('quantity')!.value).toBe(1);
    });

    it('does not throw when data changes before the form exists', () => {
      const component = createComponent();
      component.data = { quantity: 9 } as VehicleMaintenanceProduct;

      expect(() => component.ngOnChanges({ data: {} as any })).not.toThrow();
    });
  });

  describe('ngOnDestroy', () => {
    it('unsubscribes the productName auto-resolve subscription', async () => {
      const component = createComponent();
      await component.ngOnInit();

      component.ngOnDestroy();
      component.form.get('productName')!.setValue('Produto 1');

      expect(component.form.get('productId')!.value).toBe('');
    });
  });

  describe('submit', () => {
    it('marks the form as touched and returns null without saving when invalid', async () => {
      const component = createComponent();
      await component.ngOnInit();

      let result: unknown;
      component.submit().subscribe((r) => (result = r));

      expect(result).toBeNull();
      expect(component.submitted).toBe(true);
    });

    it('adds a new record and does not notify when there is no parentId', async () => {
      const component = createComponent();
      await component.ngOnInit();
      component.form.patchValue({ productId: 'p1', quantity: 1, price: 10, discount: 0 });
      vehicleMaintenanceProductServiceMock.add.mockReturnValue(
        of({ message: 'OK', status: 'success' } as unknown as WebApiResponse<VehicleMaintenanceProduct>),
      );

      component.submit().subscribe();

      expect(vehicleMaintenanceProductServiceMock.add).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).not.toHaveBeenCalled();
    });

    it('notifies when parentId is present and merges rawValue into data when editing', async () => {
      const component = createComponent();
      component.parentId = 'vm1';
      component.isEdit = true;
      component.data = { id: 'vmp1' } as VehicleMaintenanceProduct;
      await component.ngOnInit();
      component.form.get('productId')!.setValue('p1');
      component.form.get('price')!.setValue(10);
      vehicleMaintenanceProductServiceMock.update.mockReturnValue(
        of({ message: 'Salvo', status: 'success' } as unknown as WebApiResponse<VehicleMaintenanceProduct>),
      );

      component.submit().subscribe();

      expect(component.data).toMatchObject({ id: 'vmp1', productId: 'p1' });
      expect(vehicleMaintenanceProductServiceMock.update).toHaveBeenCalledWith(
        expect.objectContaining({ vehicleMaintenanceId: 'vm1' }),
      );
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith('', 'Salvo', 'success');
    });

    it('adds instead of updating when creating with a parentId', async () => {
      const component = createComponent();
      component.parentId = 'vm1';
      await component.ngOnInit();
      component.form.get('productId')!.setValue('p1');
      component.form.get('price')!.setValue(10);
      vehicleMaintenanceProductServiceMock.add.mockReturnValue(
        of({ message: 'OK', status: 'success' } as unknown as WebApiResponse<VehicleMaintenanceProduct>),
      );

      component.submit().subscribe();

      expect(vehicleMaintenanceProductServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ vehicleMaintenanceId: 'vm1' }),
      );
    });

    it('closes the dialog when saving succeeds and a dialogRef is present', async () => {
      const component = createComponent();
      const dialogRefMock = { close: vi.fn() };
      component.dialogRef = dialogRefMock as any;
      await component.ngOnInit();
      component.form.get('productId')!.setValue('p1');
      component.form.get('price')!.setValue(10);
      vehicleMaintenanceProductServiceMock.add.mockReturnValue(
        of({ message: 'OK', status: 'success' } as unknown as WebApiResponse<VehicleMaintenanceProduct>),
      );

      component.submit().subscribe();

      expect(dialogRefMock.close).toHaveBeenCalled();
    });

    it('notifies an error when saving fails', async () => {
      const component = createComponent();
      await component.ngOnInit();
      component.form.get('productId')!.setValue('p1');
      component.form.get('price')!.setValue(10);
      vehicleMaintenanceProductServiceMock.add.mockReturnValue(throwError(() => new Error('boom')));

      component.submit().subscribe({ error: () => {} });

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'COMMON.SAVE_ERROR');
    });
  });

  it('cancel hides the modal via the dialogRef', () => {
    const component = createComponent();
    const dialogRefMock = {};
    component.dialogRef = dialogRefMock as any;

    component.cancel();

    expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
  });

  describe('remove', () => {
    it('deletes and notifies success outside a modal when confirmed', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'vmp1' } as VehicleMaintenanceProduct;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      vehicleMaintenanceProductServiceMock.delete.mockReturnValue(
        of({ message: 'Removido', status: 'success' } as unknown as WebApiResponse<VehicleMaintenanceProduct>),
      );

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith();
      expect(modalServiceMock.hideModal).not.toHaveBeenCalledWith(component.dialogRef);
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('success', 'Removido');
    });

    it('hides the modal and notifies success inside a modal when confirmed', async () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = {};
      component.dialogRef = dialogRefMock as any;
      component.data = { id: 'vmp1' } as VehicleMaintenanceProduct;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      vehicleMaintenanceProductServiceMock.delete.mockReturnValue(
        of({ message: 'Removido', status: 'success' } as unknown as WebApiResponse<VehicleMaintenanceProduct>),
      );

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('success', 'Removido');
    });

    it('notifies an error when the delete request fails', async () => {
      const originalOnUnhandledError = config.onUnhandledError;
      config.onUnhandledError = () => {};
      try {
        const component = createComponent();
        component.data = { id: 'vmp1' } as VehicleMaintenanceProduct;
        modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
        vehicleMaintenanceProductServiceMock.delete.mockReturnValue(throwError(() => new Error('boom')));

        component.remove();
        await Promise.resolve();
        await Promise.resolve();

        expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
          'error',
          'VEHICLES.SAVE_MAINTENANCE_ERROR',
        );

        await new Promise((resolve) => setTimeout(resolve, 0));
      } finally {
        config.onUnhandledError = originalOnUnhandledError;
      }
    });

    it('does nothing further when the deletion is cancelled outside a modal', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'vmp1' } as VehicleMaintenanceProduct;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
      expect(vehicleMaintenanceProductServiceMock.delete).not.toHaveBeenCalled();
    });

    it('reopens the details modal when the deletion is cancelled inside a modal', async () => {
      const component = createComponent();
      component.isModal = true;
      component.isEdit = true;
      component.data = { id: 'vmp1' } as VehicleMaintenanceProduct;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isEdit: true, data: component.data, id: 'vmp1' }),
      );
    });
  });

  describe('selectProduct', () => {
    it('does nothing when no product is given', async () => {
      const component = createComponent();
      await component.ngOnInit();

      expect(() => component.selectProduct(null as unknown as Product)).not.toThrow();
      expect(component.form.get('productId')!.value).toBe('');
    });

    it('rejects an out-of-stock product (not a service) and clears the fields', async () => {
      const component = createComponent();
      await component.ngOnInit();
      const outOfStock = { id: 'p4', sku: 'SKU4', name: 'Sem Estoque', type: ProductType.Sale, quantityInStock: 0 } as Product;

      component.selectProduct(outOfStock);

      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
        false,
        'PRODUCTS.OUT_OF_STOCK_TITLE',
        'PRODUCTS.OUT_OF_STOCK_MESSAGE',
      );
      expect(component.form.get('productSku')!.value).toBe('');
      expect(component.form.get('productId')!.value).toBe('');
    });

    it('allows a Service-type product regardless of stock', async () => {
      const component = createComponent();
      await component.ngOnInit();
      const service = { id: 'p5', sku: 'SKU5', name: 'Serviço', type: ProductType.Service, quantityInStock: 0 } as Product;

      component.selectProduct(service);

      expect(modalServiceMock.showNotification).not.toHaveBeenCalled();
      expect(component.form.get('productId')!.value).toBe('p5');
    });

    it('re-adds the productId control if missing, then patches the selected product', async () => {
      const component = createComponent();
      await component.ngOnInit();
      component.form.removeControl('productId');

      component.selectProduct(products[0]);

      expect(component.form.get('productId')!.value).toBe('p1');
      expect(component.form.get('productSku')!.value).toBe('SKU1');
    });

    it('creates a new data object when none exists yet', async () => {
      const component = createComponent();
      component.data = null;
      await component.ngOnInit();

      component.selectProduct(products[0]);

      expect(component.data).toMatchObject({ productId: 'p1', productSku: 'SKU1' });
    });

    it('mutates the existing data object when one is already present', async () => {
      const component = createComponent();
      component.data = { id: 'vmp1' } as VehicleMaintenanceProduct;
      await component.ngOnInit();

      component.selectProduct(products[1]);

      expect(component.data).toMatchObject({ id: 'vmp1', productId: 'p2', productSku: 'SKU2' });
    });
  });

  describe('onProductSkuBlur', () => {
    it('cleans the selection when the typed sku is blank', async () => {
      vi.useFakeTimers();
      const component = createComponent();
      await component.ngOnInit();
      component.form.get('productSku')!.setValue('   ');

      component.onProductSkuBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('productId')!.value).toBe('');
      expect(component.form.get('productId')!.hasError('required')).toBe(true);
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('does nothing further when the typed sku matches an existing product', async () => {
      vi.useFakeTimers();
      const component = createComponent();
      await component.ngOnInit();
      component.form.get('productSku')!.setValue('SKU1');

      component.onProductSkuBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showConfirmation).not.toHaveBeenCalled();
    });

    it('offers to create a new product, then selects it once created', async () => {
      vi.useFakeTimers();
      const component = createComponent();
      await component.ngOnInit();
      component.form.get('productSku')!.setValue('SKU-NEW');

      const newProduct = { id: 'p9', sku: 'SKU-NEW', name: 'Novo', type: ProductType.Sale, price: 5 } as Product;
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({
        afterClosed: () => of({ data: newProduct } as WebApiResponse<Product>),
      });

      component.onProductSkuBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showConfirmation).toHaveBeenCalled();
      expect(component.form.get('productId')!.value).toBe('p9');
    });

    it('cleans the selection when the new-product modal closes without a result', async () => {
      vi.useFakeTimers();
      const component = createComponent();
      await component.ngOnInit();
      component.form.get('productSku')!.setValue('SKU-NEW');

      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(undefined) });

      component.onProductSkuBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('productId')!.value).toBe('');
      expect(component.form.get('productId')!.hasError('required')).toBe(true);
    });

    it('cleans the selection when the user declines creating a new product', async () => {
      vi.useFakeTimers();
      const component = createComponent();
      await component.ngOnInit();
      component.form.get('productSku')!.setValue('SKU-NEW');

      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.onProductSkuBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
      expect(component.form.get('productId')!.value).toBe('');
    });
  });

  describe('onProductNameBlur', () => {
    it('cleans the selection when the typed name is blank', async () => {
      vi.useFakeTimers();
      const component = createComponent();
      await component.ngOnInit();
      component.form.get('productName')!.setValue('   ');

      component.onProductNameBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('productId')!.value).toBe('');
    });

    it('does nothing further when the typed name matches an existing product', async () => {
      vi.useFakeTimers();
      const component = createComponent();
      await component.ngOnInit();
      component.form.get('productName')!.setValue('Produto 1');

      component.onProductNameBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showConfirmation).not.toHaveBeenCalled();
    });

    it('offers to create a new product, then selects it once created', async () => {
      vi.useFakeTimers();
      const component = createComponent();
      await component.ngOnInit();
      component.form.get('productName')!.setValue('Produto Novo');

      const newProduct = { id: 'p9', sku: 'SKU-NEW', name: 'Produto Novo', type: ProductType.Sale, price: 5 } as Product;
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({
        afterClosed: () => of({ data: newProduct } as WebApiResponse<Product>),
      });

      component.onProductNameBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('productId')!.value).toBe('p9');
    });

    it('cleans the selection when the new-product modal closes without a result', async () => {
      vi.useFakeTimers();
      const component = createComponent();
      await component.ngOnInit();
      component.form.get('productName')!.setValue('Produto Novo');

      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(undefined) });

      component.onProductNameBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('productId')!.value).toBe('');
    });

    it('cleans the selection when the user declines creating a new product', async () => {
      vi.useFakeTimers();
      const component = createComponent();
      await component.ngOnInit();
      component.form.get('productName')!.setValue('Produto Novo');

      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.onProductNameBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
      expect(component.form.get('productId')!.value).toBe('');
    });
  });

  describe('onQuantityBlur', () => {
    it('does nothing when there is no quantity control or productSku is blank', async () => {
      const component = createComponent();
      await component.ngOnInit();
      component.form.removeControl('quantity');

      expect(() => component.onQuantityBlur()).not.toThrow();
      expect(modalServiceMock.showNotification).not.toHaveBeenCalled();
    });

    it('does nothing when the matching product has no known stock quantity', async () => {
      const component = createComponent();
      await component.ngOnInit();
      component.form.get('productSku')!.setValue('SKU1');
      (component as any).products$ = { data: [{ sku: 'SKU1', quantityInStock: null }] };

      component.onQuantityBlur();

      expect(modalServiceMock.showNotification).not.toHaveBeenCalled();
    });

    it('warns and resets the quantity when it exceeds the available stock', async () => {
      const component = createComponent();
      await component.ngOnInit();
      component.form.get('productSku')!.setValue('SKU1');
      component.form.get('quantity')!.setValue(10);
      component.data = { previousQuantity: 2 } as VehicleMaintenanceProduct;
      (component as any).products$ = { data: [{ sku: 'SKU1', quantityInStock: 5 }] };

      component.onQuantityBlur();

      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
        false,
        'PRODUCTS.STOCK_EXCEEDED_TITLE',
        'PRODUCTS.STOCK_EXCEEDED_MESSAGE',
      );
      expect(component.form.get('quantity')!.value).toBe(2);
    });

    it('resets the quantity to 1 when there is no previousQuantity to fall back to', async () => {
      const component = createComponent();
      await component.ngOnInit();
      component.form.get('productSku')!.setValue('SKU1');
      component.form.get('quantity')!.setValue(10);
      component.data = null;
      (component as any).products$ = { data: [{ sku: 'SKU1', quantityInStock: 5 }] };

      component.onQuantityBlur();

      expect(component.form.get('quantity')!.value).toBe(1);
    });

    it('does not warn when the requested quantity is within stock', async () => {
      const component = createComponent();
      await component.ngOnInit();
      component.form.get('productSku')!.setValue('SKU1');
      component.form.get('quantity')!.setValue(3);
      (component as any).products$ = { data: [{ sku: 'SKU1', quantityInStock: 5 }] };

      component.onQuantityBlur();

      expect(modalServiceMock.showNotification).not.toHaveBeenCalled();
    });
  });

  describe('filteredProductsSku$ / filteredProductsName$', () => {
    it('emits an empty list when there is no filter value', async () => {
      const component = createComponent();
      await component.ngOnInit();

      let sku: Product[] = [];
      let name: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (sku = r));
      component.filteredProductsName$.subscribe((r) => (name = r));

      expect(sku).toEqual([]);
      expect(name).toEqual([]);
    });

    it('filters by sku (case-insensitive) and flags alreadyUsed/disabled', async () => {
      const component = createComponent();
      component.parentData = { vehicleMaintenanceProducts: [{ productId: 'p1' } as VehicleMaintenanceProduct] };
      await component.ngOnInit();

      let result: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (result = r));
      component.form.get('productSku')!.setValue('sku1');

      expect(result).toEqual([expect.objectContaining({ id: 'p1', alreadyUsed: true, disabled: false })]);
    });

    it('filters by name (case-insensitive) and flags alreadyUsed', async () => {
      const component = createComponent();
      component.parentData = { vehicleMaintenanceProducts: [{ productId: 'p2' } as VehicleMaintenanceProduct] };
      await component.ngOnInit();

      let result: Product[] = [];
      component.filteredProductsName$.subscribe((r) => (result = r));
      component.form.get('productName')!.setValue('produto 2');

      expect(result).toEqual([expect.objectContaining({ id: 'p2', alreadyUsed: true })]);
    });

    it('resolves the filter value from an object emission (sku)', async () => {
      const component = createComponent();
      await component.ngOnInit();

      let result: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (result = r));
      component.form.get('productSku')!.setValue({ sku: 'SKU2' } as unknown as string);

      expect(result[0]).toMatchObject({ id: 'p2' });
    });

    it('resolves the filter value from an object emission (name)', async () => {
      const component = createComponent();
      await component.ngOnInit();

      let result: Product[] = [];
      component.filteredProductsName$.subscribe((r) => (result = r));
      component.form.get('productName')!.setValue({ name: 'Produto 2' } as unknown as string);

      expect(result[0]).toMatchObject({ id: 'p2' });
    });

    it('falls back to an empty filter for an object emission missing the expected field', async () => {
      const component = createComponent();
      await component.ngOnInit();

      let sku: Product[] = [];
      let name: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (sku = r));
      component.filteredProductsName$.subscribe((r) => (name = r));

      component.form.get('productSku')!.setValue({} as unknown as string);
      component.form.get('productName')!.setValue({} as unknown as string);

      expect(sku).toEqual([]);
      expect(name).toEqual([]);
    });

    it('falls back to an empty filter for a non-string, non-object emission (null)', async () => {
      const component = createComponent();
      await component.ngOnInit();

      let sku: Product[] = [];
      let name: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (sku = r));
      component.filteredProductsName$.subscribe((r) => (name = r));

      component.form.get('productSku')!.setValue(null);
      component.form.get('productName')!.setValue(null);

      expect(sku).toEqual([]);
      expect(name).toEqual([]);
    });

    it('treats a product with no sku/name as an empty string when filtering', async () => {
      const component = createComponent();
      await component.ngOnInit();

      let sku: Product[] = [];
      let name: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (sku = r));
      component.filteredProductsName$.subscribe((r) => (name = r));

      component.form.get('productSku')!.setValue('sku1');
      component.form.get('productName')!.setValue('produto 2');

      expect(sku.find((p) => p.id === 'p3')).toBeUndefined();
      expect(name.find((p) => p.id === 'p3')).toBeUndefined();
    });
  });

  describe('setupAutoComplete', () => {
    it('falls back to an empty array when the product response has no data', async () => {
      const component = createComponent();
      productServiceMock.getAll.mockReturnValue(of({} as WebApiResponse<Product[]>));
      await component.ngOnInit();

      let result: Product[] = [];
      component.productsArray$.subscribe((r) => (result = r));

      expect(result).toEqual([]);
    });
  });

  describe('updateTotalPrice', () => {
    it('treats a non-numeric quantity as zero', async () => {
      vi.useFakeTimers();
      const component = createComponent();
      await component.ngOnInit();
      vi.advanceTimersByTime(0);
      component.form.get('price')!.setValue(100);
      component.form.get('quantity')!.setValue('');

      expect(component.form.get('totalPrice')!.value).toBe(0);
    });
  });
});
