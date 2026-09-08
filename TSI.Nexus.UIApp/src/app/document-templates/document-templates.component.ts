import { Component, OnInit } from '@angular/core';
import {
  DocumentTemplate,
  DocumentTemplateService,
  DocumentTemplateType,
  NotificationService,
  ResponseStatus,
  TranslationService,
  downloadBlob,
} from '@nexus/core';
import { finalize } from 'rxjs/operators';
import { HeaderComponent } from '../shared/header/header.component';
import { NgIf, NgFor } from '@angular/common';
import { TranslatePipe } from '../core/pipes/translate.pipe';

@Component({
    selector: 'app-document-templates',
    templateUrl: './document-templates.component.html',
    styleUrl: './document-templates.component.scss',
    imports: [
        HeaderComponent,
        NgIf,
        NgFor,
        TranslatePipe,
    ],
})
export class DocumentTemplatesComponent implements OnInit {
  templates: DocumentTemplate[] = [];
  loading = false;
  uploadingType: DocumentTemplateType | null = null;

  constructor(
    private documentTemplateService: DocumentTemplateService,
    private notificationService: NotificationService,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  download(template: DocumentTemplate): void {
    if (!template.type) {
      return;
    }
    this.documentTemplateService.download(template.type).subscribe((blob) => {
      const fallbackExtension = this.isImageType(template.type) ? 'jpg' : 'docx';
      downloadBlob(blob, template.fileName || `${template.type}.${fallbackExtension}`);
    });
  }

  triggerUpload(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  // Every DocumentTemplateType is a .docx template except Letterhead, the JPG background artwork
  // drawn behind every page - used to pick the right file-picker filter and download extension.
  isImageType(type: DocumentTemplateType | undefined): boolean {
    return type === DocumentTemplateType.Letterhead;
  }

  onFileSelected(event: Event, template: DocumentTemplate): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';

    if (!file || !template.type) {
      return;
    }

    this.uploadingType = template.type;
    this.documentTemplateService
      .upload(template.type, file)
      .pipe(finalize(() => (this.uploadingType = null)))
      .subscribe({
        next: (response) => {
          if (response.status === ResponseStatus.Success && response.data) {
            template.fileName = response.data.fileName;
          }
          this.notificationService.showMessage(
            response.status,
            response.message,
          );
        },
        error: () => {
          this.notificationService.showMessage(
            'Error',
            this.translationService.instant('DOCUMENT_TEMPLATES.UPDATE_ERROR'),
          );
        },
      });
  }

  private load(): void {
    this.loading = true;
    this.documentTemplateService.getAll().subscribe({
      next: (response) => {
        this.templates = response.data ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
