import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { VehicleMaintenance } from '@nexus/core';
import { VehicleMaintenanceFormComponent } from '../vehicle-maintenance-form/vehicle-maintenance-form.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-vehicle-maintenance-details-modal',
    templateUrl: './vehicle-maintenance-details-modal.component.html',
    styleUrl: './vehicle-maintenance-details-modal.component.scss',
    imports: [VehicleMaintenanceFormComponent, TranslatePipe],
})
export class VehicleMaintenanceDetailsModalComponent {
  isEdit: boolean;
  vehicleId: string;
  data: VehicleMaintenance | null;

  constructor(
    public dialogRef: MatDialogRef<VehicleMaintenanceDetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
  ) {
    this.data = dialogData?.data ?? null;
    this.vehicleId = dialogData?.vehicleId ?? '';
    this.isEdit = !!this.data?.id;
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
