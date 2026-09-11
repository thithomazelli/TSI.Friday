import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';

import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';

import {
  ApiType,
  FormBaseComponent,
  ModalService,
  NotificationService,
  Product,
  ProductService,
  ProductType,
  ProductUnit,
  ResponseStatus,
  SelectableOption,
  SelectableOptionGroup,
  SelectableOptionService,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';

import { Observable, of, Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';

// Type-only: ProductDetailsModalComponent imports this form back (renders <app-product-form> in
// its template), so a normal import here would form a module-load-order circular dependency
// between the two files - `import type` is erased at compile time and can't contribute to that
// cycle. The one place this component needs the class itself at runtime (reopening the modal
// after a cancelled delete, in remove() below) loads it dynamically instead, for the same reason.
import type { ProductDetailsModalComponent } from '../product-details-modal/product-details-modal.component';
import { NgClass } from '@angular/common';
import { CurrencyFieldComponent } from '../../../shared/components/currency-field/currency-field.component';
import { ClickDirective } from '../../../core/directives/click.directive';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    selector: 'app-product-form',
    templateUrl: './product-form.component.html',
    styleUrls: ['./product-form.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgClass,
        ReactiveFormsModule,
        CurrencyFieldComponent,
        ClickDirective,
        TranslatePipe,
    ],
})
export class ProductFormComponent
  extends FormBaseComponent
  implements OnInit, OnChanges, OnDestroy
{
  @Input()
  isModal = false;

  @Input()
  isEdit = false;

  @Input()
  data?: Product | null;

  @Input()
  compact = false;

  @Input()
  dialogRef?: MatDialogRef<ProductDetailsModalComponent>;

  categories: SelectableOption[] = [];

  get unitOptions() {
    return [
      { label: this.translationService.instant('PRODUCTS.UNIT_UNIT'), value: ProductUnit.Unit },
      { label: this.translationService.instant('PRODUCTS.UNIT_KILOGRAM'), value: ProductUnit.Kilogram },
      { label: this.translationService.instant('PRODUCTS.UNIT_GRAM'), value: ProductUnit.Gram },
    ];
  }

  get productTypeOptions() {
    return [
      { label: this.translationService.instant('PRODUCTS.TYPE_SALE'), value: ProductType.Sale },
      { label: this.translationService.instant('PRODUCTS.TYPE_RENTAL'), value: ProductType.Rental },
      { label: this.translationService.instant('PRODUCTS.SINGULAR'), value: ProductType.Service },
    ];
  }

  private _baseEndPoint: ApiType = ApiType.Products;
  private _subscriptions: Subscription[] = [];

  constructor(
    private formBuilder: FormBuilder,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private productService: ProductService,
    private routerService: Router,
    private selectableOptionService: SelectableOptionService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
  ) {
    super();
  }

  ngOnInit(): void {
    this.initForm();
    this.patchFormWithData();
    this.loadCategories();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // quando data chegar depois do init, apenas patch no form
    if (changes['data'] && changes['data'].currentValue && this.form) {
      this.form.patchValue(changes['data'].currentValue);
    }

    // se o modo de edição mudar depois, re-inicializa o form com o novo modo
    if (changes['isEdit'] && !changes['isEdit'].firstChange) {
      this.initForm();
    }
  }

  ngOnDestroy(): void {
    this._subscriptions.forEach(
      (sub) =>
        sub && typeof sub.unsubscribe === 'function' && sub.unsubscribe(),
    );
    this._subscriptions = [];
  }

  private loadCategories(): void {
    this.selectableOptionService
      .getByGroup(SelectableOptionGroup.ProductCategory)
      .subscribe((response) => {
        this.categories = response.data ?? [];
        this.cdr.markForCheck();
      });
  }

  submit(): Observable<WebApiResponse<Product> | null> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return of(null);
    }

    const rawValue = this.form.getRawValue();

    if (this.data) {
      Object.assign(this.data!, rawValue);
    }

    return this.save(rawValue as Product).pipe(
      tap({
        next: (response: WebApiResponse<Product>) => {
          // The backend reports business-rule failures (e.g. duplicate SKU/name) as a 200
          // response with status Error and data: null rather than an HTTP error, so this has to
          // be checked before treating the save as successful - otherwise savePage()/saveModal()
          // crash trying to read .id off a null response.data.
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
          this.notificationService.showMessage('error', 'Erro ao salvar');
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
        'Deseja realmente excluir este registro?',
        'question',
      )
      .then((result: any) => {
        if (result.isConfirmed) {
          this.productService
            .delete(this.data as Product)
            .pipe(
              tap({
                next: (response: WebApiResponse<Product>) => {
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
                    'Erro ao remover',
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
              '../product-details-modal/product-details-modal.component'
            ).then(({ ProductDetailsModalComponent }) => {
              this.modalService.showTemplateModal(
                ProductDetailsModalComponent,
                initialState,
              );
            });
          }
        }
      });
  }

  private initForm(): void {
    const commonControls = {
      sku: ['', Validators.required],
      name: ['', Validators.required],
      description: [''],
      price: [0, [Validators.required, Validators.min(0)]],
      unit: [ProductUnit.Unit, Validators.required],
      type: [ProductType.Rental, Validators.required],
      quantityInStock: [1, [Validators.required, Validators.min(0)]],
      photo: [''],
      category: ['', Validators.required],
    };

    this.form = !this.isEdit
      ? this.formBuilder.group(commonControls)
      : this.formBuilder.group({
          id: [''],
          ...commonControls,
        });
  }

  private patchFormWithData(): void {
    if (this.data && this.form) {
      this.form.patchValue(this.data);
    }

    const typeSub = this.form.get('type')?.valueChanges.subscribe((type) => {
      const quantityControl = this.form.get('quantityInStock');
      if (type === ProductType.Service) {
        quantityControl?.setValue(0);
        quantityControl?.disable();
      } else {
        quantityControl?.enable();
      }
    });
    if (typeSub) {
      this._subscriptions.push(typeSub);
    }
  }

  private save(product: Product): Observable<WebApiResponse<Product>> {
    return this.isEdit && this.data
      ? this.productService.update(product)
      : this.productService.add(product);
  }

  private saveModal(response: WebApiResponse<Product>): void {
    this.dialogRef?.close(response);
    this.modalService.showNotification(
      response.status == ResponseStatus.Success,
      'Produto adicionado',
      response.message,
    );
  }

  private savePage(response: WebApiResponse<Product>): void {
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
