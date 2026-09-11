import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { User } from '@nexus/core';
import { UserFormComponent } from '../user-form/user-form.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-user-details-modal',
    templateUrl: './user-details-modal.component.html',
    styleUrl: './user-details-modal.component.scss',
    imports: [UserFormComponent, TranslatePipe],
})
export class UserDetailsModalComponent {
  isEdit = false;
  data?: User | null = null;
  id: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<UserDetailsModalComponent>,
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
