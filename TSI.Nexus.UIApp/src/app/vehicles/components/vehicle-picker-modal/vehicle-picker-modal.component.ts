import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { TranslationService, Vehicle, VehicleService } from '@nexus/core';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

// Full-search vehicle picker opened by the "Buscar" button next to the Trip form's Vehicle
// autocomplete (see trip-form.component.ts openVehiclePickerModal()) - mirrors the role
// OrderProductsDetailsModalComponent plays for the Product inline picker's own "Buscar" button
// (a fuller search surface than the compact inline autocomplete), but a Vehicle assignment has
// no extra line-item fields to fill in, so this is just a searchable list that closes with the
// chosen Vehicle instead of a full add/edit form.
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-vehicle-picker-modal',
  templateUrl: './vehicle-picker-modal.component.html',
  styleUrl: './vehicle-picker-modal.component.scss',
  imports: [FormsModule, NgFor, NgIf, TranslatePipe],
})
export class VehiclePickerModalComponent implements OnInit, OnDestroy {
  vehicles: Vehicle[] = [];
  filteredVehicles: Vehicle[] = [];
  searchTerm = '';

  private _destroy$ = new Subject<void>();

  constructor(
    public dialogRef: MatDialogRef<VehiclePickerModalComponent>,
    private vehicleService: VehicleService,
    private translationService: TranslationService,
  ) {}

  get statusMap(): { [key: string]: { label: string; color: string } } {
    return {
      Available: {
        label: this.translationService.instant('VEHICLES.STATUS_AVAILABLE'),
        color: 'success',
      },
      InMaintenance: {
        label: this.translationService.instant('VEHICLES.STATUS_IN_MAINTENANCE'),
        color: 'warning',
      },
      Blocked: {
        label: this.translationService.instant('VEHICLES.STATUS_BLOCKED'),
        color: 'danger',
      },
      Inactive: {
        label: this.translationService.instant('VEHICLES.STATUS_INACTIVE'),
        color: 'secondary',
      },
    };
  }

  ngOnInit(): void {
    this.vehicleService
      .getAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe((response) => {
        this.vehicles = response.data ?? [];
        this.applyFilter();
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredVehicles = this.vehicles;
      return;
    }
    this.filteredVehicles = this.vehicles.filter(
      (vehicle) =>
        (vehicle.plate || '').toLowerCase().includes(term) ||
        (vehicle.brand || '').toLowerCase().includes(term) ||
        (vehicle.model || '').toLowerCase().includes(term),
    );
  }

  select(vehicle: Vehicle): void {
    this.dialogRef.close(vehicle);
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
