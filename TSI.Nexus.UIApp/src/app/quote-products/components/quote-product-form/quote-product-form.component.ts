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
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  QuoteProduct,
  Product,
  ProductService,
  FormBaseComponent,
  ModalService,
  ProductType,
  WebApiResponse,
  Quote,
  ResponseStatus,
  NotificationService,
  QuoteProductService,
  QuoteService,
  TranslationService,
} from '@nexus/core';
import {
  Observable,
  startWith,
  map,
  of,
  tap,
  firstValueFrom,
  combineLatestWith,
  Subscription,
} from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';

import { ProductDetailsModalComponent } from '../../../products/components/product-details-modal/product-details-modal.component';
import { QuoteProductDetailsModalComponent } from '../quote-product-details-modal/quote-product-details-modal.component';
import { NgClass, NgFor, NgIf, AsyncPipe } from '@angular/common';
import { MatAutocompleteTrigger, MatAutocomplete, MatOption } from '@angular/material/autocomplete';
import { LinkFieldComponent } from '../../../shared/components/link-field/link-field.component';
import { CurrencyFieldComponent } from '../../../shared/components/currency-field/currency-field.component';
import { ClickDirective } from '../../../core/directives/click.directive';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    selector: 'app-quote-product-form',
    templateUrl: './quote-product-form.component.html',
    styleUrl: './quote-product-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgClass,
        ReactiveFormsModule,
        MatAutocompleteTrigger,
        MatAutocomplete,
        NgFor,
        MatOption,
        NgIf,
        LinkFieldComponent,
        CurrencyFieldComponent,
        ClickDirective,
        AsyncPipe,
        TranslatePipe,
    ],
})
export class QuoteProductFormComponent
  extends FormBaseComponent
  implements OnInit, OnChanges, OnDestroy
{
  @Input()
  isModal = false;

  @Input()
  isEdit = false;

  @Input()
  parentId: string | null = null;

  @Input()
  parentData: any;

  @Input()
  data?: QuoteProduct | null;

  @Input()
  compact = false;

  @Input()
  dialogRef?: MatDialogRef<QuoteProductDetailsModalComponent>;

  products$!: Observable<WebApiResponse<Product[]>>;
  productsArray$!: Observable<Product[]>;
  filteredProductsSku$!: Observable<Product[]>;
  filteredProductsName$!: Observable<Product[]>;

  get productTypeOptions() {
    return [
      { label: this.translationService.instant('PRODUCTS.TYPE_RENTAL'), value: ProductType.Rental },
      { label: this.translationService.instant('PRODUCTS.TYPE_SALE'), value: ProductType.Sale },
      { label: this.translationService.instant('PRODUCTS.SINGULAR'), value: ProductType.Service },
    ];
  }

  // productTypeOptions is a getter, so *ngFor's default identity-based tracking sees a brand new
  // array/objects on every change-detection pass and keeps destroying/recreating the <option>
  // elements - severe enough churn on a bound <select> to trip NG0103 (infinite change detection).
  trackByOptionValue(_index: number, option: { value: string; label: string }): string {
    return option.value;
  }

  private _subscriptions: Subscription[] = [];
  private _quoteData: Quote | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private quoteService: QuoteService,
    private quoteProductService: QuoteProductService,
    private productService: ProductService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
  ) {
    super();
  }

  async ngOnInit(): Promise<void> {
    this.initForm();
    this.patchFormWithData();
    this.setupAutoComplete();
    this.totalPriceChange();
    await this.initParentInfo();
    this.disableEditFields();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data && this.form) {
      this.patchFormWithData();
    }
  }

  ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  submit(): Observable<WebApiResponse<QuoteProduct> | null> {
    this.submitted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return of(null);
    }

    return this.save(this.form.getRawValue() as QuoteProduct).pipe(
      tap({
        next: (response: WebApiResponse<QuoteProduct>) => {
          this.dialogRef?.close(response);
          if (this.parentId) {
            this.modalService.showSweetNotification(
              '',
              response.message,
              response.status,
            );
          }
        },
        error: (err) => {
          this.notificationService.showMessage('Error', this.translationService.instant('COMMON.SAVE_ERROR'));
        },
      }),
    );
  }

  cancel(): void {
    this.modalService.hideModal(this.dialogRef);
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
          this.quoteProductService
            .delete(this.data as QuoteProduct)
            .pipe(
              tap({
                next: (response: WebApiResponse<QuoteProduct>) => {
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
                  }
                },
                error: (err) => {
                  this.notificationService.showMessage(
                    'error',
                    this.translationService.instant('ORDERS.REMOVE_ERROR'),
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
            this.modalService.showTemplateModal(
              QuoteProductDetailsModalComponent,
              initialState,
            );
          }
        }
      });
  }

  async initParentInfo() {
    if (this.parentData) {
      this._quoteData = this.parentData;
      return;
    } else if (this.parentId == null) {
      return;
    }

    const response = await firstValueFrom(
      this.quoteService.getById(this.parentId),
    );
    this._quoteData = response.data ?? null;
  }

  async onProductSkuBlur(): Promise<void> {
    setTimeout(() => {
      const productSku = this.form.get('productSku')!.value?.trim();
      if (!productSku) {
        this.cleanProductSelection();
        this.cdr.markForCheck();
        return;
      }
      const sub = this.productsArray$.subscribe((products) => {
        const found = products.find((p) => p.sku === productSku);
        if (!found) {
          const confirmRef = this.modalService.showConfirmation({
            title: this.translationService.instant('COMMON.ENTITY_NOT_FOUND', { entity: this.translationService.instant('PRODUCTS.SINGULAR') }),
            message: this.translationService.instant('COMMON.CONFIRM_ADD_ENTITY', { entityLower: this.translationService.instant('PRODUCTS.SINGULAR').toLowerCase(), name: productSku }),
            cancelButtonText: this.translationService.instant('COMMON.CANCEL'),
            confirmButtonText: this.translationService.instant('COMMON.YES'),
          });
          confirmRef.afterClosed().subscribe((confirmed: boolean) => {
            if (confirmed) {
              const productFormRef: MatDialogRef<any> =
                this.modalService.showTemplateModal(
                  ProductDetailsModalComponent,
                  {
                    data: { sku: productSku },
                    disableClose: true,
                  },
                );
              productFormRef
                .afterClosed()
                .subscribe((result: WebApiResponse<Product> | undefined) => {
                  if (result) {
                    this.form.get('productId')!.setValue(result.data.id);
                    this.form.get('productSku')!.setValue(result.data.sku);
                    this.form.get('productName')!.setValue(result.data.name);
                    this.form.get('productType')!.setValue(result.data.type);
                    this.setupAutoComplete();
                  } else {
                    this.cleanProductSelection();
                  }
                  this.cdr.markForCheck();
                });
            } else {
              this.cleanProductSelection();
              this.cdr.markForCheck();
            }
          });
        }
        sub.unsubscribe();
      });
    }, 200);
  }

  async onProductNameBlur(): Promise<void> {
    setTimeout(() => {
      const productName = this.form.get('productName')!.value?.trim();
      if (!productName) {
        this.cleanProductSelection();
        this.cdr.markForCheck();
        return;
      }
      const sub = this.productsArray$.subscribe((products) => {
        const found = products.find((p) => p.name === productName);
        if (!found) {
          const confirmRef = this.modalService.showConfirmation({
            title: this.translationService.instant('COMMON.ENTITY_NOT_FOUND', { entity: this.translationService.instant('PRODUCTS.SINGULAR') }),
            message: this.translationService.instant('COMMON.CONFIRM_ADD_ENTITY', { entityLower: this.translationService.instant('PRODUCTS.SINGULAR').toLowerCase(), name: productName }),
            cancelButtonText: this.translationService.instant('COMMON.CANCEL'),
            confirmButtonText: this.translationService.instant('COMMON.YES'),
          });
          confirmRef.afterClosed().subscribe((confirmed: boolean) => {
            if (confirmed) {
              const productFormRef: MatDialogRef<any> =
                this.modalService.showTemplateModal(
                  ProductDetailsModalComponent,
                  {
                    data: { name: productName },
                    disableClose: true,
                  },
                );
              productFormRef
                .afterClosed()
                .subscribe((response: WebApiResponse<Product> | undefined) => {
                  if (response) {
                    this.form.get('productId')!.setValue(response.data.id);
                    this.form.get('productSku')!.setValue(response.data.sku);
                    this.form.get('productName')!.setValue(response.data.name);
                    this.form.get('productType')!.setValue(response.data.type);
                    this.setupAutoComplete();
                  } else {
                    this.cleanProductSelection();
                  }
                  this.cdr.markForCheck();
                });
            } else {
              this.cleanProductSelection();
              this.cdr.markForCheck();
            }
          });
        }
        sub.unsubscribe();
      });
    }, 200);
  }

  selectProduct(product: Product) {
    if (!product) {
      return;
    }

    if (!this.form.get('productId')) {
      this.form.addControl('productId', this.formBuilder.control(''));
    }

    if (this.data == null) {
      this.data = {} as QuoteProduct;
    }

    this.data.productId = product.id;
    this.data.productSku = product.sku;
    this.data.productName = product.name;
    this.data.productType = product.type as any;
    this.data.price = product.price;

    this.form.patchValue({
      productId: product.id,
      productSku: product.sku,
      productName: product.name,
      productType: product.type,
      price: product.price,
    });

    this.updateTotalPrice();
  }

  private initForm(): void {
    this.form = this.formBuilder.group({
      productId: ['', Validators.required],
      productSku: [''],
      productName: [''],
      productType: [{ value: '', disabled: true }],
      quantity: [1, [Validators.required, Validators.min(1)]],
      previousQuantity: [0],
      price: [0, [Validators.required]],
      discount: [0, [Validators.min(0), Validators.max(100)]],
      totalPrice: [{ value: 0, disabled: true }],
    });

    if (this.isEdit) {
      this.form.addControl('id', this.formBuilder.control(''));
    } else {
      this._subscriptions.push(
        this.form.get('productName')!.valueChanges.subscribe((name) => {
          const sub = this.productsArray$.subscribe((products) => {
            const product = products.find((p: Product) => p.name === name);
            if (product) {
              this.form.get('productId')!.setValue(product.id);
            }
          });
          this._subscriptions.push(sub);
        }),
      );
    }
  }

  private patchFormWithData(): void {
    if (this.data && this.form) {
      this.form.patchValue(this.data);
    }
  }

  private disableEditFields(): void {
    if (this.isEdit && this.form) {
      this.form.get('productSku')?.disable();
      this.form.get('productName')?.disable();
    }
  }

  private setupAutoComplete(): void {
    this.products$ = this.productService.getAll();
    this.productsArray$ = this.products$.pipe(
      map((response) => response.data ?? []),
    );

    this.productSkuAutoComplete();
    this.productNameAutoComplete();
  }

  private productSkuAutoComplete(): void {
    this.filteredProductsSku$ = this.form.get('productSku')!.valueChanges.pipe(
      startWith(''),
      combineLatestWith(this.productsArray$),
      map(([value, products]) => {
        let filterValue = '';
        if (typeof value === 'string') {
          filterValue = value.toLowerCase();
        } else if (value && typeof value === 'object') {
          filterValue = value.sku?.toLowerCase() || '';
        }
        if (!filterValue) {
          return [];
        }
        return products
          .filter((product: Product) =>
            (product.sku || '').toLowerCase().includes(filterValue),
          )
          .map((product: Product) => ({
            ...product,
            alreadyUsed: this.parentData?.quoteProducts?.some(
              (qp: QuoteProduct) => qp.productId === product.id,
            ),
          }));
      }),
    );
  }

  private productNameAutoComplete(): void {
    this.filteredProductsName$ = this.form
      .get('productName')!
      .valueChanges.pipe(
        startWith(''),
        combineLatestWith(this.productsArray$),
        map(([value, products]) => {
          let filterValue = '';
          if (typeof value === 'string') {
            filterValue = value.toLowerCase();
          } else if (value && typeof value === 'object') {
            filterValue = value.name?.toLowerCase() || '';
          }
          if (!filterValue) {
            return [];
          }
          return products
            .filter((product: Product) =>
              (product.name || '').toLowerCase().includes(filterValue),
            )
            .map((product: Product) => ({
              ...product,
              alreadyUsed: this.parentData?.quoteProducts?.some(
                (qp: QuoteProduct) => qp.productId === product.id,
              ),
            }));
        }),
      );
  }

  private totalPriceChange(): void {
    setTimeout(() => {
      this.updateTotalPrice();
      this.cdr.markForCheck();
    }, 0);

    this.form.get('quantity')?.valueChanges &&
      this._subscriptions.push(
        this.form
          .get('quantity')!
          .valueChanges.subscribe(() => this.updateTotalPrice()),
      );

    this.form.get('discount')?.valueChanges &&
      this._subscriptions.push(
        this.form
          .get('discount')!
          .valueChanges.subscribe(() => this.updateTotalPrice()),
      );
  }

  private updateTotalPrice(): void {
    let priceValue = this.form.get('price')?.value || 0;

    if (typeof priceValue === 'string') {
      priceValue = priceValue
        .replace(/R\$\s?/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .trim();
    }
    const price = Number(priceValue) || 0;
    const quantity = Number(this.form.get('quantity')?.value) || 0;
    const discount = Number(this.form.get('discount')?.value) || 0;
    const total = price * quantity * (1 - discount / 100);

    this.form.get('totalPrice')?.setValue(total);
  }

  private cleanProductSelection() {
    this.form.get('productId')!.setValue('');
    this.markAsTouched('productId');
    this.form.get('productId')!.setErrors({ required: true });
    this.form.get('productSku')!.setValue('');
    this.markAsTouched('productSku');
    this.form.get('productSku')!.setErrors({ required: true });
    this.form.get('productName')!.setValue('');
    this.markAsTouched('productName');
    this.form.get('productName')!.setErrors({ required: true });
    this.form.get('productType')!.setValue('');
    this.markAsTouched('productType');
    this.form.get('productType')!.setErrors({ required: true });
  }

  private save(
    quoteProduct: QuoteProduct,
  ): Observable<WebApiResponse<QuoteProduct>> {
    if (!this.parentId) {
      return this.quoteProductService.addTemporary(
        this.form.getRawValue() as QuoteProduct,
      );
    }

    quoteProduct.orderId = this.parentId ?? undefined;
    return this.isEdit && this.data
      ? this.quoteProductService.update(quoteProduct)
      : this.quoteProductService.add(quoteProduct);
  }
}
