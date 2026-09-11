import { Observable } from 'rxjs';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  Attachment,
  AttachmentService,
  ModalService,
  PhotoService,
  TranslationService,
} from '@nexus/core';
import { NgIf } from '@angular/common';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { CameraCaptureModalComponent } from './camera-capture-modal/camera-capture-modal.component';
import { ImageCropModalComponent } from './image-crop-modal/image-crop-modal.component';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-photo',
    templateUrl: './photo.component.html',
    styleUrls: ['./photo.component.scss'],
    imports: [NgIf, TranslatePipe],
})
export class PhotoComponent implements OnInit, OnDestroy, OnChanges {
  @Input()
  data: any;

  @Input()
  imageUrl?: string | null = null;

  @Input()
  entityClass: string = '';

  @Input()
  canDisplaySubtitle: boolean = true;

  @ViewChild('fileInput')
  fileInput!: ElementRef<HTMLInputElement>;

  private lastObjectUrl?: string;

  constructor(
    private cd: ChangeDetectorRef,
    private modalService: ModalService,
    private attachmentService: AttachmentService,
    private photoService: PhotoService,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.loadPhoto();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['imageUrl'] && this.data && this.data.photo) {
      this.loadPhoto();
    }
  }

  ngOnDestroy(): void {
    this.revokeLastObjectUrl();
  }

  loadPhoto(): void {
    if (this.data && this.data.photo && this.entityClass && this.data.id) {
      this.imageUrl = this.getNoImage();
      this.photoService
        .getPhoto(this.entityClass, this.data.id, this.data.photo)
        .subscribe({
          next: (blob) => {
            this.revokeLastObjectUrl();
            const url = URL.createObjectURL(blob);
            this.lastObjectUrl = url;
            this.imageUrl = url;
            this.cd.detectChanges();
          },
          error: () => {
            this.imageUrl = this.getNoImage();
          },
        });
      return;
    }
    this.imageUrl = this.getNoImage();
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = this.getNoImage();
  }

  triggerFile(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    this.openCropModal(file);
  }

  openCamera(): void {
    const dialogRef = this.modalService.showTemplateModal(
      CameraCaptureModalComponent,
      { width: '560px' },
    );
    dialogRef.afterClosed().subscribe((file?: File) => {
      if (file) {
        this.openCropModal(file);
      }
    });
  }

  removePhotoConfirm(): void {
    if (!this.data?.id || !this.entityClass) return;

    this.modalService
      .showSweetConfirmation(
        this.translationService.instant('PHOTO.REMOVE_CONFIRM_TITLE'),
        this.translationService.instant('PHOTO.REMOVE_CONFIRM_TEXT'),
        'warning',
      )
      .then((result: any) => {
        if (result.isConfirmed) {
          this.performRemove();
        }
      });
  }

  private openCropModal(source: File): void {
    const dialogRef = this.modalService.showTemplateModal(
      ImageCropModalComponent,
      { source, width: '560px' },
    );
    dialogRef.afterClosed().subscribe((croppedBlob?: Blob) => {
      if (croppedBlob) {
        this.uploadCroppedPhoto(croppedBlob);
      }
    });
  }

  private uploadCroppedPhoto(blob: Blob): void {
    if (!this.data?.id || !this.entityClass) return;

    const file = new File([blob], `${this.data.id}.png`, {
      type: blob.type || 'image/png',
    });

    // 1) Anexa o arquivo primeiro
    this.addPhotoAsAttachment(file, () => {
      // 2) Depois atualiza o atributo photo na entidade
      this.photoService
        .uploadPhoto(this.entityClass, this.data.id, file)
        .subscribe({
          next: (uploadRes) => {
            const photoPath = uploadRes?.fileName ?? uploadRes?.path ?? '';
            this.data.photo = photoPath;
            this.loadPhoto();

            this.modalService.showSweetNotification(
              'Foto atualizada',
              'Upload realizado com sucesso!',
              'success',
            );

            if (this.entityClass === 'Users') {
              this.photoService.updateUserPhoto(photoPath, this.data.id);
            }
          },
          error: () => {
            this.modalService.showSweetNotification(
              '',
              'Erro ao salvar foto.',
              'error',
            );
          },
        });
    });
  }

  private performRemove(): void {
    // Remove o anexo correspondente
    this.deletePhotoAttachment();

    // Limpa o campo photo na entidade
    this.photoService.removePhoto(this.entityClass, this.data.id).subscribe({
      next: () => {
        this.data.photo = '';
        this.imageUrl = this.getNoImage();

        this.modalService.showSweetNotification(
          'Foto removida',
          'Foto removida com sucesso!',
          'success',
        );

        if (this.entityClass === 'Users') {
          this.photoService.updateUserPhoto('', this.data.id);
        }
      },
      error: () => {
        this.modalService.showSweetNotification(
          '',
          'Erro ao remover foto.',
          'error',
        );
      },
    });
  }

  private addPhotoAsAttachment(file: File, onSuccess?: () => void): void {
    const entityIdField = this.getEntityIdField();
    const attachment: Partial<Attachment> = {
      file,
      [entityIdField]: this.data.id,
    };
    const overridePath = `photos/${this.entityClass}`;
    this.attachmentService
      .add(attachment as Attachment, overridePath)
      .subscribe({
        next: () => onSuccess?.(),
        error: () => onSuccess?.(),
      });
  }

  private deletePhotoAttachment(): void {
    if (!this.data?.photo || !this.data?.id) return;

    const photoFileName = this.data.photo;
    const entityIdField = this.getEntityIdField();
    const entityMap: Record<string, (id: string) => Observable<any>> = {
      userId: (id) => this.attachmentService.getByUserId(id),
      businessPartnerId: (id) =>
        this.attachmentService.getByBusinessPartnerId(id),
      productId: (id) => this.attachmentService.getByProductId(id),
      orderId: (id) => this.attachmentService.getByOrderId(id),
      transactionId: (id) => this.attachmentService.getByTransactionId(id),
      paymentId: (id) => this.attachmentService.getByPaymentId(id),
      vehicleId: (id) => this.attachmentService.getByVehicleId(id),
      driverId: (id) => this.attachmentService.getByDriverId(id),
    };

    const fetchFn = entityMap[entityIdField];
    if (!fetchFn) return;

    fetchFn(this.data.id).subscribe({
      next: (res: any) => {
        const attachments: Attachment[] = res?.data ?? [];
        const match = attachments.find((a) => a.fileName === photoFileName);
        if (match) {
          this.attachmentService.delete(match.id).subscribe();
        }
      },
    });
  }

  private getEntityIdField(): string {
    const map: Record<string, string> = {
      Users: 'userId',
      BusinessPartners: 'businessPartnerId',
      Products: 'productId',
      Orders: 'orderId',
      Transactions: 'transactionId',
      Payments: 'paymentId',
      Vehicles: 'vehicleId',
      Drivers: 'driverId',
    };
    return map[this.entityClass] ?? 'userId';
  }

  private revokeLastObjectUrl(): void {
    if (this.lastObjectUrl) {
      try {
        URL.revokeObjectURL(this.lastObjectUrl);
      } catch {}
      this.lastObjectUrl = undefined;
    }
  }

  // 'Users' is the entityClass value actually passed in (see getEntityIdField's map) - a person
  // gets the person silhouette, every other entity (a BusinessPartner may be a company, not a
  // person) gets a neutral generic-photo glyph instead.
  private getNoImage(): string {
    return this.entityClass == 'Users'
      ? 'assets/img/no_profile.png'
      : 'assets/img/no_photo_generic.svg';
  }
}
