import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Transaction } from '@nexus/core';
import { TransactionFormComponent } from '../transactions-form/transaction-form.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-transaction-details-modal',
    templateUrl: './transaction-details-modal.component.html',
    styleUrl: './transaction-details-modal.component.scss',
    imports: [TransactionFormComponent, TranslatePipe],
})
export class TransactionDetailsModalComponent {
  isEdit = false;
  data?: Transaction | null = null;
  id: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<TransactionDetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
  ) {
    if (dialogData) {
      this.isEdit = dialogData.isEdit ?? false;
      this.data = dialogData.data ?? null;
      this.id = dialogData.id ?? null;
    }
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
