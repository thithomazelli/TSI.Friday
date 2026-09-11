import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  NotificationService,
  Passenger,
  PassengerService,
  ResponseStatus,
} from '@nexus/core';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-passenger-details-modal',
    templateUrl: './passenger-details-modal.component.html',
    styleUrl: './passenger-details-modal.component.scss',
    imports: [ReactiveFormsModule, TranslatePipe],
})
export class PassengerDetailsModalComponent {
  saving = false;
  isEdit: boolean;
  tripId: string;
  private _id: string;
  form: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<PassengerDetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
    private formBuilder: FormBuilder,
    private passengerService: PassengerService,
    private notificationService: NotificationService,
  ) {
    const existing: Passenger | null = dialogData?.data ?? null;
    this.tripId = dialogData?.tripId ?? '';
    this.isEdit = !!existing?.id;
    this._id = existing?.id ?? '';

    this.form = this.formBuilder.group({
      name: [existing?.name ?? '', Validators.required],
      documentNumber: [existing?.documentNumber ?? ''],
      seat: [existing?.seat ?? ''],
      phone: [existing?.phone ?? ''],
    });
  }

  close(): void {
    this.dialogRef.close(null);
  }

  submit(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const passenger = {
      // O backend não converte "" para Guid, então o id só entra no payload ao editar.
      ...(this.isEdit ? { id: this._id } : {}),
      name: raw.name,
      documentNumber: raw.documentNumber,
      seat: raw.seat,
      phone: raw.phone,
      tripId: this.tripId,
    } as Passenger;

    this.saving = true;
    const request = this.isEdit
      ? this.passengerService.update(passenger)
      : this.passengerService.add(passenger);

    request.subscribe({
      next: (response) => {
        this.saving = false;
        this.notificationService.showMessage(response.status, response.message);
        if (response.status === ResponseStatus.Success) {
          this.dialogRef.close(response);
        }
      },
      error: () => {
        this.saving = false;
        this.notificationService.showMessage(
          ResponseStatus.Error,
          'Erro ao salvar o passageiro.',
        );
      },
    });
  }
}
