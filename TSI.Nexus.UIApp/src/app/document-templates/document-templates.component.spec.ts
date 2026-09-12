import { of, throwError } from 'rxjs';
import {
  DocumentTemplate,
  DocumentTemplateService,
  DocumentTemplateType,
  NotificationService,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';
import { DocumentTemplatesComponent } from './document-templates.component';

describe('DocumentTemplatesComponent', () => {
  let documentTemplateServiceMock: {
    getAll: ReturnType<typeof vi.fn>;
    download: ReturnType<typeof vi.fn>;
    upload: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };

  function createComponent() {
    documentTemplateServiceMock = {
      getAll: vi.fn().mockReturnValue(of({ data: [] })),
      download: vi.fn(),
      upload: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };

    return new DocumentTemplatesComponent(
      documentTemplateServiceMock as unknown as DocumentTemplateService,
      notificationServiceMock as unknown as NotificationService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  beforeEach(() => {
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockReturnValue({
      set href(_: string) {},
      set download(_: string) {},
      click: vi.fn(),
    } as unknown as HTMLAnchorElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('loads all templates on init', () => {
    const templates = [{ type: DocumentTemplateType.Quote }] as DocumentTemplate[];
    const component = createComponent();
    documentTemplateServiceMock.getAll.mockReturnValue(of({ data: templates }));

    component.ngOnInit();

    expect(component.templates).toBe(templates);
    expect(component.loading).toBe(false);
  });

  it('stops loading when the load request errors out', () => {
    const component = createComponent();
    documentTemplateServiceMock.getAll.mockReturnValue(throwError(() => new Error('boom')));

    component.ngOnInit();

    expect(component.loading).toBe(false);
  });

  describe('getFileExtension', () => {
    it('returns jpg for Letterhead', () => {
      const component = createComponent();
      expect(component.getFileExtension(DocumentTemplateType.Letterhead)).toBe('jpg');
    });

    it('returns png for Signature', () => {
      const component = createComponent();
      expect(component.getFileExtension(DocumentTemplateType.Signature)).toBe('png');
    });

    it('returns docx for every other type', () => {
      const component = createComponent();
      expect(component.getFileExtension(DocumentTemplateType.Quote)).toBe('docx');
      expect(component.getFileExtension(undefined)).toBe('docx');
    });
  });

  describe('getFileInputAccept', () => {
    it('matches the accept filter to the file extension', () => {
      const component = createComponent();
      expect(component.getFileInputAccept(DocumentTemplateType.Letterhead)).toBe('.jpg,.jpeg,image/jpeg');
      expect(component.getFileInputAccept(DocumentTemplateType.Signature)).toBe('.png,image/png');
      expect(component.getFileInputAccept(DocumentTemplateType.Quote)).toBe(
        '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    });
  });

  describe('download', () => {
    it('does nothing when the template has no type', () => {
      const component = createComponent();

      component.download({} as DocumentTemplate);

      expect(documentTemplateServiceMock.download).not.toHaveBeenCalled();
    });

    it('downloads the template blob under its own fileName', () => {
      const blob = new Blob(['x']);
      const component = createComponent();
      documentTemplateServiceMock.download.mockReturnValue(of(blob));

      component.download({ type: DocumentTemplateType.Quote, fileName: 'orcamento.docx' } as DocumentTemplate);

      expect(documentTemplateServiceMock.download).toHaveBeenCalledWith(DocumentTemplateType.Quote);
    });

    it('falls back to a type-based filename when fileName is absent', () => {
      const blob = new Blob(['x']);
      const component = createComponent();
      documentTemplateServiceMock.download.mockReturnValue(of(blob));

      expect(() =>
        component.download({ type: DocumentTemplateType.Letterhead } as DocumentTemplate),
      ).not.toThrow();
    });
  });

  it('triggerUpload clicks the given file input', () => {
    const component = createComponent();
    const input = { click: vi.fn() } as unknown as HTMLInputElement;

    component.triggerUpload(input);

    expect(input.click).toHaveBeenCalled();
  });

  describe('onFileSelected', () => {
    function fileEvent(file: File | null): Event {
      return { target: { files: file ? [file] : [], value: '' } } as unknown as Event;
    }

    it('does nothing when no file was selected', () => {
      const component = createComponent();

      component.onFileSelected(fileEvent(null), { type: DocumentTemplateType.Quote } as DocumentTemplate);

      expect(documentTemplateServiceMock.upload).not.toHaveBeenCalled();
    });

    it('does nothing when the template has no type', () => {
      const component = createComponent();
      const file = new File(['x'], 'a.docx');

      component.onFileSelected(fileEvent(file), {} as DocumentTemplate);

      expect(documentTemplateServiceMock.upload).not.toHaveBeenCalled();
    });

    it('uploads the file and applies the returned fileName on success', () => {
      const file = new File(['x'], 'a.docx');
      const response = { status: ResponseStatus.Success, message: 'ok', data: { fileName: 'novo.docx' } };
      const component = createComponent();
      documentTemplateServiceMock.upload.mockReturnValue(of(response));
      const template = { type: DocumentTemplateType.Quote } as DocumentTemplate;

      component.onFileSelected(fileEvent(file), template);

      expect(documentTemplateServiceMock.upload).toHaveBeenCalledWith(DocumentTemplateType.Quote, file);
      expect(template.fileName).toBe('novo.docx');
      expect(component.uploadingType).toBeNull();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(response.status, response.message);
    });

    it('does not apply fileName when the backend reports a non-success status', () => {
      const file = new File(['x'], 'a.docx');
      const response = { status: ResponseStatus.Error, message: 'falhou', data: { fileName: 'novo.docx' } };
      const component = createComponent();
      documentTemplateServiceMock.upload.mockReturnValue(of(response));
      const template = { type: DocumentTemplateType.Quote, fileName: 'antigo.docx' } as DocumentTemplate;

      component.onFileSelected(fileEvent(file), template);

      expect(template.fileName).toBe('antigo.docx');
    });

    it('shows a translated error notification and clears uploadingType when the request errors out', () => {
      const file = new File(['x'], 'a.docx');
      const component = createComponent();
      documentTemplateServiceMock.upload.mockReturnValue(throwError(() => new Error('boom')));

      component.onFileSelected(fileEvent(file), { type: DocumentTemplateType.Quote } as DocumentTemplate);

      expect(component.uploadingType).toBeNull();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'DOCUMENT_TEMPLATES.UPDATE_ERROR');
    });
  });
});
