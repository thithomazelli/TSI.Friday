import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Product } from '@nexus/core';
import { ProductFormComponent } from '../product-form/product-form.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-product-details-modal',
    templateUrl: './product-details-modal.component.html',
    styleUrl: './product-details-modal.component.scss',
    imports: [ProductFormComponent, TranslatePipe],
})
export class ProductDetailsModalComponent {
  isEdit = false;
  data?: Product | null = null;
  id: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<ProductDetailsModalComponent>,
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
