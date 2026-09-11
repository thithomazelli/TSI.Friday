import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AgendaEvent } from '@nexus/core';
import { EventFormComponent } from '../event-form/event-form.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-event-details-modal',
    templateUrl: './event-details-modal.component.html',
    styleUrl: './event-details-modal.component.scss',
    imports: [EventFormComponent, TranslatePipe],
})
export class EventDetailsModalComponent {
  isEdit = false;
  data?: AgendaEvent | null = null;
  prefillStart?: Date | null = null;
  prefillEnd?: Date | null = null;
  lockedLinkField?: string | null = null;
  lockedLinkId?: string | null = null;
  lockedLinkLabel?: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<EventDetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
  ) {
    if (dialogData) {
      this.isEdit = dialogData.isEdit ?? false;
      this.data = dialogData.data ?? null;
      this.prefillStart = dialogData.prefillStart ?? null;
      this.prefillEnd = dialogData.prefillEnd ?? null;
      this.lockedLinkField = dialogData.lockedLinkField ?? null;
      this.lockedLinkId = dialogData.lockedLinkId ?? null;
      this.lockedLinkLabel = dialogData.lockedLinkLabel ?? null;
    }
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
