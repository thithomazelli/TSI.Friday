import { combineLatestWith, of, Subscription, tap } from 'rxjs';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';

import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import {
  BusinessPartnerService,
  BusinessPartner,
  Driver,
  DriverService,
  Quote,
  QuoteStatus,
  QuoteType,
  FormBaseComponent,
  ModalService,
  Vehicle,
  VehicleService,
  WebApiResponse,
  ApiType,
  ResponseStatus,
  NotificationService,
  QuoteService,
  QuoteProductService,
  PaymentCondition,
  PaymentMethod,
  TranslationService,
} from '@nexus/core';

import { MatDialogRef } from '@angular/material/dialog';

import { Observable, startWith, map } from 'rxjs';

import { BusinessPartnerDetailsModalComponent } from '../../../business-partner/components/business-partner-details-modal/business-partner-details-modal.component';
import { QuoteProductDetailsModalComponent } from '../../../quote-products/components/quote-product-details-modal/quote-product-details-modal.component';
import { QuoteDetailsModalComponent } from '../quote-details-modal/quote-details-modal.component';
import { Router } from '@angular/router';
import { AlertBannerComponentComponent } from '../../../shared/alert-banner-component/alert-banner-component.component';
import { NgIf, NgClass, NgFor, AsyncPipe, CurrencyPipe } from '@angular/common';
import { MatAutocompleteTrigger, MatAutocomplete, MatOption } from '@angular/material/autocomplete';
import { LinkFieldComponent } from '../../../shared/components/link-field/link-field.component';
import { DateFieldComponent } from '../../../shared/components/date-field/date-field.component';
import { CurrencyFieldComponent } from '../../../shared/components/currency-field/currency-field.component';
import { ClickDirective } from '../../../core/directives/click.directive';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    selector: 'app-quote-form',
    templateUrl: './quote-form.component.html',
    styleUrl: './quote-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        AlertBannerComponentComponent,
        ReactiveFormsModule,
        NgIf,
        NgClass,
        MatAutocompleteTrigger,
        MatAutocomplete,
        NgFor,
        MatOption,
        LinkFieldComponent,
        DateFieldComponent,
        CurrencyFieldComponent,
        ClickDirective,
        AsyncPipe,
        CurrencyPipe,
        TranslatePipe,
    ],
})
export class QuoteFormComponent
  extends FormBaseComponent
  implements OnInit, OnChanges, OnDestroy
{
  @Input()
  isModal = false;

  @Input()
  isEdit = false;

  @Input()
  data?: Quote | null = <Quote>{
    quoteProducts: [],
  };

  @Input()
  compact = false;

  @Input()
  dialogRef?: MatDialogRef<QuoteDetailsModalComponent>;

  businessPartners$!: Observable<WebApiResponse<BusinessPartner[]>>;
  businessPartnersArray$!: Observable<BusinessPartner[]>;
  filteredBusinessPartners$!: Observable<BusinessPartner[]>;

  vehicles: Vehicle[] = [];
  drivers: Driver[] = [];
  filteredQuoteTripVehicles$!: Observable<Vehicle[]>;
  filteredQuoteTripDrivers$!: Observable<Driver[]>;

  get quoteStatusOptions() {
    return [
      { value: QuoteStatus.Open, label: this.translationService.instant('QUOTES.STATUS_OPEN') },
      { value: QuoteStatus.Canceled, label: this.translationService.instant('QUOTES.STATUS_CANCELED') },
      { value: QuoteStatus.Converted, label: this.translationService.instant('QUOTES.STATUS_CONVERTED') },
      { value: QuoteStatus.Expired, label: this.translationService.instant('QUOTES.STATUS_EXPIRED') },
    ];
  }

  // quoteStatusOptions is a getter, so *ngFor's default identity-based tracking sees a brand new
  // array/objects on every change-detection pass and keeps destroying/recreating the <option>
  // elements - severe enough churn on a bound <select> to trip NG0103 (infinite change detection).
  trackByOptionValue(_index: number, option: { value: string; label: string }): string {
    return option.value;
  }

  get methodOptions() {
    return [
      { label: this.translationService.instant('TRANSACTIONS.METHOD_CASH'), value: PaymentMethod.Cash },
      { label: this.translationService.instant('TRANSACTIONS.METHOD_PIX'), value: PaymentMethod.Pix },
      { label: this.translationService.instant('TRANSACTIONS.METHOD_CREDIT_CARD'), value: PaymentMethod.CreditCard },
    ];
  }

  get conditionOptions() {
    return [
      { label: this.translationService.instant('TRANSACTIONS.FULL_PAYMENT'), value: PaymentCondition.FullPayment },
      { label: this.translationService.instant('TRANSACTIONS.IN_PAYMENTS'), value: PaymentCondition.InInstallments },
    ];
  }

  private _subscriptions: Subscription[] = [];
  private _baseEndPoint = ApiType.Quotes;

  constructor(
    private businessPartnerService: BusinessPartnerService,
    private driverService: DriverService,
    private formBuilder: FormBuilder,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private quoteService: QuoteService,
    private quoteProductService: QuoteProductService,
    private vehicleService: VehicleService,
    private routerService: Router,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
  ) {
    super();
  }

  ngOnInit(): void {
    this.initForm();
    this.disableEditFields();
    this.patchFormWithData();
    this.setupAutoComplete();
    this.totalPriceChange();
    this.setupPaymentPriceWatcher();

    if (this.isTripQuote()) {
      this.loadVehiclesAndDrivers();
    }

    if (this.isQuoteConverted && this.isQuoteConverted()) {
      this.form.disable();
    }

    this._subscriptions.push(
      this.quoteProductService.quoteProductAdded$.subscribe((quoteProduct) => {
        if (quoteProduct && this.data) {
          this.data.quoteProducts = [...(this.data.quoteProducts ?? []), quoteProduct];
          this.updatePriceFields();
          this.updateTotalPriceFields();
          this.modalService.showNotification(
            true,
            '',
            this.translationService.instant('QUOTES.PRODUCT_ADDED_SUCCESS'),
          );
          this.cdr.markForCheck();
        }
      }),
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data && this.form) {
      // On the details page, data arrives asynchronously (a route resolver fetch) after
      // ngOnInit already ran initForm() with the still-empty default @Input data - so
      // isTripQuote() was false back then and the quoteTrip FormGroup was never added. Add it
      // now, the first time data turns out to be a Trip quote, before patching values into it.
      if (this.isTripQuote() && !this.form.contains('quoteTrip')) {
        this.addQuoteTripForm();
        this.loadVehiclesAndDrivers();
      }
      this.patchFormWithData();
    }
    if (this.isQuoteConverted && this.isQuoteConverted() && this.form) {
      this.form.disable();
    }
  }

  ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  submit(): Observable<WebApiResponse<Quote> | null> {
    this.submitted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return of(null);
    }

    const rawValue = this.form.getRawValue();

    if (this.data) {
      Object.assign(this.data!, rawValue);
    }

    return this.save(this.data as Quote).pipe(
      tap({
        next: (response: WebApiResponse<Quote>) => {
          // The backend reports business-rule failures as a 200 response with status Error and
          // data: null rather than an HTTP error, so this has to be checked before treating the
          // save as successful - otherwise savePage()/saveModal() crash reading .id off a null
          // response.data.
          if (response.status !== ResponseStatus.Success) {
            this.notificationService.showMessage(response.status, response.message);
            return;
          }
          if (this.isModal) {
            this.saveModal(response);
          } else {
            this.savePage(response);
          }
        },
        error: (err) => {
          this.notificationService.showMessage('Error', this.translationService.instant('COMMON.SAVE_ERROR'));
        },
      }),
    );
  }

  cancel(): void {
    if (this.isModal) {
      this.modalService.hideModal(this.dialogRef);
    } else {
      this.routerService.navigateByUrl(`/${this._baseEndPoint}`);
    }
  }

  isTripQuote(): boolean {
    return this.data?.type === QuoteType.Trip;
  }

  convert(): void {
    if (!this.data) {
      this.notificationService?.showMessage(
        'Error',
        this.translationService.instant('QUOTES.NOT_FOUND'),
      );
      return;
    }

    const convert$ = this.isTripQuote()
      ? this.quoteService.convertToTrip(this.data)
      : this.quoteService.convertToOrder(this.data);

    convert$.subscribe({
      next: (response: WebApiResponse<any>) => {
        // Se status for Warning, exibe confirmação
        if (response.status === 'Warning') {
          const confirmRef = this.modalService.showConfirmation({
            title: this.translationService.instant('COMMON.ATTENTION'),
            message: response.message,
            confirmButtonText: this.translationService.instant('COMMON.CONFIRM'),
            cancelButtonText: this.translationService.instant('COMMON.CANCEL'),
          });
          confirmRef.afterClosed().subscribe((confirmed: boolean) => {
            if (confirmed) {
              // Chama novamente com response.data
              this.quoteService.convertToOrder(response.data).subscribe({
                next: (response: WebApiResponse<any>) => {
                  if (response.status === ResponseStatus.Success) {
                    this.notificationService?.showMessage(
                      response.status,
                      response.message,
                    );
                  } else {
                    this.notificationService?.showMessage(
                      response.status,
                      response.message || this.translationService.instant('QUOTES.CONVERT_FAILED'),
                    );
                  }
                },
                error: () => {
                  this.notificationService?.showMessage(
                    ResponseStatus.Error,
                    this.translationService.instant('QUOTES.CONVERT_ERROR'),
                  );
                },
              });
            }
          });
          return;
        }
        // Sucesso normal
        if (response.status === ResponseStatus.Success) {
          this.notificationService?.showMessage(
            response.status,
            response.message,
          );
        } else {
          this.notificationService?.showMessage(
            ResponseStatus.Error,
            response.message || this.translationService.instant('QUOTES.CONVERT_FAILED'),
          );
        }
      },
      error: () => {
        this.notificationService?.showMessage(
          ResponseStatus.Error,
          this.translationService.instant('QUOTES.CONVERT_ERROR'),
        );
      },
    });
  }

  async onClientBlur(): Promise<void> {
    setTimeout(() => {
      const businessPartnerName = this.form
        .get('businessPartnerName')!
        .value?.trim();
      if (!businessPartnerName) {
        this.cleanClientSelection();
        this.cdr.markForCheck();
        return;
      }
      const sub = this.businessPartnersArray$.subscribe((clients) => {
        const found = clients.find((c) => c.name === businessPartnerName);
        if (!found) {
          const confirmRef = this.modalService.showConfirmation({
            title: this.translationService.instant('COMMON.ENTITY_NOT_FOUND', { entity: this.translationService.instant('BUSINESS_PARTNER.CLIENT_SINGULAR') }),
            message: this.translationService.instant('COMMON.CONFIRM_ADD_ENTITY', { entityLower: this.translationService.instant('BUSINESS_PARTNER.CLIENT_SINGULAR').toLowerCase(), name: businessPartnerName }),
            cancelButtonText: this.translationService.instant('COMMON.CANCEL'),
            confirmButtonText: this.translationService.instant('COMMON.YES'),
          });
          const confirmSub = confirmRef
            .afterClosed()
            .subscribe((confirmed: boolean) => {
              if (confirmed) {
                const clientFormRef: MatDialogRef<any> =
                  this.modalService.showTemplateModal(
                    BusinessPartnerDetailsModalComponent,
                    {
                      data: { name: businessPartnerName },
                      disableClose: true,
                    },
                  );
                const clientFormSub = clientFormRef
                  .afterClosed()
                  .subscribe((result: BusinessPartner | undefined) => {
                    if (result) {
                      this.businessPartnerService.addOrUpdateBusinessPartner(
                        result,
                      );
                      this.form
                        .get('businessPartnerName')!
                        .setValue(result.name);
                      this.form.get('businessPartnerId')!.setValue(result.id);
                    } else {
                      this.cleanClientSelection();
                    }
                    this.cdr.markForCheck();
                  });
                this._subscriptions.push(clientFormSub);
              } else {
                this.cleanClientSelection();
                this.cdr.markForCheck();
              }
            });
          this._subscriptions.push(confirmSub);
        }
      });
      this._subscriptions.push(sub);
    }, 200);
  }

  removeProduct(index: number): void {
    if (!this.data?.quoteProducts) {
      return;
    }
    this.data.quoteProducts = this.data.quoteProducts.filter((_, i) => i !== index);
    this.updatePriceFields();
    this.updateTotalPriceFields();
  }

  openQuoteProductsModal() {
    const data = { ...this.data, ...this.form.getRawValue() };

    const initialState = {
      isEdit: false,
      id: null,
      parentId: null,
      parentData: data,
    };

    this.modalService.showTemplateModal(
      QuoteProductDetailsModalComponent,
      initialState,
    );
  }

  canDisplayConvertButton(): boolean {
    return this.isEdit && this.data?.status === QuoteStatus.Open;
  }

  isQuoteConverted(): boolean {
    return this.data?.status === QuoteStatus.Converted;
  }

  private initForm(): void {
    this.form = this.formBuilder.group({
      quoteNumber: [''],
      businessPartnerId: [null, Validators.required],
      businessPartnerName: [
        { value: '', disabled: this.data?.businessPartnerId != null },
        Validators.required,
      ],
      description: [''],
      date: [new Date(), Validators.required],
      status: [QuoteStatus.Open, Validators.required],
      price: [{ value: 0, disabled: true }],
      discount: [0, [Validators.min(0), Validators.max(100)]],
      totalPrice: [{ value: 0, disabled: true }],
      condition: [PaymentCondition.FullPayment],
      method: [PaymentMethod.Cash],
      totalOfPayments: [1, [Validators.min(1)]],
      paymentTotalPrice: [{ value: 0, disabled: this.isEdit }, [Validators.min(0)]],
      totalOfExpenses: [0, [Validators.min(0)]],
      expenseTotalPrice: [{ value: 0, disabled: this.isEdit }, [Validators.min(0)]],
    });

    if (this.isEdit) {
      this.form.addControl('id', this.formBuilder.control(''));
    } else {
      this._subscriptions.push(
        this.form.get('businessPartnerName')!.valueChanges.subscribe((name) => {
          const sub = this.businessPartnersArray$.subscribe(
            (businessPartners) => {
              const businessPartner = businessPartners.find(
                (p: BusinessPartner) => p.name === name,
              );
              if (businessPartner) {
                this.form
                  .get('businessPartnerId')!
                  .setValue(businessPartner.id);
              }
            },
          );
          this._subscriptions.push(sub);
        }),
      );
    }

    if (this.isTripQuote()) {
      this.addQuoteTripForm();
    }
  }

  private addQuoteTripForm(): void {
    if (!this.form.contains('quoteTrip')) {
      this.form.addControl(
        'quoteTrip',
        this.formBuilder.group({
          id: [null],
          route: [''],
          distanceKm: [0, [Validators.min(0)]],
          dailyCount: [0, [Validators.min(0)]],
          transportLicenseNumber: [''],
          transportLicenseExpiryDate: [null as Date | null],
          vehicleId: [null],
          vehiclePlate: [''],
          driverId: [null],
          driverName: [''],
          quoteId: [null],
        }),
      );
      this.setupQuoteTripAutoComplete();
    }
  }

  private loadVehiclesAndDrivers(): void {
    const vehicleSub = this.vehicleService
      .getAll()
      .subscribe((response) => (this.vehicles = response.data ?? []));
    const driverSub = this.driverService
      .getAll()
      .subscribe((response) => (this.drivers = response.data ?? []));
    this._subscriptions.push(vehicleSub, driverSub);
  }

  private setupQuoteTripAutoComplete(): void {
    const quoteTrip = this.form.get('quoteTrip')!;

    this.filteredQuoteTripVehicles$ = quoteTrip
      .get('vehiclePlate')!
      .valueChanges.pipe(
        startWith(''),
        map((value) => {
          const filterValue = (typeof value === 'string' ? value : '').toLowerCase();
          if (!filterValue) {
            return [];
          }
          return this.vehicles.filter(
            (vehicle) =>
              (vehicle.plate || '').toLowerCase().includes(filterValue) ||
              (vehicle.brand || '').toLowerCase().includes(filterValue) ||
              (vehicle.model || '').toLowerCase().includes(filterValue),
          );
        }),
      );

    this.filteredQuoteTripDrivers$ = quoteTrip
      .get('driverName')!
      .valueChanges.pipe(
        startWith(''),
        map((value) => {
          const filterValue = (typeof value === 'string' ? value : '').toLowerCase();
          if (!filterValue) {
            return [];
          }
          return this.drivers.filter((driver) =>
            (driver.name || '').toLowerCase().includes(filterValue),
          );
        }),
      );
  }

  selectQuoteTripVehicle(vehicle: Vehicle): void {
    if (!vehicle) {
      return;
    }
    this.form.get('quoteTrip')!.patchValue({
      vehicleId: vehicle.id,
      vehiclePlate: vehicle.plate,
    });
  }

  async onQuoteTripVehiclePlateBlur(): Promise<void> {
    setTimeout(() => {
      const quoteTrip = this.form.get('quoteTrip')!;
      const plate = quoteTrip.get('vehiclePlate')!.value?.trim();
      if (!plate) {
        this.cleanQuoteTripVehicle();
        this.cdr.markForCheck();
        return;
      }
      const found = this.vehicles.find((v) => v.plate === plate);
      if (found) {
        this.selectQuoteTripVehicle(found);
      } else {
        this.cleanQuoteTripVehicle();
      }
      this.cdr.markForCheck();
    }, 200);
  }

  selectQuoteTripDriver(driver: Driver): void {
    if (!driver) {
      return;
    }
    this.form.get('quoteTrip')!.patchValue({
      driverId: driver.id,
      driverName: driver.name,
    });
  }

  async onQuoteTripDriverNameBlur(): Promise<void> {
    setTimeout(() => {
      const quoteTrip = this.form.get('quoteTrip')!;
      const name = quoteTrip.get('driverName')!.value?.trim();
      if (!name) {
        this.cleanQuoteTripDriver();
        this.cdr.markForCheck();
        return;
      }
      const found = this.drivers.find((d) => d.name === name);
      if (found) {
        this.selectQuoteTripDriver(found);
      } else {
        this.cleanQuoteTripDriver();
      }
      this.cdr.markForCheck();
    }, 200);
  }

  private cleanQuoteTripVehicle(): void {
    this.form.get('quoteTrip')!.patchValue({ vehicleId: null, vehiclePlate: '' });
  }

  private cleanQuoteTripDriver(): void {
    this.form.get('quoteTrip')!.patchValue({ driverId: null, driverName: '' });
  }

  private patchFormWithData(): void {
    if (this.data && this.form) {
      const totalOfPayments = this.data.totalOfPayments ?? 1;
      const paymentTotalPrice = this.data.totalPrice ?? 0;
      const totalOfExpenses = this.data.totalOfExpenses ?? 0;
      const expenseTotalPrice = this.data.expenseTotalPrice ?? 0;

      const patch = {
        ...this.data,
        totalOfPayments,
        paymentTotalPrice,
        totalOfExpenses,
        expenseTotalPrice,
      };

      this.form.patchValue(patch);
    }
  }

  private cleanClientSelection(): void {
    this.form.get('businessPartnerId')!.setValue('');
    this.markAsTouched('businessPartnerId');
    this.form.get('businessPartnerId')!.setErrors({ required: true });
    this.form.get('businessPartnerName')!.setValue('');
    this.markAsTouched('businessPartnerName');
    this.form.get('businessPartnerName')!.setErrors({ required: true });
  }

  private setupAutoComplete(): void {
    this.businessPartners$ = this.businessPartnerService.getClients();
    this.businessPartnersArray$ = this.businessPartners$.pipe(
      map((response) => response.data ?? []),
    );

    this.filteredBusinessPartners$ = this.form
      .get('businessPartnerName')!
      .valueChanges.pipe(
        startWith(''),
        combineLatestWith(this.businessPartnersArray$),
        map(([value, businessPartners]) => {
          const filterValue = (value || '').toLowerCase();
          if (!filterValue) {
            return [];
          }
          return businessPartners.filter((businessPartner: BusinessPartner) =>
            (businessPartner.name || '').toLowerCase().includes(filterValue),
          );
        }),
      );
  }

  private disableEditFields(): void {
    if (this.isEdit && this.form) {
      this.form.get('businessPartnerName')?.disable();
      this.form.get('quoteNumber')?.disable();
    }
  }

  private setupPaymentPriceWatcher(): void {
    this._subscriptions.push(
      this.form
        .get('totalPrice')!
        .valueChanges.subscribe((totalPrice: number) => {
          const payments = this.form.get('totalOfPayments')?.value || 1;
          const validPayments = payments > 0 ? payments : 1;
          const perPayment = totalPrice / validPayments;
          this.form.get('paymentTotalPrice')?.setValue(perPayment);
        }),
    );
  }

  private totalPriceChange(): void {
    this.form
      .get('discount')
      ?.valueChanges.subscribe(() => this.updateTotalPriceFields());
  }

  private updatePriceFields(): void {
    const total = this.data?.quoteProducts?.reduce(
      (sum, p) => sum + (p?.totalPrice || 0),
      0,
    );
    this.data!.price = total;
    this.form.get('price')?.setValue(total);
  }

  private updateTotalPriceFields(): void {
    const price = Number(this.form.get('price')?.value) || 0;
    const discount = Number(this.form.get('discount')?.value) || 0;
    const total = price * (1 - discount / 100);
    this.form.get('totalPrice')?.setValue(total);
  }

  private save(quote: Quote): Observable<WebApiResponse<Quote>> {
    return this.isEdit && this.data
      ? this.quoteService.update(quote)
      : this.quoteService.add(quote);
  }

  private saveModal(response: WebApiResponse<Quote>): void {
    this.dialogRef?.close(response);
    this.modalService.showNotification(
      response.status == ResponseStatus.Success,
      this.translationService.instant('QUOTES.QUOTE_ADDED'),
      response.message,
    );
  }

  private savePage(response: WebApiResponse<Quote>): void {
    if (this.isEdit && this.data) {
      this.notificationService.showMessage(response.status, response.message);
      this.data = response.data;
      this.cdr.markForCheck();
    } else {
      this.routerService.navigateByUrl(
        `/${this._baseEndPoint}/${response.data.id}`,
      );
    }
  }
}
