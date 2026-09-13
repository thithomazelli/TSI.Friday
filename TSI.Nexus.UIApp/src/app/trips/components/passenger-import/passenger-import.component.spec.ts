import { HttpErrorResponse } from '@angular/common/http';
import { MatDialogRef } from '@angular/material/dialog';
import { AttachmentService, Passenger, PassengerService, NotificationService, ResponseStatus } from '@nexus/core';
import { of, throwError } from 'rxjs';
import { PassengerImportComponent } from './passenger-import.component';

describe('PassengerImportComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };
  let passengerServiceMock: { addRange: ReturnType<typeof vi.fn> };
  let attachmentServiceMock: { add: ReturnType<typeof vi.fn> };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: any = { tripId: 't1' }): PassengerImportComponent {
    dialogRefMock = { close: vi.fn() };
    passengerServiceMock = { addRange: vi.fn() };
    attachmentServiceMock = { add: vi.fn() };
    notificationServiceMock = { showMessage: vi.fn() };

    return new PassengerImportComponent(
      dialogRefMock as unknown as MatDialogRef<PassengerImportComponent>,
      dialogData,
      passengerServiceMock as unknown as PassengerService,
      attachmentServiceMock as unknown as AttachmentService,
      notificationServiceMock as unknown as NotificationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('reads the tripId from the dialog data, falling back to an empty string', () => {
    expect(createComponent({ tripId: 't1' }).tripId).toBe('t1');
    expect(createComponent(null).tripId).toBe('');
    expect(createComponent({}).tripId).toBe('');
  });

  describe('close', () => {
    it('closes the dialog with null', () => {
      const component = createComponent();

      component.close();

      expect(dialogRefMock.close).toHaveBeenCalledWith(null);
    });
  });

  describe('onFileSelected', () => {
    it('clears the selection and does nothing when there is no file', () => {
      const component = createComponent();
      component.previewPassengers = [{ id: 'p1' } as Passenger];

      component.onFileSelected({ target: { files: [] } } as unknown as Event);

      expect(component.selectedFile).toBeNull();
      expect(component.previewPassengers).toEqual([]);
    });

    it('parses the selected file into preview passengers', async () => {
      const component = createComponent();
      const file = new File(['Nome,Documento\nJoão,123'], 'passengers.csv', { type: 'text/csv' });

      component.onFileSelected({ target: { files: [file] } } as unknown as Event);
      expect(component.selectedFile).toBe(file);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(Array.isArray(component.previewPassengers)).toBe(true);
    });

    it('treats a null reader result as an empty string', async () => {
      const component = createComponent();
      const file = new File([''], 'empty.csv', { type: 'text/csv' });
      const readAsTextSpy = vi
        .spyOn(FileReader.prototype, 'readAsText')
        .mockImplementation(function (this: FileReader) {
          Object.defineProperty(this, 'result', { value: null, configurable: true });
          this.onload?.(null as any);
        });

      component.onFileSelected({ target: { files: [file] } } as unknown as Event);

      expect(component.previewPassengers).toEqual([]);
      readAsTextSpy.mockRestore();
    });
  });

  describe('confirmImport', () => {
    it('does nothing when there is no selected file', () => {
      const component = createComponent();
      component.previewPassengers = [{ id: 'p1' } as Passenger];

      component.confirmImport();

      expect(passengerServiceMock.addRange).not.toHaveBeenCalled();
    });

    it('does nothing when there are no preview passengers', () => {
      const component = createComponent();
      component.selectedFile = new File(['x'], 'f.csv');
      component.previewPassengers = [];

      component.confirmImport();

      expect(passengerServiceMock.addRange).not.toHaveBeenCalled();
    });

    it('does nothing while already importing', () => {
      const component = createComponent();
      component.selectedFile = new File(['x'], 'f.csv');
      component.previewPassengers = [{ id: 'p1' } as Passenger];
      component.importing = true;

      component.confirmImport();

      expect(passengerServiceMock.addRange).not.toHaveBeenCalled();
    });

    it('imports the passengers and attachment, closing the dialog on success', () => {
      const component = createComponent();
      component.selectedFile = new File(['x'], 'f.csv');
      component.previewPassengers = [{ id: 'p1' } as Passenger];
      passengerServiceMock.addRange.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Importado' }),
      );
      attachmentServiceMock.add.mockReturnValue(of({}));

      component.confirmImport();

      expect(component.importing).toBe(false);
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'Importado',
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('does not close the dialog when the import response is not a success', () => {
      const component = createComponent();
      component.selectedFile = new File(['x'], 'f.csv');
      component.previewPassengers = [{ id: 'p1' } as Passenger];
      passengerServiceMock.addRange.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falha' }),
      );
      attachmentServiceMock.add.mockReturnValue(of({}));

      component.confirmImport();

      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('stops importing and shows the extracted error message on failure', () => {
      const component = createComponent();
      component.selectedFile = new File(['x'], 'f.csv');
      component.previewPassengers = [{ id: 'p1' } as Passenger];
      passengerServiceMock.addRange.mockReturnValue(
        throwError(() => new HttpErrorResponse({ error: { message: 'Deu erro' }, status: 400 })),
      );
      attachmentServiceMock.add.mockReturnValue(of({}));

      component.confirmImport();

      expect(component.importing).toBe(false);
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'Deu erro');
    });
  });

  describe('extractErrorMessage (private, via confirmImport error path)', () => {
    function triggerError(err: HttpErrorResponse): void {
      const component = createComponent();
      component.selectedFile = new File(['x'], 'f.csv');
      component.previewPassengers = [{ id: 'p1' } as Passenger];
      passengerServiceMock.addRange.mockReturnValue(throwError(() => err));
      attachmentServiceMock.add.mockReturnValue(of({}));

      component.confirmImport();
    }

    it('joins validation errors from the "errors" field', () => {
      triggerError(new HttpErrorResponse({ error: { errors: ['A', 'B'] }, status: 400 }));

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'A B');
    });

    it('joins validation errors from the "Errors" field', () => {
      triggerError(new HttpErrorResponse({ error: { Errors: ['C'] }, status: 400 }));

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'C');
    });

    it('uses the raw string body when it is a non-empty string', () => {
      triggerError(new HttpErrorResponse({ error: 'raw error text', status: 400 }));

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'raw error text');
    });

    it('ignores a blank string body and falls through to the generic message', () => {
      triggerError(new HttpErrorResponse({ error: '   ', status: 500 }));

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'Error',
        'Erro ao importar a lista de passageiros (HTTP 500).',
      );
    });

    it('uses the body message field when present', () => {
      triggerError(new HttpErrorResponse({ error: { message: 'Falhou' }, status: 400 }));

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'Falhou');
    });

    it('falls back to a generic message with the HTTP status when nothing else matches', () => {
      triggerError(new HttpErrorResponse({ error: {}, status: 500 }));

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'Error',
        'Erro ao importar a lista de passageiros (HTTP 500).',
      );
    });

    it('falls back to "?" when there is no status at all', () => {
      triggerError({ error: {} } as HttpErrorResponse);

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'Error',
        'Erro ao importar a lista de passageiros (HTTP ?).',
      );
    });
  });
});
