import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Trip } from '@nexus/core';
import { TripFormComponent } from '../trip-form/trip-form.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-trip-details-modal',
    templateUrl: './trip-details-modal.component.html',
    styleUrl: './trip-details-modal.component.scss',
    imports: [TripFormComponent, TranslatePipe],
})
export class TripDetailsModalComponent {
  isEdit = false;
  data?: Trip | null = <Trip>{};
  id: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<TripDetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
  ) {
    if (dialogData) {
      this.isEdit = dialogData.isEdit ?? false;
      this.data = dialogData.data ?? this.data;
      this.id = dialogData.id ?? null;
    }
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
