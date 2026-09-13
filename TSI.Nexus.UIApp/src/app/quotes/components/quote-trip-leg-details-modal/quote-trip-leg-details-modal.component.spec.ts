import { FormBuilder } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import {
  NotificationService,
  QuoteTripLeg,
  QuoteTripLegService,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';
import { of, throwError } from 'rxjs';
import { QuoteTripLegDetailsModalComponent } from './quote-trip-leg-details-modal.component';

describe('QuoteTripLegDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };
  let quoteTripLegServiceMock: { add: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: any): QuoteTripLegDetailsModalComponent {
    dialogRefMock = { close: vi.fn() };
    quoteTripLegServiceMock = { add: vi.fn(), update: vi.fn() };
    notificationServiceMock = { showMessage: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };

    return new QuoteTripLegDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<QuoteTripLegDetailsModalComponent>,
      dialogData,
      new FormBuilder(),
      quoteTripLegServiceMock as unknown as QuoteTripLegService,
      notificationServiceMock as unknown as NotificationService,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  it('should create', () => {
    expect(createComponent(null)).toBeTruthy();
  });

  describe('constructor / mode setup', () => {
    it('starts in add mode with one empty stop when no dialogData is provided', () => {
      const component = createComponent(null);

      expect(component.isEdit).toBe(false);
      expect(component.quoteTripId).toBe('');
      expect(component.stops.length).toBe(1);
    });

    it('reads quoteTripId from parentId when quoteTripId is absent', () => {
      const component = createComponent({ parentId: 'qt1' });

      expect(component.quoteTripId).toBe('qt1');
    });

    it('infers isEdit from the presence of an existing id when isEdit is not explicit', () => {
      const component = createComponent({ data: { id: 'l1' } });

      expect(component.isEdit).toBe(true);
    });

    it('starts in edit mode pre-filled from an existing leg, with same-day arrival detected', () => {
      const existing: QuoteTripLeg = {
        id: 'l1',
        origin: 'A',
        destination: 'B',
        departureDate: new Date(2024, 0, 10, 8, 30) as any,
        arrivalDate: new Date(2024, 0, 10, 12, 0) as any,
        distanceKm: 50,
        notes: 'obs',
      } as unknown as QuoteTripLeg;

      const component = createComponent({ isEdit: true, quoteTripId: 'qt1', data: existing });

      expect(component.form.value.origin).toBe('A');
      expect(component.form.value.destination).toBe('B');
      expect(component.form.value.sameDayArrival).toBe(true);
      expect(component.form.get('arrivalDateOnly')!.disabled).toBe(true);
    });

    it('starts in edit mode with arrival on a different day (not disabled)', () => {
      const existing: QuoteTripLeg = {
        id: 'l1',
        origin: 'A',
        destination: 'B',
        departureDate: new Date(2024, 0, 10) as any,
        arrivalDate: new Date(2024, 0, 12) as any,
      } as unknown as QuoteTripLeg;

      const component = createComponent({ isEdit: true, data: existing });

      expect(component.form.value.sameDayArrival).toBe(false);
      expect(component.form.get('arrivalDateOnly')!.disabled).toBe(false);
    });

    it('starts in edit mode with no arrival recorded, defaulting to same-day', () => {
      const existing: QuoteTripLeg = {
        id: 'l1',
        origin: 'A',
        destination: 'B',
        departureDate: new Date(2024, 0, 10) as any,
      } as unknown as QuoteTripLeg;

      const component = createComponent({ isEdit: true, data: existing });

      expect(component.form.value.sameDayArrival).toBe(true);
    });
  });

  describe('addStop / removeStop', () => {
    it('adds a new stop', () => {
      const component = createComponent(null);

      component.addStop();

      expect(component.stops.length).toBe(2);
    });

    it('removes a stop when there is more than one', () => {
      const component = createComponent(null);
      component.addStop();

      component.removeStop(0);

      expect(component.stops.length).toBe(1);
    });

    it('does not remove the last remaining stop', () => {
      const component = createComponent(null);

      component.removeStop(0);

      expect(component.stops.length).toBe(1);
    });
  });

  describe('close', () => {
    it('closes the dialog with null', () => {
      const component = createComponent(null);

      component.close();

      expect(dialogRefMock.close).toHaveBeenCalledWith(null);
    });
  });

  describe('submit', () => {
    it('marks all as touched and does not save when the form is invalid', () => {
      const component = createComponent(null);

      component.submit();

      expect(component.form.get('origin')!.touched).toBe(true);
      expect(quoteTripLegServiceMock.add).not.toHaveBeenCalled();
    });

    it('does not save while already saving', () => {
      const component = createComponent({ isEdit: true, data: { id: 'l1', origin: 'A', destination: 'B', dateOnly: new Date() } });
      component.form.patchValue({ origin: 'A', destination: 'B', dateOnly: new Date() });
      component.saving = true;

      component.submit();

      expect(quoteTripLegServiceMock.update).not.toHaveBeenCalled();
    });

    it('calls submitEdit when isEdit is true and the form is valid', () => {
      const component = createComponent({
        isEdit: true,
        data: { id: 'l1', origin: 'A', destination: 'B', departureDate: new Date() },
      });
      quoteTripLegServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'ok' }),
      );

      component.submit();

      expect(quoteTripLegServiceMock.update).toHaveBeenCalled();
    });

    it('calls submitAdd when isEdit is false and the form is valid', () => {
      const component = createComponent({ quoteTripId: 'qt1' });
      component.form.patchValue({ origin: 'A' });
      component.stops.at(0).patchValue({ destination: 'B', dateOnly: new Date() });
      quoteTripLegServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'ok' }),
      );

      component.submit();

      expect(quoteTripLegServiceMock.add).toHaveBeenCalled();
    });
  });

  describe('submitEdit (private, via submit)', () => {
    function setupValidEditForm() {
      return createComponent({
        isEdit: true,
        quoteTripId: 'qt1',
        data: { id: 'l1', origin: 'A', destination: 'B', departureDate: new Date(2024, 0, 1) },
      });
    }

    it('closes the dialog on a successful update', () => {
      const component = setupValidEditForm();
      quoteTripLegServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Salvo' }),
      );

      component.submit();

      expect(component.saving).toBe(false);
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'Salvo',
      );
      expect(dialogRefMock.close).toHaveBeenCalled();
    });

    it('does not close the dialog when the update response is not a success', () => {
      const component = setupValidEditForm();
      quoteTripLegServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falha' }),
      );

      component.submit();

      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('shows a translated error notification when the update request errors', () => {
      const component = setupValidEditForm();
      quoteTripLegServiceMock.update.mockReturnValue(throwError(() => new Error('fail')));

      component.submit();

      expect(component.saving).toBe(false);
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'TRIPS.SAVE_LEGS_ERROR',
      );
    });
  });

  describe('submitAdd (private, via submit)', () => {
    function setupValidAddForm(nextSequenceNumber = 1) {
      const component = createComponent({ quoteTripId: 'qt1', nextSequenceNumber });
      component.form.patchValue({ origin: 'A' });
      component.stops.at(0).patchValue({ destination: 'B', dateOnly: new Date(2024, 0, 1) });
      return component;
    }

    it('adds a single leg and shows the singular success message', () => {
      const component = setupValidAddForm();
      quoteTripLegServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'ok' }),
      );

      component.submit();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'TRIPS.LEG_ADDED_SINGLE',
      );
      expect(dialogRefMock.close).toHaveBeenCalled();
    });

    it('adds multiple legs and shows the plural success message', () => {
      const component = createComponent({ quoteTripId: 'qt1' });
      component.form.patchValue({ origin: 'A' });
      component.stops.at(0).patchValue({ destination: 'B', dateOnly: new Date(2024, 0, 1) });
      component.addStop();
      component.stops.at(1).patchValue({ destination: 'C', dateOnly: new Date(2024, 0, 2) });
      quoteTripLegServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'ok' }),
      );

      component.submit();

      expect(translationServiceMock.instant).toHaveBeenCalledWith('TRIPS.LEG_ADDED_PLURAL', {
        count: '2',
      });
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'TRIPS.LEG_ADDED_PLURAL',
      );
    });

    it('shows the failed leg message and does not close the dialog when one request fails', () => {
      const component = setupValidAddForm();
      quoteTripLegServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falha ao salvar' }),
      );

      component.submit();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'Falha ao salvar',
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('shows a translated error notification when the add request errors', () => {
      const component = setupValidAddForm();
      quoteTripLegServiceMock.add.mockReturnValue(throwError(() => new Error('fail')));

      component.submit();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'TRIPS.SAVE_LEGS_ERROR',
      );
    });
  });

  describe('wireSameDayArrival (private, via the edit/add forms)', () => {
    it('mirrors and disables arrivalDateOnly while sameDayArrival is checked', () => {
      const component = createComponent(null);
      const group = component.stops.at(0);

      group.get('dateOnly')!.setValue(new Date(2024, 0, 5));

      expect(group.get('arrivalDateOnly')!.value).toEqual(new Date(2024, 0, 5));
      expect(group.get('arrivalDateOnly')!.disabled).toBe(true);
    });

    it('enables arrivalDateOnly for manual entry when sameDayArrival is unchecked', () => {
      const component = createComponent(null);
      const group = component.stops.at(0);

      group.get('sameDayArrival')!.setValue(false);

      expect(group.get('arrivalDateOnly')!.disabled).toBe(false);
    });

    it('does not touch arrivalDateOnly on a departure change once sameDayArrival is off', () => {
      const component = createComponent(null);
      const group = component.stops.at(0);
      group.get('sameDayArrival')!.setValue(false);
      group.get('arrivalDateOnly')!.setValue(new Date(2024, 0, 9));

      group.get('dateOnly')!.setValue(new Date(2024, 0, 20));

      expect(group.get('arrivalDateOnly')!.value).toEqual(new Date(2024, 0, 9));
    });
  });

  describe('ngOnDestroy', () => {
    it('unsubscribes all internal subscriptions without throwing', () => {
      const component = createComponent(null);

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('date helpers (private, exercised via the edit form / submit)', () => {
    it('parses a "DD/MM/YYYY" string date with a time into a Date', () => {
      const component = createComponent({
        isEdit: true,
        quoteTripId: 'qt1',
        data: { id: 'l1', origin: 'A', destination: 'B', departureDate: new Date(2024, 0, 1) },
      });
      component.form.patchValue({ dateOnly: '15/03/2024', time: '08:30' });
      quoteTripLegServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'ok' }),
      );

      component.submit();

      const sentLeg = quoteTripLegServiceMock.update.mock.calls[0][0];
      expect(sentLeg.departureDate.getFullYear()).toBe(2024);
      expect(sentLeg.departureDate.getMonth()).toBe(2);
      expect(sentLeg.departureDate.getDate()).toBe(15);
      expect(sentLeg.departureDate.getHours()).toBe(8);
      expect(sentLeg.departureDate.getMinutes()).toBe(30);
    });

    it('parses a moment-like object (with toDate()) as the departure date', () => {
      const component = createComponent({
        isEdit: true,
        quoteTripId: 'qt1',
        data: { id: 'l1', origin: 'A', destination: 'B', departureDate: new Date(2024, 0, 1) },
      });
      const momentLike = { toDate: () => new Date(2024, 4, 20) };
      component.form.patchValue({ dateOnly: momentLike, time: '' });
      quoteTripLegServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'ok' }),
      );

      component.submit();

      const sentLeg = quoteTripLegServiceMock.update.mock.calls[0][0];
      expect(sentLeg.departureDate.getMonth()).toBe(4);
      expect(sentLeg.departureDate.getDate()).toBe(20);
      expect(sentLeg.departureDate.getHours()).toBe(0);
    });

    it('defaults to now when dateOnly is empty on submit (defensive - required validator normally blocks this)', () => {
      const component = createComponent({
        isEdit: true,
        quoteTripId: 'qt1',
        data: { id: 'l1', origin: 'A', destination: 'B', departureDate: new Date(2024, 0, 1) },
      });
      component.form.get('dateOnly')!.clearValidators();
      component.form.patchValue({ dateOnly: null });
      quoteTripLegServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'ok' }),
      );

      component.submit();

      expect(quoteTripLegServiceMock.update).toHaveBeenCalled();
    });

    it('sends a null arrivalDate when arrivalDateOnly is empty', () => {
      const component = createComponent({
        isEdit: true,
        quoteTripId: 'qt1',
        data: { id: 'l1', origin: 'A', destination: 'B', departureDate: new Date(2024, 0, 1) },
      });
      component.form.get('sameDayArrival')!.setValue(false);
      component.form.get('arrivalDateOnly')!.setValue(null);
      quoteTripLegServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'ok' }),
      );

      component.submit();

      const sentLeg = quoteTripLegServiceMock.update.mock.calls[0][0];
      expect(sentLeg.arrivalDate).toBeNull();
    });

    it('resolves arrivalDate when arrivalDateOnly is a real Date', () => {
      const component = createComponent({
        isEdit: true,
        quoteTripId: 'qt1',
        data: { id: 'l1', origin: 'A', destination: 'B', departureDate: new Date(2024, 0, 1) },
      });
      component.form.get('sameDayArrival')!.setValue(false);
      component.form.get('arrivalDateOnly')!.setValue(new Date(2024, 0, 3));
      quoteTripLegServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'ok' }),
      );

      component.submit();

      const sentLeg = quoteTripLegServiceMock.update.mock.calls[0][0];
      expect(sentLeg.arrivalDate.getDate()).toBe(3);
    });

    it('treats an invalid arrival date string as null (splitDateAndTime on construction)', () => {
      const existing: QuoteTripLeg = {
        id: 'l1',
        origin: 'A',
        destination: 'B',
        departureDate: new Date(2024, 0, 1) as any,
        arrivalDate: 'not-a-date' as any,
      } as unknown as QuoteTripLeg;

      const component = createComponent({ isEdit: true, data: existing });

      expect(component.form.value.sameDayArrival).toBe(true);
    });

    it('treats a missing departure date as null on construction (falls back to now on submit)', () => {
      const existing: QuoteTripLeg = {
        id: 'l1',
        origin: 'A',
        destination: 'B',
      } as unknown as QuoteTripLeg;

      const component = createComponent({ isEdit: true, data: existing });

      expect(component.form.value.dateOnly).toBeNull();
    });

    it('falls back to null when the existing leg has no id', () => {
      const existing = { origin: 'A', destination: 'B' } as unknown as QuoteTripLeg;

      const component = createComponent({ isEdit: true, data: existing });
      component.form.patchValue({ dateOnly: new Date(2024, 0, 1) });
      quoteTripLegServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'ok' }),
      );

      component.submit();

      expect(quoteTripLegServiceMock.update.mock.calls[0][0].id).toBeNull();
    });

    it('falls back distanceKm/notes to 0/"" when explicitly cleared to null', () => {
      const component = createComponent({
        isEdit: true,
        quoteTripId: 'qt1',
        data: { id: 'l1', origin: 'A', destination: 'B', departureDate: new Date(2024, 0, 1) },
      });
      component.form.patchValue({ distanceKm: null, notes: null });
      quoteTripLegServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'ok' }),
      );

      component.submit();

      const sentLeg = quoteTripLegServiceMock.update.mock.calls[0][0];
      expect(sentLeg.distanceKm).toBe(0);
      expect(sentLeg.notes).toBe('');
    });

    it('falls back a stop distanceKm/notes to 0/"" when explicitly cleared to null (add mode)', () => {
      const component = createComponent({ quoteTripId: 'qt1' });
      component.form.patchValue({ origin: 'A' });
      component.stops.at(0).patchValue({
        destination: 'B',
        dateOnly: new Date(2024, 0, 1),
        distanceKm: null,
        notes: null,
      });
      quoteTripLegServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'ok' }),
      );

      component.submit();

      const sentLeg = quoteTripLegServiceMock.add.mock.calls[0][0];
      expect(sentLeg.distanceKm).toBe(0);
      expect(sentLeg.notes).toBe('');
    });

    it('does not add any legs when the stops array is empty (defensive, called directly)', () => {
      const component = createComponent({ quoteTripId: 'qt1' });
      component.form.patchValue({ origin: 'A' });
      component.form.removeControl('stops');

      (component as any).submitAdd();

      expect(quoteTripLegServiceMock.add).not.toHaveBeenCalled();
    });

    it('defaults hours/minutes to 0 when the time string is empty', () => {
      const component = createComponent({
        isEdit: true,
        quoteTripId: 'qt1',
        data: { id: 'l1', origin: 'A', destination: 'B', departureDate: new Date(2024, 0, 1) },
      });
      component.form.patchValue({ dateOnly: '10/05/2024', time: '' });
      quoteTripLegServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'ok' }),
      );

      component.submit();

      const sentLeg = quoteTripLegServiceMock.update.mock.calls[0][0];
      expect(sentLeg.departureDate.getHours()).toBe(0);
      expect(sentLeg.departureDate.getMinutes()).toBe(0);
    });

    it('defaults month/day to 1 when a malformed date string parses to 0', () => {
      const component = createComponent({
        isEdit: true,
        quoteTripId: 'qt1',
        data: { id: 'l1', origin: 'A', destination: 'B', departureDate: new Date(2024, 0, 1) },
      });
      component.form.patchValue({ dateOnly: '0/0/2024', time: '08:00' });
      quoteTripLegServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'ok' }),
      );

      component.submit();

      const sentLeg = quoteTripLegServiceMock.update.mock.calls[0][0];
      expect(sentLeg.departureDate.getMonth()).toBe(0);
      expect(sentLeg.departureDate.getDate()).toBe(1);
    });
  });

  describe('isSameCalendarDay (private, direct)', () => {
    it('returns false when there is an arrival date but no departure date', () => {
      const component = createComponent(null);

      expect((component as any).isSameCalendarDay(null, new Date(2024, 0, 1))).toBe(false);
    });
  });
});
