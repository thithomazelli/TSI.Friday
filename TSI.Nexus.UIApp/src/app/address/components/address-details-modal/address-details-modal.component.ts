import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { Address } from '@nexus/core';
import { AddressFormComponent } from '../address-form/address-form.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-address-details-modal',
    templateUrl: './address-details-modal.component.html',
    styleUrl: './address-details-modal.component.scss',
    imports: [AddressFormComponent, TranslatePipe],
})
export class AddressDetailsModalComponent {
  isEdit = false;
  data?: Address | null = null;
  id: string | null = null;
  parentId: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<AddressDetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
  ) {
    if (dialogData) {
      this.isEdit = dialogData.isEdit ?? false;
      this.data = dialogData.data ?? null;
      this.id = dialogData.id ?? null;
      this.parentId = dialogData.parentId ?? null;
    }
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
