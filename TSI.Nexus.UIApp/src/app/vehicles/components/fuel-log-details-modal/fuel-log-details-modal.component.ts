import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FuelLog } from '@nexus/core';
import { FuelLogFormComponent } from '../fuel-log-form/fuel-log-form.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-fuel-log-details-modal',
    templateUrl: './fuel-log-details-modal.component.html',
    styleUrl: './fuel-log-details-modal.component.scss',
    imports: [FuelLogFormComponent, TranslatePipe],
})
export class FuelLogDetailsModalComponent {
  isEdit: boolean;
  vehicleId: string;
  data: FuelLog | null;

  constructor(
    public dialogRef: MatDialogRef<FuelLogDetailsModalComponent>,
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
