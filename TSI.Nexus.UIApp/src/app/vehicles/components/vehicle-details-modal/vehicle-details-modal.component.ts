import { ChangeDetectionStrategy, Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslationService, Vehicle } from '@nexus/core';
import { VehicleFormComponent } from '../vehicle-form/vehicle-form.component';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-vehicle-details-modal',
    templateUrl: './vehicle-details-modal.component.html',
    styleUrl: './vehicle-details-modal.component.scss',
    imports: [VehicleFormComponent],
})
export class VehicleDetailsModalComponent implements OnInit {
  isEdit = false;
  data?: Vehicle | null = <Vehicle>{};
  id: string | null = null;

  title = '';

  constructor(
    public dialogRef: MatDialogRef<VehicleDetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
    private translationService: TranslationService,
  ) {
    if (dialogData) {
      this.isEdit = dialogData.isEdit ?? false;
      this.data = dialogData.data ?? <Vehicle>{};
      this.id = dialogData.id ?? null;
    }
  }

  ngOnInit(): void {
    this.title = this.translationService.instant(
      this.isEdit ? 'COMMON.EDIT_ENTITY' : 'COMMON.ADD_ENTITY',
      { entity: this.translationService.instant('VEHICLES.SINGULAR') },
    );
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
