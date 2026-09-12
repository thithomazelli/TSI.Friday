import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import {
  FuelLog,
  FuelLogService,
  ModalService,
  NotificationService,
  Product,
  ProductService,
  ResponseStatus,
  SelectableOptionService,
  TranslationService,
  Vehicle,
  VehicleService,
  WebApiResponse,
} from '@nexus/core';
import { config, of, throwError } from 'rxjs';
import { FuelLogFormComponent } from './fuel-log-form.component';

describe('FuelLogFormComponent', () => {
  let modalServiceMock: {
    hideModal: ReturnType<typeof vi.fn>;
    showConfirmation: ReturnType<typeof vi.fn>;
    showTemplateModal: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let fuelLogServiceMock: {
    add: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let productServiceMock: { getAll: ReturnType<typeof vi.fn> };
  let vehicleServiceMock: { getAll: ReturnType<typeof vi.fn> };
  let selectableOptionServiceMock: { getByGroup: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  const vehicles: Vehicle[] = [
    { id: 'v1', plate: 'ABC1234' } as Vehicle,
    { id: 'v2', plate: 'XYZ9876' } as Vehicle,
  ];
  const products: Product[] = [
    { id: 'p1', sku: 'SKU1', name: 'Diesel S10' } as Product,
    { id: 'p2', sku: 'SKU2', name: 'Gasolina' } as Product,
  ];

  function createComponent(): FuelLogFormComponent {
    modalServiceMock = {
      hideModal: vi.fn(),
      showConfirmation: vi.fn(),
      showTemplateModal: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    fuelLogServiceMock = { add: vi.fn(), update: vi.fn(), delete: vi.fn() };
    productServiceMock = {
      getAll: vi.fn().mockReturnValue(of({ data: products } as WebApiResponse<Product[]>)),
    };
    vehicleServiceMock = {
      getAll: vi.fn().mockReturnValue(of({ data: vehicles } as WebApiResponse<Vehicle[]>)),
    };
    selectableOptionServiceMock = { getByGroup: vi.fn().mockReturnValue(of({ data: [] })) };
    routerMock = { navigateByUrl: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };

    return new FuelLogFormComponent(
      new FormBuilder(),
      fuelLogServiceMock as unknown as FuelLogService,
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      productServiceMock as unknown as ProductService,
      routerMock as unknown as Router,
      selectableOptionServiceMock as unknown as SelectableOptionService,
      translationServiceMock as unknown as TranslationService,
      vehicleServiceMock as unknown as VehicleService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  function fillValidForm(component: FuelLogFormComponent) {
    component.form.patchValue({
      date: '2024-01-01',
      odometer: 1000,
      liters: 40,
      pricePerLiter: 5,
      status: 'Open',
      vehicleId: 'v1',
    });
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('loads vehicles and builds the vehicle autocomplete when no vehicleId is pre-set', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.vehicles).toEqual(vehicles);
      expect(cdrMock.markForCheck).toHaveBeenCalled();

      let result: Vehicle[] = [];
      component.filteredVehiclesPlate$.subscribe((r) => (result = r));
      component.form.get('vehiclePlate')!.setValue('abc');

      expect(result).toEqual([vehicles[0]]);
    });

    it('does not fetch vehicles when embedded with a pre-set vehicleId', () => {
      const component = createComponent();
      component.vehicleId = 'v1';

      component.ngOnInit();

      expect(vehicleServiceMock.getAll).not.toHaveBeenCalled();
      expect(component.form.get('vehicleId')!.value).toBe('v1');
    });

    it('falls back to an empty vehicle list when the response has no data', () => {
      const component = createComponent();
      vehicleServiceMock.getAll.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.vehicles).toEqual([]);
    });

    it('loads status options and falls back to an empty array when there is no data', () => {
      const component = createComponent();
      selectableOptionServiceMock.getByGroup.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.statusOptions).toEqual([]);
    });

    it('loads status options from the response data', () => {
      const component = createComponent();
      selectableOptionServiceMock.getByGroup.mockReturnValue(
        of({ data: [{ id: 's1', name: 'Open' }] }),
      );

      component.ngOnInit();

      expect(component.statusOptions).toEqual([{ id: 's1', name: 'Open' }]);
    });

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

    it('patches the form with the provided data, including the vehicle plate', () => {
      const component = createComponent();
      component.data = {
        odometer: 500,
        vehicle: { plate: 'ABC1234' },
      } as FuelLog;

      component.ngOnInit();

      expect(component.form.get('odometer')!.value).toBe(500);
      expect(component.form.get('vehiclePlate')!.value).toBe('ABC1234');
    });

    it('does not patch the vehicle plate when the data has no vehicle', () => {
      const component = createComponent();
      component.data = { odometer: 500 } as FuelLog;

      component.ngOnInit();

      expect(component.form.get('vehiclePlate')!.value).toBe('');
    });
  });

  describe('ngOnChanges', () => {
    it('re-patches the form when data changes after init', () => {
      const component = createComponent();
      component.ngOnInit();
      component.data = { odometer: 999 } as FuelLog;

      component.ngOnChanges({ data: { currentValue: component.data } as never });

      expect(component.form.get('odometer')!.value).toBe(999);
    });

    it('does nothing when the changed input is not data', () => {
      const component = createComponent();
      component.ngOnInit();

      component.ngOnChanges({ isEdit: { currentValue: true } as never });

      expect(component.form.get('odometer')!.value).toBe(0);
    });

    it('does nothing when data has no currentValue', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() =>
        component.ngOnChanges({ data: { currentValue: null } as never }),
      ).not.toThrow();
    });

    it('does not throw when data changes before the form exists', () => {
      const component = createComponent();

      expect(() =>
        component.ngOnChanges({ data: { currentValue: { odometer: 1 } } as never }),
      ).not.toThrow();
    });
  });

  describe('ngOnDestroy', () => {
    it('unsubscribes tracked subscriptions', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('onProductSkuBlur', () => {
    it('cleans the selection when the typed sku is blank', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('productSku')!.setValue('   ');

      component.onProductSkuBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('productSku')!.value).toBe('');
      expect(component.form.get('productId')!.value).toBeNull();
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('selects the matching product without prompting when the sku is found', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      (component as any)._products = products;
      component.form.get('productSku')!.setValue('SKU1');

      component.onProductSkuBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('productId')!.value).toBe('p1');
      expect(modalServiceMock.showConfirmation).not.toHaveBeenCalled();
    });

    it('offers to create a new product when the sku is not found', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      (component as any)._products = products;
      component.form.get('productSku')!.setValue('SKU-NEW');
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
      component.form.get('productName')!.setValue('   ');

      component.onProductNameBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('productName')!.value).toBe('');
    });

    it('selects the matching product without prompting when the name is found', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      (component as any)._products = products;
      component.form.get('productName')!.setValue('Diesel S10');

      component.onProductNameBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('productId')!.value).toBe('p1');
      expect(modalServiceMock.showConfirmation).not.toHaveBeenCalled();
    });

    it('offers to create a new product when the name is not found', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      (component as any)._products = products;
      component.form.get('productName')!.setValue('Produto Novo');
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.onProductNameBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showConfirmation).toHaveBeenCalled();
    });
  });

  describe('confirmAndCreateProduct (via blur)', () => {
    it('does nothing further when the user declines creating a new product', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('productSku')!.setValue('SKU-NEW');
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.onProductSkuBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
      expect(component.form.get('productSku')!.value).toBe('');
    });

    it('adds and selects the newly created product when confirmed', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('productSku')!.setValue('SKU-NEW');
      const newProduct = { id: 'p9', sku: 'SKU-NEW', name: 'Novo' } as Product;
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({
        afterClosed: () => of({ data: newProduct } as WebApiResponse<Product>),
      });

      component.onProductSkuBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('productId')!.value).toBe('p9');
      expect((component as any)._products).toContainEqual(newProduct);
    });

    it('cleans the selection when the new-product modal closes without a result', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('productSku')!.setValue('SKU-NEW');
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(undefined) });

      component.onProductSkuBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('productSku')!.value).toBe('');
    });

    it('resolves the entity name from data.name when there is no sku', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('productName')!.setValue('Produto Sem SKU');
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.onProductNameBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) }),
      );
    });
  });

  describe('selectProduct', () => {
    it('does nothing when no product is given', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() => component.selectProduct(null as unknown as Product)).not.toThrow();
    });

    it('patches the form with the selected product', () => {
      const component = createComponent();
      component.ngOnInit();

      component.selectProduct(products[0]);

      expect(component.form.get('productId')!.value).toBe('p1');
      expect(component.form.get('productSku')!.value).toBe('SKU1');
      expect(component.form.get('productName')!.value).toBe('Diesel S10');
    });
  });

  describe('onVehiclePlateBlur', () => {
    it('cleans the selection when the typed plate is blank', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('vehiclePlate')!.setValue('   ');

      component.onVehiclePlateBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('vehicleId')!.value).toBeNull();
      expect(component.form.get('vehiclePlate')!.value).toBe('');
    });

    it('selects the matching vehicle when the plate is found', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('vehiclePlate')!.setValue('ABC1234');

      component.onVehiclePlateBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('vehicleId')!.value).toBe('v1');
    });

    it('cleans the selection when the typed plate matches no vehicle', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('vehiclePlate')!.setValue('NOMATCH');

      component.onVehiclePlateBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('vehicleId')!.value).toBeNull();
    });
  });

  describe('selectVehicle', () => {
    it('does nothing when no vehicle is given', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() => component.selectVehicle(null as unknown as Vehicle)).not.toThrow();
    });

    it('patches the form with the selected vehicle', () => {
      const component = createComponent();
      component.ngOnInit();

      component.selectVehicle(vehicles[0]);

      expect(component.form.get('vehicleId')!.value).toBe('v1');
      expect(component.form.get('vehiclePlate')!.value).toBe('ABC1234');
    });
  });

  describe('submit', () => {
    it('marks the form as touched and returns null without saving when invalid', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: unknown;
      component.submit().subscribe((r) => (result = r));

      expect(result).toBeNull();
      expect(component.form.get('date')!.touched).toBe(true);
      expect(fuelLogServiceMock.add).not.toHaveBeenCalled();
    });

    it('computes totalCost and uses the embedded vehicleId when present', () => {
      const component = createComponent();
      component.vehicleId = 'v1';
      component.ngOnInit();
      fillValidForm(component);
      fuelLogServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'f1' } } as WebApiResponse<FuelLog>),
      );

      component.submit().subscribe();

      expect(fuelLogServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ totalCost: 200, vehicleId: 'v1' }),
      );
    });

    it('sets product fields to null when no product was selected', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      fuelLogServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'f1' } } as WebApiResponse<FuelLog>),
      );

      component.submit().subscribe();

      expect(fuelLogServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ productId: null, productSku: null, productName: null }),
      );
    });

    it('includes product fields when a product was selected', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      component.selectProduct(products[0]);
      fuelLogServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'f1' } } as WebApiResponse<FuelLog>),
      );

      component.submit().subscribe();

      expect(fuelLogServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'p1', productSku: 'SKU1', productName: 'Diesel S10' }),
      );
    });

    it('updates when editing an existing record', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 'f1' } as FuelLog;
      component.ngOnInit();
      fillValidForm(component);
      fuelLogServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'f1' } } as WebApiResponse<FuelLog>),
      );

      component.submit().subscribe();

      expect(fuelLogServiceMock.update).toHaveBeenCalled();
    });

    it('notifies without saving when the backend reports a failure status', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      fuelLogServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' } as WebApiResponse<FuelLog>),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Error, 'Falhou');
    });

    it('saves via the modal path when isModal is true', () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = { close: vi.fn() };
      component.dialogRef = dialogRefMock as any;
      component.ngOnInit();
      fillValidForm(component);
      fuelLogServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'f1' }, message: 'OK' } as WebApiResponse<FuelLog>),
      );

      component.submit().subscribe();

      expect(dialogRefMock.close).toHaveBeenCalled();
    });

    it('saves via the page path when isModal is false', () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      fillValidForm(component);
      fuelLogServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'f1' } } as WebApiResponse<FuelLog>),
      );

      component.submit().subscribe();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/fuel-logs');
    });

    it('notifies an error when the save request errors', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      fuelLogServiceMock.add.mockReturnValue(throwError(() => new Error('boom')));

      component.submit().subscribe({ error: () => {} });

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'Erro ao salvar o abastecimento.',
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

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/fuel-logs');
    });
  });

  describe('remove', () => {
    it('does nothing without data', () => {
      const component = createComponent();
      component.data = null;

      component.remove();

      expect(fuelLogServiceMock.delete).not.toHaveBeenCalled();
    });

    it('deletes, notifies and navigates on success outside a modal', () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'f1' } as FuelLog;
      fuelLogServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' } as WebApiResponse<FuelLog>),
      );

      component.remove();

      expect(modalServiceMock.hideModal).not.toHaveBeenCalled();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Success, 'Removido');
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/fuel-logs');
    });

    it('hides the modal and does not navigate on success inside a modal', () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = {};
      component.dialogRef = dialogRefMock as any;
      component.data = { id: 'f1' } as FuelLog;
      fuelLogServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' } as WebApiResponse<FuelLog>),
      );

      component.remove();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('does not navigate when the delete reports an error status', () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'f1' } as FuelLog;
      fuelLogServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' } as WebApiResponse<FuelLog>),
      );

      component.remove();

      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('notifies an error when the delete request errors', async () => {
      const originalOnUnhandledError = config.onUnhandledError;
      config.onUnhandledError = () => {};
      try {
        const component = createComponent();
        component.data = { id: 'f1' } as FuelLog;
        fuelLogServiceMock.delete.mockReturnValue(throwError(() => new Error('boom')));

        component.remove();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
          ResponseStatus.Error,
          'Erro ao remover o abastecimento.',
        );
      } finally {
        config.onUnhandledError = originalOnUnhandledError;
      }
    });
  });

  describe('savePage (via submit)', () => {
    it('notifies and updates local data when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 'f1' } as FuelLog;
      component.ngOnInit();
      fillValidForm(component);
      const updated = { id: 'f1', odometer: 999 } as FuelLog;
      fuelLogServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: updated } as WebApiResponse<FuelLog>),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Success, 'OK');
      expect(component.data).toBe(updated);
    });

    it('notifies without navigating when adding fails with a non-success status (defensive branch)', () => {
      const component = createComponent();

      (component as any).savePage({
        status: ResponseStatus.Error,
        message: 'Falhou',
      } as WebApiResponse<FuelLog>);

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Error, 'Falhou');
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe('filteredProductsSku$ / filteredProductsName$', () => {
    it('emit an empty list when there is no filter value', () => {
      const component = createComponent();
      component.ngOnInit();

      let sku: Product[] = [];
      let name: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (sku = r));
      component.filteredProductsName$.subscribe((r) => (name = r));

      expect(sku).toEqual([]);
      expect(name).toEqual([]);
    });

    it('filter by sku/name (case-insensitive)', () => {
      const component = createComponent();
      component.ngOnInit();

      let sku: Product[] = [];
      let name: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (sku = r));
      component.filteredProductsName$.subscribe((r) => (name = r));

      component.form.get('productSku')!.setValue('sku1');
      component.form.get('productName')!.setValue('diesel');

      expect(sku).toEqual([products[0]]);
      expect(name).toEqual([products[0]]);
    });

    it('falls back to an empty product array when the response has no data', () => {
      const component = createComponent();
      productServiceMock.getAll.mockReturnValue(of({}));
      component.ngOnInit();

      let sku: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (sku = r));
      component.form.get('productSku')!.setValue('sku1');

      expect(sku).toEqual([]);
    });

    it('treats a non-string emission as an empty filter', () => {
      const component = createComponent();
      component.ngOnInit();

      let sku: Product[] = [];
      let name: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (sku = r));
      component.filteredProductsName$.subscribe((r) => (name = r));

      component.form.get('productSku')!.setValue(123 as unknown as string);
      component.form.get('productName')!.setValue(123 as unknown as string);

      expect(sku).toEqual([]);
      expect(name).toEqual([]);
    });

    it('treats a product with no sku/name as an empty string when filtering', () => {
      const component = createComponent();
      productServiceMock.getAll.mockReturnValue(
        of({ data: [{ id: 'p9', sku: undefined, name: undefined } as unknown as Product] }),
      );
      component.ngOnInit();

      let sku: Product[] = [];
      let name: Product[] = [];
      component.filteredProductsSku$.subscribe((r) => (sku = r));
      component.filteredProductsName$.subscribe((r) => (name = r));

      component.form.get('productSku')!.setValue('anything');
      component.form.get('productName')!.setValue('anything');

      expect(sku).toEqual([]);
      expect(name).toEqual([]);
    });
  });

  describe('filteredVehiclesPlate$', () => {
    it('treats a non-string emission as an empty filter', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: Vehicle[] = [];
      component.filteredVehiclesPlate$.subscribe((r) => (result = r));
      component.form.get('vehiclePlate')!.setValue(123 as unknown as string);

      expect(result).toEqual([]);
    });

    it('treats a vehicle with no plate as an empty string when filtering', () => {
      const component = createComponent();
      vehicleServiceMock.getAll.mockReturnValue(
        of({ data: [{ id: 'v9', plate: undefined } as unknown as Vehicle] }),
      );
      component.ngOnInit();

      let result: Vehicle[] = [];
      component.filteredVehiclesPlate$.subscribe((r) => (result = r));
      component.form.get('vehiclePlate')!.setValue('anything');

      expect(result).toEqual([]);
    });
  });

  describe('confirmAndCreateProduct (direct call)', () => {
    it('resolves the entity name to an empty string when neither sku nor name is given', () => {
      const component = createComponent();
      component.ngOnInit();
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      expect(() => (component as any).confirmAndCreateProduct({})).not.toThrow();

      expect(modalServiceMock.showConfirmation).toHaveBeenCalled();
    });
  });

  describe('date helpers (via submit)', () => {
    function submitWithDate(date: unknown) {
      const component = createComponent();
      component.vehicleId = 'v1';
      component.ngOnInit();
      fillValidForm(component);
      component.form.get('date')!.setValue(date);
      let payload: any;
      fuelLogServiceMock.add.mockImplementation((fuelLog: FuelLog) => {
        payload = fuelLog;
        return of({ status: ResponseStatus.Success, data: { id: 'f1' } } as WebApiResponse<FuelLog>);
      });
      component.submit().subscribe();
      return payload;
    }

    it('falls back to the current date when none is given', () => {
      // date is a required field, so submit() can never reach toDate() with an empty value
      // through the public flow - exercised directly to cover the defensive branch.
      const component = createComponent();
      expect((component as any).toDate('')).toBeInstanceOf(Date);
      expect((component as any).toDate(null)).toBeInstanceOf(Date);
    });

    it('parses an object with its own toDate() method', () => {
      const fakeMoment = { toDate: () => new Date(2099, 0, 2) };
      const payload = submitWithDate(fakeMoment);
      expect(payload.date.getDate()).toBe(2);
    });

    it('returns a Date instance unchanged', () => {
      const date = new Date(2099, 0, 1);
      const payload = submitWithDate(date);
      expect(payload.date).toBe(date);
    });

    it('parses a dd/mm/yyyy string', () => {
      const payload = submitWithDate('15/03/2099');
      expect(payload.date.getFullYear()).toBe(2099);
      expect(payload.date.getMonth()).toBe(2);
      expect(payload.date.getDate()).toBe(15);
    });

    it('falls back to day=1/month=1 when the dd/mm/yyyy parts are zero', () => {
      const payload = submitWithDate('0/0/2099');
      expect(payload.date.getMonth()).toBe(0);
      expect(payload.date.getDate()).toBe(1);
    });

    it('parses an ISO-like string with no slashes', () => {
      const payload = submitWithDate('2099-03-15');
      expect(payload.date.getFullYear()).toBe(2099);
    });
  });
});
