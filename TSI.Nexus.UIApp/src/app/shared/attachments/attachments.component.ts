import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MenuItem } from 'primeng/api';
import {
  Attachment,
  BreadcrumbItem,
  FolderNode,
  ResponseStatus,
} from '@nexus/core';
import { AttachmentService } from '../../core/services/attachment/attachment.service';
import { ModalService } from '../../core/services/modal/modal.service';
import { NotificationService } from '../../core/services/notification/notification.service';
import { NgIf, NgFor } from '@angular/common';
import { Bind } from 'primeng/bind';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { ContextMenu } from 'primeng/contextmenu';
import { Dialog } from 'primeng/dialog';
import { AttachmentDetailsModalComponent } from './components/attachment-details-modal/attachment-details-modal.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
    selector: 'app-attachments',
    templateUrl: './attachments.component.html',
    styleUrl: './attachments.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgIf,
        Bind,
        Button,
        Tooltip,
        NgFor,
        ContextMenu,
        Dialog,
        AttachmentDetailsModalComponent,
        ReactiveFormsModule,
        InputText,
        FormsModule,
        TranslatePipe,
    ],
})
export class AttachmentsComponent implements OnInit {
  @Input()
  orderNumber = '';
  @Input()
  purchaseOrderNumber = '';
  @Input()
  tripNumber = '';
  @Input()
  vehiclePlate = '';
  @Input()
  driverName = '';
  @Input()
  entity = 'businessPartner';

  @Input()
  entityId = '';

  @ViewChild('fileInput')
  fileInput!: ElementRef<HTMLInputElement>;

  attachments: Attachment[] = [];
  rootFolder: FolderNode = {
    name: 'Anexos',
    path: '',
    children: [],
    files: [],
  };
  currentFolder: FolderNode = this.rootFolder;
  breadcrumbs: BreadcrumbItem[] = [];
  loading = false;

  selectedFile: Attachment | null = null;
  contextMenuItems: MenuItem[] = [];
  showDetailsDialog = false;
  viewMode: 'list' | 'grid' = 'list';

  // --- Add attachment dialog ---
  showAddDialog = false;
  addFile: File | null = null;
  addPath = '';

  // --- Add folder dialog ---
  showFolderDialog = false;
  newFolderName = '';

  // --- Drag & Drop ---
  isDraggingOver = false;
  dragOverFolder: FolderNode | null = null;

  private _pathPrefix = '';

  constructor(
    private attachmentService: AttachmentService,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadAttachments();
  }

  refresh(): void {
    this.loadAttachments();
  }

  // ─── Navigation ─────────────────────────────────────────

  navigateToPath(path: string): void {
    this.currentFolder = this.findFolder(path);
    this.selectedFile = null;
    this.buildBreadcrumbs();
    this.buildContextMenu();
  }

  navigateUp(): void {
    const parts = this.currentFolder.path.split('/').filter(Boolean);
    parts.pop();
    this.navigateToPath(parts.join('/'));
  }

  isAtRoot(): boolean {
    return this.currentFolder === this.rootFolder;
  }

  // ─── Selection & Context Menu ───────────────────────────

  selectFile(file: Attachment): void {
    this.selectedFile = file;
    this.buildContextMenu();
  }

  onFileContextMenu(event: MouseEvent, file: Attachment): void {
    this.selectedFile = file;
    this.buildContextMenu();
  }

  buildContextMenu(): void {
    this.contextMenuItems = [
      {
        label: 'Detalhes',
        icon: 'pi pi-info-circle',
        command: () => this.openDetailsDialog(),
        visible: !!this.selectedFile,
      },
      {
        label: 'Baixar',
        icon: 'pi pi-download',
        command: () => {
          if (this.selectedFile) this.downloadFile(this.selectedFile);
        },
        visible: !!this.selectedFile,
      },
      {
        label: 'Remover',
        icon: 'pi pi-trash',
        styleClass: 'text-danger',
        command: () => this.removeFile(),
        visible: !!this.selectedFile,
      },
    ];
  }

