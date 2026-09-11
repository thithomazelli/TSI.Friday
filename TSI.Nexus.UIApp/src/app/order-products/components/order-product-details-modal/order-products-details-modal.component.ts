import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { OrderProduct } from '@nexus/core';
import { OrderProductsFormComponent } from '../order-product-form/order-products-form.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-order-product-details-modal',
    templateUrl: './order-products-details-modal.component.html',
    styleUrl: './order-products-details-modal.component.scss',
    imports: [OrderProductsFormComponent, TranslatePipe],
})
export class OrderProductsDetailsModalComponent {
  isEdit = false;
  data?: OrderProduct | null = null;
  id: string | null = null;
  parentId: string | null = null;
  parentData: any;

  constructor(
    public dialogRef: MatDialogRef<OrderProductsDetailsModalComponent>,
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
