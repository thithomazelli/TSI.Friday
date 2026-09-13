import { ChangeDetectorRef, ElementRef } from '@angular/core';
import {
  Attachment,
  AttachmentService,
  ModalService,
  PhotoService,
  TranslationService,
} from '@nexus/core';
import { of, throwError } from 'rxjs';
import { PhotoComponent } from './photo.component';

describe('PhotoComponent', () => {
  let cdMock: { detectChanges: ReturnType<typeof vi.fn> };
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    showSweetConfirmation: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
  };
  let attachmentServiceMock: {
    add: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getByUserId: ReturnType<typeof vi.fn>;
    getByBusinessPartnerId: ReturnType<typeof vi.fn>;
    getByProductId: ReturnType<typeof vi.fn>;
    getByOrderId: ReturnType<typeof vi.fn>;
    getByTransactionId: ReturnType<typeof vi.fn>;
    getByPaymentId: ReturnType<typeof vi.fn>;
    getByVehicleId: ReturnType<typeof vi.fn>;
    getByDriverId: ReturnType<typeof vi.fn>;
  };
  let photoServiceMock: {
    getPhoto: ReturnType<typeof vi.fn>;
    uploadPhoto: ReturnType<typeof vi.fn>;
    removePhoto: ReturnType<typeof vi.fn>;
    updateUserPhoto: ReturnType<typeof vi.fn>;
  };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };

  function createComponent(): PhotoComponent {
    cdMock = { detectChanges: vi.fn() };
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      showSweetConfirmation: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    attachmentServiceMock = {
      add: vi.fn(),
      delete: vi.fn().mockReturnValue(of(null)),
      getByUserId: vi.fn(),
      getByBusinessPartnerId: vi.fn(),
      getByProductId: vi.fn(),
      getByOrderId: vi.fn(),
      getByTransactionId: vi.fn(),
      getByPaymentId: vi.fn(),
      getByVehicleId: vi.fn(),
      getByDriverId: vi.fn(),
    };
    photoServiceMock = {
      getPhoto: vi.fn(),
      uploadPhoto: vi.fn(),
      removePhoto: vi.fn(),
      updateUserPhoto: vi.fn(),
    };
    translationServiceMock = { instant: vi.fn((key: string) => key) };

    return new PhotoComponent(
      cdMock as unknown as ChangeDetectorRef,
      modalServiceMock as unknown as ModalService,
      attachmentServiceMock as unknown as AttachmentService,
      photoServiceMock as unknown as PhotoService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  beforeEach(() => {
    if (!('createObjectURL' in URL)) {
      (URL as any).createObjectURL = () => '';
    }
    if (!('revokeObjectURL' in URL)) {
      (URL as any).revokeObjectURL = () => {};
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('loadPhoto (via ngOnInit)', () => {
    it('sets the placeholder image when there is no data', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.imageUrl).toBe('assets/img/no_photo_generic.svg');
    });

    it('fetches and shows the photo when data/entityClass/photo/id are all present', () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: 'photo.png' };
      const blob = new Blob(['x']);
      photoServiceMock.getPhoto.mockReturnValue(of(blob));

      component.ngOnInit();

      expect(photoServiceMock.getPhoto).toHaveBeenCalledWith('Users', 'u1', 'photo.png');
      expect(component.imageUrl).toBe('blob:fake');
      expect(cdMock.detectChanges).toHaveBeenCalled();
    });

    it('revokes a previously created object URL before assigning a new one', () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: 'photo.png' };
      photoServiceMock.getPhoto.mockReturnValue(of(new Blob(['x'])));

      component.loadPhoto();
      component.loadPhoto();

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    });

    it('falls back to the placeholder image when the fetch errors', () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: 'photo.png' };
      photoServiceMock.getPhoto.mockReturnValue(throwError(() => new Error('boom')));

      component.loadPhoto();

      expect(component.imageUrl).toBe('assets/img/no_profile.png');
    });

    it('sets the placeholder image when the entity has no photo set', () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1' };

      component.loadPhoto();

      expect(photoServiceMock.getPhoto).not.toHaveBeenCalled();
      expect(component.imageUrl).toBe('assets/img/no_profile.png');
    });
  });

  describe('ngOnChanges', () => {
    it('reloads the photo when imageUrl changes and data.photo is set', () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: 'photo.png' };
      photoServiceMock.getPhoto.mockReturnValue(of(new Blob(['x'])));

      component.ngOnChanges({ imageUrl: {} as any });

      expect(photoServiceMock.getPhoto).toHaveBeenCalled();
    });

    it('does nothing when the changed input is not imageUrl', () => {
      const component = createComponent();
      component.data = { id: 'u1', photo: 'photo.png' };

      expect(() => component.ngOnChanges({ entityClass: {} as any })).not.toThrow();
      expect(photoServiceMock.getPhoto).not.toHaveBeenCalled();
    });

    it('does nothing when there is no data', () => {
      const component = createComponent();

      expect(() => component.ngOnChanges({ imageUrl: {} as any })).not.toThrow();
    });

    it('does nothing when data has no photo', () => {
      const component = createComponent();
      component.data = { id: 'u1' };

      expect(() => component.ngOnChanges({ imageUrl: {} as any })).not.toThrow();
      expect(photoServiceMock.getPhoto).not.toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('revokes the last object URL when one was created', () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: 'photo.png' };
      photoServiceMock.getPhoto.mockReturnValue(of(new Blob(['x'])));
      component.loadPhoto();

      component.ngOnDestroy();

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    });

    it('does not throw when no object URL was ever created', () => {
      const component = createComponent();

      expect(() => component.ngOnDestroy()).not.toThrow();
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    });

    it('swallows an error thrown by revokeObjectURL', () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: 'photo.png' };
      photoServiceMock.getPhoto.mockReturnValue(of(new Blob(['x'])));
      component.loadPhoto();
      (URL.revokeObjectURL as any).mockImplementation(() => {
        throw new Error('boom');
      });

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('onImgError', () => {
    it('replaces the broken image src with the placeholder image', () => {
      const component = createComponent();
      component.entityClass = 'Vehicles';
      const img = document.createElement('img');

      component.onImgError({ target: img } as unknown as Event);

      expect(img.src).toContain('no_photo_generic.svg');
    });
  });

  describe('triggerFile', () => {
    it('clicks the native file input when present', () => {
      const component = createComponent();
      const input = document.createElement('input');
      const clickSpy = vi.spyOn(input, 'click');
      component.fileInput = new ElementRef(input);

      component.triggerFile();

      expect(clickSpy).toHaveBeenCalled();
    });

    it('does not throw when the file input is not yet available', () => {
      const component = createComponent();

      expect(() => component.triggerFile()).not.toThrow();
    });
  });

  describe('onFileSelected', () => {
    function fileEvent(file: File | null): Event {
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', {
        value: file ? [file] : [],
        writable: false,
      });
      return { target: input } as unknown as Event;
    }

    it('does nothing when no file was selected', () => {
      const component = createComponent();

      expect(() => component.onFileSelected(fileEvent(null))).not.toThrow();
      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
    });

    it('does nothing when the selected file is not an image', () => {
      const component = createComponent();
      const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });

      component.onFileSelected(fileEvent(file));

      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
    });

    it('opens the crop modal for a valid image file', () => {
      const component = createComponent();
      const file = new File(['x'], 'photo.png', { type: 'image/png' });
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(undefined) });

      component.onFileSelected(fileEvent(file));

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ source: file }),
      );
    });

    it('resets the input value after handling the selection', () => {
      const component = createComponent();
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', { value: [], writable: false });
      input.value = 'C:\\fakepath\\photo.png';

      component.onFileSelected({ target: input } as unknown as Event);

      expect(input.value).toBe('');
    });
  });

  describe('openCamera', () => {
    it('opens the crop modal when a photo was captured', () => {
      const component = createComponent();
      const file = new File(['x'], 'capture.png', { type: 'image/png' });
      modalServiceMock.showTemplateModal
        .mockReturnValueOnce({ afterClosed: () => of(file) })
        .mockReturnValueOnce({ afterClosed: () => of(undefined) });

      component.openCamera();

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledTimes(2);
    });

    it('does nothing further when the camera modal closes without a file', () => {
      const component = createComponent();
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(undefined) });

      component.openCamera();

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledTimes(1);
    });
  });

  describe('removePhotoConfirm', () => {
    it('does nothing without a data id', () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = {};

      component.removePhotoConfirm();

      expect(modalServiceMock.showSweetConfirmation).not.toHaveBeenCalled();
    });

    it('does nothing without an entityClass', () => {
      const component = createComponent();
      component.data = { id: 'u1' };

      component.removePhotoConfirm();

      expect(modalServiceMock.showSweetConfirmation).not.toHaveBeenCalled();
    });

    it('removes the photo when the user confirms', async () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: 'photo.png' };
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      attachmentServiceMock.getByUserId.mockReturnValue(of({ data: [] }));
      photoServiceMock.removePhoto.mockReturnValue(of(null));

      component.removePhotoConfirm();
      await Promise.resolve();

      expect(photoServiceMock.removePhoto).toHaveBeenCalledWith('Users', 'u1');
    });

    it('does nothing further when the user declines', async () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: 'photo.png' };
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.removePhotoConfirm();
      await Promise.resolve();

      expect(photoServiceMock.removePhoto).not.toHaveBeenCalled();
    });
  });

  describe('uploadCroppedPhoto (via onFileSelected)', () => {
    function uploadFlow(component: PhotoComponent, blob: Blob) {
      const file = new File(['x'], 'photo.png', { type: 'image/png' });
      modalServiceMock.showTemplateModal.mockReturnValue({ afterClosed: () => of(blob) });
      const inputEvent = { target: (() => {
        const input = document.createElement('input');
        Object.defineProperty(input, 'files', { value: [file], writable: false });
        return input;
      })() } as unknown as Event;
      component.onFileSelected(inputEvent);
    }

    it('does nothing without a data id', () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = {};

      uploadFlow(component, new Blob(['x'], { type: 'image/png' }));

      expect(attachmentServiceMock.add).not.toHaveBeenCalled();
    });

    it('does nothing without an entityClass', () => {
      const component = createComponent();
      component.data = { id: 'u1' };

      uploadFlow(component, new Blob(['x'], { type: 'image/png' }));

      expect(attachmentServiceMock.add).not.toHaveBeenCalled();
    });

    it('attaches then uploads the photo, updating the entity photo path and notifying', () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: '' };
      attachmentServiceMock.add.mockReturnValue(of(null));
      photoServiceMock.uploadPhoto.mockReturnValue(of({ fileName: 'new.png' }));
      photoServiceMock.getPhoto.mockReturnValue(of(new Blob(['x'])));

      uploadFlow(component, new Blob(['x'], { type: 'image/png' }));

      expect(attachmentServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1' }),
        'photos/Users',
      );
      expect(component.data.photo).toBe('new.png');
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        'Foto atualizada',
        'Upload realizado com sucesso!',
        'success',
      );
      expect(photoServiceMock.updateUserPhoto).toHaveBeenCalledWith('new.png', 'u1');
    });

    it('falls back to the upload response path when fileName is absent', () => {
      const component = createComponent();
      component.entityClass = 'Vehicles';
      component.data = { id: 'v1', photo: '' };
      attachmentServiceMock.add.mockReturnValue(of(null));
      photoServiceMock.uploadPhoto.mockReturnValue(of({ path: 'from-path.png' }));
      photoServiceMock.getPhoto.mockReturnValue(of(new Blob(['x'])));

      uploadFlow(component, new Blob(['x'], { type: 'image/png' }));

      expect(component.data.photo).toBe('from-path.png');
      expect(photoServiceMock.updateUserPhoto).not.toHaveBeenCalled();
    });

    it('falls back to an empty photo path when the upload response has neither', () => {
      const component = createComponent();
      component.entityClass = 'Vehicles';
      component.data = { id: 'v1', photo: '' };
      attachmentServiceMock.add.mockReturnValue(of(null));
      photoServiceMock.uploadPhoto.mockReturnValue(of({}));
      photoServiceMock.getPhoto.mockReturnValue(of(new Blob(['x'])));

      uploadFlow(component, new Blob(['x'], { type: 'image/png' }));

      expect(component.data.photo).toBe('');
    });

    it('defaults the uploaded file type to image/png when the blob has no type', () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: '' };
      attachmentServiceMock.add.mockReturnValue(of(null));
      photoServiceMock.uploadPhoto.mockReturnValue(of({}));
      photoServiceMock.getPhoto.mockReturnValue(of(new Blob(['x'])));

      uploadFlow(component, new Blob(['x']));

      const uploadedFile = photoServiceMock.uploadPhoto.mock.calls[0][2] as File;
      expect(uploadedFile.type).toBe('image/png');
    });

    it('proceeds to upload even when attaching the file fails', () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: '' };
      attachmentServiceMock.add.mockReturnValue(throwError(() => new Error('boom')));
      photoServiceMock.uploadPhoto.mockReturnValue(of({ fileName: 'new.png' }));
      photoServiceMock.getPhoto.mockReturnValue(of(new Blob(['x'])));

      uploadFlow(component, new Blob(['x'], { type: 'image/png' }));

      expect(photoServiceMock.uploadPhoto).toHaveBeenCalled();
    });

    it('shows an error notification when the upload request fails', () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: '' };
      attachmentServiceMock.add.mockReturnValue(of(null));
      photoServiceMock.uploadPhoto.mockReturnValue(throwError(() => new Error('boom')));

      uploadFlow(component, new Blob(['x'], { type: 'image/png' }));

      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Erro ao salvar foto.',
        'error',
      );
    });

    it('does nothing further when the crop modal closes without a cropped blob', () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1' };

      uploadFlow(component, undefined as unknown as Blob);

      expect(attachmentServiceMock.add).not.toHaveBeenCalled();
    });
  });

  describe('performRemove (via removePhotoConfirm)', () => {
    async function removeFlow(component: PhotoComponent) {
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      component.removePhotoConfirm();
      await Promise.resolve();
    }

    it('finds and deletes the matching attachment, then clears the entity photo and notifies', async () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: 'photo.png' };
      attachmentServiceMock.getByUserId.mockReturnValue(
        of({ data: [{ id: 'a1', fileName: 'photo.png' } as Attachment] }),
      );
      photoServiceMock.removePhoto.mockReturnValue(of(null));

      await removeFlow(component);

      expect(attachmentServiceMock.delete).toHaveBeenCalledWith('a1');
      expect(component.data.photo).toBe('');
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        'Foto removida',
        'Foto removida com sucesso!',
        'success',
      );
      expect(photoServiceMock.updateUserPhoto).toHaveBeenCalledWith('', 'u1');
    });

    it('does not delete any attachment when none matches the photo filename', async () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: 'photo.png' };
      attachmentServiceMock.getByUserId.mockReturnValue(
        of({ data: [{ id: 'a1', fileName: 'other.png' } as Attachment] }),
      );
      photoServiceMock.removePhoto.mockReturnValue(of(null));

      await removeFlow(component);

      expect(attachmentServiceMock.delete).not.toHaveBeenCalled();
    });

    it('falls back to an empty attachments array when the response has no data', async () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: 'photo.png' };
      attachmentServiceMock.getByUserId.mockReturnValue(of({}));
      photoServiceMock.removePhoto.mockReturnValue(of(null));

      await expect(removeFlow(component)).resolves.not.toThrow();
      expect(attachmentServiceMock.delete).not.toHaveBeenCalled();
    });

    it('does not attempt to find an attachment when data has no photo', async () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1' };
      photoServiceMock.removePhoto.mockReturnValue(of(null));

      await removeFlow(component);

      expect(attachmentServiceMock.getByUserId).not.toHaveBeenCalled();
      expect(photoServiceMock.removePhoto).toHaveBeenCalled();
    });

    it('shows an error notification when the remove request fails', async () => {
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: 'photo.png' };
      attachmentServiceMock.getByUserId.mockReturnValue(of({ data: [] }));
      photoServiceMock.removePhoto.mockReturnValue(throwError(() => new Error('boom')));

      await removeFlow(component);

      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Erro ao remover foto.',
        'error',
      );
    });

    it.each([
      ['BusinessPartners', 'getByBusinessPartnerId'],
      ['Products', 'getByProductId'],
      ['Orders', 'getByOrderId'],
      ['Transactions', 'getByTransactionId'],
      ['Payments', 'getByPaymentId'],
      ['Vehicles', 'getByVehicleId'],
      ['Drivers', 'getByDriverId'],
    ] as const)('resolves the fetch function for entityClass %s', async (entityClass, methodName) => {
      const component = createComponent();
      component.entityClass = entityClass;
      component.data = { id: 'e1', photo: 'photo.png' };
      (attachmentServiceMock as any)[methodName].mockReturnValue(of({ data: [] }));
      photoServiceMock.removePhoto.mockReturnValue(of(null));

      await removeFlow(component);

      expect((attachmentServiceMock as any)[methodName]).toHaveBeenCalledWith('e1');
      expect(photoServiceMock.updateUserPhoto).not.toHaveBeenCalled();
    });

    it('does nothing when the resolved entity id field has no matching fetch function', () => {
      // Every entityClass getEntityIdField() can produce has a matching key in entityMap, so this
      // guard is unreachable via the public API - exercised directly with a stubbed field name.
      const component = createComponent();
      component.entityClass = 'Users';
      component.data = { id: 'u1', photo: 'photo.png' };
      vi.spyOn(component as any, 'getEntityIdField').mockReturnValue('unknownField');

      expect(() => (component as any).deletePhotoAttachment()).not.toThrow();

      expect(attachmentServiceMock.getByUserId).not.toHaveBeenCalled();
    });
  });

  describe('getNoImage', () => {
    it('returns the profile placeholder for Users', () => {
      const component = createComponent();
      component.entityClass = 'Users';

      expect((component as any).getNoImage()).toBe('assets/img/no_profile.png');
    });

    it('returns the generic placeholder for any other entity', () => {
      const component = createComponent();
      component.entityClass = 'Vehicles';

      expect((component as any).getNoImage()).toBe('assets/img/no_photo_generic.svg');
    });
  });

  describe('getEntityIdField (default fallback)', () => {
    it('defaults to userId for an unknown entityClass', () => {
      const component = createComponent();
      component.entityClass = 'Unknown';
      component.data = { id: 'e1' };
      attachmentServiceMock.add.mockReturnValue(of(null));

      (component as any).addPhotoAsAttachment(new File(['x'], 'a.png'));

      expect(attachmentServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'e1' }),
        'photos/Unknown',
      );
    });
  });
});
