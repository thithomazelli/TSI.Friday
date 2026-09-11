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
  OrderProduct,
  Product,
  ProductService,
  FormBaseComponent,
  ModalService,
  ProductType,
  WebApiResponse,
  NotificationService,
  OrderProductService,
  TranslationService,
} from '@nexus/core';
import {
  Observable,
  startWith,
  map,
  of,
  tap,
  combineLatestWith,
  Subscription,
} from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';

import { ProductDetailsModalComponent } from '../../../products/components/product-details-modal/product-details-modal.component';
import { OrderProductsDetailsModalComponent } from '../order-product-details-modal/order-products-details-modal.component';
import { NgClass, NgFor, NgIf, AsyncPipe } from '@angular/common';
import { MatAutocompleteTrigger, MatAutocomplete, MatOption } from '@angular/material/autocomplete';
import { LinkFieldComponent } from '../../../shared/components/link-field/link-field.component';
import { CurrencyFieldComponent } from '../../../shared/components/currency-field/currency-field.component';
import { ClickDirective } from '../../../core/directives/click.directive';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    selector: 'app-order-products-form',
    templateUrl: './order-products-form.component.html',
    styleUrl: './order-products-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgClass,
        ReactiveFormsModule,
        MatAutocompleteTrigger,
        MatAutocomplete,
        NgFor,
        MatOption,
        LinkFieldComponent,
        NgIf,
        CurrencyFieldComponent,
        ClickDirective,
        AsyncPipe,
        TranslatePipe,
    ],
})
export class OrderProductsFormComponent
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
  data?: OrderProduct | null;

  @Input()
  compact = false;

  @Input()
  dialogRef?: MatDialogRef<OrderProductsDetailsModalComponent>;

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

  // productTypeOptions is a getter, so *ngFor's default identity-based
  // tracking sees brand new arrays/objects on every change-detection pass and keeps destroying/
  // recreating the <option> elements - severe enough churn on a bound <select> to trip NG0103
  // (infinite change detection).
  trackByOptionValue(_index: number, option: { value: string; label: string }): string {
    return option.value;
  }

  private _subscriptions: Subscription[] = [];

  constructor(
    private formBuilder: FormBuilder,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private orderProductService: OrderProductService,
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

    // Enable/disable quantity field based on productType
    const quantityControl = this.form.get('quantity');
    const productTypeControl = this.form.get('productType');
    if (productTypeControl && quantityControl) {
      const setQuantityState = (type: string) => {
        if (type === 'Sale') {
          quantityControl.enable();
        } else {
          quantityControl.disable();
        }
      };
      setQuantityState(productTypeControl.value);
      this._subscriptions.push(
        productTypeControl.valueChanges.subscribe((type: string) => {
          setQuantityState(type);
        }),
      );
    }

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

  submit(): Observable<WebApiResponse<OrderProduct> | null> {
    this.submitted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return of(null);
    }

    const rawValue = this.form.getRawValue();

    if (this.data) {
      Object.assign(this.data!, rawValue);
    }

    return this.save(rawValue as OrderProduct).pipe(
      tap({
        next: (response: WebApiResponse<OrderProduct>) => {
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
          this.orderProductService
            .delete(this.data as OrderProduct)
            .pipe(
              tap({
                next: (response: WebApiResponse<OrderProduct>) => {
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
              OrderProductsDetailsModalComponent,
              initialState,
            );
          }
        }
      });
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

  onQuantityBlur(): void {
    const quantityControl = this.form.get('quantity');
    const productSku = this.form.get('productSku')?.value;
    if (!quantityControl || !productSku) {
      return;
    }

    const products = (this.products$ as any).data as Product[];
    const product = products.find((p) => p.sku === productSku);
    if (product?.quantityInStock == null) {
      return;
    }

    const quantity =
      Number(quantityControl.value) - (this.data?.previousQuantity ?? 0);
    if (quantity > product.quantityInStock) {
      this.modalService.showNotification(
        false,
        this.translationService.instant('PRODUCTS.STOCK_EXCEEDED_TITLE'),
        this.translationService.instant('PRODUCTS.STOCK_EXCEEDED_MESSAGE', { qty: quantity + '', stock: product.quantityInStock + '' }),
      );
      quantityControl.setValue(this.data?.previousQuantity);
    }
  }

  selectProduct(product: Product) {
    if (!product) {
      return;
    }

    // Validação de estoque
    if (
      product.type !== ProductType.Service &&
      (product.quantityInStock === undefined ||
        product.quantityInStock === null ||
        product.quantityInStock <= 0)
    ) {
      this.modalService.showNotification(
        false,
        this.translationService.instant('PRODUCTS.OUT_OF_STOCK_TITLE'),
        this.translationService.instant('PRODUCTS.OUT_OF_STOCK_MESSAGE', { name: product.name + '' }),
      );
      // Limpa seleção para forçar nova escolha
      this.form.get('productSku')?.setValue('');
      this.form.get('productName')?.setValue('');
      this.form.get('productType')?.setValue('');
      return;
    }

    if (!this.form.get('productId')) {
      this.form.addControl('productId', this.formBuilder.control(''));
    }

    if (this.data == null) {
      this.data = {} as OrderProduct;
    }

    this.data.productId = product.id;
    this.data.productSku = product.sku;
    this.data.productName = product.name;
    this.data.productType = product.type;
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
      // Atualiza productId ao selecionar produto
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
            alreadyUsed: this.parentData?.orderProducts?.some(
              (op: OrderProduct) => op.productId === product.id,
            ),
            disabled:
              product.quantityInStock !== undefined &&
              product.quantityInStock <= 0,
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
              alreadyUsed: this.parentData?.orderProducts?.some(
                (op: OrderProduct) => op.productId === product.id,
              ),
              disabled:
                product.quantityInStock !== undefined &&
                product.quantityInStock <= 0,
            }));
        }),
      );
  }

  private totalPriceChange(): void {
    // Atualiza totalPrice ao inicializar no modo edição
    setTimeout(() => {
      this.updateTotalPrice();
      this.cdr.markForCheck();
    }, 0);

    // Atualiza totalPrice ao alterar produto, quantidade, preço ou desconto
    this.form.get('productSku')?.valueChanges &&
      this._subscriptions.push(
        this.form
          .get('productSku')!
          .valueChanges.subscribe(() => this.updateTotalPrice()),
      );

    this.form.get('productName')?.valueChanges &&
      this._subscriptions.push(
        this.form
          .get('productName')!
          .valueChanges.subscribe(() => this.updateTotalPrice()),
      );

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

    this.form.get('price')?.valueChanges &&
      this._subscriptions.push(
        this.form
          .get('price')!
          .valueChanges.subscribe(() => this.updateTotalPrice()),
      );
  }

  private updateTotalPrice(): void {
    const price = Number(this.form.get('price')?.value) || 0;
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
    orderProduct: OrderProduct,
  ): Observable<WebApiResponse<OrderProduct>> {
    if (!this.parentId) {
      return this.orderProductService.addTemporary(
        this.form.getRawValue() as OrderProduct,
      );
    }

    orderProduct.orderId = this.parentId ?? undefined;
    return this.isEdit && this.data
      ? this.orderProductService.update(orderProduct)
      : this.orderProductService.add(orderProduct);
  }
}
