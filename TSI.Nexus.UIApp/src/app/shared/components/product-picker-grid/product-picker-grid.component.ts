import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CurrencyService,
  ModalService,
  Product,
  ProductService,
  ProductType,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteTrigger, MatAutocomplete, MatOption } from '@angular/material/autocomplete';
import { NgFor, NgIf, NgClass, AsyncPipe, CurrencyPipe } from '@angular/common';
import { Observable, Subject, combineLatestWith, map, startWith, takeUntil } from 'rxjs';

import { ProductDetailsModalComponent } from '../../../products/components/product-details-modal/product-details-modal.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

// Product picker used by any "add line items to a document" form (today: Pedido de Venda,
// Pedido de Compra). SKU autocomplete + inline staged-line grid + quantity validation +
// "produto não encontrado, deseja cadastrar?" flow, all extracted from order-form.component.ts
// (see docs/spec-2-pedido-de-compra.md, seção 3) so both forms share the exact same behavior
// instead of drifting apart. This component knows nothing about Order/PurchaseOrder - it only
// stages { productId, productSku, productName, productType, quantity, price, discount,
// totalPrice } lines and hands them to the parent via (itemAdded); the parent owns the actual
// document's item list.
@Component({
    selector: 'app-product-picker-grid',
    templateUrl: './product-picker-grid.component.html',
    styleUrl: './product-picker-grid.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatAutocompleteTrigger,
        MatAutocomplete,
        MatOption,
        NgFor,
        NgIf,
        NgClass,
        AsyncPipe,
        CurrencyPipe,
        TranslatePipe,
    ],
})
export class ProductPickerGridComponent implements OnInit, OnDestroy {
  @Input()
  items: any[] | null | undefined = [];

  // Sales blocks picking a product with zero stock; Purchase doesn't (the whole point of a
  // purchase order is to bring stock that's currently at/below zero back up).
  @Input()
  filterOutOfStock = true;

  @Output()
  itemAdded = new EventEmitter<any>();

  @Output()
  itemRemoved = new EventEmitter<number>();

  @Output()
  openManualModal = new EventEmitter<void>();

  inlineProductForm!: FormGroup;
  filteredProductsSku$!: Observable<Product[]>;
  filteredProductsName$!: Observable<Product[]>;

  private _products: Product[] = [];
  private _destroy$ = new Subject<void>();

