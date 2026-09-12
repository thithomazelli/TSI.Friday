import { MatDialogRef } from '@angular/material/dialog';
import { TranslationService } from '@nexus/core';
import { PdfProgressComponent } from './pdf-progress.component';

describe('PdfProgressComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn>; disableClose: boolean };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };

  function createComponent(title = 'Gerando PDF') {
    dialogRefMock = { close: vi.fn(), disableClose: true };
    translationServiceMock = {
      instant: vi.fn((key: string, params?: Record<string, string>) =>
        params ? `${key} ${params['current']}/${params['total']}` : key,
      ),
    };
    return new PdfProgressComponent(
      { title },
      dialogRefMock as unknown as MatDialogRef<PdfProgressComponent>,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create in the indeterminate state with the given title', () => {
    const component = createComponent('Gerando relatório');

    expect(component.state).toBe('indeterminate');
    expect(component.title).toBe('Gerando relatório');
  });

  it('setProgress computes a clamped percentage and a translated label', () => {
    const component = createComponent();

    component.setProgress(3, 10);

    expect(component.state).toBe('progress');
    expect(component.percent).toBe(30);
    expect(component.label).toBe('PDF_EXPORT.PAGE_PROGRESS 3/10');
  });

  it('setProgress treats a zero total as zero percent instead of dividing by zero', () => {
    const component = createComponent();

    component.setProgress(0, 0);

    expect(component.percent).toBe(0);
  });

  it('setProgress clamps above 100%', () => {
    const component = createComponent();

    component.setProgress(15, 10);

    expect(component.percent).toBe(100);
  });

  it('setIndeterminate resets the state', () => {
    const component = createComponent();
    component.setProgress(5, 10);

    component.setIndeterminate();

    expect(component.state).toBe('indeterminate');
  });

  it('success stores the message/file and re-enables closing the dialog', () => {
    const component = createComponent();
    const file = { url: 'blob:x', name: 'report.pdf' };

    component.success('Pronto!', file);

    expect(component.state).toBe('success');
    expect(component.message).toBe('Pronto!');
    expect(component.file).toBe(file);
    expect(dialogRefMock.disableClose).toBe(false);
  });

  it('success without a file leaves file null', () => {
    const component = createComponent();

    component.success('Pronto!');

    expect(component.file).toBeNull();
  });

  it('error stores the message and re-enables closing the dialog', () => {
    const component = createComponent();

    component.error('Falhou');

    expect(component.state).toBe('error');
    expect(component.message).toBe('Falhou');
    expect(dialogRefMock.disableClose).toBe(false);
  });

  it('openFile opens the stored file URL in a new tab', () => {
    const component = createComponent();
    component.success('Pronto!', { url: 'blob:x', name: 'report.pdf' });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    component.openFile();

    expect(openSpy).toHaveBeenCalledWith('blob:x', '_blank');
  });

  it('openFile does nothing when there is no file', () => {
    const component = createComponent();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    component.openFile();

    expect(openSpy).not.toHaveBeenCalled();
  });

  it('close closes the dialog', () => {
    const component = createComponent();

    component.close();

    expect(dialogRefMock.close).toHaveBeenCalled();
  });

  it('ngOnDestroy revokes the file object URL when a file is present', () => {
    const component = createComponent();
    component.success('Pronto!', { url: 'blob:x', name: 'report.pdf' });
    const revokeSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});

    component.ngOnDestroy();

    expect(revokeSpy).toHaveBeenCalledWith('blob:x');
  });

  it('ngOnDestroy does nothing when there is no file', () => {
    const component = createComponent();
    const revokeSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});

    component.ngOnDestroy();

    expect(revokeSpy).not.toHaveBeenCalled();
  });
});
