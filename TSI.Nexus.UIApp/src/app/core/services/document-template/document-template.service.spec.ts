import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, DocumentTemplateType } from '@nexus/core';
import { DocumentTemplateService } from './document-template.service';

describe('DocumentTemplateService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    getBlob: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };

  function createService(): DocumentTemplateService {
    apiServiceMock = { get: vi.fn(), getBlob: vi.fn(), post: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(DocumentTemplateService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getAll hits the expected endpoint', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getAll();

    expect(apiServiceMock.get).toHaveBeenCalledWith('documenttemplates/getAll');
  });

  it('getByType hits the expected endpoint', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getByType(DocumentTemplateType.Quote);

    expect(apiServiceMock.get).toHaveBeenCalledWith(
      `documenttemplates/getByType/${DocumentTemplateType.Quote}`,
    );
  });

  it('download fetches the blob from the expected endpoint', () => {
    const service = createService();
    apiServiceMock.getBlob.mockReturnValue(new Subject());

    service.download(DocumentTemplateType.Quote);

    expect(apiServiceMock.getBlob).toHaveBeenCalledWith(
      `documenttemplates/download/${DocumentTemplateType.Quote}`,
    );
  });

  it('upload sends the file as form data to the expected endpoint', () => {
    const service = createService();
    apiServiceMock.post.mockReturnValue(new Subject());
    const file = new File(['content'], 'template.docx');

    service.upload(DocumentTemplateType.Quote, file);

    expect(apiServiceMock.post).toHaveBeenCalledWith(
      `documenttemplates/upload/${DocumentTemplateType.Quote}`,
      expect.any(FormData),
    );
    const formData = apiServiceMock.post.mock.calls[0][1] as FormData;
    expect(formData.get('file')).toBe(file);
  });
});
