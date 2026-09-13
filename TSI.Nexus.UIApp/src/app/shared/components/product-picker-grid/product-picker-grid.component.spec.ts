import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import {
  CurrencyService,
  ModalService,
  Product,
  ProductService,
  ProductType,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { of } from 'rxjs';
import { ProductPickerGridComponent } from './product-picker-grid.component';

describe('ProductPickerGridComponent', () => {
  let currencyServiceMock: { formatCurrencyBRL: ReturnType<typeof vi.fn> };
  let modalServiceMock: {
    showConfirmation: ReturnType<typeof vi.fn>;
    showTemplateModal: ReturnType<typeof vi.fn>;
    showNotification: ReturnType<typeof vi.fn>;
  };
  let productServiceMock: { getAll: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  const products: Product[] = [
    { id: 'p1', sku: 'SKU1', name: 'Produto 1', price: 10, type: ProductType.Sale, quantityInStock: 5 } as Product,
    { id: 'p2', sku: 'SKU2', name: 'Produto 2', price: 20, type: ProductType.Rental, quantityInStock: 8 } as Product,
    { id: 'p3', sku: undefined, name: undefined, price: 30, type: ProductType.Sale, quantityInStock: 1 } as unknown as Product,
    { id: 'p4', sku: 'SKU4', name: 'Produto 4', price: 15, type: ProductType.Service } as Product,
    { id: 'p5', sku: 'SKU5', name: 'Produto 5', price: 25, type: ProductType.Sale, quantityInStock: 0 } as Product,
  ];

  function createComponent(): ProductPickerGridComponent {
    currencyServiceMock = { formatCurrencyBRL: vi.fn((v: number) => `R$ ${v}`) };
    modalServiceMock = {
      showConfirmation: vi.fn(),
      showTemplateModal: vi.fn(),
      showNotification: vi.fn(),
    };
    productServiceMock = {
      getAll: vi.fn().mockReturnValue(of({ data: products } as WebApiResponse<Product[]>)),
    };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };

    return new ProductPickerGridComponent(
      currencyServiceMock as unknown as CurrencyService,
      new FormBuilder(),
      modalServiceMock as unknown as ModalService,
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

  describe('ngOnInit', () => {
    it('builds the inline form and loads products', () => {
      const component = createComponent();

      component.ngOnInit();

      expect(component.inlineProductForm.get('productId')).toBeTruthy();
      expect(productServiceMock.getAll).toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('stops the products subscription', () => {
      const component = createComponent();
      component.ngOnInit();

      component.ngOnDestroy();
      component.inlineProductForm.get('productSku')!.setValue('SKU1');

      expect(component.inlineProductForm.get('productId')!.value).toBe('');
    });
  });

  describe('selectProduct', () => {
    it('does nothing when no product is given', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() => component.selectProduct(null as unknown as Product)).not.toThrow();
      expect(component.inlineProductForm.get('productId')!.value).toBe('');
    });

    it('patches the form with the selected product', () => {
      const component = createComponent();
      component.ngOnInit();

      component.selectProduct(products[0]);

      expect(component.inlineProductForm.get('productId')!.value).toBe('p1');
      expect(component.inlineProductForm.get('productSku')!.value).toBe('SKU1');
    });

    it('allows a Service product with no stock when filterOutOfStock is true', () => {
      const component = createComponent();
      component.filterOutOfStock = true;
      component.ngOnInit();

      component.selectProduct(products[3]);

      expect(modalServiceMock.showNotification).not.toHaveBeenCalled();
      expect(component.inlineProductForm.get('productId')!.value).toBe('p4');
    });

    it('blocks a zero-stock Sale product when filterOutOfStock is true', () => {
      const component = createComponent();
      component.filterOutOfStock = true;
      component.ngOnInit();

      component.selectProduct(products[4]);

      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
        false,
        'PRODUCTS.OUT_OF_STOCK_TITLE',
        'PRODUCTS.OUT_OF_STOCK_MESSAGE',
      );
      expect(component.inlineProductForm.get('productId')!.value).toBe('');
    });

    it('blocks selection when quantityInStock is undefined', () => {
      const component = createComponent();
      component.filterOutOfStock = true;
      component.ngOnInit();
      const noStock = { id: 'p6', sku: 'SKU6', name: 'Sem estoque', type: ProductType.Sale } as Product;

      component.selectProduct(noStock);

      expect(modalServiceMock.showNotification).toHaveBeenCalled();
    });

    it('blocks selection when quantityInStock is null', () => {
      const component = createComponent();
      component.filterOutOfStock = true;
      component.ngOnInit();
      const noStock = { id: 'p6', sku: 'SKU6', name: 'Sem estoque', type: ProductType.Sale, quantityInStock: null } as unknown as Product;

      component.selectProduct(noStock);

      expect(modalServiceMock.showNotification).toHaveBeenCalled();
    });

    it('allows a zero-stock product when filterOutOfStock is false (purchase order flow)', () => {
      const component = createComponent();
      component.filterOutOfStock = false;
      component.ngOnInit();

      component.selectProduct(products[4]);

      expect(modalServiceMock.showNotification).not.toHaveBeenCalled();
      expect(component.inlineProductForm.get('productId')!.value).toBe('p5');
    });
  });

  describe('onProductSkuBlur', () => {
    it('cleans the selection when the typed sku is blank', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.inlineProductForm.get('productSku')!.setValue('   ');

      component.onProductSkuBlur();
      vi.advanceTimersByTime(200);

      expect(component.inlineProductForm.get('productId')!.value).toBe('');
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('selects the product when the typed sku matches an existing product', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.inlineProductForm.get('productSku')!.setValue('SKU1');

      component.onProductSkuBlur();
      vi.advanceTimersByTime(200);

      expect(component.inlineProductForm.get('productId')!.value).toBe('p1');
    });

    it('offers to create a new product when the sku matches nothing', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.inlineProductForm.get('productSku')!.setValue('SKU-NEW');
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.onProductSkuBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showConfirmation).toHaveBeenCalled();
    });
  });

  describe('onProductNameBlur', () => {
    it('cleans the selection when the typed name is blank', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.inlineProductForm.get('productName')!.setValue('   ');

      component.onProductNameBlur();
      vi.advanceTimersByTime(200);

      expect(component.inlineProductForm.get('productId')!.value).toBe('');
    });

    it('selects the product when the typed name matches an existing product', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.inlineProductForm.get('productName')!.setValue('Produto 1');

      component.onProductNameBlur();
      vi.advanceTimersByTime(200);

      expect(component.inlineProductForm.get('productId')!.value).toBe('p1');
    });

    it('offers to create a new product when the name matches nothing', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.inlineProductForm.get('productName')!.setValue('Produto Novo');
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.onProductNameBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showConfirmation).toHaveBeenCalled();
    });
  });

  describe('confirmAndCreateProduct (private, via onProductSkuBlur/onProductNameBlur)', () => {
    it('cleans the selection when the user declines creating a new product', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.inlineProductForm.get('productSku')!.setValue('SKU-NEW');
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.onProductSkuBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
      expect(component.inlineProductForm.get('productId')!.value).toBe('');
    });

    it('creates and selects the new product once confirmed', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.inlineProductForm.get('productSku')!.setValue('SKU-NEW');
      const newProduct = { id: 'p9', sku: 'SKU-NEW', name: 'Novo', type: ProductType.Sale, price: 5, quantityInStock: 5 } as Product;
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({
        afterClosed: () => of({ data: newProduct } as WebApiResponse<Product>),
      });

      component.onProductSkuBlur();
      vi.advanceTimersByTime(200);

      expect(component.inlineProductForm.get('productId')!.value).toBe('p9');
    });

    it('cleans the selection when the new-product modal closes without a result', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.inlineProductForm.get('productName')!.setValue('Produto Novo');
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(undefined) });

      component.onProductNameBlur();
      vi.advanceTimersByTime(200);

      expect(component.inlineProductForm.get('productId')!.value).toBe('');
    });

    it('falls back to an empty name when called with neither sku nor name', () => {
      const component = createComponent();
      component.ngOnInit();
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      (component as any).confirmAndCreateProduct({});

      expect(translationServiceMock.instant).toHaveBeenCalledWith(
        'COMMON.CONFIRM_ADD_ENTITY',
        expect.objectContaining({ name: '' }),
      );
    });

    it('uses the name when there is no sku to compute the confirmation message', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.inlineProductForm.get('productName')!.setValue('Produto Sem Sku');
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.onProductNameBlur();
      vi.advanceTimersByTime(200);

      expect(translationServiceMock.instant).toHaveBeenCalledWith(
        'COMMON.CONFIRM_ADD_ENTITY',
        expect.objectContaining({ name: 'Produto Sem Sku' }),
      );
    });
  });

  describe('onQuantityBlur', () => {
    it('does nothing when filterOutOfStock is false', () => {
      const component = createComponent();
      component.filterOutOfStock = false;
      component.ngOnInit();
      component.inlineProductForm.get('productSku')!.setValue('SKU1');
      component.inlineProductForm.get('quantity')!.setValue(100);

      component.onQuantityBlur();

      expect(modalServiceMock.showNotification).not.toHaveBeenCalled();
    });

    it('does nothing when there is no quantity control', () => {
      const component = createComponent();
      component.ngOnInit();
      component.inlineProductForm.removeControl('quantity');
      component.inlineProductForm.get('productSku')!.setValue('SKU1');

      expect(() => component.onQuantityBlur()).not.toThrow();
    });

    it('does nothing when there is no productSku value', () => {
      const component = createComponent();
      component.ngOnInit();

      component.onQuantityBlur();

      expect(modalServiceMock.showNotification).not.toHaveBeenCalled();
    });

    it('does nothing when the product cannot be found', () => {
      const component = createComponent();
      component.ngOnInit();
      component.inlineProductForm.get('productSku')!.setValue('UNKNOWN');

      expect(() => component.onQuantityBlur()).not.toThrow();
      expect(modalServiceMock.showNotification).not.toHaveBeenCalled();
    });

    it('does nothing when the found product has no quantityInStock', () => {
      const component = createComponent();
      component.ngOnInit();
      component.inlineProductForm.get('productSku')!.setValue('SKU4');

      component.onQuantityBlur();

      expect(modalServiceMock.showNotification).not.toHaveBeenCalled();
    });

    it('does nothing when the requested quantity is within stock', () => {
      const component = createComponent();
      component.ngOnInit();
      component.inlineProductForm.get('productSku')!.setValue('SKU1');
      component.inlineProductForm.get('quantity')!.setValue(3);

      component.onQuantityBlur();

      expect(modalServiceMock.showNotification).not.toHaveBeenCalled();
      expect(component.inlineProductForm.get('quantity')!.value).toBe(3);
    });

    it('notifies and resets to 1 when exceeding stock', () => {
      const component = createComponent();
      component.ngOnInit();
      component.inlineProductForm.get('productSku')!.setValue('SKU1');
      component.inlineProductForm.get('quantity')!.setValue(10);

      component.onQuantityBlur();

      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
        false,
        'PRODUCTS.STOCK_EXCEEDED_TITLE',
        'PRODUCTS.STOCK_EXCEEDED_MESSAGE',
      );
      expect(component.inlineProductForm.get('quantity')!.value).toBe(1);
    });
  });

  describe('addProduct', () => {
    it('does nothing without a selected product', () => {
      const component = createComponent();
      component.ngOnInit();
      let emitted = false;
      component.itemAdded.subscribe(() => (emitted = true));

      component.addProduct();

      expect(emitted).toBe(false);
    });

    it('emits the staged item and cleans the selection', () => {
      const component = createComponent();
      component.ngOnInit();
      component.selectProduct(products[0]);
      component.inlineProductForm.get('quantity')!.setValue(2);
      let emitted: any;
      component.itemAdded.subscribe((v) => (emitted = v));

      component.addProduct();

      expect(emitted).toMatchObject({
        productId: 'p1',
        productSku: 'SKU1',
        quantity: 2,
        price: 10,
        totalPrice: 20,
        priceFormatted: 'R$ 10',
        totalPriceFormatted: 'R$ 20',
        discount: 0,
      });
      expect(component.inlineProductForm.get('productId')!.value).toBe('');
    });

    it('defaults quantity to 1 and price to 0 when they are not numeric', () => {
      const component = createComponent();
      component.ngOnInit();
      component.selectProduct(products[0]);
      component.inlineProductForm.get('quantity')!.setValue('' as any);
      component.inlineProductForm.get('price')!.setValue('' as any);
      let emitted: any;
      component.itemAdded.subscribe((v) => (emitted = v));

      component.addProduct();

      expect(emitted).toMatchObject({ quantity: 1, price: 0, totalPrice: 0 });
    });

    it('does nothing without a productId even if productSku is set', () => {
      const component = createComponent();
      component.ngOnInit();
      component.inlineProductForm.get('productSku')!.setValue('SKU1');
      let emitted = false;
      component.itemAdded.subscribe(() => (emitted = true));

      component.addProduct();

      expect(emitted).toBe(false);
    });
  });

  describe('removeItem / openModal', () => {
    it('emits the removed index', () => {
      const component = createComponent();
      let removedIndex: number | undefined;
      component.itemRemoved.subscribe((i) => (removedIndex = i));

      component.removeItem(3);

      expect(removedIndex).toBe(3);
    });

    it('emits openManualModal', () => {
      const component = createComponent();
      let opened = false;
      component.openManualModal.subscribe(() => (opened = true));

      component.openModal();

      expect(opened).toBe(true);
    });
  });

  describe('trackBy helpers', () => {
    it('trackByProductId returns the product id', () => {
      const component = createComponent();
      expect(component.trackByProductId(0, { id: 'p1' } as Product)).toBe('p1');
    });

    it('trackByIndex returns the index', () => {
      const component = createComponent();
      expect(component.trackByIndex(4)).toBe(4);
    });
  });

  describe('filteredProductsSku$ / filteredProductsName$', () => {
    it('emits an empty list when there is no filter value', () => {
      const component = createComponent();
      component.ngOnInit();

      let sku: Product[] = [];
      let name: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (sku = r));
      component.filteredProductsName$.subscribe((r) => (name = r));

      expect(sku).toEqual([]);
      expect(name).toEqual([]);
    });

    it('filters by sku (case-insensitive) and flags alreadyUsed', () => {
      const component = createComponent();
      component.items = [{ productId: 'p1' }];
      component.ngOnInit();

      let result: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (result = r));
      component.inlineProductForm.get('productSku')!.setValue('sku1');

      expect(result).toEqual([expect.objectContaining({ id: 'p1', alreadyUsed: true })]);
    });

    it('filters by name (case-insensitive) and flags alreadyUsed', () => {
      const component = createComponent();
      component.items = [{ productId: 'p2' }];
      component.ngOnInit();

      let result: Product[] = [];
      component.filteredProductsName$.subscribe((r) => (result = r));
      component.inlineProductForm.get('productName')!.setValue('produto 2');

      expect(result).toEqual([expect.objectContaining({ id: 'p2', alreadyUsed: true })]);
    });

    it('treats a non-string filter value as an empty filter', () => {
      const component = createComponent();
      component.ngOnInit();

      let sku: Product[] = [];
      let name: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (sku = r));
      component.filteredProductsName$.subscribe((r) => (name = r));

      component.inlineProductForm.get('productSku')!.setValue({ sku: 'SKU1' } as unknown as string);
      component.inlineProductForm.get('productName')!.setValue(null);

      expect(sku).toEqual([]);
      expect(name).toEqual([]);
    });

    it('treats a product with no sku/name as an empty string when filtering', () => {
      const component = createComponent();
      component.ngOnInit();

      let sku: Product[] = [];
      let name: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (sku = r));
      component.filteredProductsName$.subscribe((r) => (name = r));

      component.inlineProductForm.get('productSku')!.setValue('sku1');
      component.inlineProductForm.get('productName')!.setValue('produto 2');

      expect(sku.find((p) => p.id === 'p3')).toBeUndefined();
      expect(name.find((p) => p.id === 'p3')).toBeUndefined();
    });

    it('flags disabled only when filterOutOfStock is true and stock is zero or less', () => {
      const component = createComponent();
      component.filterOutOfStock = true;
      component.ngOnInit();

      let sku: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (sku = r));
      component.inlineProductForm.get('productSku')!.setValue('sku');

      expect(sku.find((p) => p.id === 'p5')).toMatchObject({ disabled: true });
      expect(sku.find((p) => p.id === 'p1')).toMatchObject({ disabled: false });
    });

    it('never disables options when filterOutOfStock is false', () => {
      const component = createComponent();
      component.filterOutOfStock = false;
      component.ngOnInit();

      let sku: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (sku = r));
      component.inlineProductForm.get('productSku')!.setValue('sku');

      expect(sku.find((p) => p.id === 'p5')).toMatchObject({ disabled: false });
    });

    it('treats missing items as not already used', () => {
      const component = createComponent();
      component.items = null;
      component.ngOnInit();

      let sku: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (sku = r));
      component.inlineProductForm.get('productSku')!.setValue('sku1');

      expect(sku.find((p) => p.id === 'p1')).toMatchObject({ alreadyUsed: undefined });
    });
  });

  describe('setupAutoComplete', () => {
    it('falls back to an empty array when the product response has no data', () => {
      const component = createComponent();
      productServiceMock.getAll.mockReturnValue(of({} as WebApiResponse<Product[]>));

      component.ngOnInit();

      let result: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (result = r));
      component.inlineProductForm.get('productSku')!.setValue('a');

      expect(result).toEqual([]);
    });
  });
});
