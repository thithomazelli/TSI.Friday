import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Payment } from '@nexus/core';
import { PaymentFormComponent } from '../payment-form/payment-form.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-payment-details-modal',
    templateUrl: './payment-details-modal.component.html',
    styleUrl: './payment-details-modal.component.scss',
    imports: [PaymentFormComponent, TranslatePipe],
})
export class PaymentDetailsModalComponent {
  isEdit = false;
  data?: Payment | null = null;
  id: string | null = null;
  parentId: string | null = null;
  parentData: any;

  constructor(
    public dialogRef: MatDialogRef<PaymentDetailsModalComponent>,
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
