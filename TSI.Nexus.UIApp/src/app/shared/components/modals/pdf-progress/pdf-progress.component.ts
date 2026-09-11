import { ChangeDetectionStrategy, Component, Inject, OnDestroy } from '@angular/core';
import { NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslationService } from '@nexus/core';
import { LoadingSpinnerComponent } from '../../loading-spinner/loading-spinner.component';

export interface PdfProgressFile {
  url: string;
  name: string;
}

type PdfProgressState = 'progress' | 'indeterminate' | 'success' | 'error';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-pdf-progress',
  templateUrl: './pdf-progress.component.html',
  styleUrl: './pdf-progress.component.scss',
  imports: [NgIf, NgSwitch, NgSwitchCase, LoadingSpinnerComponent],
})
export class PdfProgressComponent implements OnDestroy {
  state: PdfProgressState = 'indeterminate';
  title: string;
  percent = 0;
  label = '';
  message = '';
  file: PdfProgressFile | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) data: { title: string },
    public dialogRef: MatDialogRef<PdfProgressComponent>,
    private translationService: TranslationService,
  ) {
    this.title = data.title;
  }

  setProgress(current: number, total: number): void {
    this.state = 'progress';
    this.percent = total > 0 ? Math.min(100, Math.max(0, Math.round((current / total) * 100))) : 0;
    this.label = this.translationService.instant('PDF_EXPORT.PAGE_PROGRESS', {
      current: String(current),
      total: String(total),
    });
  }

  setIndeterminate(): void {
    this.state = 'indeterminate';
  }

  // Only success ever carries a file - a failed generation has nothing to open, so the link/icon
  // simply doesn't render (see the template's *ngIf="file").
  success(message: string, file?: PdfProgressFile): void {
    this.state = 'success';
    this.message = message;
    this.file = file ?? null;
    this.dialogRef.disableClose = false;
  }

  error(message: string): void {
    this.state = 'error';
    this.message = message;
    this.dialogRef.disableClose = false;
  }

  openFile(): void {
    if (this.file) {
      window.open(this.file.url, '_blank');
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  // The blob URL behind `file` is created by the caller and kept alive (not revoked on download,
  // unlike the plain downloadBlob() helper) specifically so this "open file" link keeps working
  // for as long as the modal is on screen - it only gets released once the modal itself goes away.
  ngOnDestroy(): void {
    if (this.file) {
      window.URL.revokeObjectURL(this.file.url);
    }
  }
}
