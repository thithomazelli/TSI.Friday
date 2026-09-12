import { FormBuilder } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { NotificationService, Passenger, PassengerService, ResponseStatus } from '@nexus/core';
import { PassengerDetailsModalComponent } from './passenger-details-modal.component';

describe('PassengerDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };
  let passengerServiceMock: { add: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: unknown) {
    dialogRefMock = { close: vi.fn() };
    passengerServiceMock = { add: vi.fn(), update: vi.fn() };
    notificationServiceMock = { showMessage: vi.fn() };

    return new PassengerDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<PassengerDetailsModalComponent>,
      dialogData,
      new FormBuilder(),
      passengerServiceMock as unknown as PassengerService,
      notificationServiceMock as unknown as NotificationService,
    );
  }

  it('should create', () => {
    expect(createComponent(null)).toBeTruthy();
  });

  it('starts in add mode with an empty form when no dialogData is provided', () => {
    const component = createComponent(null);

    expect(component.isEdit).toBe(false);
    expect(component.tripId).toBe('');
    expect(component.form.value).toEqual({
      name: '',
      documentNumber: '',
      seat: '',
      phone: '',
    });
  });

  it('starts in edit mode pre-filled from existing passenger data', () => {
    const passenger: Passenger = {
      id: 'p1',
      name: 'Ana',
      documentNumber: '123',
      seat: '10',
      phone: '999',
      tripId: 't1',
    } as Passenger;
    const component = createComponent({ data: passenger, tripId: 't1' });

    expect(component.isEdit).toBe(true);
    expect(component.tripId).toBe('t1');
    expect(component.form.value).toEqual({
      name: 'Ana',
      documentNumber: '123',
      seat: '10',
      phone: '999',
    });
  });

  it('closes the dialog with null when close() is called', () => {
    const component = createComponent(null);
    component.close();

    expect(dialogRefMock.close).toHaveBeenCalledWith(null);
  });

  it('does not submit and marks the form as touched when it is invalid', () => {
    const component = createComponent({ tripId: 't1' });
    component.submit();

    expect(component.form.touched).toBe(true);
    expect(passengerServiceMock.add).not.toHaveBeenCalled();
  });

  it('adds a new passenger and closes the dialog on success', () => {
    const response = { status: ResponseStatus.Success, message: 'ok', data: {} as Passenger };
    const component = createComponent({ tripId: 't1' });
    passengerServiceMock.add.mockReturnValue(of(response));
    component.form.setValue({ name: 'Ana', documentNumber: '123', seat: '10', phone: '999' });

    component.submit();

    expect(passengerServiceMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ana', tripId: 't1' }),
    );
    expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(response.status, response.message);
    expect(dialogRefMock.close).toHaveBeenCalledWith(response);
    expect(component.saving).toBe(false);
  });

  it('updates an existing passenger, including its id in the payload', () => {
    const passenger: Passenger = { id: 'p1', name: 'Ana', tripId: 't1' } as Passenger;
    const response = { status: ResponseStatus.Success, message: 'ok', data: passenger };
    const component = createComponent({ data: passenger, tripId: 't1' });
    passengerServiceMock.update.mockReturnValue(of(response));

    component.submit();

    expect(passengerServiceMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', tripId: 't1' }),
    );
    expect(dialogRefMock.close).toHaveBeenCalledWith(response);
  });

  it('does not close the dialog when the backend reports a non-success status', () => {
    const response = { status: ResponseStatus.Error, message: 'falhou', data: null };
    const component = createComponent({ tripId: 't1' });
    passengerServiceMock.add.mockReturnValue(of(response));
    component.form.setValue({ name: 'Ana', documentNumber: '', seat: '', phone: '' });

    component.submit();

    expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(response.status, response.message);
    expect(dialogRefMock.close).not.toHaveBeenCalled();
    expect(component.saving).toBe(false);
  });

  it('shows a generic error notification and stops saving when the request errors out', () => {
    const component = createComponent({ tripId: 't1' });
    passengerServiceMock.add.mockReturnValue(throwError(() => new Error('network error')));
    component.form.setValue({ name: 'Ana', documentNumber: '', seat: '', phone: '' });

    component.submit();

    expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
      ResponseStatus.Error,
      'Erro ao salvar o passageiro.',
    );
    expect(component.saving).toBe(false);
  });

  it('does not submit again while a save is already in flight', () => {
    const component = createComponent({ tripId: 't1' });
    component.form.setValue({ name: 'Ana', documentNumber: '', seat: '', phone: '' });
    component.saving = true;

    component.submit();

    expect(passengerServiceMock.add).not.toHaveBeenCalled();
  });
});
