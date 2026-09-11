import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Order } from '@nexus/core';
import { OrderFormComponent } from '../order-form/order-form.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-order-details-modal',
    templateUrl: './order-details-modal.component.html',
    styleUrl: './order-details-modal.component.scss',
    imports: [OrderFormComponent, TranslatePipe],
})
export class OrderDetailsModalComponent {
  isEdit = false;
  data?: Order | null = <Order>{
    orderProducts: [],
  };
  id: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<OrderDetailsModalComponent>,
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
