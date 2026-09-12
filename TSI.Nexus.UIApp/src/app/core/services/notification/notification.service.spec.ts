import { TestBed } from '@angular/core/testing';
import Swal from 'sweetalert2';

import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let fireSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fireSpy = vi.spyOn(Swal, 'fire').mockReturnValue(undefined as unknown as ReturnType<typeof Swal.fire>);
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    fireSpy.mockRestore();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('showMessage', () => {
    it('dispatches to success for type "Success"', () => {
      service.showMessage('Success', 'Salvo com sucesso');

      expect(fireSpy).toHaveBeenCalledWith(
        expect.objectContaining({ icon: 'success', text: 'Salvo com sucesso', background: '#198754' }),
      );
    });

    it('dispatches to error for type "Error"', () => {
      service.showMessage('Error', 'Falha ao salvar');

      expect(fireSpy).toHaveBeenCalledWith(
        expect.objectContaining({ icon: 'error', text: 'Falha ao salvar', background: '#dc3545' }),
      );
    });

    it('dispatches to info for type "Info"', () => {
      service.showMessage('Info', 'Aviso informativo');

      expect(fireSpy).toHaveBeenCalledWith(
        expect.objectContaining({ icon: 'info', text: 'Aviso informativo', background: '#0d6efd' }),
      );
    });

    it('dispatches to warning for type "Warning"', () => {
      service.showMessage('Warning', 'Atenção');

      expect(fireSpy).toHaveBeenCalledWith(
        expect.objectContaining({ icon: 'warning', text: 'Atenção', background: '#ffc107' }),
      );
    });

    it('matches the type case-insensitively (lowercase caller literal)', () => {
      service.showMessage('error', 'Falha ao salvar');

      expect(fireSpy).toHaveBeenCalledWith(expect.objectContaining({ icon: 'error' }));
    });

    it('falls back to error for an unrecognized type', () => {
      service.showMessage('SomethingElse', 'Mensagem');

      expect(fireSpy).toHaveBeenCalledWith(
        expect.objectContaining({ icon: 'error', text: 'Mensagem' }),
      );
    });

    it('falls back to error when type is undefined', () => {
      service.showMessage(undefined as unknown as string, 'Mensagem');

      expect(fireSpy).toHaveBeenCalledWith(expect.objectContaining({ icon: 'error' }));
    });

    it('passes the title through to the underlying Swal handler call', () => {
      service.showMessage('Success', 'Mensagem', 'Título');

      expect(fireSpy).toHaveBeenCalledWith(expect.objectContaining({ text: 'Mensagem' }));
    });
  });
});
