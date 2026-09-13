import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import {
  BusinessPartner,
  BusinessPartnerService,
  Driver,
  DriverService,
  ModalService,
  NotificationService,
  PaymentCondition,
  PaymentMethod,
  Quote,
  QuoteProduct,
  QuoteProductService,
  QuoteService,
  QuoteStatus,
  QuoteType,
  ResponseStatus,
  TranslationService,
  Vehicle,
  VehicleService,
  WebApiResponse,
} from '@nexus/core';
import { Router } from '@angular/router';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject, config, of, throwError } from 'rxjs';
import { BusinessPartnerDetailsModalComponent } from '../../../business-partner/components/business-partner-details-modal/business-partner-details-modal.component';
import { QuoteProductDetailsModalComponent } from '../../../quote-products/components/quote-product-details-modal/quote-product-details-modal.component';
import { QuoteDetailsModalComponent } from '../quote-details-modal/quote-details-modal.component';
import { QuoteFormComponent } from './quote-form.component';

describe('QuoteFormComponent', () => {
  let businessPartnerServiceMock: {
    getClients: ReturnType<typeof vi.fn>;
    addOrUpdateBusinessPartner: ReturnType<typeof vi.fn>;
  };
  let driverServiceMock: { getAll: ReturnType<typeof vi.fn> };
  let modalServiceMock: {
    hideModal: ReturnType<typeof vi.fn>;
    showConfirmation: ReturnType<typeof vi.fn>;
    showTemplateModal: ReturnType<typeof vi.fn>;
    showNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let quoteServiceMock: {
    add: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    convertToOrder: ReturnType<typeof vi.fn>;
    convertToTrip: ReturnType<typeof vi.fn>;
  };
  let quoteProductAdded$: Subject<QuoteProduct | null>;
  let quoteProductServiceMock: { quoteProductAdded$: Subject<QuoteProduct | null> };
  let vehicleServiceMock: { getAll: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  const businessPartners: BusinessPartner[] = [
    { id: 'bp1', name: 'Cliente A' } as BusinessPartner,
    { id: 'bp2', name: 'Cliente B' } as BusinessPartner,
  ];

  const vehicles: Vehicle[] = [
    { id: 'v1', plate: 'ABC1234', brand: 'Marca', model: 'Modelo' } as Vehicle,
    { id: 'v2', plate: 'XYZ9999', brand: 'Outra', model: 'Outro' } as Vehicle,
  ];

  const drivers: Driver[] = [
    { id: 'd1', name: 'João' } as Driver,
    { id: 'd2', name: 'Maria' } as Driver,
  ];

  function createComponent(): QuoteFormComponent {
    businessPartnerServiceMock = {
      getClients: vi.fn().mockReturnValue(of({ data: businessPartners } as WebApiResponse<BusinessPartner[]>)),
      addOrUpdateBusinessPartner: vi.fn(),
    };
    driverServiceMock = { getAll: vi.fn().mockReturnValue(of({ data: drivers } as WebApiResponse<Driver[]>)) };
    modalServiceMock = {
      hideModal: vi.fn(),
      showConfirmation: vi.fn(),
      showTemplateModal: vi.fn(),
      showNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    quoteServiceMock = {
      add: vi.fn(),
      update: vi.fn(),
      convertToOrder: vi.fn(),
      convertToTrip: vi.fn(),
    };
    quoteProductAdded$ = new Subject();
    quoteProductServiceMock = { quoteProductAdded$ };
    vehicleServiceMock = { getAll: vi.fn().mockReturnValue(of({ data: vehicles } as WebApiResponse<Vehicle[]>)) };
    routerMock = { navigateByUrl: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };
    dialogRefMock = { close: vi.fn() };

    const component = new QuoteFormComponent(
      businessPartnerServiceMock as unknown as BusinessPartnerService,
      driverServiceMock as unknown as DriverService,
      new FormBuilder(),
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      quoteServiceMock as unknown as QuoteService,
      quoteProductServiceMock as unknown as QuoteProductService,
      vehicleServiceMock as unknown as VehicleService,
      routerMock as unknown as Router,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
    component.dialogRef = dialogRefMock as unknown as MatDialogRef<any>;
    component.data = { quoteProducts: [] } as unknown as Quote;
    return component;
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('quoteStatusOptions / methodOptions / conditionOptions / trackByOptionValue', () => {
    it('exposes translated status options', () => {
      const component = createComponent();
      expect(component.quoteStatusOptions.length).toBe(4);
    });

    it('exposes translated method options', () => {
      const component = createComponent();
      expect(component.methodOptions.length).toBe(3);
    });

    it('exposes translated condition options', () => {
      const component = createComponent();
      expect(component.conditionOptions.length).toBe(2);
    });

    it('returns the option value', () => {
      const component = createComponent();
      expect(component.trackByOptionValue(0, { value: QuoteStatus.Open, label: 'x' })).toBe(QuoteStatus.Open);
    });
  });

  describe('ngOnInit', () => {
    it('builds the form and loads business partners', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('businessPartnerId')).toBeTruthy();
      expect(businessPartnerServiceMock.getClients).toHaveBeenCalled();
    });

    it('does not load vehicles/drivers for a non-trip quote', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(vehicleServiceMock.getAll).not.toHaveBeenCalled();
      expect(driverServiceMock.getAll).not.toHaveBeenCalled();
    });

    it('loads vehicles/drivers and adds the quoteTrip group for a trip quote', () => {
      const component = createComponent();
      component.data = { quoteProducts: [], type: QuoteType.Trip } as unknown as Quote;

      component.ngOnInit();

      expect(vehicleServiceMock.getAll).toHaveBeenCalled();
      expect(driverServiceMock.getAll).toHaveBeenCalled();
      expect(component.form.get('quoteTrip')).toBeTruthy();
      expect(component.vehicles).toEqual(vehicles);
      expect(component.drivers).toEqual(drivers);
    });

    it('falls back to empty arrays when vehicle/driver responses have no data', () => {
      const component = createComponent();
      component.data = { quoteProducts: [], type: QuoteType.Trip } as unknown as Quote;
      vehicleServiceMock.getAll.mockReturnValue(of({} as WebApiResponse<Vehicle[]>));
      driverServiceMock.getAll.mockReturnValue(of({} as WebApiResponse<Driver[]>));

      component.ngOnInit();

      expect(component.vehicles).toEqual([]);
      expect(component.drivers).toEqual([]);
    });

    // this.form.disable() cascades depth-first: it disables 'totalPrice' before
    // 'paymentTotalPrice', and disabling a control still emits its valueChanges (Angular does not
    // suppress that during disable()). setupPaymentPriceWatcher()'s subscriber reacts to that
    // emission by calling paymentTotalPrice.setValue(...), which (default emitEvent/onlySelf)
    // recalculates the ancestor FormGroup's status from its still-partially-enabled children
    // mid-cascade - clobbering the DISABLED status the top-level disable() had just set, before
    // the remaining children even get disabled. The net effect: every individual control ends up
    // disabled, but the group's own aggregate `disabled` getter reports false. Documented as a
    // genuine (if inert - form.invalid/getRawValue() still behave, and no visible field is
    // actually editable) pre-existing quirk, not fixed here.
    it('disables every individual control when the quote is already converted, even though the group-level disabled flag is clobbered by a watcher side effect', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { quoteProducts: [], status: QuoteStatus.Converted } as unknown as Quote;

      component.ngOnInit();

      expect(component.form.disabled).toBe(false);
      expect(component.form.get('businessPartnerId')!.disabled).toBe(true);
      expect(component.form.get('totalPrice')!.disabled).toBe(true);
    });

    it('appends a product, recomputes totals, and notifies on quoteProductAdded$', () => {
      const component = createComponent();
      component.ngOnInit();
      const product = { totalPrice: 50 } as QuoteProduct;

      quoteProductAdded$.next(product);

      expect(component.data!.quoteProducts).toEqual([product]);
      expect(component.form.get('price')!.value).toBe(50);
      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(true, '', 'QUOTES.PRODUCT_ADDED_SUCCESS');
    });

    it('falls back to an empty array when data has no quoteProducts yet', () => {
      const component = createComponent();
      component.data = {} as unknown as Quote;
      component.ngOnInit();
      const product = { totalPrice: 0 } as QuoteProduct;

      quoteProductAdded$.next(product);

      expect(component.data!.quoteProducts).toEqual([product]);
    });

    it('ignores quoteProductAdded$ when there is no product or no data', () => {
      const component = createComponent();
      component.ngOnInit();

      quoteProductAdded$.next(null);
      component.data = null;
      quoteProductAdded$.next({ totalPrice: 10 } as QuoteProduct);

      expect(modalServiceMock.showNotification).not.toHaveBeenCalled();
    });
  });

  describe('ngOnChanges', () => {
    it('re-patches the form when data changes', () => {
      const component = createComponent();
      component.ngOnInit();
      component.data = { quoteProducts: [], description: 'Nova' } as unknown as Quote;

      component.ngOnChanges({ data: {} as never });

      expect(component.form.get('description')!.value).toBe('Nova');
    });

    it('adds the quoteTrip group and loads vehicles/drivers the first time data becomes a trip quote', () => {
      const component = createComponent();
      component.ngOnInit();
      expect(component.form.get('quoteTrip')).toBeNull();

      component.data = { quoteProducts: [], type: QuoteType.Trip } as unknown as Quote;
      component.ngOnChanges({ data: {} as never });

      expect(component.form.get('quoteTrip')).toBeTruthy();
      expect(vehicleServiceMock.getAll).toHaveBeenCalled();
    });

    it('does not re-add the quoteTrip group when it already exists', () => {
      const component = createComponent();
      component.data = { quoteProducts: [], type: QuoteType.Trip } as unknown as Quote;
      component.ngOnInit();
      vehicleServiceMock.getAll.mockClear();

      component.data = { quoteProducts: [], type: QuoteType.Trip, description: 'Outra' } as unknown as Quote;
      component.ngOnChanges({ data: {} as never });

      expect(vehicleServiceMock.getAll).not.toHaveBeenCalled();
      expect(component.form.get('description')!.value).toBe('Outra');
    });

    it('does nothing when the changed input is not data', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() => component.ngOnChanges({ isEdit: {} as never })).not.toThrow();
    });

    it('does not throw when data changes before the form exists', () => {
      const component = createComponent();
      component.data = { quoteProducts: [] } as unknown as Quote;

      expect(() => component.ngOnChanges({ data: {} as never })).not.toThrow();
    });

    // See the equivalent ngOnInit test above for why the group-level `disabled` flag ends up
    // false even though every individual control is disabled.
    it('disables every individual control when data changes into a converted status', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();

      component.data = { quoteProducts: [], status: QuoteStatus.Converted } as unknown as Quote;
      component.ngOnChanges({ data: {} as never });

      expect(component.form.disabled).toBe(false);
      expect(component.form.get('businessPartnerId')!.disabled).toBe(true);
    });
  });

  describe('ngOnDestroy', () => {
    it('unsubscribes tracked subscriptions', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });

    it('does not throw when there are no subscriptions yet', () => {
      const component = createComponent();
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('submit', () => {
    function fillValidForm(component: QuoteFormComponent) {
      component.form.patchValue({
        businessPartnerId: 'bp1',
        businessPartnerName: 'Cliente A',
        date: new Date(),
        status: QuoteStatus.Open,
      });
    }

    it('marks the form as touched and returns null without saving when invalid', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: unknown;
      component.submit().subscribe((r) => (result = r));

      expect(result).toBeNull();
      expect(quoteServiceMock.add).not.toHaveBeenCalled();
    });

    it('assigns the raw form value onto data before saving', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      quoteServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'q1' } }),
      );

      component.submit().subscribe();

      expect(component.data).toMatchObject({ businessPartnerId: 'bp1' });
    });

    it('does not throw when there is no data to assign the raw form value onto', () => {
      const component = createComponent();
      component.data = null;
      component.ngOnInit();
      fillValidForm(component);
      quoteServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'q1' } }),
      );

      expect(() => component.submit().subscribe()).not.toThrow();
    });

    it('updates when editing an existing quote', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 'q1', quoteProducts: [] } as unknown as Quote;
      component.ngOnInit();
      fillValidForm(component);
      quoteServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Salvo', data: { id: 'q1' } }),
      );

      component.submit().subscribe();

      expect(quoteServiceMock.update).toHaveBeenCalled();
      expect(quoteServiceMock.add).not.toHaveBeenCalled();
    });

    it('notifies without saving when the backend reports a business error', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      quoteServiceMock.add.mockReturnValue(
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
      quoteServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'q1' } }),
      );

      component.submit().subscribe();

      expect(dialogRefMock.close).toHaveBeenCalled();
      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(true, 'QUOTES.QUOTE_ADDED', 'OK');
    });

    it('navigates to the new quote page on success (page mode)', () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      fillValidForm(component);
      quoteServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: { id: 'q1' } }),
      );

      component.submit().subscribe();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/quotes/q1');
    });

    it('shows the message and refreshes data when editing (page mode)', () => {
      const component = createComponent();
      component.isEdit = true;
      component.isModal = false;
      component.data = { id: 'q1', quoteProducts: [] } as unknown as Quote;
      component.ngOnInit();
      fillValidForm(component);
      quoteServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Salvo', data: { id: 'q1', description: 'Nova' } }),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Success, 'Salvo');
      expect(component.data).toEqual({ id: 'q1', description: 'Nova' });
    });

    it('notifies an error when saving fails', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      quoteServiceMock.add.mockReturnValue(throwError(() => new Error('fail')));

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

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/quotes');
    });
  });

  describe('isTripQuote', () => {
    it('returns true when the data type is Trip', () => {
      const component = createComponent();
      component.data = { quoteProducts: [], type: QuoteType.Trip } as unknown as Quote;

      expect(component.isTripQuote()).toBe(true);
    });

    it('returns false otherwise', () => {
      const component = createComponent();

      expect(component.isTripQuote()).toBe(false);
    });
  });

  describe('convert', () => {
    it('notifies an error and returns when there is no data', () => {
      const component = createComponent();
      component.data = null;

      component.convert();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'QUOTES.NOT_FOUND');
      expect(quoteServiceMock.convertToOrder).not.toHaveBeenCalled();
    });

    it('calls convertToTrip for a trip quote', () => {
      const component = createComponent();
      component.data = { quoteProducts: [], type: QuoteType.Trip } as unknown as Quote;
      quoteServiceMock.convertToTrip.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK' }),
      );

      component.convert();

      expect(quoteServiceMock.convertToTrip).toHaveBeenCalledWith(component.data);
    });

    it('calls convertToOrder for a non-trip quote and notifies on success', () => {
      const component = createComponent();
      quoteServiceMock.convertToOrder.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Convertido' }),
      );

      component.convert();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Success, 'Convertido');
    });

    it('notifies a failure message when the conversion does not succeed', () => {
      const component = createComponent();
      quoteServiceMock.convertToOrder.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Deu ruim' }),
      );

      component.convert();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Error, 'Deu ruim');
    });

    it('falls back to a translated message when the failure has no message', () => {
      const component = createComponent();
      quoteServiceMock.convertToOrder.mockReturnValue(
        of({ status: ResponseStatus.Error, message: '' }),
      );

      component.convert();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Error, 'QUOTES.CONVERT_FAILED');
    });

    it('notifies an error when the conversion request fails', () => {
      const component = createComponent();
      quoteServiceMock.convertToOrder.mockReturnValue(throwError(() => new Error('boom')));

      component.convert();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Error, 'QUOTES.CONVERT_ERROR');
    });

    it('shows a confirmation on a Warning response and retries convertToOrder when confirmed', () => {
      const component = createComponent();
      quoteServiceMock.convertToOrder
        .mockReturnValueOnce(of({ status: 'Warning', message: 'Confirma?', data: { id: 'q1' } }))
        .mockReturnValueOnce(of({ status: ResponseStatus.Success, message: 'Convertido' }));
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });

      component.convert();

      expect(modalServiceMock.showConfirmation).toHaveBeenCalled();
      expect(quoteServiceMock.convertToOrder).toHaveBeenCalledTimes(2);
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Success, 'Convertido');
    });

    it('notifies a failure on the retried convertToOrder when it does not succeed', () => {
      const component = createComponent();
      quoteServiceMock.convertToOrder
        .mockReturnValueOnce(of({ status: 'Warning', message: 'Confirma?', data: { id: 'q1' } }))
        .mockReturnValueOnce(of({ status: ResponseStatus.Error, message: 'Falhou de novo' }));
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });

      component.convert();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Error, 'Falhou de novo');
    });

    it('falls back to a translated message when the retried convertToOrder failure has no message', () => {
      const component = createComponent();
      quoteServiceMock.convertToOrder
        .mockReturnValueOnce(of({ status: 'Warning', message: 'Confirma?', data: { id: 'q1' } }))
        .mockReturnValueOnce(of({ status: ResponseStatus.Error, message: '' }));
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });

      component.convert();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Error, 'QUOTES.CONVERT_FAILED');
    });

    it('notifies an error when the retried convertToOrder request fails', () => {
      const component = createComponent();
      quoteServiceMock.convertToOrder
        .mockReturnValueOnce(of({ status: 'Warning', message: 'Confirma?', data: { id: 'q1' } }))
        .mockReturnValueOnce(throwError(() => new Error('boom')));
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });

      component.convert();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Error, 'QUOTES.CONVERT_ERROR');
    });

    it('does nothing further when the Warning confirmation is declined', () => {
      const component = createComponent();
      quoteServiceMock.convertToOrder.mockReturnValue(
        of({ status: 'Warning', message: 'Confirma?', data: { id: 'q1' } }),
      );
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(false) });

      component.convert();

      expect(quoteServiceMock.convertToOrder).toHaveBeenCalledTimes(1);
    });
  });

  describe('onClientBlur', () => {
    it('cleans the selection when the typed name is blank', async () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('   ');

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('businessPartnerId')!.value).toBe('');
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('does nothing further when the typed name matches an existing business partner', async () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Cliente A');

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showConfirmation).not.toHaveBeenCalled();
    });

    it('offers to create a new client when the name matches nothing', async () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Novo Cliente');
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(undefined) });

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(modalServiceMock.showConfirmation).toHaveBeenCalled();
    });

    it('cleans the selection when the user declines creating a new business partner', async () => {
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

    it('creates and selects the new business partner once confirmed', async () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.get('businessPartnerName')!.setValue('Novo Cliente');
      const created = { id: 'bp9', name: 'Novo Cliente' } as BusinessPartner;
      modalServiceMock.showConfirmation.mockReturnValue({ afterClosed: () => of(true) });
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(created) });

      component.onClientBlur();
      vi.advanceTimersByTime(200);

      expect(businessPartnerServiceMock.addOrUpdateBusinessPartner).toHaveBeenCalledWith(created);
      expect(component.form.get('businessPartnerId')!.value).toBe('bp9');
      expect(component.form.get('businessPartnerName')!.value).toBe('Novo Cliente');
    });

    it('cleans the selection when the new-partner modal closes without a result', async () => {
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

  describe('removeProduct', () => {
    it('does nothing when there are no quoteProducts', () => {
      const component = createComponent();
      component.data = {} as unknown as Quote;
      component.ngOnInit();

      expect(() => component.removeProduct(0)).not.toThrow();
    });

    it('removes the product at the given index and recomputes totals', () => {
      const component = createComponent();
      component.data = { quoteProducts: [{ totalPrice: 10 }, { totalPrice: 20 }] } as unknown as Quote;
      component.ngOnInit();

      component.removeProduct(0);

      expect(component.data!.quoteProducts).toEqual([{ totalPrice: 20 }]);
      expect(component.form.get('price')!.value).toBe(20);
    });
  });

  describe('openQuoteProductsModal', () => {
    it('opens the products modal with merged data and form values', () => {
      const component = createComponent();
      component.ngOnInit();

      component.openQuoteProductsModal();

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        QuoteProductDetailsModalComponent,
        expect.objectContaining({ isEdit: false, id: null, parentId: null }),
      );
    });
  });

  describe('canDisplayConvertButton / isQuoteConverted', () => {
    it('returns true only when editing an Open quote', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { quoteProducts: [], status: QuoteStatus.Open } as unknown as Quote;

      expect(component.canDisplayConvertButton()).toBe(true);
    });

    it('returns false when not editing', () => {
      const component = createComponent();
      component.isEdit = false;
      component.data = { quoteProducts: [], status: QuoteStatus.Open } as unknown as Quote;

      expect(component.canDisplayConvertButton()).toBe(false);
    });

    it('returns false when the status is not Open', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { quoteProducts: [], status: QuoteStatus.Canceled } as unknown as Quote;

      expect(component.canDisplayConvertButton()).toBe(false);
    });

    it('isQuoteConverted returns true only when status is Converted', () => {
      const component = createComponent();
      component.data = { quoteProducts: [], status: QuoteStatus.Converted } as unknown as Quote;

      expect(component.isQuoteConverted()).toBe(true);
    });

    it('isQuoteConverted returns false otherwise', () => {
      const component = createComponent();
      component.data = { quoteProducts: [], status: QuoteStatus.Open } as unknown as Quote;

      expect(component.isQuoteConverted()).toBe(false);
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
      component.data = { quoteProducts: [], businessPartnerId: 'bp1' } as unknown as Quote;
      component.ngOnInit();

      expect(component.form.get('businessPartnerName')!.disabled).toBe(true);
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

  describe('quoteTrip form / autocomplete', () => {
    function tripComponent(): QuoteFormComponent {
      const component = createComponent();
      component.data = { quoteProducts: [], type: QuoteType.Trip } as unknown as Quote;
      component.ngOnInit();
      return component;
    }

    it('does not re-add the quoteTrip group when it already exists', () => {
      const component = tripComponent();
      const originalGroup = component.form.get('quoteTrip');

      (component as any).addQuoteTripForm();

      expect(component.form.get('quoteTrip')).toBe(originalGroup);
    });

    it('filters vehicles by plate/brand/model (case-insensitive)', () => {
      const component = tripComponent();

      let result: Vehicle[] = [];
      component.filteredQuoteTripVehicles$.subscribe((r) => (result = r));
      component.form.get('quoteTrip')!.get('vehiclePlate')!.setValue('abc');

      expect(result).toEqual([expect.objectContaining({ id: 'v1' })]);
    });

    it('emits an empty vehicle list when there is no filter value', () => {
      const component = tripComponent();

      let result: Vehicle[] = [];
      component.filteredQuoteTripVehicles$.subscribe((r) => (result = r));

      expect(result).toEqual([]);
    });

    it('treats a non-string vehiclePlate emission as an empty filter', () => {
      const component = tripComponent();

      let result: Vehicle[] = [];
      component.filteredQuoteTripVehicles$.subscribe((r) => (result = r));
      component.form.get('quoteTrip')!.get('vehiclePlate')!.setValue(null);

      expect(result).toEqual([]);
    });

    it('treats a vehicle with missing plate/brand/model as an empty string when filtering', () => {
      const component = tripComponent();
      component.vehicles = [{ id: 'v3' } as Vehicle];

      let result: Vehicle[] = [];
      component.filteredQuoteTripVehicles$.subscribe((r) => (result = r));
      component.form.get('quoteTrip')!.get('vehiclePlate')!.setValue('modelo');

      expect(result.find((v) => v.id === 'v3')).toBeUndefined();
    });

    it('filters drivers by name (case-insensitive)', () => {
      const component = tripComponent();

      let result: Driver[] = [];
      component.filteredQuoteTripDrivers$.subscribe((r) => (result = r));
      component.form.get('quoteTrip')!.get('driverName')!.setValue('joão');

      expect(result).toEqual([expect.objectContaining({ id: 'd1' })]);
    });

    it('treats a non-string driverName emission as an empty filter', () => {
      const component = tripComponent();

      let result: Driver[] = [];
      component.filteredQuoteTripDrivers$.subscribe((r) => (result = r));
      component.form.get('quoteTrip')!.get('driverName')!.setValue(null);

      expect(result).toEqual([]);
    });

    it('emits an empty driver list when there is no filter value', () => {
      const component = tripComponent();

      let result: Driver[] = [];
      component.filteredQuoteTripDrivers$.subscribe((r) => (result = r));

      expect(result).toEqual([]);
    });

    it('treats a driver with no name as an empty string when filtering', () => {
      const component = tripComponent();
      component.drivers = [{ id: 'd3' } as Driver];

      let result: Driver[] = [];
      component.filteredQuoteTripDrivers$.subscribe((r) => (result = r));
      component.form.get('quoteTrip')!.get('driverName')!.setValue('maria');

      expect(result.find((d) => d.id === 'd3')).toBeUndefined();
    });
  });

  describe('selectQuoteTripVehicle / selectQuoteTripDriver', () => {
    function tripComponent(): QuoteFormComponent {
      const component = createComponent();
      component.data = { quoteProducts: [], type: QuoteType.Trip } as unknown as Quote;
      component.ngOnInit();
      return component;
    }

    it('does nothing when no vehicle is given', () => {
      const component = tripComponent();

      expect(() => component.selectQuoteTripVehicle(null as unknown as Vehicle)).not.toThrow();
      expect(component.form.get('quoteTrip')!.get('vehicleId')!.value).toBeNull();
    });

    it('patches the quoteTrip group with the selected vehicle', () => {
      const component = tripComponent();

      component.selectQuoteTripVehicle(vehicles[0]);

      expect(component.form.get('quoteTrip')!.get('vehicleId')!.value).toBe('v1');
      expect(component.form.get('quoteTrip')!.get('vehiclePlate')!.value).toBe('ABC1234');
    });

    it('does nothing when no driver is given', () => {
      const component = tripComponent();

      expect(() => component.selectQuoteTripDriver(null as unknown as Driver)).not.toThrow();
      expect(component.form.get('quoteTrip')!.get('driverId')!.value).toBeNull();
    });

    it('patches the quoteTrip group with the selected driver', () => {
      const component = tripComponent();

      component.selectQuoteTripDriver(drivers[0]);

      expect(component.form.get('quoteTrip')!.get('driverId')!.value).toBe('d1');
      expect(component.form.get('quoteTrip')!.get('driverName')!.value).toBe('João');
    });
  });

  describe('onQuoteTripVehiclePlateBlur', () => {
    function tripComponent(): QuoteFormComponent {
      const component = createComponent();
      component.data = { quoteProducts: [], type: QuoteType.Trip } as unknown as Quote;
      component.ngOnInit();
      return component;
    }

    it('cleans the selection when the typed plate is blank', () => {
      vi.useFakeTimers();
      const component = tripComponent();
      component.form.get('quoteTrip')!.get('vehiclePlate')!.setValue('   ');

      component.onQuoteTripVehiclePlateBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('quoteTrip')!.get('vehicleId')!.value).toBeNull();
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('selects the vehicle when the typed plate matches', () => {
      vi.useFakeTimers();
      const component = tripComponent();
      component.form.get('quoteTrip')!.get('vehiclePlate')!.setValue('ABC1234');

      component.onQuoteTripVehiclePlateBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('quoteTrip')!.get('vehicleId')!.value).toBe('v1');
    });

    it('cleans the selection when the typed plate matches nothing', () => {
      vi.useFakeTimers();
      const component = tripComponent();
      component.form.get('quoteTrip')!.get('vehiclePlate')!.setValue('DESCONHECIDA');

      component.onQuoteTripVehiclePlateBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('quoteTrip')!.get('vehicleId')!.value).toBeNull();
    });
  });

  describe('onQuoteTripDriverNameBlur', () => {
    function tripComponent(): QuoteFormComponent {
      const component = createComponent();
      component.data = { quoteProducts: [], type: QuoteType.Trip } as unknown as Quote;
      component.ngOnInit();
      return component;
    }

    it('cleans the selection when the typed name is blank', () => {
      vi.useFakeTimers();
      const component = tripComponent();
      component.form.get('quoteTrip')!.get('driverName')!.setValue('   ');

      component.onQuoteTripDriverNameBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('quoteTrip')!.get('driverId')!.value).toBeNull();
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('selects the driver when the typed name matches', () => {
      vi.useFakeTimers();
      const component = tripComponent();
      component.form.get('quoteTrip')!.get('driverName')!.setValue('João');

      component.onQuoteTripDriverNameBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('quoteTrip')!.get('driverId')!.value).toBe('d1');
    });

    it('cleans the selection when the typed name matches nothing', () => {
      vi.useFakeTimers();
      const component = tripComponent();
      component.form.get('quoteTrip')!.get('driverName')!.setValue('Desconhecido');

      component.onQuoteTripDriverNameBlur();
      vi.advanceTimersByTime(200);

      expect(component.form.get('quoteTrip')!.get('driverId')!.value).toBeNull();
    });
  });

  describe('patchFormWithData (private, via ngOnInit)', () => {
    it('computes payment defaults from the provided data', () => {
      const component = createComponent();
      component.data = {
        quoteProducts: [],
        totalOfPayments: 3,
        totalPrice: 300,
        totalOfExpenses: 5,
        expenseTotalPrice: 50,
      } as unknown as Quote;

      component.ngOnInit();

      expect(component.form.get('totalOfPayments')!.value).toBe(3);
      expect(component.form.get('paymentTotalPrice')!.value).toBe(300);
      expect(component.form.get('totalOfExpenses')!.value).toBe(5);
      expect(component.form.get('expenseTotalPrice')!.value).toBe(50);
    });

    it('defaults totalOfPayments to 1 and paymentTotalPrice/expenses to 0 when missing', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('totalOfPayments')!.value).toBe(1);
      expect(component.form.get('paymentTotalPrice')!.value).toBe(0);
      expect(component.form.get('totalOfExpenses')!.value).toBe(0);
      expect(component.form.get('expenseTotalPrice')!.value).toBe(0);
    });

    it('does not throw without data', () => {
      const component = createComponent();
      component.data = null;

      expect(() => component.ngOnInit()).not.toThrow();
    });
  });

  describe('setupAutoComplete / filteredBusinessPartners$', () => {
    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      businessPartnerServiceMock.getClients.mockReturnValue(of({} as WebApiResponse<BusinessPartner[]>));
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
        of({ data: [{ id: 'bp3' } as BusinessPartner] } as WebApiResponse<BusinessPartner[]>),
      );
      component.ngOnInit();

      let result: BusinessPartner[] = [];
      component.filteredBusinessPartners$.subscribe((r) => (result = r));
      component.form.get('businessPartnerName')!.setValue('cliente');

      expect(result.find((bp) => bp.id === 'bp3')).toBeUndefined();
    });
  });

  describe('disableEditFields (private, via ngOnInit)', () => {
    it('disables businessPartnerName and quoteNumber when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();

      expect(component.form.get('businessPartnerName')!.disabled).toBe(true);
      expect(component.form.get('quoteNumber')!.disabled).toBe(true);
    });

    it('leaves fields enabled when not editing', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('quoteNumber')!.disabled).toBe(false);
    });
  });

  describe('setupPaymentPriceWatcher (private, via ngOnInit)', () => {
    it('recomputes paymentTotalPrice per installment when totalPrice changes', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.get('totalOfPayments')!.setValue(2);

      component.form.get('totalPrice')!.setValue(100);

      expect(component.form.get('paymentTotalPrice')!.value).toBe(50);
    });

    it('defaults totalOfPayments to 1 when its value is falsy', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.get('totalOfPayments')!.setValue(0);

      component.form.get('totalPrice')!.setValue(100);

      expect(component.form.get('paymentTotalPrice')!.value).toBe(100);
    });

    it('falls back to 1 payment when totalOfPayments is negative', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.get('totalOfPayments')!.setValue(-3);

      component.form.get('totalPrice')!.setValue(100);

      expect(component.form.get('paymentTotalPrice')!.value).toBe(100);
    });
  });

  describe('totalPriceChange (private, via ngOnInit)', () => {
    it('recomputes totalPrice when discount changes', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.get('price')!.setValue(100);

      component.form.get('discount')!.setValue(10);

      expect(component.form.get('totalPrice')!.value).toBe(90);
    });
  });

  describe('updatePriceFields / updateTotalPriceFields (private, via removeProduct)', () => {
    it('treats a falsy product totalPrice as zero when summing', () => {
      const component = createComponent();
      component.data = { quoteProducts: [{ totalPrice: 0 }, { totalPrice: 30 }] } as unknown as Quote;
      component.ngOnInit();

      component.removeProduct(0);

      expect(component.form.get('price')!.value).toBe(30);
    });

    it('treats a non-numeric price/discount as zero', () => {
      const component = createComponent();
      component.data = { quoteProducts: [] } as unknown as Quote;
      component.ngOnInit();
      component.form.get('price')!.setValue('');
      component.form.get('discount')!.setValue('');

      (component as any).updateTotalPriceFields();

      expect(component.form.get('totalPrice')!.value).toBe(0);
    });
  });
});
