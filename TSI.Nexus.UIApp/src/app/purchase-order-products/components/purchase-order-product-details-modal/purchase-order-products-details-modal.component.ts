import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PurchaseOrderProduct } from '@nexus/core';
import { PurchaseOrderProductsFormComponent } from '../purchase-order-product-form/purchase-order-products-form.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-purchase-order-product-details-modal',
    templateUrl: './purchase-order-products-details-modal.component.html',
    styleUrl: './purchase-order-products-details-modal.component.scss',
    imports: [PurchaseOrderProductsFormComponent, TranslatePipe],
})
export class PurchaseOrderProductsDetailsModalComponent {
  isEdit = false;
  data?: PurchaseOrderProduct | null = null;
  id: string | null = null;
  parentId: string | null = null;
  parentData: any;

  constructor(
    public dialogRef: MatDialogRef<PurchaseOrderProductsDetailsModalComponent>,
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
