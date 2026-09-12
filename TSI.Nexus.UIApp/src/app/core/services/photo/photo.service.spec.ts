import { TestBed } from '@angular/core/testing';
import { ApiService } from '@nexus/core';
import { PhotoService } from './photo.service';

describe('PhotoService', () => {
  let apiServiceMock: {
    post: ReturnType<typeof vi.fn>;
    getBlob: ReturnType<typeof vi.fn>;
  };

  function createService(): PhotoService {
    apiServiceMock = { post: vi.fn(), getBlob: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(PhotoService);
  }

  it('should be created', () => {
    expect(createService()).toBeTruthy();
  });

  it('photo$ starts with an empty photoPath', () => {
    const service = createService();
    let latest: { photoPath: string; userId?: string } | undefined;
    service.photo$.subscribe((v) => (latest = v));
    TestBed.flushEffects();

    expect(latest).toEqual({ photoPath: '' });
  });

  it('updateUserPhoto updates photo$ with the new path and userId', () => {
    const service = createService();
    let latest: { photoPath: string; userId?: string } | undefined;
    service.photo$.subscribe((v) => (latest = v));
    TestBed.flushEffects();

    service.updateUserPhoto('photos/u1.jpg', 'u1');
    TestBed.flushEffects();

    expect(latest).toEqual({ photoPath: 'photos/u1.jpg', userId: 'u1' });
  });

  it('uploadPhoto posts a FormData with entity, entityId, and file', () => {
    const service = createService();
    apiServiceMock.post.mockReturnValue({ subscribe: vi.fn() });
    const file = new File(['x'], 'photo.png');

    service.uploadPhoto('drivers', 'd1', file);

    expect(apiServiceMock.post).toHaveBeenCalledTimes(1);
    const [url, formData] = apiServiceMock.post.mock.calls[0];
    expect(url).toBe('photos/uploadPhoto');
    expect(formData).toBeInstanceOf(FormData);
    expect((formData as FormData).get('entity')).toBe('drivers');
    expect((formData as FormData).get('entityId')).toBe('d1');
    const uploadedFile = (formData as FormData).get('file') as File;
    expect(uploadedFile.name).toBe(file.name);
  });

  it('removePhoto posts a FormData with entity/entityId but no file', () => {
    const service = createService();
    apiServiceMock.post.mockReturnValue({ subscribe: vi.fn() });

    service.removePhoto('drivers', 'd1');

    expect(apiServiceMock.post).toHaveBeenCalledTimes(1);
    const [url, formData] = apiServiceMock.post.mock.calls[0];
    expect(url).toBe('photos/uploadPhoto');
    expect((formData as FormData).get('entity')).toBe('drivers');
    expect((formData as FormData).get('entityId')).toBe('d1');
    expect((formData as FormData).get('file')).toBeNull();
  });

  it('getPhoto builds the query string and delegates to getBlob', () => {
    const service = createService();
    apiServiceMock.getBlob.mockReturnValue({ subscribe: vi.fn() });

    service.getPhoto('drivers', 'd1', 'photo.png');

    expect(apiServiceMock.getBlob).toHaveBeenCalledWith(
      'photos/getPhoto?entity=drivers&entityId=d1&fileName=photo.png',
    );
  });
});
