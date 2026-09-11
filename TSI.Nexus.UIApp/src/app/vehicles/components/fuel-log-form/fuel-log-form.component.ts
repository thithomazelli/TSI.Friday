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
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { NgFor, AsyncPipe } from '@angular/common';
import { MatAutocompleteTrigger, MatAutocomplete, MatOption } from '@angular/material/autocomplete';
import { Observable, Subscription, combineLatestWith, map, of, startWith } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  FormBaseComponent,
  FuelLog,
  FuelLogService,
  ModalService,
  NotificationService,
  Product,
  ProductService,
  ResponseStatus,
  SelectableOption,
  SelectableOptionGroup,
  SelectableOptionService,
  TranslationService,
  Vehicle,
  VehicleService,
  WebApiResponse,
} from '@nexus/core';
import { DateFieldComponent } from '../../../shared/components/date-field/date-field.component';
import { CurrencyFieldComponent } from '../../../shared/components/currency-field/currency-field.component';
import { ProductDetailsModalComponent } from '../../../products/components/product-details-modal/product-details-modal.component';
import { ClickDirective } from '../../../core/directives/click.directive';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { FuelLogDetailsModalComponent } from '../fuel-log-details-modal/fuel-log-details-modal.component';

// Form logic for a FuelLog, shared by the Add/Edit modal and (potentially) a details page -
// mirrors VehicleMaintenanceFormComponent's rationale: keeping the <form> nested one level below
// .modal-body (inside this component, not inline in the modal template) is what the global
// modal-scrollable-area CSS (.modal-body > * > *) expects, otherwise the footer buttons collapse
// into a full-width column instead of a right-aligned row.
@Component({
    selector: 'app-fuel-log-form',
    templateUrl: './fuel-log-form.component.html',
    styleUrl: './fuel-log-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        NgFor,
        AsyncPipe,
        MatAutocompleteTrigger,
        MatAutocomplete,
        MatOption,
        DateFieldComponent,
        CurrencyFieldComponent,
        ClickDirective,
        TranslatePipe,
    ],
})
export class FuelLogFormComponent
  extends FormBaseComponent
  implements OnInit, OnChanges, OnDestroy
{
  @Input()
  isModal = false;

  @Input()
  isEdit = false;

  @Input()
  data?: FuelLog | null;

  // Pre-set when the form is embedded inside a Vehicle's own screens - left empty when opened
  // from the standalone /fuel-logs list's "Adicionar" button, in which case the user picks the
  // Vehicle themselves via the select below.
  @Input()
  vehicleId = '';

  @Input()
  compact = false;

  @Input()
  dialogRef?: MatDialogRef<FuelLogDetailsModalComponent>;

  vehicles: Vehicle[] = [];
  statusOptions: SelectableOption[] = [];
  filteredProductsSku$!: Observable<Product[]>;
  filteredProductsName$!: Observable<Product[]>;
  filteredVehiclesPlate$!: Observable<Vehicle[]>;

  private _products: Product[] = [];
  private _subscriptions: Subscription[] = [];
  private readonly _baseEndPoint = 'fuel-logs';

  constructor(
    private formBuilder: FormBuilder,
    private fuelLogService: FuelLogService,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private productService: ProductService,
    private routerService: Router,
    private selectableOptionService: SelectableOptionService,
    private translationService: TranslationService,
    private vehicleService: VehicleService,
    private cdr: ChangeDetectorRef,
  ) {
    super();
  }

  ngOnInit(): void {
    this.initForm();
    this.patchFormWithData();
    this.loadStatusOptions();
    this.setupAutoComplete();
    if (!this.vehicleId) {
      this.vehicleService.getAll().subscribe((response) => {
        this.vehicles = response.data ?? [];
        this.setupVehicleAutoComplete();
        this.cdr.markForCheck();
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && changes['data'].currentValue && this.form) {
      this.patchFormWithData();
    }
  }

  ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  async onProductSkuBlur(): Promise<void> {
    setTimeout(() => {
      const productSku = this.form.get('productSku')!.value?.trim();
      if (!productSku) {
        this.cleanProductSelection();
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
      const productName = this.form.get('productName')!.value?.trim();
      if (!productName) {
        this.cleanProductSelection();
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

  selectProduct(product: Product): void {
    if (!product) {
      return;
    }

    this.form.patchValue({
      productId: product.id,
      productSku: product.sku,
      productName: product.name,
    });
  }

  async onVehiclePlateBlur(): Promise<void> {
    setTimeout(() => {
      const typed = this.form.get('vehiclePlate')!.value?.trim();
      if (!typed) {
        this.cleanVehicleSelection();
        this.cdr.markForCheck();
        return;
      }
      const found = this.vehicles.find((v) => v.plate === typed);
      if (found) {
        this.selectVehicle(found);
      } else {
        this.cleanVehicleSelection();
      }
      this.cdr.markForCheck();
    }, 200);
  }

  selectVehicle(vehicle: Vehicle): void {
    if (!vehicle) {
      return;
    }

    this.form.patchValue({
      vehicleId: vehicle.id,
      vehiclePlate: vehicle.plate,
    });
  }

  submit(): Observable<WebApiResponse<FuelLog> | null> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return of(null);
    }

    const { vehiclePlate, ...raw } = this.form.getRawValue();
    const fuelLog = {
      ...raw,
      date: this.toDate(raw.date),
      totalCost: raw.liters * raw.pricePerLiter,
      vehicleId: this.vehicleId || raw.vehicleId,
      productId: raw.productId || null,
      productSku: raw.productId ? raw.productSku : null,
      productName: raw.productId ? raw.productName : null,
    } as FuelLog;

    return this.save(fuelLog).pipe(
      tap({
        next: (response: WebApiResponse<FuelLog>) => {
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
        error: () =>
          this.notificationService.showMessage(
            ResponseStatus.Error,
            'Erro ao salvar o abastecimento.',
          ),
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
    if (!this.data) {
      return;
    }

    this.fuelLogService
      .delete(this.data)
      .pipe(
        tap({
          next: (response: WebApiResponse<FuelLog>) => {
            if (this.isModal) {
              this.modalService.hideModal(this.dialogRef);
            }
            this.notificationService.showMessage(response.status, response.message);
            if (response.status === ResponseStatus.Success && !this.isModal) {
              this.routerService.navigateByUrl(`/${this._baseEndPoint}`);
            }
          },
          error: () =>
            this.notificationService.showMessage(
              ResponseStatus.Error,
              'Erro ao remover o abastecimento.',
            ),
        }),
      )
      .subscribe();
  }

  private initForm(): void {
    const commonControls = {
      date: ['', Validators.required],
      odometer: [0, [Validators.required, Validators.min(0)]],
      liters: [0, [Validators.required, Validators.min(0)]],
      pricePerLiter: [0, [Validators.required, Validators.min(0)]],
      gasStation: [''],
      status: ['', Validators.required],
      productId: [null as string | null],
      productSku: [''],
      productName: [''],
      vehicleId: [
        this.vehicleId || null,
        this.vehicleId ? [] : [Validators.required],
      ],
      vehiclePlate: [''],
    };

    this.form = !this.isEdit
      ? this.formBuilder.group(commonControls)
      : this.formBuilder.group({ id: [''], ...commonControls });
  }

  private patchFormWithData(): void {
    if (this.data && this.form) {
      this.form.patchValue(this.data);
      if (this.data.vehicle?.plate) {
        this.form.patchValue({ vehiclePlate: this.data.vehicle.plate });
      }
    }
  }

  private save(fuelLog: FuelLog): Observable<WebApiResponse<FuelLog>> {
    return this.isEdit && this.data
      ? this.fuelLogService.update(fuelLog)
      : this.fuelLogService.add(fuelLog);
  }

  private savePage(response: WebApiResponse<FuelLog>): void {
    if (this.isEdit && this.data) {
      this.notificationService.showMessage(response.status, response.message);
      this.data = response.data;
      this.cdr.markForCheck();
    } else if (response.status === ResponseStatus.Success) {
      this.routerService.navigateByUrl(`/${this._baseEndPoint}`);
    } else {
      this.notificationService.showMessage(response.status, response.message);
    }
  }

  private saveModal(response: WebApiResponse<FuelLog>): void {
    this.dialogRef?.close(response);
    this.notificationService.showMessage(response.status, response.message);
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
      if (!confirmed) {
        this.cleanProductSelection();
        this.cdr.markForCheck();
        return;
      }
      const productFormRef: MatDialogRef<any> = this.modalService.showTemplateModal(
        ProductDetailsModalComponent,
        { data, disableClose: true },
      );
      productFormRef
        .afterClosed()
        .subscribe((result: WebApiResponse<Product> | undefined) => {
          if (result) {
            this._products = [...this._products, result.data];
            this.selectProduct(result.data);
          } else {
            this.cleanProductSelection();
          }
          this.cdr.markForCheck();
        });
    });
  }

  private cleanProductSelection(): void {
    this.form.patchValue({ productId: null, productSku: '', productName: '' });
  }

  private cleanVehicleSelection(): void {
    this.form.patchValue({ vehicleId: null, vehiclePlate: '' });
  }

  private setupVehicleAutoComplete(): void {
    this.filteredVehiclesPlate$ = this.form.get('vehiclePlate')!.valueChanges.pipe(
      startWith(''),
      map((value) => {
        const filterValue = (typeof value === 'string' ? value : '').toLowerCase();
        if (!filterValue) {
          return [];
        }
        return this.vehicles.filter((vehicle) =>
          (vehicle.plate || '').toLowerCase().includes(filterValue),
        );
      }),
    );
  }

  private loadStatusOptions(): void {
    this.selectableOptionService
      .getByGroup(SelectableOptionGroup.FuelLogStatus)
      .subscribe((response) => {
        this.statusOptions = response.data ?? [];
        this.cdr.markForCheck();
      });
  }

  private setupAutoComplete(): void {
    const productsArray$ = this.productService.getAll().pipe(
      map((response) => response.data ?? []),
    );

    this._subscriptions.push(
      productsArray$.subscribe((products) => (this._products = products)),
    );

    this.filteredProductsSku$ = this.form.get('productSku')!.valueChanges.pipe(
      startWith(''),
      combineLatestWith(productsArray$),
      map(([value, products]) => {
        const filterValue = (typeof value === 'string' ? value : '').toLowerCase();
        if (!filterValue) {
          return [];
        }
        return products.filter((product: Product) =>
          (product.sku || '').toLowerCase().includes(filterValue),
        );
      }),
    );

    this.filteredProductsName$ = this.form.get('productName')!.valueChanges.pipe(
      startWith(''),
      combineLatestWith(productsArray$),
      map(([value, products]) => {
        const filterValue = (typeof value === 'string' ? value : '').toLowerCase();
        if (!filterValue) {
          return [];
        }
        return products.filter((product: Product) =>
          (product.name || '').toLowerCase().includes(filterValue),
        );
      }),
    );
  }

  /**
   * app-date-field yields a "DD/MM/YYYY" string when typed manually, a Moment/Date instance when
   * picked from the calendar, or the original ISO string/Date when left untouched during edit.
   */
  private toDate(dateOnly: any): Date {
    if (!dateOnly) {
      return new Date();
    }
    if (typeof dateOnly === 'object' && typeof dateOnly.toDate === 'function') {
      return dateOnly.toDate();
    }
    if (dateOnly instanceof Date) {
      return dateOnly;
    }
    const str = String(dateOnly);
    if (str.includes('/')) {
      const [day, month, year] = str.split('/').map((part) => Number(part));
      return new Date(year, (month || 1) - 1, day || 1);
    }
    return new Date(str);
  }
}
