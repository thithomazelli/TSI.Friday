import { of, Subscription, tap } from 'rxjs';
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
  PurchaseOrder,
  OrderStatus,
  FormBaseComponent,
  ModalService,
  CurrencyService,
  PaymentType,
  PaymentCondition,
  PaymentMethod,
  PaymentStatus,
  WebApiResponse,
  ApiType,
  ResponseStatus,
  NotificationService,
  PurchaseOrderService,
  PurchaseOrderProductService,
  PurchaseOrderProduct,
  ProductService,
  TranslationService,
} from '@nexus/core';

import { MatDialogRef } from '@angular/material/dialog';

import { Observable, startWith, map, combineLatestWith } from 'rxjs';

import { BusinessPartnerDetailsModalComponent } from '../../../business-partner/components/business-partner-details-modal/business-partner-details-modal.component';
import { PurchaseOrderProductsDetailsModalComponent } from '../../../purchase-order-products/components/purchase-order-product-details-modal/purchase-order-products-details-modal.component';
// Type-only: PurchaseOrderDetailsModalComponent imports this form back (it renders
// <app-purchase-order-form> in its template), so a normal import here would form a
// module-load-order circular dependency between the two files - `import type` is erased at
// compile time and can't contribute to that cycle. The one place this component needs the
// class itself at runtime (reopening the modal after a cancelled delete, in remove() below)
// loads it dynamically instead, for the same reason.
import type { PurchaseOrderDetailsModalComponent } from '../purchase-order-details-modal/purchase-order-details-modal.component';
import { Router } from '@angular/router';
import { AlertBannerComponentComponent } from '../../../shared/alert-banner-component/alert-banner-component.component';
import { NgIf, NgClass, NgFor, AsyncPipe } from '@angular/common';
import { MatAutocompleteTrigger, MatAutocomplete, MatOption } from '@angular/material/autocomplete';
import { LinkFieldComponent } from '../../../shared/components/link-field/link-field.component';
import { DateFieldComponent } from '../../../shared/components/date-field/date-field.component';
import { CurrencyFieldComponent } from '../../../shared/components/currency-field/currency-field.component';
import { TransactionFormComponent } from '../../../transactions/components/transactions-form/transaction-form.component';
import { ProductPickerGridComponent } from '../../../shared/components/product-picker-grid/product-picker-grid.component';
import { ClickDirective } from '../../../core/directives/click.directive';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    selector: 'app-purchase-order-form',
    templateUrl: './purchase-order-form.component.html',
    styleUrl: './purchase-order-form.component.scss',
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
        TransactionFormComponent,
        ProductPickerGridComponent,
        ClickDirective,
        AsyncPipe,
        TranslatePipe,
    ],
})
export class PurchaseOrderFormComponent
  extends FormBaseComponent
  implements OnInit, OnChanges, OnDestroy
{
  @Input()
  isModal = false;

  @Input()
  isEdit = false;

  @Input()
  data?: PurchaseOrder | null = <PurchaseOrder>{
    purchaseOrderProducts: [],
  };

  @Input()
  compact = false;

  // Set when the form is opened from the navbar's stock-alert notification, so the picked
  // product is already staged instead of making the user look it up again.
  @Input()
  preselectedProductId?: string | null = null;

  @Input()
  dialogRef?: MatDialogRef<PurchaseOrderDetailsModalComponent>;

  canDisplayTransactionForm: boolean = true;
  businessPartners$!: Observable<WebApiResponse<BusinessPartner[]>>;
  businessPartnersArray$!: Observable<BusinessPartner[]>;
  filteredBusinessPartners$!: Observable<BusinessPartner[]>;

  get orderStatusOptions() {
    return [
      { value: OrderStatus.Open, label: this.translationService.instant('QUOTES.STATUS_OPEN') },
      { value: OrderStatus.Closed, label: this.translationService.instant('QUOTES.STATUS_CLOSED') },
      { value: OrderStatus.WaitingPayment, label: this.translationService.instant('QUOTES.STATUS_WAITING_PAYMENT') },
    ];
  }

  // orderStatusOptions is a getter, so *ngFor's default identity-based tracking sees a brand new
  // array/objects on every change-detection pass and keeps destroying/recreating the <option>
  // elements - severe enough churn on a bound <select> to trip NG0103 (infinite change detection).
  trackByOptionValue(_index: number, option: { value: string; label: string }): string {
    return option.value;
  }

  private _subscriptions: Subscription[] = [];
  private _baseEndPoint = ApiType.PurchaseOrders;
  private totalOfExpensesSubscription?: Subscription;

  constructor(
    private businessPartnerService: BusinessPartnerService,
    private currencyService: CurrencyService,
    private formBuilder: FormBuilder,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private purchaseOrderService: PurchaseOrderService,
    private purchaseOrderProductService: PurchaseOrderProductService,
    private productService: ProductService,
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
    this.setupTotalOfExpensesWatcher();
    this.applyPreselectedProduct();

    this._subscriptions.push(
      this.purchaseOrderProductService.purchaseOrderProductAdded$.subscribe(
        (purchaseOrderProduct) => {
          if (purchaseOrderProduct && this.data) {
            this.data.purchaseOrderProducts = [
              ...(this.data.purchaseOrderProducts ?? []),
              purchaseOrderProduct,
            ];
            this.updatePriceFields();
            this.updateTotalPriceFields();
            this.modalService.showNotification(
              true,
              '',
              this.translationService.instant('PURCHASE_ORDERS.PRODUCT_ADDED_SUCCESS'),
            );
            this.cdr.markForCheck();
          }
        },
      ),
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data && this.form) {
      this.patchFormWithData();
      this.setupTotalOfExpensesWatcher();
    }
  }

  ngOnDestroy(): void {
    if (this.totalOfExpensesSubscription) {
      this.totalOfExpensesSubscription.unsubscribe();
    }
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  submit(): Observable<WebApiResponse<PurchaseOrder> | null> {
    this.submitted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return of(null);
    }

    const rawValue = this.form.getRawValue();

    // Ensure transactionGroup has the updated business partner fields
    if (this.canDisplayTransactionForm) {
      if (rawValue.transaction) {
        rawValue.transaction.businessPartnerId = rawValue.businessPartnerId;
        rawValue.transaction.businessPartnerName = rawValue.businessPartnerName;
      }
    }

    // Garante que o id da transação seja preservado
    if (rawValue.transaction && this.data?.transaction?.id) {
      rawValue.transaction.id = this.data.transaction.id;
    }

    if (this.data) {
      Object.assign(this.data!, rawValue);
    }

    if (
      this.canDisplayTransactionForm &&
      this.data?.transaction &&
      this.data.transaction.id == null
    ) {
      delete this.data.transaction.id;
    }

    return this.save(this.data as PurchaseOrder).pipe(
      tap({
        next: (response: WebApiResponse<PurchaseOrder>) => {
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

  remove(): void {
    this.modalService.hideModal();
    this.modalService
      .showSweetConfirmation(
        '',
        this.translationService.instant('GRID.CONFIRM_DELETE'),
        'question',
      )
      .then((result: any) => {
        if (result.isConfirmed) {
          this.purchaseOrderService
            .delete(this.data as PurchaseOrder)
            .pipe(
              tap({
                next: (response: WebApiResponse<PurchaseOrder>) => {
                  if (this.isModal) {
                    this.modalService.hideModal(this.dialogRef);
                    this.modalService.showSweetNotification(
                      '',
                      response.message,
                      response.status,
                    );
                  } else {
                    this.modalService.showSweetNotification(
                      '',
                      response.message,
                      response.status,
                    );
                    if (response.status === ResponseStatus.Success) {
                      this.routerService.navigateByUrl(
                        `/${this._baseEndPoint}`,
                      );
                    }
                  }
                },
                error: (err) => {
                  this.notificationService.showMessage(
                    'error',
                    this.translationService.instant('PURCHASE_ORDERS.REMOVE_ERROR'),
                  );
                },
              }),
            )
            .subscribe();
        } else {
          if (this.isModal) {
            const initialState = {
              isEdit: this.isEdit,
              data: this.data,
              id: this.data?.id,
            };
            import(
              '../purchase-order-details-modal/purchase-order-details-modal.component'
            ).then(({ PurchaseOrderDetailsModalComponent }) => {
              this.modalService.showTemplateModal(
                PurchaseOrderDetailsModalComponent,
                initialState,
              );
            });
          }
        }
      });
  }

  removeProduct(index: number): void {
    if (!this.data?.purchaseOrderProducts) {
      return;
    }
    this.data.purchaseOrderProducts = this.data.purchaseOrderProducts.filter(
      (_, i) => i !== index,
    );
    this.updatePriceFields();
    this.updateTotalPriceFields();
  }

  openPurchaseOrderProductsModal() {
    const data = { ...this.data, ...this.form.getRawValue() };

    const initialState = {
      isEdit: false,
      id: null,
      parentId: null,
      parentData: data,
    };

    this.modalService.showTemplateModal(
      PurchaseOrderProductsDetailsModalComponent,
      initialState,
    );
  }

  onProductPickerItemAdded(item: PurchaseOrderProduct): void {
    if (!this.data) {
      return;
    }
    this.data.purchaseOrderProducts = [...(this.data.purchaseOrderProducts ?? []), item];
    this.updatePriceFields();
    this.updateTotalPriceFields();
  }

  get transactionFormGroup(): FormGroup {
    return this.form.get('transaction') as FormGroup;
  }

  async onSupplierBlur(): Promise<void> {
    setTimeout(() => {
      const businessPartnerName = this.form
        .get('businessPartnerName')!
        .value?.trim();
      if (!businessPartnerName) {
        this.cleanSupplierSelection();
        this.cdr.markForCheck();
        return;
      }
      // Sempre checa a lista de fornecedores, mesmo se businessPartnerId estiver vazio
      const sub = this.businessPartnersArray$.subscribe((suppliers) => {
        const found = suppliers.find((s) => s.name === businessPartnerName);
        if (!found) {
          const confirmRef = this.modalService.showConfirmation({
            title: this.translationService.instant('COMMON.ENTITY_NOT_FOUND', { entity: this.translationService.instant('BUSINESS_PARTNER.SUPPLIER_SINGULAR') }),
            message: this.translationService.instant('COMMON.CONFIRM_ADD_ENTITY', { entityLower: this.translationService.instant('BUSINESS_PARTNER.SUPPLIER_SINGULAR').toLowerCase(), name: businessPartnerName }),
            cancelButtonText: this.translationService.instant('COMMON.CANCEL'),
            confirmButtonText: this.translationService.instant('COMMON.YES'),
          });
          const confirmSub = confirmRef
            .afterClosed()
            .subscribe((confirmed: boolean) => {
              if (confirmed) {
                // Open modal to add supplier
                const supplierFormRef: MatDialogRef<any> =
                  this.modalService.showTemplateModal(
                    BusinessPartnerDetailsModalComponent,
                    {
                      data: { name: businessPartnerName },
                      disableClose: true,
                    },
                  );
                const supplierFormSub = supplierFormRef
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
                      this.cleanSupplierSelection();
                    }
                    this.cdr.markForCheck();
                  });
                this._subscriptions.push(supplierFormSub);
              } else {
                this.cleanSupplierSelection();
                this.cdr.markForCheck();
              }
            });
          this._subscriptions.push(confirmSub);
        }
      });
      this._subscriptions.push(sub);
    }, 200);
  }

  private initForm(): void {
    this.form = this.formBuilder.group({
      purchaseOrderNumber: [''],
      businessPartnerId: [null, Validators.required],
      businessPartnerName: [
        { value: '', disabled: this.data?.businessPartnerId != null },
        Validators.required,
      ],
      description: [''],
      date: [new Date(), Validators.required],
      status: [OrderStatus.Open, Validators.required],
      price: [{ value: 0, disabled: true }],
      discount: [0, [Validators.min(0), Validators.max(100)]],
      totalPrice: [{ value: 0, disabled: true }],
      transactionId: [null],
    });

    this.addTransactionForm();

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
  }

  private addTransactionForm(): void {
    if (!this.form.contains('transaction')) {
      const transactionGroup = this.formBuilder.group({
        id: [null],
        type: [PaymentType.Outgoing],
        date: [new Date(), Validators.required],
        method: [PaymentMethod.Cash, Validators.required],
        status: [PaymentStatus.Pending, Validators.required],
        category: ['Pagamentos'],
        condition: [
          {
            value: PaymentCondition.FullPayment,
            disabled: this.isEdit ? true : false,
          },
        ],
        totalOfPayments: [
          { value: 0, disabled: this.isEdit ? true : false },
          [Validators.min(0)],
        ],
        paymentTotalPrice: [{ value: 0, disabled: true }, [Validators.min(0)]],
        totalOfExpenses: [
          {
            value: 1,
            disabled: this.isEdit ? true : false,
          },
          Validators.required,
        ],
        expenseTotalPrice: [{ value: 0, disabled: true }, [Validators.min(0)]],
      });
      this.form.addControl('transaction', transactionGroup);
    }
  }

  private patchFormWithData(): void {
    if (this.data && this.form) {
      const expenseTotalPrice = !this.isEdit
        ? (this.data.totalPrice ?? 0) /
          (this.data.transaction?.totalOfExpenses || 1)
        : this.data.transaction?.expenseTotalPrice;

      const patch = {
        ...this.data,
        transaction: {
          ...this.data.transaction,
          id: this.data.transaction?.id ?? null,
          expenseTotalPrice,
        },
      };

      this.form.patchValue(patch);
    }
  }

  private cleanSupplierSelection(): void {
    this.form.get('businessPartnerId')!.setValue('');
    this.markAsTouched('businessPartnerId');
    this.form.get('businessPartnerId')!.setErrors({ required: true });
    this.form.get('businessPartnerName')!.setValue('');
    this.markAsTouched('businessPartnerName');
    this.form.get('businessPartnerName')!.setErrors({ required: true });
  }

  private setupAutoComplete(): void {
    this.businessPartners$ = this.businessPartnerService.getSuppliers();
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
      this.form.get('purchaseOrderNumber')?.disable();
    }
  }

  private totalPriceChange(): void {
    this.form
      .get('discount')
      ?.valueChanges.subscribe(() => this.updateTotalPriceFields());
  }

  private updatePriceFields(): void {
    const total = this.data?.purchaseOrderProducts?.reduce(
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

    const transactionGroup = this.form.get('transaction') as FormGroup | null;
    if (!this.isEdit && transactionGroup) {
      transactionGroup.get('expenseTotalPrice')?.setValue(total);
    }
  }

  private setupTotalOfExpensesWatcher(): void {
    // Remove subscription anterior se existir
    if (this.totalOfExpensesSubscription) {
      this.totalOfExpensesSubscription.unsubscribe();
    }
    const transactionGroup = this.form.get('transaction') as FormGroup | null;
    if (transactionGroup && transactionGroup.get('totalOfExpenses')) {
      this.totalOfExpensesSubscription = transactionGroup
        .get('totalOfExpenses')!
        .valueChanges.subscribe(() => {
          this.updateTotalPriceFields();
        });
    }
  }

  private applyPreselectedProduct(): void {
    if (!this.preselectedProductId || this.isEdit) {
      return;
    }

    this.productService.getById(this.preselectedProductId).subscribe((response) => {
      const product = response.data;
      if (!product) {
        return;
      }

      this.purchaseOrderProductService.addTemporary(<PurchaseOrderProduct>{
        productId: product.id,
        productSku: product.sku,
        productName: product.name,
        productType: product.type,
        quantity: 1,
        price: product.price,
        discount: 0,
        totalPrice: product.price,
      });
    });
  }

  private save(purchaseOrder: PurchaseOrder): Observable<WebApiResponse<PurchaseOrder>> {
    return this.isEdit && this.data
      ? this.purchaseOrderService.update(purchaseOrder)
      : this.purchaseOrderService.add(purchaseOrder);
  }

  private saveModal(response: WebApiResponse<PurchaseOrder>): void {
    this.dialogRef?.close(response);
    this.modalService.showNotification(
      response.status == ResponseStatus.Success,
      this.translationService.instant('PURCHASE_ORDERS.PURCHASE_ORDER_ADDED'),
      response.message,
    );
  }

  private savePage(response: WebApiResponse<PurchaseOrder>): void {
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
