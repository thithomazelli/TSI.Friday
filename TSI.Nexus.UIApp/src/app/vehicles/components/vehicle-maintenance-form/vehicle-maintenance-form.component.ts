import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  FormBaseComponent,
  MaintenanceStatus,
  MaintenanceType,
  ModalService,
  NotificationService,
  ResponseStatus,
  Vehicle,
  VehicleMaintenance,
  VehicleMaintenanceProduct,
  VehicleMaintenanceService,
  VehicleService,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { NgIf } from '@angular/common';
import { DateFieldComponent } from '../../../shared/components/date-field/date-field.component';
import { CurrencyFieldComponent } from '../../../shared/components/currency-field/currency-field.component';
import { ProductPickerGridComponent } from '../../../shared/components/product-picker-grid/product-picker-grid.component';
import { ClickDirective } from '../../../core/directives/click.directive';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
// Type-only: VehicleMaintenanceDetailsModalComponent imports this form back (renders
// <app-vehicle-maintenance-form> in its template), so a normal import would form a
// module-load-order circular dependency between the two files - `import type` is erased at
// compile time and can't contribute to that cycle.
import type { VehicleMaintenanceDetailsModalComponent } from '../vehicle-maintenance-details-modal/vehicle-maintenance-details-modal.component';

// Form logic for a VehicleMaintenance, shared by the Add/Edit modal and the details page's
// Detalhes tab - mirrors VehicleFormComponent's isModal/compact/dialogRef contract so both hosts
// work the same way, and keeps the <form> nested one level below .modal-body (inside this
// component) rather than inline in the modal template, which is what the global modal-scrollable
// -area CSS (.modal-body > * > *) actually expects; putting it directly in the modal collapsed
// the footer buttons into a full-width column instead of a right-aligned row.
@Component({
    selector: 'app-vehicle-maintenance-form',
    templateUrl: './vehicle-maintenance-form.component.html',
    styleUrl: './vehicle-maintenance-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        NgIf,
        DateFieldComponent,
        CurrencyFieldComponent,
        ProductPickerGridComponent,
        ClickDirective,
        TranslatePipe,
    ],
})
export class VehicleMaintenanceFormComponent
  extends FormBaseComponent
  implements OnInit, OnChanges
{
  @Input()
  isModal = false;

  @Input()
  isEdit = false;

  @Input()
  data?: VehicleMaintenance | null;

  // Pre-set when the form is embedded inside a Vehicle's own screens (tab or modal opened from
  // there) - the form then never shows its own vehicle picker. Left empty when opened from a
  // vehicle-agnostic context (the standalone /vehicle-maintenances list's "Adicionar" button), in
  // which case the user has to pick the Vehicle themselves via the select below.
  @Input()
  vehicleId = '';

  @Input()
  compact = false;

  @Input()
  dialogRef?: MatDialogRef<VehicleMaintenanceDetailsModalComponent>;

  vehicles: Vehicle[] = [];
  vehicleMaintenanceProducts: VehicleMaintenanceProduct[] = [];

  private readonly _baseEndPoint = 'vehicle-maintenances';

  get typeOptions() {
    return [
      { label: this.translationService.instant('VEHICLES.PREVENTIVE'), value: MaintenanceType.Preventive },
      { label: this.translationService.instant('VEHICLES.CORRECTIVE'), value: MaintenanceType.Corrective },
    ];
  }

  get statusOptions() {
    return [
      { label: this.translationService.instant('VEHICLES.MAINTENANCE_SCHEDULED'), value: MaintenanceStatus.Scheduled },
      { label: this.translationService.instant('VEHICLES.MAINTENANCE_IN_PROGRESS'), value: MaintenanceStatus.InProgress },
      { label: this.translationService.instant('VEHICLES.MAINTENANCE_COMPLETED'), value: MaintenanceStatus.Completed },
      { label: this.translationService.instant('VEHICLES.MAINTENANCE_OVERDUE'), value: MaintenanceStatus.Overdue },
      { label: this.translationService.instant('VEHICLES.MAINTENANCE_CANCELLED'), value: MaintenanceStatus.Cancelled },
    ];
  }

  constructor(
    private formBuilder: FormBuilder,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private vehicleMaintenanceService: VehicleMaintenanceService,
    private vehicleService: VehicleService,
    private routerService: Router,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
  ) {
    super();
  }

  ngOnInit(): void {
    this.initForm();
    this.patchFormWithData();
    if (!this.vehicleId) {
      this.vehicleService.getAll().subscribe((response) => {
        this.vehicles = response.data ?? [];
        this.cdr.markForCheck();
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && changes['data'].currentValue && this.form) {
      this.patchFormWithData();
    }
  }

  onProductPickerItemAdded(item: VehicleMaintenanceProduct): void {
    this.vehicleMaintenanceProducts = [...this.vehicleMaintenanceProducts, item];
  }

  removeProduct(index: number): void {
    this.vehicleMaintenanceProducts = this.vehicleMaintenanceProducts.filter(
      (_, i) => i !== index,
    );
  }

  submit(): Observable<WebApiResponse<VehicleMaintenance> | null> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return of(null);
    }

    const raw = this.form.getRawValue();
    const maintenance = {
      ...raw,
      vehicleId: this.vehicleId || raw.vehicleId,
      vehicleMaintenanceProducts: this.vehicleMaintenanceProducts,
    } as VehicleMaintenance;

    return this.save(maintenance).pipe(
      tap({
        next: (response: WebApiResponse<VehicleMaintenance>) => {
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
            this.translationService.instant('VEHICLES.SAVE_MAINTENANCE_ERROR'),
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

    this.vehicleMaintenanceService
      .delete(this.data)
      .pipe(
        tap({
          next: (response: WebApiResponse<VehicleMaintenance>) => {
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
              this.translationService.instant('VEHICLES.SAVE_MAINTENANCE_ERROR'),
            ),
        }),
      )
      .subscribe();
  }

  private initForm(): void {
    const commonControls = {
      type: [MaintenanceType.Preventive, Validators.required],
      description: ['', Validators.required],
      scheduledDate: ['', Validators.required],
      cost: [0, [Validators.min(0)]],
      status: [MaintenanceStatus.Scheduled, Validators.required],
      vehicleId: [
        this.vehicleId || null,
        this.vehicleId ? [] : [Validators.required],
      ],
    };

    this.form = !this.isEdit
      ? this.formBuilder.group(commonControls)
      : this.formBuilder.group({ id: [''], ...commonControls });
  }

  private patchFormWithData(): void {
    if (this.data && this.form) {
      this.form.patchValue(this.data);
      this.vehicleMaintenanceProducts = [...(this.data.vehicleMaintenanceProducts ?? [])];
    }
  }

  private save(
    maintenance: VehicleMaintenance,
  ): Observable<WebApiResponse<VehicleMaintenance>> {
    return this.isEdit && this.data
      ? this.vehicleMaintenanceService.update(maintenance)
      : this.vehicleMaintenanceService.add(maintenance);
  }

  private savePage(response: WebApiResponse<VehicleMaintenance>): void {
    if (this.isEdit && this.data) {
      this.notificationService.showMessage(response.status, response.message);
      this.data = response.data;
      this.cdr.markForCheck();
    } else if (response.status === ResponseStatus.Success) {
      this.routerService.navigateByUrl(`/${this._baseEndPoint}/${response.data.id}`);
    } else {
      this.notificationService.showMessage(response.status, response.message);
    }
  }

  private saveModal(response: WebApiResponse<VehicleMaintenance>): void {
    this.dialogRef?.close(response);
    this.notificationService.showMessage(response.status, response.message);
  }
}
