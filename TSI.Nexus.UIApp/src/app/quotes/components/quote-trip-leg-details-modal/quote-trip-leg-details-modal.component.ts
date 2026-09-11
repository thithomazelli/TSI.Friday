import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  OnDestroy,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  NotificationService,
  ResponseStatus,
  QuoteTripLeg,
  QuoteTripLegService,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { forkJoin, Observable, Subscription } from 'rxjs';
import { DateFieldComponent } from '../../../shared/components/date-field/date-field.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    selector: 'app-quote-trip-leg-details-modal',
    templateUrl: './quote-trip-leg-details-modal.component.html',
    styleUrl: './quote-trip-leg-details-modal.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        DateFieldComponent,
        TranslatePipe,
    ],
})
export class QuoteTripLegDetailsModalComponent implements OnDestroy {
  saving = false;

  isEdit: boolean;
  quoteTripId: string;
  private _id: string | null = null;
  private _nextSequenceNumber: number;
  private _subscriptions: Subscription[] = [];

  form: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<QuoteTripLegDetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
    private formBuilder: FormBuilder,
    private quoteTripLegService: QuoteTripLegService,
    private notificationService: NotificationService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
  ) {
    const existing: QuoteTripLeg | null = dialogData?.data ?? null;
    this.isEdit = dialogData?.isEdit ?? !!existing?.id;
    this.quoteTripId = dialogData?.quoteTripId ?? dialogData?.parentId ?? '';
    this._nextSequenceNumber = dialogData?.nextSequenceNumber ?? 1;

    if (this.isEdit && existing) {
      this._id = existing.id ?? null;
      const { dateOnly, time } = this.splitDateAndTime(existing.departureDate);
      const { dateOnly: arrivalDateOnly, time: arrivalTime } = this.splitDateAndTime(
        existing.arrivalDate,
      );
      const sameDayArrival = this.isSameCalendarDay(dateOnly, arrivalDateOnly);
      this.form = this.formBuilder.group({
        origin: [existing.origin ?? '', Validators.required],
        destination: [existing.destination ?? '', Validators.required],
        dateOnly: [dateOnly, Validators.required],
        time: [time],
        sameDayArrival: [sameDayArrival],
        arrivalDateOnly: [{ value: arrivalDateOnly ?? dateOnly, disabled: sameDayArrival }],
        arrivalTime: [arrivalTime],
        distanceKm: [existing.distanceKm ?? 0, [Validators.min(0)]],
        notes: [existing.notes ?? ''],
      });
      this.wireSameDayArrival(this.form);
    } else {
      this.form = this.formBuilder.group({
        origin: ['', Validators.required],
        stops: this.formBuilder.array([this.buildStopGroup()]),
      });
    }
  }

  ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  get stops(): FormArray {
    return this.form.get('stops') as FormArray;
  }

  addStop(): void {
    this.stops.push(this.buildStopGroup());
  }

  removeStop(index: number): void {
    if (this.stops.length > 1) {
      this.stops.removeAt(index);
    }
  }

  close(): void {
    this.dialogRef.close(null);
  }

  submit(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.isEdit) {
      this.submitEdit();
    } else {
      this.submitAdd();
    }
  }

  private submitEdit(): void {
    const raw = this.form.getRawValue();
    const quoteTripLeg = {
      id: this._id as string,
      quoteTripId: this.quoteTripId,
      origin: raw.origin,
      destination: raw.destination,
      departureDate: this.combineDateAndTime(raw.dateOnly, raw.time),
      arrivalDate: this.combineDateAndTimeOrNull(raw.arrivalDateOnly, raw.arrivalTime),
      distanceKm: raw.distanceKm ?? 0,
      notes: raw.notes ?? '',
    } as QuoteTripLeg;

    this.saving = true;
    this.quoteTripLegService.update(quoteTripLeg).subscribe({
      next: (response: WebApiResponse<QuoteTripLeg>) => {
        this.saving = false;
        this.notificationService.showMessage(response.status, response.message);
        if (response.status === ResponseStatus.Success) {
          this.dialogRef.close(response);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.notificationService.showMessage(
          ResponseStatus.Error,
          this.translationService.instant('TRIPS.SAVE_LEGS_ERROR'),
        );
        this.cdr.markForCheck();
      },
    });
  }

  private submitAdd(): void {
    const raw = this.form.getRawValue();
    const legs: QuoteTripLeg[] = [];
    let previousPoint = raw.origin!;

    (raw.stops ?? []).forEach((stop: any, index: number) => {
      legs.push({
        sequenceNumber: this._nextSequenceNumber + index,
        origin: previousPoint,
        destination: stop.destination,
        departureDate: this.combineDateAndTime(stop.dateOnly, stop.time),
        arrivalDate: this.combineDateAndTimeOrNull(stop.arrivalDateOnly, stop.arrivalTime),
        distanceKm: stop.distanceKm ?? 0,
        notes: stop.notes ?? '',
        quoteTripId: this.quoteTripId,
      } as QuoteTripLeg);
      previousPoint = stop.destination;
    });

    if (legs.length === 0) {
      return;
    }

    this.saving = true;
    const requests: Observable<WebApiResponse<QuoteTripLeg>>[] = legs.map((leg) =>
      this.quoteTripLegService.add(leg),
    );

    forkJoin(requests).subscribe({
      next: (responses) => {
        this.saving = false;
        const failed = responses.find((r) => r.status !== ResponseStatus.Success);
        if (failed) {
          this.notificationService.showMessage(failed.status, failed.message);
          this.cdr.markForCheck();
          return;
        }
        this.notificationService.showMessage(
          ResponseStatus.Success,
          legs.length === 1
            ? this.translationService.instant('TRIPS.LEG_ADDED_SINGLE')
            : this.translationService.instant('TRIPS.LEG_ADDED_PLURAL', { count: legs.length + '' }),
        );
        this.dialogRef.close(responses);
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.notificationService.showMessage(
          ResponseStatus.Error,
          this.translationService.instant('TRIPS.SAVE_LEGS_ERROR'),
        );
        this.cdr.markForCheck();
      },
    });
  }

  private buildStopGroup(): FormGroup {
    const group = this.formBuilder.group({
      destination: ['', Validators.required],
      dateOnly: ['', Validators.required],
      time: [''],
      sameDayArrival: [true],
      arrivalDateOnly: [{ value: '', disabled: true }],
      arrivalTime: [''],
      distanceKm: [0, [Validators.min(0)]],
      notes: [''],
    });
    this.wireSameDayArrival(group);
    return group;
  }

  // Keeps arrivalDateOnly locked to (and mirroring) dateOnly while sameDayArrival is checked -
  // the common case (see TRIPS.SAME_DAY_ARRIVAL) - and releases it for manual entry otherwise.
  // Shared between the single-leg edit form and each stop in the add-mode stops FormArray.
  private wireSameDayArrival(group: FormGroup): void {
    const departureControl = group.get('dateOnly')!;
    const sameDayControl = group.get('sameDayArrival')!;
    const arrivalControl = group.get('arrivalDateOnly')!;

    const sync = () => {
      if (sameDayControl.value) {
        arrivalControl.setValue(departureControl.value, { emitEvent: false });
        arrivalControl.disable({ emitEvent: false });
      } else {
        arrivalControl.enable({ emitEvent: false });
      }
    };

    this._subscriptions.push(
      sameDayControl.valueChanges.subscribe(sync),
      departureControl.valueChanges.subscribe(() => {
        if (sameDayControl.value) {
          arrivalControl.setValue(departureControl.value, { emitEvent: false });
        }
      }),
    );

    sync();
  }

  private isSameCalendarDay(departure: Date | null, arrival: Date | null): boolean {
    if (!arrival) {
      // No arrival recorded yet (legacy leg, or a leg created before this field existed) -
      // default to the common case instead of forcing the user to fill it in immediately.
      return true;
    }
    if (!departure) {
      return false;
    }
    return (
      departure.getFullYear() === arrival.getFullYear() &&
      departure.getMonth() === arrival.getMonth() &&
      departure.getDate() === arrival.getDate()
    );
  }

  /**
   * app-date-field yields a "DD/MM/YYYY" string when typed manually, but a Moment/Date instance
   * when picked from the calendar; combines either with an optional "HH:mm" time into a datetime.
   */
  private combineDateAndTime(dateOnly: any, time?: string | null): Date {
    if (!dateOnly) {
      return new Date();
    }
    let day: number, month: number, year: number;
    if (typeof dateOnly === 'object' && typeof dateOnly.toDate === 'function') {
      const asDate: Date = dateOnly.toDate();
      day = asDate.getDate();
      month = asDate.getMonth() + 1;
      year = asDate.getFullYear();
    } else if (dateOnly instanceof Date) {
      day = dateOnly.getDate();
      month = dateOnly.getMonth() + 1;
      year = dateOnly.getFullYear();
    } else {
      [day, month, year] = String(dateOnly).split('/').map((part) => Number(part));
    }
    const [hours, minutes] = (time || '00:00').split(':').map((part) => Number(part));
    return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0);
  }

  // ArrivalDate is optional (a leg with no estimate yet) - unlike departure, an empty value here
  // stays null instead of falling back to "now".
  private combineDateAndTimeOrNull(dateOnly: any, time?: string | null): Date | null {
    if (!dateOnly) {
      return null;
    }
    return this.combineDateAndTime(dateOnly, time);
  }

  private splitDateAndTime(date: string | Date | null | undefined): {
    dateOnly: Date | null;
    time: string;
  } {
    if (!date) {
      return { dateOnly: null, time: '' };
    }
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return { dateOnly: null, time: '' };
    }
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return { dateOnly: d, time: `${hours}:${minutes}` };
  }
}
