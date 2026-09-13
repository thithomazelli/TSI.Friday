import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import Swal from 'sweetalert2';
import { TranslationService } from '../translation/translation.service';
import { ModalService } from './modal.service';

describe('ModalService', () => {
  let dialogMock: { open: ReturnType<typeof vi.fn>; closeAll: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let fireSpy: ReturnType<typeof vi.spyOn>;

  function createService(): ModalService {
    dialogMock = { open: vi.fn(), closeAll: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };

    return new ModalService(
      dialogMock as unknown as MatDialog,
      translationServiceMock as unknown as TranslationService,
    );
  }

  beforeEach(() => {
    fireSpy = vi
      .spyOn(Swal, 'fire')
      .mockReturnValue(undefined as unknown as ReturnType<typeof Swal.fire>);
  });

  afterEach(() => {
    fireSpy.mockRestore();
  });

  it('should be created', () => {
    expect(createService()).toBeTruthy();
  });

  describe('showTemplateModal', () => {
    it('opens a dialog with the given component/template and default width', () => {
      const service = createService();
      const Component = class {};

      service.showTemplateModal(Component, { foo: 'bar' });

      expect(dialogMock.open).toHaveBeenCalledWith(
        Component,
        expect.objectContaining({
          data: { foo: 'bar' },
          width: '760px',
          disableClose: false,
          panelClass: 'custom-modal',
          autoFocus: false,
        }),
      );
    });

    it('carries the id through to dialogData when present', () => {
      const service = createService();

      service.showTemplateModal(class {}, { id: 'x1' });

      expect(dialogMock.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining({ id: 'x1' }) }),
      );
    });

    it('carries the parentId through to dialogData when present', () => {
      const service = createService();

      service.showTemplateModal(class {}, { parentId: 'p1' });

      expect(dialogMock.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: expect.objectContaining({ parentId: 'p1' }) }),
      );
    });

    it('uses a custom width when provided', () => {
      const service = createService();

      service.showTemplateModal(class {}, { width: '900px' });

      expect(dialogMock.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ width: '900px' }),
      );
    });

    it('honors disableClose when set', () => {
      const service = createService();

      service.showTemplateModal(class {}, { disableClose: true });

      expect(dialogMock.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ disableClose: true }),
      );
    });

    it('works with no data at all', () => {
      const service = createService();

      service.showTemplateModal(class {});

      expect(dialogMock.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: {}, width: '760px', disableClose: false }),
      );
    });
  });

  describe('showNotification', () => {
    it('opens the notification dialog with the given data', () => {
      const service = createService();

      service.showNotification(true, 'Título', 'Mensagem');

      expect(dialogMock.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: { isSuccess: true, title: 'Título', message: 'Mensagem' },
          width: '400px',
          panelClass: 'custom-modal',
          autoFocus: false,
        }),
      );
    });
  });

  describe('showSweetNotification', () => {
    it.each([
      ['success', 'success'],
      ['ok', 'success'],
      ['error', 'error'],
      ['fail', 'error'],
      ['failed', 'error'],
      ['warning', 'warning'],
      ['warn', 'warning'],
      ['alert', 'warning'],
    ])('maps status "%s" to icon "%s"', (status, expectedIcon) => {
      const service = createService();

      service.showSweetNotification('Título', 'Texto', status);

      expect(fireSpy).toHaveBeenCalledWith(
        expect.objectContaining({ icon: expectedIcon, title: 'Título', text: 'Texto' }),
      );
    });

    it('maps an unrecognized status to the info icon', () => {
      const service = createService();

      service.showSweetNotification('Título', 'Texto', 'something-else');

      expect(fireSpy).toHaveBeenCalledWith(expect.objectContaining({ icon: 'info' }));
    });

    it('matches status case-insensitively', () => {
      const service = createService();

      service.showSweetNotification('Título', 'Texto', 'SUCCESS');

      expect(fireSpy).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success' }));
    });
  });

  describe('showConfirmation', () => {
    it('opens the confirmation dialog with the given data', () => {
      const service = createService();

      service.showConfirmation({ message: 'Tem certeza?' });

      expect(dialogMock.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: { message: 'Tem certeza?' },
          width: '400px',
          panelClass: 'custom-modal',
          autoFocus: false,
        }),
      );
    });
  });

  describe('showSweetConfirmation', () => {
    it('fires a question confirmation with translated default button labels', () => {
      const service = createService();

      service.showSweetConfirmation('Título', 'Texto');

      expect(fireSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Título',
          text: 'Texto',
          icon: 'question',
          confirmButtonText: 'COMMON.YES',
          cancelButtonText: 'COMMON.CANCEL',
        }),
      );
    });

    it('uses a warning icon and custom button labels when provided', () => {
      const service = createService();

      service.showSweetConfirmation('Título', 'Texto', 'warning', 'Sim', 'Não');

      expect(fireSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'warning',
          confirmButtonText: 'Sim',
          cancelButtonText: 'Não',
        }),
      );
    });
  });

  describe('showPdfProgress', () => {
    it('opens the pdf progress dialog and delegates handle calls to the component instance', () => {
      const service = createService();
      const instance = {
        setProgress: vi.fn(),
        setIndeterminate: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
      };
      dialogMock.open.mockReturnValue({ componentInstance: instance });

      const handle = service.showPdfProgress('Gerando PDF');

      expect(dialogMock.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: { title: 'Gerando PDF' },
          width: '420px',
          disableClose: true,
          panelClass: 'custom-modal',
          autoFocus: false,
        }),
      );

      handle.setProgress(2, 5);
      expect(instance.setProgress).toHaveBeenCalledWith(2, 5);

      handle.setIndeterminate();
      expect(instance.setIndeterminate).toHaveBeenCalled();

      handle.success('Concluído', { name: 'a.pdf' } as any);
      expect(instance.success).toHaveBeenCalledWith('Concluído', { name: 'a.pdf' });

      handle.error('Falhou');
      expect(instance.error).toHaveBeenCalledWith('Falhou');
    });
  });

  describe('hideModal', () => {
    it('closes the given dialogRef when provided', () => {
      const service = createService();
      const dialogRef = { close: vi.fn() } as unknown as MatDialogRef<any>;

      service.hideModal(dialogRef);

      expect(dialogRef.close).toHaveBeenCalled();
      expect(dialogMock.closeAll).not.toHaveBeenCalled();
    });

    it('closes all dialogs when no dialogRef is given', () => {
      const service = createService();

      service.hideModal();

      expect(dialogMock.closeAll).toHaveBeenCalled();
    });
  });
});