  openDetailsDialog(): void {
    if (!this.selectedFile) return;
    this.showDetailsDialog = true;
  }

  /** Reconstrói o path completo a partir do path relativo da árvore, sem o segmento 'attachments/' (o backend adiciona automaticamente). */
  getFullPath(relativePath: string): string {
    if (!this._pathPrefix) return relativePath;
    // Remove o primeiro segmento 'attachments/' do prefix, pois o backend já o adiciona
    const prefixWithoutRoot = this._pathPrefix.replace(/^attachments\/?/, '');
    if (!prefixWithoutRoot) return relativePath;
    return relativePath
      ? `${prefixWithoutRoot}/${relativePath}`
      : prefixWithoutRoot;
  }

  openAddDialog(): void {
    this.addFile = null;
    this.addPath = this.getFullPath(this.currentFolder.path);
    this.showAddDialog = true;
    setTimeout(() => {
      if (this.fileInput) this.fileInput.nativeElement.value = '';
      this.cdr.markForCheck();
    });
  }

  onAddFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.addFile = input.files[0];
    }
  }

  addAttachment(): void {
    if (!this.addFile) return;

    const attachment: Partial<Attachment> = {
      file: this.addFile,
      [this.entityIdField]: this.entityId,
    };

    this.attachmentService
      .add(attachment as Attachment, this.addPath || undefined)
      .subscribe({
        next: (res) => {
          this.showAddDialog = false;
          this.modalService.showSweetNotification('', res.message, res.status);
          if (res.status === ResponseStatus.Success) {
            this.loadAttachments();
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.notificationService.showMessage(
            'Error',
            'Erro ao adicionar anexo.',
          );
        },
      });
  }

  openFolderDialog(): void {
    this.newFolderName = '';
    this.showFolderDialog = true;
  }

  addFolder(): void {
    if (!this.newFolderName.trim()) return;
    const folderPath = this.currentFolder.path
      ? `${this.currentFolder.path}/${this.newFolderName.trim()}`
      : this.newFolderName.trim();

    let folder = this.findFolder(folderPath);
    if (folder === this.rootFolder && folderPath) {
      // Folder doesn't exist yet — create it in the tree
      const newFolder: FolderNode = {
        name: this.newFolderName.trim(),
        path: folderPath,
        children: [],
        files: [],
      };
      // In-place push (not reassignment) is intentional here: this is triggered directly by this
      // component's own template click/enter binding, so OnPush already marks the view dirty and
      // NgForOf's differ picks up the appended item on the next check regardless of array
      // reference. Reassigning currentFolder would also break isAtRoot()'s === check against
      // rootFolder when adding a folder at the root.
      this.currentFolder.children.push(newFolder);
    }
    this.showFolderDialog = false;
  }

  removeFile(): void {
    if (!this.selectedFile) return;

    this.modalService
      .showSweetConfirmation(
        '',
        'Deseja realmente excluir este anexo?',
        'question',
      )
      .then((result) => {
        if (result.isConfirmed && this.selectedFile) {
          this.attachmentService.delete(this.selectedFile.id).subscribe({
            next: (res) => {
              this.modalService.showSweetNotification(
                '',
                res.message,
                res.status,
              );
              if (res.status === ResponseStatus.Success) {
                this.selectedFile = null;
                this.loadAttachments();
              }
              this.cdr.markForCheck();
            },
            error: () => {
              this.notificationService.showMessage(
                'Error',
                'Erro ao remover anexo.',
              );
            },
          });
        }
      });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    // Only reset if leaving the container (not entering a child)
    const relatedTarget = event.relatedTarget as HTMLElement;
    const container = event.currentTarget as HTMLElement;
    if (!container.contains(relatedTarget)) {
      this.isDraggingOver = false;
      this.dragOverFolder = null;
    }
  }

  onFolderDragOver(event: DragEvent, folder: FolderNode): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverFolder = folder;
  }

  onFolderDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverFolder = null;
  }

  onDropOnFolder(event: DragEvent, folder: FolderNode): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver = false;
    this.dragOverFolder = null;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const targetPath = this.getFullPath(folder.path);
      this.uploadDroppedFile(files[0], targetPath);
    }
  }

  onDropOnContainer(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver = false;
    this.dragOverFolder = null;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const targetPath = this.getFullPath(this.currentFolder.path);
      this.uploadDroppedFile(files[0], targetPath);
    }
  }

  downloadFile(file: Attachment): void {
    this.attachmentService.downloadFile(file.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.fileName || 'download';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.notificationService.showMessage(
          'Error',
          'Erro ao baixar arquivo.',
        );
      },
    });
  }

  getFileIcon(fileName?: string): string {
    if (!fileName) return 'pi pi-file';
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext))
      return 'pi pi-image';
    if (ext === 'pdf') return 'pi pi-file-pdf';
    if (['doc', 'docx'].includes(ext)) return 'pi pi-file-word';
    if (['xls', 'xlsx'].includes(ext)) return 'pi pi-file-excel';
    return 'pi pi-file';
  }

  private get entityIdField(): string {
    const map: Record<string, string> = {
      businessPartner: 'businessPartnerId',
      order: 'orderId',
      purchaseOrder: 'purchaseOrderId',
      transaction: 'transactionId',
      payment: 'paymentId',
      product: 'productId',
      vehicle: 'vehicleId',
      driver: 'driverId',
      vehicleMaintenance: 'vehicleMaintenanceId',
      user: 'userId',
    };
    return map[this.entity] ?? 'businessPartnerId';
  }

  private buildBreadcrumbs(): void {
    this.breadcrumbs = [{ label: 'Anexos', path: '' }];
    const parts = this.currentFolder.path.split('/').filter(Boolean);
    let accumulated = '';
    for (const part of parts) {
      accumulated = accumulated ? `${accumulated}/${part}` : part;
      this.breadcrumbs.push({ label: part, path: accumulated });
    }
  }

  private uploadDroppedFile(file: File, overridePath: string): void {
    const attachment: Partial<Attachment> = {
      file,
      [this.entityIdField]: this.entityId,
    };

    this.attachmentService
      .add(attachment as Attachment, overridePath || undefined)
      .subscribe({
        next: (res) => {
          this.modalService.showSweetNotification('', res.message, res.status);
          if (res.status === ResponseStatus.Success) {
            this.loadAttachments();
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.notificationService.showMessage(
            'Error',
            'Erro ao adicionar anexo.',
          );
        },
      });
  }

  private loadAttachments(): void {
    if (!this.entityId) {
      return;
    }
    this.loading = true;

    const entityMap: Record<
      string,
      (id: string) => ReturnType<AttachmentService['getByBusinessPartnerId']>
    > = {
      businessPartner: (id) =>
        this.attachmentService.getByBusinessPartnerId(id),
      order: (id) => this.attachmentService.getByOrderId(id),
      purchaseOrder: (id) => this.attachmentService.getByPurchaseOrderId(id),
      trip: (id) => this.attachmentService.getByTripId(id),
      transaction: (id) => this.attachmentService.getByTransactionId(id),
      payment: (id) => this.attachmentService.getByPaymentId(id),
      product: (id) => this.attachmentService.getByProductId(id),
      vehicle: (id) => this.attachmentService.getByVehicleId(id),
      driver: (id) => this.attachmentService.getByDriverId(id),
      vehicleMaintenance: (id) =>
        this.attachmentService.getByVehicleMaintenanceId(id),
      user: (id) => this.attachmentService.getByUserId(id),
    };

    const fetchFn = entityMap[this.entity];
    if (!fetchFn) {
      this.loading = false;
      return;
    }

    const currentPath = this.currentFolder.path;

    fetchFn(this.entityId).subscribe({
      next: (res) => {
        this.attachments = res.data ?? [];
        this.buildTree();
        this.navigateToPath(currentPath);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.attachments = [];
        this.buildTree();
        this.navigateToPath(currentPath);
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  // ─── Tree Building ──────────────────────────────────────

  /**
   * Mapeia a entidade para o nome da pasta correspondente no backend.
   * Ex: businessPartner → 'BusinessPartners', order → 'Orders'
   */
  private get entityFolderKey(): string {
    const map: Record<string, string> = {
      businessPartner: 'BusinessPartners',
      order: 'Orders',
      purchaseOrder: 'PurchaseOrders',
      trip: 'Trips',
      transaction: 'Transactions',
      payment: 'Payments',
      product: 'Products',
      vehicle: 'Vehicles',
      driver: 'Drivers',
      vehicleMaintenance: 'Maintenances',
      user: 'Users',
    };
    return map[this.entity] ?? '';
  }

  /**
   * Detecta o prefixo estrutural do path usando a pasta da entidade como âncora.
   * Ex: entity='order' → encontra 'Orders' no path e tira tudo até 'Orders/{OrderNumber}'.
   * Resultado: a raiz da árvore começa no contexto da entidade acessada.
   */
  private detect_pathPrefix(): { prefix: string; rootName: string } {
    // Lista de possíveis entidades para cortar o prefixo
    const entityFolders = [
      'BusinessPartners',
      'Orders',
      'PurchaseOrders',
      'Trips',
      'Transactions',
      'Payments',
      'Products',
      'Vehicles',
      'Drivers',
      'Maintenances',
      'Users',
    ];

    // Para pedido, corta até attachments/BusinessPartners/{NomeCliente}/Orders/{OrderNumber}
    if (this.entity === 'order' && this.orderNumber && this.entityId) {
      // entityId = BusinessPartnerId, orderNumber = OrderNumber
      // Busca um path que contenha Orders/{orderNumber}
      for (const att of this.attachments) {
        if (att.path && att.path.includes(`/Orders/${this.orderNumber}/`)) {
          const prefix =
            att.path.split(`/Orders/${this.orderNumber}`)[0] +
            `/Orders/${this.orderNumber}`;
          return { prefix, rootName: 'Anexos' };
        }
      }
    }
    // Para pedido de compra, corta até attachments/BusinessPartners/{NomeFornecedor}/PurchaseOrders/{PurchaseOrderNumber}
    if (
      this.entity === 'purchaseOrder' &&
      this.purchaseOrderNumber &&
      this.entityId
    ) {
      for (const att of this.attachments) {
        if (
          att.path &&
          att.path.includes(`/PurchaseOrders/${this.purchaseOrderNumber}/`)
        ) {
          const prefix =
            att.path.split(`/PurchaseOrders/${this.purchaseOrderNumber}`)[0] +
            `/PurchaseOrders/${this.purchaseOrderNumber}`;
          return { prefix, rootName: 'Anexos' };
        }
      }
    }
    // Para viagem, corta até attachments/BusinessPartners/{NomeCliente}/Trips/{TripNumber}
    if (this.entity === 'trip' && this.tripNumber && this.entityId) {
      for (const att of this.attachments) {
        if (att.path && att.path.includes(`/Trips/${this.tripNumber}/`)) {
          const prefix =
            att.path.split(`/Trips/${this.tripNumber}`)[0] +
            `/Trips/${this.tripNumber}`;
          return { prefix, rootName: 'Anexos' };
        }
      }
    }
    // Para transação, corta até attachments/BusinessPartners/{NomeCliente}/Transactions/{TransactionId}
    if (this.entity === 'transaction' && this.entityId) {
      for (const att of this.attachments) {
        if (att.path && att.path.includes(`/Transactions/${this.entityId}/`)) {
          const prefix =
            att.path.split(`/Transactions/${this.entityId}`)[0] +
            `/Transactions/${this.entityId}`;
          return { prefix, rootName: 'Anexos' };
        }
      }
    }
    // Para manutenção, corta até attachments/Vehicles/{Placa}/Maintenances/{VehicleMaintenanceId}
    if (this.entity === 'vehicleMaintenance' && this.entityId) {
      for (const att of this.attachments) {
        if (att.path && att.path.includes(`/Maintenances/${this.entityId}/`)) {
          const prefix =
            att.path.split(`/Maintenances/${this.entityId}`)[0] +
            `/Maintenances/${this.entityId}`;
          return { prefix, rootName: 'Anexos' };
        }
      }
    }
    // Para cliente, corta até attachments/BusinessPartners/{NomeCliente}
    if (this.entity === 'businessPartner' && this.entityId) {
      for (const att of this.attachments) {
        if (att.path && att.path.includes('attachments/BusinessPartners/')) {
          // Pega até o nome do cliente
          const parts = att.path.split('/');
          const idx = parts.indexOf('BusinessPartners');
          if (idx >= 0 && parts.length > idx + 1) {
            const prefix = parts.slice(0, idx + 2).join('/');
            return { prefix, rootName: 'Anexos' };
          }
        }
      }
    }
    // Para outras entidades, mantém lógica anterior
    const folderKey = this.entityFolderKey;
    if (folderKey) {
      for (const att of this.attachments) {
        if (att.path) {
          const parts = att.path.split('/').filter(Boolean);
          const keyIndex = parts.findIndex((p) => p === folderKey);
          if (keyIndex >= 0 && keyIndex + 1 < parts.length) {
            if (this.entityId && parts[keyIndex + 1] === this.entityId) {
              return {
                prefix: parts.slice(0, keyIndex + 2).join('/'),
                rootName: 'Anexos',
              };
            }
          }
        }
      }
    }
    // Senão, mantém lógica anterior para entidades relacionadas
    for (const att of this.attachments) {
      if (att.path) {
        const parts = att.path.split('/').filter(Boolean);
        const keyIndex = parts.findIndex((p) => entityFolders.includes(p));
        if (keyIndex >= 0 && keyIndex + 1 < parts.length) {
          return {
            prefix: parts.slice(0, keyIndex + 2).join('/'),
            rootName: parts[keyIndex],
          };
        }
      }
    }
    return { prefix: '', rootName: 'Anexos' };
  }

  private buildTree(): void {
    const { prefix, rootName } = this.detect_pathPrefix();
    this._pathPrefix = prefix;
    this.rootFolder = { name: rootName, path: '', children: [], files: [] };

    for (const att of this.attachments) {
      const rawPath = att.path ?? '';
      // Remove prefix
      const stripped =
        prefix && rawPath.startsWith(prefix)
          ? rawPath.slice(prefix.length).replace(/^\//, '')
          : rawPath;
      let parts = stripped.split('/').filter(Boolean);

      // Se o primeiro segmento for 'attachments', ignora
      if (parts[0] === 'attachments') {
        parts = parts.slice(1);
      }

      // Se não há partes, é arquivo da entidade principal, vai direto na raiz
      if (parts.length === 0) {
        this.rootFolder.files.push(att);
        continue;
      }

      // Só cria pasta se o segmento for entidade relacionada conhecida
      let relatedEntities = [
        'BusinessPartners',
        'Transactions',
        'Payments',
        'Products',
        'Users',
      ];
      // Orders só é relatedEntity fora do contexto de pedido
      if (this.entity !== 'order') {
        relatedEntities.push('Orders');
      }
      // PurchaseOrders só é relatedEntity fora do contexto de pedido de compra
      if (this.entity !== 'purchaseOrder') {
        relatedEntities.push('PurchaseOrders');
      }
      if (relatedEntities.includes(parts[0])) {
        let current = this.rootFolder;
        for (const part of parts) {
          const childPath = current.path ? `${current.path}/${part}` : part;
          let child = current.children.find((c) => c.name === part);
          if (!child) {
            child = { name: part, path: childPath, children: [], files: [] };
            current.children.push(child);
          }
          current = child;
        }
        current.files.push(att);
        continue;
      }
      // Se não for entidade relacionada, ou for 'Orders' no contexto de pedido, joga arquivo na raiz
      this.rootFolder.files.push(att);
    }
  }

  private findFolder(path: string): FolderNode {
    if (!path) return this.rootFolder;
    const parts = path.split('/').filter(Boolean);
    let current = this.rootFolder;
    for (const part of parts) {
      const child = current.children.find((c) => c.name === part);
      if (!child) return this.rootFolder;
      current = child;
    }
    return current;
  }
}