  constructor(
    private currencyService: CurrencyService,
    private formBuilder: FormBuilder,
    private modalService: ModalService,
    private productService: ProductService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.setupAutoComplete();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  async onProductSkuBlur(): Promise<void> {
    setTimeout(() => {
      const productSku = this.inlineProductForm.get('productSku')!.value?.trim();
      if (!productSku) {
        this.cleanSelection();
        this.cdr.markForCheck();
        return;
      }
      const found = this._products.find((p) => p.sku === productSku);
      if (found) {
        this.selectProduct(found);
        this.cdr.markForCheck();
        return;
      }
      this.confirmAndCreateProduct({ sku: productSku });
    }, 200);
  }

  async onProductNameBlur(): Promise<void> {
    setTimeout(() => {
      const productName = this.inlineProductForm.get('productName')!.value?.trim();
      if (!productName) {
        this.cleanSelection();
        this.cdr.markForCheck();
        return;
      }
      const found = this._products.find((p) => p.name === productName);
      if (found) {
        this.selectProduct(found);
        this.cdr.markForCheck();
        return;
      }
      this.confirmAndCreateProduct({ name: productName });
    }, 200);
  }

  private confirmAndCreateProduct(data: { sku?: string; name?: string }): void {
    const nameOrSku = data.sku ?? data.name ?? '';
    const confirmRef = this.modalService.showConfirmation({
      title: this.translationService.instant('COMMON.ENTITY_NOT_FOUND', { entity: this.translationService.instant('PRODUCTS.SINGULAR') }),
      message: this.translationService.instant('COMMON.CONFIRM_ADD_ENTITY', { entityLower: this.translationService.instant('PRODUCTS.SINGULAR').toLowerCase(), name: nameOrSku }),
      cancelButtonText: this.translationService.instant('COMMON.CANCEL'),
      confirmButtonText: this.translationService.instant('COMMON.YES'),
    });
    confirmRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        const productFormRef: MatDialogRef<any> = this.modalService.showTemplateModal(
          ProductDetailsModalComponent,
          {
            data,
            disableClose: true,
          },
        );
        productFormRef
          .afterClosed()
          .subscribe((result: WebApiResponse<Product> | undefined) => {
            if (result) {
              this._products = [...this._products, result.data];
              this.selectProduct(result.data);
            } else {
              this.cleanSelection();
            }
            this.cdr.markForCheck();
          });
      } else {
        this.cleanSelection();
        this.cdr.markForCheck();
      }
    });
  }

  selectProduct(product: Product): void {
    if (!product) {
      return;
    }

    if (
      this.filterOutOfStock &&
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
      this.cleanSelection();
      return;
    }

    this.inlineProductForm.patchValue({
      productId: product.id,
      productSku: product.sku,
      productName: product.name,
      productType: product.type,
      price: product.price,
    });
  }

  onQuantityBlur(): void {
    if (!this.filterOutOfStock) {
      return;
    }

    const quantityControl = this.inlineProductForm.get('quantity');
    const productSku = this.inlineProductForm.get('productSku')?.value;
    if (!quantityControl || !productSku) {
      return;
    }

    const product = this._products.find((p) => p.sku === productSku);
    if (product?.quantityInStock == null) {
      return;
    }

    const quantity = Number(quantityControl.value);
    if (quantity > product.quantityInStock) {
      this.modalService.showNotification(
        false,
        this.translationService.instant('PRODUCTS.STOCK_EXCEEDED_TITLE'),
        this.translationService.instant('PRODUCTS.STOCK_EXCEEDED_MESSAGE', { qty: quantity + '', stock: product.quantityInStock + '' }),
      );
      quantityControl.setValue(1);
    }
  }

  addProduct(): void {
    const raw = this.inlineProductForm.getRawValue();
    if (!raw.productId || !raw.productSku) {
      return;
    }

    const quantity = Number(raw.quantity) || 1;
    const price = Number(raw.price) || 0;
    const totalPrice = price * quantity;

    this.itemAdded.emit({
      productId: raw.productId,
      productSku: raw.productSku,
      productName: raw.productName,
      productType: raw.productType,
      quantity,
      price,
      priceFormatted: this.currencyService.formatCurrencyBRL(price),
      discount: 0,
      totalPrice,
      totalPriceFormatted: this.currencyService.formatCurrencyBRL(totalPrice),
    });
    this.cleanSelection();
  }

  removeItem(index: number): void {
    this.itemRemoved.emit(index);
  }

  openModal(): void {
    this.openManualModal.emit();
  }

  trackByProductId(_index: number, product: Product): string {
    return product.id;
  }

  trackByIndex(index: number): number {
    return index;
  }

  private initForm(): void {
    this.inlineProductForm = this.formBuilder.group({
      productId: [''],
      productSku: [''],
      productName: [''],
      productType: [''],
      price: [0],
      quantity: [1, [Validators.min(1)]],
    });
  }

  private setupAutoComplete(): void {
    const productsArray$ = this.productService.getAll().pipe(
      map((response) => response.data ?? []),
    );

    productsArray$
      .pipe(takeUntil(this._destroy$))
      .subscribe((products) => (this._products = products));

    this.filteredProductsSku$ = this.inlineProductForm
      .get('productSku')!
      .valueChanges.pipe(
        startWith(''),
        combineLatestWith(productsArray$),
        map(([value, products]) => {
          const filterValue = (typeof value === 'string' ? value : '').toLowerCase();
          if (!filterValue) {
            return [];
          }
          return products
            .filter((product: Product) =>
              (product.sku || '').toLowerCase().includes(filterValue),
            )
            .map((product: Product) => ({
              ...product,
              alreadyUsed: this.items?.some((op) => op.productId === product.id),
              disabled:
                this.filterOutOfStock &&
                product.quantityInStock !== undefined &&
                product.quantityInStock <= 0,
            }));
        }),
      );

    this.filteredProductsName$ = this.inlineProductForm
      .get('productName')!
      .valueChanges.pipe(
        startWith(''),
        combineLatestWith(productsArray$),
        map(([value, products]) => {
          const filterValue = (typeof value === 'string' ? value : '').toLowerCase();
          if (!filterValue) {
            return [];
          }
          return products
            .filter((product: Product) =>
              (product.name || '').toLowerCase().includes(filterValue),
            )
            .map((product: Product) => ({
              ...product,
              alreadyUsed: this.items?.some((op) => op.productId === product.id),
              disabled:
                this.filterOutOfStock &&
                product.quantityInStock !== undefined &&
                product.quantityInStock <= 0,
            }));
        }),
      );
  }

  private cleanSelection(): void {
    this.inlineProductForm.reset({
      productId: '',
      productSku: '',
      productName: '',
      productType: '',
      price: 0,
      quantity: 1,
    });
  }
}
