import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PurchaseOrder } from '@nexus/core';
import { PurchaseOrderFormComponent } from '../purchase-order-form/purchase-order-form.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-purchase-order-details-modal',
    templateUrl: './purchase-order-details-modal.component.html',
    styleUrl: './purchase-order-details-modal.component.scss',
    imports: [PurchaseOrderFormComponent, TranslatePipe],
})
export class PurchaseOrderDetailsModalComponent {
  isEdit = false;
  data?: PurchaseOrder | null = <PurchaseOrder>{
    purchaseOrderProducts: [],
  };
  id: string | null = null;
  preselectedProductId: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<PurchaseOrderDetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
  ) {
    if (dialogData) {
      this.isEdit = dialogData.isEdit ?? false;
      this.data = dialogData.data ?? this.data;
      this.id = dialogData.id ?? null;
      this.preselectedProductId = dialogData.preselectedProductId ?? null;
    }
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
