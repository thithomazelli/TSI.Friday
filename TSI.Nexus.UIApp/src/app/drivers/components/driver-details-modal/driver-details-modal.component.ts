import { ChangeDetectionStrategy, Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Driver } from '@nexus/core';
import { DriverFormComponent } from '../driver-form/driver-form.component';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-driver-details-modal',
    templateUrl: './driver-details-modal.component.html',
    styleUrl: './driver-details-modal.component.scss',
    imports: [DriverFormComponent],
})
export class DriverDetailsModalComponent implements OnInit {
  isEdit = false;
  data?: Driver | null = <Driver>{};
  id: string | null = null;

  title = '';

  constructor(
    public dialogRef: MatDialogRef<DriverDetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
  ) {
    if (dialogData) {
      this.isEdit = dialogData.isEdit ?? false;
      this.data = dialogData.data ?? <Driver>{};
      this.id = dialogData.id ?? null;
    }
  }

  ngOnInit(): void {
    this.title = this.isEdit ? 'Editar Motorista' : 'Adicionar Motorista';
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
