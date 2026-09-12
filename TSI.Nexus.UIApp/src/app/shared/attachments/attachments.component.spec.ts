import { ChangeDetectorRef } from '@angular/core';
import { Attachment, ResponseStatus } from '@nexus/core';
import { of, throwError } from 'rxjs';
import { AttachmentsComponent } from './attachments.component';
import { AttachmentService } from '../../core/services/attachment/attachment.service';
import { ModalService } from '../../core/services/modal/modal.service';
import { NotificationService } from '../../core/services/notification/notification.service';

describe('AttachmentsComponent', () => {
  let attachmentServiceMock: {
    getByBusinessPartnerId: ReturnType<typeof vi.fn>;
    getByOrderId: ReturnType<typeof vi.fn>;
    add: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    downloadFile: ReturnType<typeof vi.fn>;
  };
  let modalServiceMock: {
    showSweetNotification: ReturnType<typeof vi.fn>;
    showSweetConfirmation: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  function createComponent(): AttachmentsComponent {
    attachmentServiceMock = {
      getByBusinessPartnerId: vi.fn().mockReturnValue(of({ data: [] })),
      getByOrderId: vi.fn().mockReturnValue(of({ data: [] })),
      add: vi.fn(),
      delete: vi.fn(),
      downloadFile: vi.fn(),
    };
    modalServiceMock = {
      showSweetNotification: vi.fn(),
      showSweetConfirmation: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    cdrMock = { markForCheck: vi.fn() };

    return new AttachmentsComponent(
      attachmentServiceMock as unknown as AttachmentService,
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit / loadAttachments', () => {
    it('does nothing when there is no entityId', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(attachmentServiceMock.getByBusinessPartnerId).not.toHaveBeenCalled();
    });

    it('fetches attachments for the configured entity and builds the tree', () => {
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';
      attachmentServiceMock.getByBusinessPartnerId.mockReturnValue(
        of({
          data: [
            { id: 'a1', path: 'attachments/root-file.pdf', fileName: 'root-file.pdf' },
          ] as Attachment[],
        }),
      );

      component.ngOnInit();

      expect(attachmentServiceMock.getByBusinessPartnerId).toHaveBeenCalledWith('bp1');
      expect(component.loading).toBe(false);
      expect(component.attachments).toHaveLength(1);
      expect(component.rootFolder.files).toHaveLength(1);
    });

    it('stops loading without fetching for an unmapped entity', () => {
      const component = createComponent();
      component.entity = 'unknown-entity';
      component.entityId = 'e1';

      component.ngOnInit();

      expect(component.loading).toBe(false);
      expect(component.attachments).toEqual([]);
    });

    it('resets attachments and stops loading when the fetch fails', () => {
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';
      attachmentServiceMock.getByBusinessPartnerId.mockReturnValue(
        throwError(() => new Error('fail')),
      );

      component.ngOnInit();

      expect(component.attachments).toEqual([]);
      expect(component.loading).toBe(false);
    });

    it('refresh() re-fetches the attachments', () => {
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';

      component.refresh();

      expect(attachmentServiceMock.getByBusinessPartnerId).toHaveBeenCalledWith('bp1');
    });
  });

  describe('getFileIcon', () => {
    it('returns a generic icon when there is no file name', () => {
      expect(createComponent().getFileIcon()).toBe('pi pi-file');
    });

    it.each([
      ['photo.png', 'pi pi-image'],
      ['report.pdf', 'pi pi-file-pdf'],
      ['contract.docx', 'pi pi-file-word'],
      ['sheet.xlsx', 'pi pi-file-excel'],
      ['archive.zip', 'pi pi-file'],
    ])('maps %s to %s', (fileName, icon) => {
      expect(createComponent().getFileIcon(fileName)).toBe(icon);
    });
  });

  describe('navigation', () => {
    it('isAtRoot is true before navigating anywhere', () => {
      expect(createComponent().isAtRoot()).toBe(true);
    });

    it('navigateToPath falls back to root for an unknown path', () => {
      const component = createComponent();
      component.navigateToPath('does/not/exist');

      expect(component.isAtRoot()).toBe(true);
      expect(component.selectedFile).toBeNull();
    });

    it('navigateUp from root stays at root', () => {
      const component = createComponent();
      component.navigateUp();

      expect(component.isAtRoot()).toBe(true);
    });
  });

  describe('buildContextMenu', () => {
    it('hides actions when nothing is selected', () => {
      const component = createComponent();
      component.buildContextMenu();

      expect(component.contextMenuItems.every((item) => item.visible === false)).toBe(true);
    });

    it('shows actions once a file is selected', () => {
      const component = createComponent();
      component.selectFile({ id: 'a1', fileName: 'a.pdf' } as Attachment);

      expect(component.contextMenuItems.every((item) => item.visible === true)).toBe(true);
    });
  });

  describe('addAttachment', () => {
    it('does nothing without a selected file', () => {
      const component = createComponent();
      component.addAttachment();

      expect(attachmentServiceMock.add).not.toHaveBeenCalled();
    });

    it('uploads the file and reloads on success', () => {
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';
      component.addFile = new File(['x'], 'doc.pdf');
      attachmentServiceMock.add.mockReturnValue(
        of({ message: 'Enviado', status: ResponseStatus.Success }),
      );

      component.addAttachment();

      expect(attachmentServiceMock.add).toHaveBeenCalled();
      expect(component.showAddDialog).toBe(false);
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Enviado',
        ResponseStatus.Success,
      );
    });

    it('shows an error notification when the upload fails', () => {
      const component = createComponent();
      component.addFile = new File(['x'], 'doc.pdf');
      attachmentServiceMock.add.mockReturnValue(throwError(() => new Error('fail')));

      component.addAttachment();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'Error',
        'Erro ao adicionar anexo.',
      );
    });
  });

  describe('removeFile', () => {
    it('does nothing without a selected file', () => {
      const component = createComponent();
      component.removeFile();

      expect(modalServiceMock.showSweetConfirmation).not.toHaveBeenCalled();
    });

    it('deletes the selected file when confirmed', async () => {
      const component = createComponent();
      component.selectFile({ id: 'a1', fileName: 'a.pdf' } as Attachment);
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      attachmentServiceMock.delete.mockReturnValue(
        of({ message: 'Removido', status: ResponseStatus.Success }),
      );

      component.removeFile();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(attachmentServiceMock.delete).toHaveBeenCalledWith('a1');
      expect(component.selectedFile).toBeNull();
    });

    it('does not delete when the user cancels', async () => {
      const component = createComponent();
      component.selectFile({ id: 'a1', fileName: 'a.pdf' } as Attachment);
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.removeFile();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(attachmentServiceMock.delete).not.toHaveBeenCalled();
    });
  });

  describe('downloadFile', () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    beforeEach(() => {
      URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
      URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it('triggers a download for the returned blob', () => {
      const component = createComponent();
      const blob = new Blob(['content']);
      attachmentServiceMock.downloadFile.mockReturnValue(of(blob));

      component.downloadFile({ id: 'a1', fileName: 'a.pdf' } as Attachment);

      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    });

    it('shows an error notification when the download fails', () => {
      const component = createComponent();
      attachmentServiceMock.downloadFile.mockReturnValue(throwError(() => new Error('fail')));

      component.downloadFile({ id: 'a1', fileName: 'a.pdf' } as Attachment);

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'Error',
        'Erro ao baixar arquivo.',
      );
    });
  });

  describe('addFolder', () => {
    it('does nothing for a blank folder name', () => {
      const component = createComponent();
      component.newFolderName = '   ';

      component.addFolder();

      expect(component.rootFolder.children).toHaveLength(0);
    });

    it('creates a new folder under the current folder', () => {
      const component = createComponent();
      component.newFolderName = 'Contracts';

      component.addFolder();

      expect(component.rootFolder.children.map((c) => c.name)).toContain('Contracts');
      expect(component.showFolderDialog).toBe(false);
    });
  });
});
