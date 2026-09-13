import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { Attachment, FolderNode, ResponseStatus } from '@nexus/core';
import { of, throwError } from 'rxjs';
import { AttachmentsComponent } from './attachments.component';
import { AttachmentService } from '../../core/services/attachment/attachment.service';
import { ModalService } from '../../core/services/modal/modal.service';
import { NotificationService } from '../../core/services/notification/notification.service';

describe('AttachmentsComponent', () => {
  let attachmentServiceMock: {
    getByBusinessPartnerId: ReturnType<typeof vi.fn>;
    getByOrderId: ReturnType<typeof vi.fn>;
    getByPurchaseOrderId: ReturnType<typeof vi.fn>;
    getByTripId: ReturnType<typeof vi.fn>;
    getByTransactionId: ReturnType<typeof vi.fn>;
    getByPaymentId: ReturnType<typeof vi.fn>;
    getByProductId: ReturnType<typeof vi.fn>;
    getByVehicleId: ReturnType<typeof vi.fn>;
    getByDriverId: ReturnType<typeof vi.fn>;
    getByVehicleMaintenanceId: ReturnType<typeof vi.fn>;
    getByUserId: ReturnType<typeof vi.fn>;
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
      getByPurchaseOrderId: vi.fn().mockReturnValue(of({ data: [] })),
      getByTripId: vi.fn().mockReturnValue(of({ data: [] })),
      getByTransactionId: vi.fn().mockReturnValue(of({ data: [] })),
      getByPaymentId: vi.fn().mockReturnValue(of({ data: [] })),
      getByProductId: vi.fn().mockReturnValue(of({ data: [] })),
      getByVehicleId: vi.fn().mockReturnValue(of({ data: [] })),
      getByDriverId: vi.fn().mockReturnValue(of({ data: [] })),
      getByVehicleMaintenanceId: vi.fn().mockReturnValue(of({ data: [] })),
      getByUserId: vi.fn().mockReturnValue(of({ data: [] })),
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

  // getFileIcon()'s `fileName.split('.').pop()?.toLowerCase() ?? ''` fallback, and
  // detect_pathPrefix()'s businessPartner rule `idx >= 0 && parts.length > idx + 1` right-hand
  // check, are both unreachable defensive code: String.split always returns at least one
  // element, so .pop() is never undefined; and the enclosing `att.path.includes('attachments/
  // BusinessPartners/')` guard can only be true when the split has real content after that
  // segment. Left undocumented in production since they're harmless guards, not dead branches
  // worth removing - only noted here as accepted residuals.
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

    it('the "Detalhes" command opens the details dialog', () => {
      const component = createComponent();
      component.selectFile({ id: 'a1', fileName: 'a.pdf' } as Attachment);

      component.contextMenuItems[0].command!({} as any);

      expect(component.showDetailsDialog).toBe(true);
    });

    it('the "Baixar" command downloads the selected file', () => {
      const component = createComponent();
      component.selectFile({ id: 'a1', fileName: 'a.pdf' } as Attachment);
      attachmentServiceMock.downloadFile.mockReturnValue(of(new Blob(['x'])));
      const originalCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');

      component.contextMenuItems[1].command!({} as any);

      expect(attachmentServiceMock.downloadFile).toHaveBeenCalledWith('a1');
      URL.createObjectURL = originalCreateObjectURL;
    });

    it('the "Baixar" command does nothing without a selected file', () => {
      const component = createComponent();
      component.buildContextMenu();

      expect(() => component.contextMenuItems[1].command!({} as any)).not.toThrow();
      expect(attachmentServiceMock.downloadFile).not.toHaveBeenCalled();
    });

    it('the "Remover" command opens the confirmation dialog', () => {
      const component = createComponent();
      component.selectFile({ id: 'a1', fileName: 'a.pdf' } as Attachment);
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.contextMenuItems[2].command!({} as any);

      expect(modalServiceMock.showSweetConfirmation).toHaveBeenCalled();
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

    it('does not clear the selection or reload when the delete reports an error status', async () => {
      const component = createComponent();
      component.selectFile({ id: 'a1', fileName: 'a.pdf' } as Attachment);
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      attachmentServiceMock.delete.mockReturnValue(
        of({ message: 'Falhou', status: ResponseStatus.Error }),
      );

      component.removeFile();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.selectedFile).not.toBeNull();
    });

    it('shows an error notification when the delete request fails', async () => {
      const component = createComponent();
      component.selectFile({ id: 'a1', fileName: 'a.pdf' } as Attachment);
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      attachmentServiceMock.delete.mockReturnValue(throwError(() => new Error('fail')));

      component.removeFile();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'Error',
        'Erro ao remover anexo.',
      );
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

    it('falls back to a generic "download" name when the attachment has none', () => {
      const component = createComponent();
      const blob = new Blob(['content']);
      attachmentServiceMock.downloadFile.mockReturnValue(of(blob));
      let createdAnchor: HTMLAnchorElement | undefined;
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') createdAnchor = el as HTMLAnchorElement;
        return el;
      });

      component.downloadFile({ id: 'a1' } as Attachment);

      expect(createdAnchor!.download).toBe('download');
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

    it('does not duplicate an already-existing folder', () => {
      const component = createComponent();
      component.rootFolder.children.push({
        name: 'Contracts',
        path: 'Contracts',
        children: [],
        files: [],
      });
      component.newFolderName = 'Contracts';

      component.addFolder();

      expect(component.rootFolder.children.filter((c) => c.name === 'Contracts')).toHaveLength(1);
    });

    it('nests the new folder under the current folder path', () => {
      const component = createComponent();
      const sub: FolderNode = { name: 'Sub', path: 'Sub', children: [], files: [] };
      component.rootFolder.children.push(sub);
      component.currentFolder = sub;
      component.newFolderName = 'Nested';

      component.addFolder();

      expect(sub.children.map((c) => c.name)).toContain('Nested');
    });
  });

  describe('loadAttachments (private, via ngOnInit/refresh) - all entity mappings', () => {
    it.each([
      ['order', 'getByOrderId'],
      ['purchaseOrder', 'getByPurchaseOrderId'],
      ['trip', 'getByTripId'],
      ['transaction', 'getByTransactionId'],
      ['payment', 'getByPaymentId'],
      ['product', 'getByProductId'],
      ['vehicle', 'getByVehicleId'],
      ['driver', 'getByDriverId'],
      ['vehicleMaintenance', 'getByVehicleMaintenanceId'],
      ['user', 'getByUserId'],
    ] as const)('fetches via %s -> %s', (entity, method) => {
      const component = createComponent();
      component.entity = entity;
      component.entityId = 'e1';

      component.ngOnInit();

      expect((attachmentServiceMock as any)[method]).toHaveBeenCalledWith('e1');
    });

    it('falls back to an empty attachments array when the response has no data', () => {
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';
      attachmentServiceMock.getByBusinessPartnerId.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.attachments).toEqual([]);
    });

    it('re-navigates to the current folder path after loading', () => {
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';
      attachmentServiceMock.getByBusinessPartnerId.mockReturnValue(
        of({
          data: [
            { id: 'a1', path: 'attachments/BusinessPartners/Cliente/Transactions/x/f.pdf' },
          ] as Attachment[],
        }),
      );
      component.ngOnInit();
      const target = component.rootFolder.children.find((c) => c.name === 'Transactions')!;
      component.currentFolder = target;

      component.refresh();

      expect(component.currentFolder.name).toBe('Transactions');
    });

    it('re-navigates to the current folder path when the reload errors', () => {
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';
      attachmentServiceMock.getByBusinessPartnerId.mockReturnValueOnce(
        of({
          data: [
            { id: 'a1', path: 'attachments/BusinessPartners/Cliente/Transactions/x/f.pdf' },
          ] as Attachment[],
        }),
      );
      component.ngOnInit();
      const target = component.rootFolder.children.find((c) => c.name === 'Transactions')!;
      component.currentFolder = target;
      attachmentServiceMock.getByBusinessPartnerId.mockReturnValueOnce(
        throwError(() => new Error('fail')),
      );

      component.refresh();

      expect(component.isAtRoot()).toBe(true);
    });
  });

  describe('entityIdField / entityFolderKey (private, via addAttachment/detect_pathPrefix)', () => {
    it.each([
      ['businessPartner', 'businessPartnerId'],
      ['order', 'orderId'],
      ['purchaseOrder', 'purchaseOrderId'],
      ['transaction', 'transactionId'],
      ['payment', 'paymentId'],
      ['product', 'productId'],
      ['vehicle', 'vehicleId'],
      ['driver', 'driverId'],
      ['vehicleMaintenance', 'vehicleMaintenanceId'],
      ['user', 'userId'],
    ] as const)('addAttachment tags the payload with %s -> %s', (entity, field) => {
      const component = createComponent();
      component.entity = entity;
      component.entityId = 'e1';
      component.addFile = new File(['x'], 'doc.pdf');
      attachmentServiceMock.add.mockReturnValue(
        of({ message: 'OK', status: ResponseStatus.Success }),
      );

      component.addAttachment();

      expect(attachmentServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ [field]: 'e1' }),
        undefined,
      );
    });

    it('falls back to businessPartnerId for an unmapped entity', () => {
      const component = createComponent();
      component.entity = 'somethingElse';
      component.entityId = 'e1';
      component.addFile = new File(['x'], 'doc.pdf');
      attachmentServiceMock.add.mockReturnValue(
        of({ message: 'OK', status: ResponseStatus.Success }),
      );

      component.addAttachment();

      expect(attachmentServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ businessPartnerId: 'e1' }),
        undefined,
      );
    });

    it('does not reload when the upload response is not a success status', () => {
      const component = createComponent();
      component.addFile = new File(['x'], 'doc.pdf');
      attachmentServiceMock.add.mockReturnValue(
        of({ message: 'Falhou', status: ResponseStatus.Error }),
      );

      component.addAttachment();

      expect(attachmentServiceMock.getByBusinessPartnerId).not.toHaveBeenCalled();
    });

    it('passes the addPath override when set', () => {
      const component = createComponent();
      component.addFile = new File(['x'], 'doc.pdf');
      component.addPath = 'Custom/Path';
      attachmentServiceMock.add.mockReturnValue(
        of({ message: 'OK', status: ResponseStatus.Success }),
      );

      component.addAttachment();

      expect(attachmentServiceMock.add).toHaveBeenCalledWith(expect.anything(), 'Custom/Path');
    });
  });

  describe('getFullPath', () => {
    it('returns the relative path unchanged when there is no prefix', () => {
      const component = createComponent();
      expect(component.getFullPath('Sub/Folder')).toBe('Sub/Folder');
    });

    it('joins the stripped prefix with the relative path', () => {
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';
      attachmentServiceMock.getByBusinessPartnerId.mockReturnValue(
        of({ data: [{ id: 'a1', path: 'attachments/BusinessPartners/Cliente/f.pdf' }] as Attachment[] }),
      );
      component.ngOnInit();

      expect(component.getFullPath('Sub')).toBe('BusinessPartners/Cliente/Sub');
    });

    it('returns just the prefix when the relative path is empty', () => {
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';
      attachmentServiceMock.getByBusinessPartnerId.mockReturnValue(
        of({ data: [{ id: 'a1', path: 'attachments/BusinessPartners/Cliente/f.pdf' }] as Attachment[] }),
      );
      component.ngOnInit();

      expect(component.getFullPath('')).toBe('BusinessPartners/Cliente');
    });

    it('returns the relative path unchanged when the prefix is just "attachments"', () => {
      const component = createComponent();
      (component as any)._pathPrefix = 'attachments';

      expect(component.getFullPath('Sub')).toBe('Sub');
    });
  });

  describe('entityFolderKey / detect_pathPrefix edge branches (private)', () => {
    it('entityFolderKey falls back to an empty string for an unmapped entity', () => {
      const component = createComponent();
      component.entity = 'somethingElse';

      expect((component as any).entityFolderKey).toBe('');
    });

    it('falls through when the purchaseOrder path has no match', () => {
      const component = createComponent();
      component.entity = 'purchaseOrder';
      component.entityId = 'bp1';
      component.purchaseOrderNumber = 'PO-1';
      (component as any).attachments = [
        { id: 'a1', path: 'attachments/PurchaseOrders/OTHER/nota.pdf' },
      ];

      const { prefix } = (component as any).detect_pathPrefix();

      expect(prefix).not.toContain('/PurchaseOrders/PO-1');
    });

    it('falls through when the trip path has no match', () => {
      const component = createComponent();
      component.entity = 'trip';
      component.entityId = 'bp1';
      component.tripNumber = 'TRIP-1';
      (component as any).attachments = [
        { id: 'a1', path: 'attachments/Trips/OTHER/rota.pdf' },
      ];

      const { prefix } = (component as any).detect_pathPrefix();

      expect(prefix).not.toContain('/Trips/TRIP-1');
    });

    it('falls through when the transaction path has no match', () => {
      const component = createComponent();
      component.entity = 'transaction';
      component.entityId = 'tx1';
      (component as any).attachments = [
        { id: 'a1', path: 'attachments/Transactions/other-tx/recibo.pdf' },
      ];

      const { prefix } = (component as any).detect_pathPrefix();

      expect(prefix).not.toContain('/Transactions/tx1');
    });

    it('falls through when the vehicleMaintenance path has no match', () => {
      const component = createComponent();
      component.entity = 'vehicleMaintenance';
      component.entityId = 'vm1';
      (component as any).attachments = [
        { id: 'a1', path: 'attachments/Vehicles/ABC-1234/Maintenances/other-vm/nota.pdf' },
      ];

      const { prefix } = (component as any).detect_pathPrefix();

      expect(prefix).not.toContain('/Maintenances/vm1');
    });

    it('skips generic entityFolderKey detection for an unmapped entity', () => {
      const component = createComponent();
      component.entity = 'somethingElse';
      (component as any).attachments = [{ id: 'a1', path: 'attachments/loose-file.pdf' }];

      const { prefix, rootName } = (component as any).detect_pathPrefix();

      expect(prefix).toBe('');
      expect(rootName).toBe('Anexos');
    });

    it('skips the purchaseOrder-specific rule when purchaseOrderNumber is missing', () => {
      const component = createComponent();
      component.entity = 'purchaseOrder';
      component.entityId = 'bp1';
      component.purchaseOrderNumber = '';
      (component as any).attachments = [
        { id: 'a1', path: 'attachments/BusinessPartners/Fornecedor/PurchaseOrders/PO-1/nota.pdf' },
      ];

      const { prefix } = (component as any).detect_pathPrefix();

      expect(prefix).not.toContain('/PurchaseOrders/PO-1');
    });

    it('skips the trip-specific rule when tripNumber is missing', () => {
      const component = createComponent();
      component.entity = 'trip';
      component.entityId = 'bp1';
      component.tripNumber = '';
      (component as any).attachments = [
        { id: 'a1', path: 'attachments/BusinessPartners/Cliente/Trips/TRIP-1/rota.pdf' },
      ];

      const { prefix } = (component as any).detect_pathPrefix();

      expect(prefix).not.toContain('/Trips/TRIP-1');
    });

    it('skips the transaction-specific rule when entityId is missing', () => {
      const component = createComponent();
      component.entity = 'transaction';
      component.entityId = '';
      (component as any).attachments = [
        { id: 'a1', path: 'attachments/BusinessPartners/Cliente/Transactions/tx1/recibo.pdf' },
      ];

      const { prefix } = (component as any).detect_pathPrefix();

      expect(prefix).not.toContain('/Transactions/tx1');
    });

    it('skips the vehicleMaintenance-specific rule when entityId is missing', () => {
      const component = createComponent();
      component.entity = 'vehicleMaintenance';
      component.entityId = '';
      (component as any).attachments = [
        { id: 'a1', path: 'attachments/Vehicles/ABC-1234/Maintenances/vm1/nota.pdf' },
      ];

      const { prefix } = (component as any).detect_pathPrefix();

      expect(prefix).not.toContain('/Maintenances/vm1');
    });
  });

  describe('openAddDialog', () => {
    it('resets state, computes addPath, and clears the file input asynchronously', () => {
      vi.useFakeTimers();
      const component = createComponent();
      const nativeInput = { value: 'stale.pdf' } as HTMLInputElement;
      component.fileInput = { nativeElement: nativeInput } as ElementRef<HTMLInputElement>;
      component.addFile = new File(['x'], 'previous.pdf');

      component.openAddDialog();
      vi.runAllTimers();

      expect(component.addFile).toBeNull();
      expect(component.showAddDialog).toBe(true);
      expect(nativeInput.value).toBe('');
      expect(cdrMock.markForCheck).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('does not throw when there is no fileInput yet', () => {
      vi.useFakeTimers();
      const component = createComponent();

      component.openAddDialog();
      expect(() => vi.runAllTimers()).not.toThrow();
      vi.useRealTimers();
    });
  });

  describe('onAddFileSelected', () => {
    it('sets addFile from the input event', () => {
      const component = createComponent();
      const file = new File(['x'], 'doc.pdf');
      const input = { files: [file] } as unknown as HTMLInputElement;

      component.onAddFileSelected({ target: input } as unknown as Event);

      expect(component.addFile).toBe(file);
    });

    it('does nothing when there are no files', () => {
      const component = createComponent();
      const input = { files: null } as unknown as HTMLInputElement;

      component.onAddFileSelected({ target: input } as unknown as Event);

      expect(component.addFile).toBeNull();
    });

    it('does nothing when the file list is empty', () => {
      const component = createComponent();
      const input = { files: [] as unknown as FileList } as unknown as HTMLInputElement;

      component.onAddFileSelected({ target: input } as unknown as Event);

      expect(component.addFile).toBeNull();
    });
  });

  describe('openFolderDialog / openDetailsDialog', () => {
    it('resets the new folder name and opens the dialog', () => {
      const component = createComponent();
      component.newFolderName = 'stale';

      component.openFolderDialog();

      expect(component.newFolderName).toBe('');
      expect(component.showFolderDialog).toBe(true);
    });

    it('does nothing without a selected file', () => {
      const component = createComponent();
      component.openDetailsDialog();

      expect(component.showDetailsDialog).toBe(false);
    });

    it('opens the details dialog for a selected file', () => {
      const component = createComponent();
      component.selectFile({ id: 'a1' } as Attachment);

      component.openDetailsDialog();

      expect(component.showDetailsDialog).toBe(true);
    });
  });

  describe('onFileContextMenu', () => {
    it('selects the file and rebuilds the context menu', () => {
      const component = createComponent();
      const file = { id: 'a1' } as Attachment;

      component.onFileContextMenu({} as MouseEvent, file);

      expect(component.selectedFile).toBe(file);
      expect(component.contextMenuItems.every((item) => item.visible === true)).toBe(true);
    });
  });

  describe('drag & drop', () => {
    function dragEvent(overrides: Partial<DragEvent> = {}): DragEvent {
      return {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        ...overrides,
      } as unknown as DragEvent;
    }

    it('onDragOver sets isDraggingOver', () => {
      const component = createComponent();
      const event = dragEvent();

      component.onDragOver(event);

      expect(component.isDraggingOver).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('onDragLeave resets state when leaving the container entirely', () => {
      const component = createComponent();
      component.isDraggingOver = true;
      component.dragOverFolder = { name: 'X', path: 'X', children: [], files: [] };
      const container = { contains: vi.fn().mockReturnValue(false) };
      const event = dragEvent({ currentTarget: container as any, relatedTarget: {} as any });

      component.onDragLeave(event);

      expect(component.isDraggingOver).toBe(false);
      expect(component.dragOverFolder).toBeNull();
    });

    it('onDragLeave keeps state when moving into a child element', () => {
      const component = createComponent();
      component.isDraggingOver = true;
      const container = { contains: vi.fn().mockReturnValue(true) };
      const event = dragEvent({ currentTarget: container as any, relatedTarget: {} as any });

      component.onDragLeave(event);

      expect(component.isDraggingOver).toBe(true);
    });

    it('onFolderDragOver tracks the hovered folder', () => {
      const component = createComponent();
      const folder = { name: 'X', path: 'X', children: [], files: [] };

      component.onFolderDragOver(dragEvent(), folder);

      expect(component.dragOverFolder).toBe(folder);
    });

    it('onFolderDragLeave clears the hovered folder', () => {
      const component = createComponent();
      component.dragOverFolder = { name: 'X', path: 'X', children: [], files: [] };

      component.onFolderDragLeave(dragEvent());

      expect(component.dragOverFolder).toBeNull();
    });

    it('onDropOnFolder uploads the first dropped file to the folder path', () => {
      const component = createComponent();
      component.isDraggingOver = true;
      component.dragOverFolder = { name: 'X', path: 'X', children: [], files: [] };
      const file = new File(['x'], 'dropped.pdf');
      attachmentServiceMock.add.mockReturnValue(
        of({ message: 'OK', status: ResponseStatus.Success }),
      );

      component.onDropOnFolder(
        dragEvent({ dataTransfer: { files: [file] } as unknown as DataTransfer }),
        { name: 'X', path: 'X', children: [], files: [] },
      );

      expect(attachmentServiceMock.add).toHaveBeenCalled();
      expect(component.isDraggingOver).toBe(false);
      expect(component.dragOverFolder).toBeNull();
    });

    it('onDropOnFolder does nothing without dropped files', () => {
      const component = createComponent();

      component.onDropOnFolder(
        dragEvent({ dataTransfer: { files: [] as unknown as FileList } as unknown as DataTransfer }),
        { name: 'X', path: 'X', children: [], files: [] },
      );

      expect(attachmentServiceMock.add).not.toHaveBeenCalled();
    });

    it('onDropOnFolder does nothing when there is no dataTransfer', () => {
      const component = createComponent();

      component.onDropOnFolder(dragEvent(), { name: 'X', path: 'X', children: [], files: [] });

      expect(attachmentServiceMock.add).not.toHaveBeenCalled();
    });

    it('onDropOnContainer uploads to the current folder path', () => {
      const component = createComponent();
      const file = new File(['x'], 'dropped.pdf');
      attachmentServiceMock.add.mockReturnValue(
        of({ message: 'OK', status: ResponseStatus.Success }),
      );

      component.onDropOnContainer(
        dragEvent({ dataTransfer: { files: [file] } as unknown as DataTransfer }),
      );

      expect(attachmentServiceMock.add).toHaveBeenCalled();
    });

    it('does not reload when the dropped upload reports a non-success status', () => {
      const component = createComponent();
      const file = new File(['x'], 'dropped.pdf');
      attachmentServiceMock.add.mockReturnValue(
        of({ message: 'Falhou', status: ResponseStatus.Error }),
      );

      component.onDropOnContainer(
        dragEvent({ dataTransfer: { files: [file] } as unknown as DataTransfer }),
      );

      expect(attachmentServiceMock.getByBusinessPartnerId).not.toHaveBeenCalled();
    });

    it('onDropOnContainer does nothing without dropped files', () => {
      const component = createComponent();

      component.onDropOnContainer(dragEvent());

      expect(attachmentServiceMock.add).not.toHaveBeenCalled();
    });

    it('shows an error notification when the dropped upload fails', () => {
      const component = createComponent();
      const file = new File(['x'], 'dropped.pdf');
      attachmentServiceMock.add.mockReturnValue(throwError(() => new Error('fail')));

      component.onDropOnContainer(
        dragEvent({ dataTransfer: { files: [file] } as unknown as DataTransfer }),
      );

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'Error',
        'Erro ao adicionar anexo.',
      );
    });
  });

  describe('detect_pathPrefix / buildTree (private, via ngOnInit)', () => {
    function load(component: AttachmentsComponent, attachments: Partial<Attachment>[]) {
      attachmentServiceMock.getByBusinessPartnerId.mockReturnValue(of({ data: attachments }));
      attachmentServiceMock.getByOrderId.mockReturnValue(of({ data: attachments }));
      attachmentServiceMock.getByPurchaseOrderId.mockReturnValue(of({ data: attachments }));
      attachmentServiceMock.getByTripId.mockReturnValue(of({ data: attachments }));
      attachmentServiceMock.getByTransactionId.mockReturnValue(of({ data: attachments }));
      attachmentServiceMock.getByVehicleMaintenanceId.mockReturnValue(of({ data: attachments }));
      component.ngOnInit();
    }

    it('detects the Orders prefix for an order entity and nests unrelated files at the root', () => {
      const component = createComponent();
      component.entity = 'order';
      component.entityId = 'bp1';
      component.orderNumber = 'ORD-1';
      load(component, [
        { id: 'a1', path: 'attachments/BusinessPartners/Cliente/Orders/ORD-1/nota.pdf' },
      ]);

      expect(component.rootFolder.files.map((f) => f.id)).toContain('a1');
      expect(component.rootFolder.children).toHaveLength(0);
    });

    it('falls through to generic detection when the order path has no match', () => {
      const component = createComponent();
      component.entity = 'order';
      component.entityId = 'bp1';
      component.orderNumber = 'ORD-1';
      load(component, [{ id: 'a1', path: 'attachments/Orders/OTHER/nota.pdf' }]);

      expect(component.rootFolder.files.map((f) => f.id)).toContain('a1');
    });

    it('detects the PurchaseOrders prefix for a purchaseOrder entity', () => {
      const component = createComponent();
      component.entity = 'purchaseOrder';
      component.entityId = 'bp1';
      component.purchaseOrderNumber = 'PO-1';
      load(component, [
        { id: 'a1', path: 'attachments/BusinessPartners/Fornecedor/PurchaseOrders/PO-1/nota.pdf' },
      ]);

      expect(component.rootFolder.files.map((f) => f.id)).toContain('a1');
    });

    it('detects the Trips prefix for a trip entity', () => {
      const component = createComponent();
      component.entity = 'trip';
      component.entityId = 'bp1';
      component.tripNumber = 'TRIP-1';
      load(component, [
        { id: 'a1', path: 'attachments/BusinessPartners/Cliente/Trips/TRIP-1/rota.pdf' },
      ]);

      expect(component.rootFolder.files.map((f) => f.id)).toContain('a1');
    });

    it('detects the Transactions prefix for a transaction entity', () => {
      const component = createComponent();
      component.entity = 'transaction';
      component.entityId = 'tx1';
      load(component, [
        { id: 'a1', path: 'attachments/BusinessPartners/Cliente/Transactions/tx1/recibo.pdf' },
      ]);

      expect(component.rootFolder.files.map((f) => f.id)).toContain('a1');
    });

    it('detects the Maintenances prefix for a vehicleMaintenance entity', () => {
      const component = createComponent();
      component.entity = 'vehicleMaintenance';
      component.entityId = 'vm1';
      load(component, [
        { id: 'a1', path: 'attachments/Vehicles/ABC-1234/Maintenances/vm1/nota.pdf' },
      ]);

      expect(component.rootFolder.files.map((f) => f.id)).toContain('a1');
    });

    it('detects the BusinessPartners prefix for a businessPartner entity', () => {
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';
      load(component, [
        { id: 'a1', path: 'attachments/BusinessPartners/Cliente/contrato.pdf' },
      ]);

      expect((component as any)._pathPrefix).toBe('attachments/BusinessPartners/Cliente');
    });

    it('falls back to entityFolderKey detection for a generic entity when the id matches', () => {
      const component = createComponent();
      component.entity = 'vehicle';
      component.entityId = 'v1';
      attachmentServiceMock.getByVehicleId.mockReturnValue(
        of({ data: [{ id: 'a1', path: 'attachments/Vehicles/v1/doc.pdf' }] }),
      );

      component.ngOnInit();

      expect(component.rootFolder.files.map((f) => f.id)).toContain('a1');
    });

    it('falls back to the generic relatedEntities scan when nothing else matches', () => {
      const component = createComponent();
      component.entity = 'driver';
      component.entityId = 'other-id';
      attachmentServiceMock.getByDriverId.mockReturnValue(
        of({ data: [{ id: 'a1', path: 'attachments/Drivers/some-other-id/doc.pdf' }] }),
      );

      component.ngOnInit();

      expect(component.rootFolder.name).toBe('Drivers');
    });

    it('defaults to an empty prefix and "Anexos" root when nothing matches at all', () => {
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';
      attachmentServiceMock.getByBusinessPartnerId.mockReturnValue(
        of({ data: [{ id: 'a1', path: 'random/unrelated/doc.pdf' }] }),
      );

      component.ngOnInit();

      expect(component.rootFolder.name).toBe('Anexos');
      expect(component.rootFolder.files.map((f) => f.id)).toContain('a1');
    });

    it('treats a missing attachment path as an empty string when building the tree', () => {
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';
      attachmentServiceMock.getByBusinessPartnerId.mockReturnValue(
        of({ data: [{ id: 'a1' }] }),
      );

      expect(() => component.ngOnInit()).not.toThrow();
      expect(component.rootFolder.files.map((f) => f.id)).toContain('a1');
    });

    it('strips a leading "attachments" segment even without a matched prefix', () => {
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';
      attachmentServiceMock.getByBusinessPartnerId.mockReturnValue(
        of({ data: [{ id: 'a1', path: 'attachments/loose-file.pdf' }] }),
      );

      component.ngOnInit();

      expect(component.rootFolder.files.map((f) => f.id)).toContain('a1');
    });

    it('nests Orders as a related entity outside the order context', () => {
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';
      attachmentServiceMock.getByBusinessPartnerId.mockReturnValue(
        of({
          data: [
            { id: 'a1', path: 'attachments/BusinessPartners/Cliente/Orders/ORD-9/nota.pdf' },
          ],
        }),
      );

      component.ngOnInit();

      const ordersFolder = component.rootFolder.children.find((c) => c.name === 'Orders');
      expect(ordersFolder).toBeTruthy();
    });

    it('reuses an existing child folder instead of creating a duplicate', () => {
      // Each Attachment.path includes the filename as its final segment (the backend combines
      // the containing folder with the sanitized file name into Path - see
      // AttachmentService.cs's `Path.Combine(path, fileName)`), so two attachments only ever
      // share a common *intermediate* folder (here, "Orders" itself) rather than their full
      // path - this is what exercises the "reuse an existing child" branch in buildTree().
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';
      attachmentServiceMock.getByBusinessPartnerId.mockReturnValue(
        of({
          data: [
            { id: 'a1', path: 'attachments/BusinessPartners/Cliente/Orders/ORD-9/nota1.pdf' },
            { id: 'a2', path: 'attachments/BusinessPartners/Cliente/Orders/ORD-10/nota2.pdf' },
          ],
        }),
      );

      component.ngOnInit();

      const ordersFolders = component.rootFolder.children.filter((c) => c.name === 'Orders');
      expect(ordersFolders).toHaveLength(1);
      expect(ordersFolders[0].children.map((c) => c.name)).toEqual(['ORD-9', 'ORD-10']);
    });
  });

  describe('findFolder (private, via navigateToPath)', () => {
    it('navigates into a nested folder built from the tree', () => {
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';
      attachmentServiceMock.getByBusinessPartnerId.mockReturnValue(
        of({
          data: [
            { id: 'a1', path: 'attachments/BusinessPartners/Cliente/Orders/ORD-1/nota.pdf' },
          ],
        }),
      );
      component.ngOnInit();

      component.navigateToPath('Orders/ORD-1');

      expect(component.currentFolder.name).toBe('ORD-1');
      expect(component.breadcrumbs.map((b) => b.label)).toEqual(['Anexos', 'Orders', 'ORD-1']);
    });

    it('navigateUp moves back to the parent folder', () => {
      const component = createComponent();
      component.entity = 'businessPartner';
      component.entityId = 'bp1';
      attachmentServiceMock.getByBusinessPartnerId.mockReturnValue(
        of({
          data: [
            { id: 'a1', path: 'attachments/BusinessPartners/Cliente/Orders/ORD-1/nota.pdf' },
          ],
        }),
      );
      component.ngOnInit();
      component.navigateToPath('Orders/ORD-1');

      component.navigateUp();

      expect(component.currentFolder.name).toBe('Orders');
    });
  });
});
