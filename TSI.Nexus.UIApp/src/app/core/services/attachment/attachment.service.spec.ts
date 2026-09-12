import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { Attachment, ApiService, WebApiResponse } from '@nexus/core';
import { AttachmentService } from './attachment.service';

describe('AttachmentService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getBlob: ReturnType<typeof vi.fn>;
  };

  function createService(): AttachmentService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), getBlob: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(AttachmentService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getById and every getByXId hit the expected endpoint', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getById('a1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('attachments/getById/a1');

    service.getByBusinessPartnerId('bp1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('attachments/getByBusinessPartnerId/bp1');

    service.getByOrderId('o1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('attachments/getByOrderId/o1');
  });

  it('downloadFile fetches a blob from the expected endpoint', () => {
    const service = createService();
    apiServiceMock.getBlob.mockReturnValue(new Subject());

    service.downloadFile('a1');

    expect(apiServiceMock.getBlob).toHaveBeenCalledWith('attachments/getFileById/a1');
  });

  it('attachmentChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.attachmentChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add builds a FormData payload including an override path and notifies on success', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<Attachment>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    let emissions = 0;
    service.attachmentChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    service.add({ id: 'a1', file: new File(['x'], 'a.pdf') } as Attachment, 'custom/path').subscribe();

    expect(apiServiceMock.post).toHaveBeenCalledWith('attachments/add', expect.any(FormData));
    const formData = apiServiceMock.post.mock.calls[0][1] as FormData;
    expect(formData.get('id')).toBe('a1');
    expect(formData.get('overridePath')).toBe('custom/path');

    addResponse$.next({} as WebApiResponse<Attachment>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);
  });

  it('update and delete also notify on success', () => {
    const service = createService();
    const updateResponse$ = new Subject<WebApiResponse<Attachment>>();
    const deleteResponse$ = new Subject<WebApiResponse<Attachment>>();
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);
    let emissions = 0;
    service.attachmentChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    service.update({ id: 'a1' } as Attachment).subscribe();
    updateResponse$.next({} as WebApiResponse<Attachment>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.delete('a1').subscribe();
    expect(apiServiceMock.delete).toHaveBeenCalledWith('attachments/delete/a1', null);
    deleteResponse$.next({} as WebApiResponse<Attachment>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);
  });
});
