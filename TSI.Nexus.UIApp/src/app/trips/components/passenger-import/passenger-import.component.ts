import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  Attachment,
  AttachmentService,
  NotificationService,
  Passenger,
  PassengerService,
  ResponseStatus,
} from '@nexus/core';
import { forkJoin } from 'rxjs';

import { parsePassengerRows } from '../../utilities/passenger-import-parser';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-passenger-import',
    templateUrl: './passenger-import.component.html',
    styleUrl: './passenger-import.component.scss',
    imports: [TranslatePipe],
})
export class PassengerImportComponent {
  tripId: string;

  selectedFile: File | null = null;
  previewPassengers: Passenger[] = [];
  importing = false;

  constructor(
    public dialogRef: MatDialogRef<PassengerImportComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
    private passengerService: PassengerService,
    private attachmentService: AttachmentService,
    private notificationService: NotificationService,
  ) {
    this.tripId = dialogData?.tripId ?? '';
  }

  close(): void {
    this.dialogRef.close(null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile = file;
    this.previewPassengers = [];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = (reader.result as string) ?? '';
      this.previewPassengers = parsePassengerRows(text, this.tripId);
    };
    reader.readAsText(file);
  }

  confirmImport(): void {
    if (!this.selectedFile || this.previewPassengers.length === 0 || this.importing) {
      return;
    }

    this.importing = true;

    const attachment: Partial<Attachment> = {
      file: this.selectedFile,
      tripId: this.tripId,
    };

    forkJoin({
      passengers: this.passengerService.addRange(this.previewPassengers),
      attachment: this.attachmentService.add(attachment as Attachment),
    }).subscribe({
      next: ({ passengers }) => {
        this.importing = false;
        this.notificationService.showMessage(
          passengers.status,
          passengers.message,
        );
        if (passengers.status === ResponseStatus.Success) {
          this.dialogRef.close(true);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.importing = false;
        this.notificationService.showMessage(
          'Error',
          this.extractErrorMessage(err),
        );
      },
    });
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    const body = err?.error;
    const validationErrors: string[] | undefined = body?.errors ?? body?.Errors;
    if (validationErrors?.length) {
      return validationErrors.join(' ');
    }
    if (typeof body === 'string' && body.trim()) {
      return body;
    }
    if (body?.message) {
      return body.message;
    }
    return `Erro ao importar a lista de passageiros (HTTP ${err?.status ?? '?'}).`;
  }
}
