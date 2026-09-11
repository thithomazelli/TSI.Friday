import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { VehicleMaintenanceProduct } from '@nexus/core';
import { VehicleMaintenanceProductFormComponent } from '../vehicle-maintenance-product-form/vehicle-maintenance-products-form.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-vehicle-maintenance-product-details-modal',
    templateUrl: './vehicle-maintenance-products-details-modal.component.html',
    styleUrl: './vehicle-maintenance-products-details-modal.component.scss',
    imports: [VehicleMaintenanceProductFormComponent, TranslatePipe],
})
export class VehicleMaintenanceProductDetailsModalComponent {
  isEdit = false;
  data?: VehicleMaintenanceProduct | null = null;
  id: string | null = null;
  parentId: string | null = null;
  parentData: any;

  constructor(
    public dialogRef: MatDialogRef<VehicleMaintenanceProductDetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
  ) {
    if (dialogData) {
      this.isEdit = dialogData.isEdit ?? false;
      this.data = dialogData.data ?? null;
      this.id = dialogData.id ?? null;
      this.parentId = dialogData.parentId ?? null;
      this.parentData = dialogData.parentData ?? null;
    }
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
