import { Injectable, TemplateRef, Type, Inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import Swal from 'sweetalert2';
import { NotificationComponent } from '../../../shared/components/modals/notification/notification.component';
import { ConfirmationComponent } from '../../../shared/components/modals/confirmation/confirmation.component';
import { PdfProgressComponent, PdfProgressFile } from '../../../shared/components/modals/pdf-progress/pdf-progress.component';
import { TranslationService } from '../translation/translation.service';

// Handle returned by ModalService.showPdfProgress() - lets the caller drive the same open modal
// through its lifecycle (progress updates, then a single terminal success/error state) without
// reaching back into PdfProgressComponent's MatDialogRef directly.
export interface PdfProgressHandle {
  setProgress(current: number, total: number): void;
  setIndeterminate(): void;
  success(message: string, file?: PdfProgressFile): void;
  error(message: string): void;
}

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  // Removido suporte a ngx-bootstrap/modal
  constructor(
    private dialog: MatDialog,
    private translationService: TranslationService,
  ) {}

  showTemplateModal<T>(
    componentOrTemplate: TemplateRef<T> | Type<T>,
    data?: any,
  ): MatDialogRef<any> {
    // Garante que id seja incluído em data
    const dialogData = { ...data };
    if (data?.id !== undefined) {
      dialogData.id = data.id;
    }
    if (data?.parentId !== undefined) {
      dialogData.parentId = data.parentId;
    }
    return this.dialog.open(componentOrTemplate as any, {
      data: dialogData,
      width: data?.width || '760px',
      disableClose: !!data?.disableClose,
      panelClass: 'custom-modal',
      autoFocus: false,
    });
  }

  showNotification(isSuccess: boolean, title: string, message: string) {
    return this.dialog.open(NotificationComponent, {
      data: { isSuccess, title, message },
      width: '400px',
      panelClass: 'custom-modal',
      autoFocus: false,
    });
  }

  // SweetAlert2: Alert simples
  showSweetNotification(title: string, text: string, icon: string) {
    const iconNormalized = this.mapStatusToIcon(icon);

    return Swal.fire({
      title,
      text,
      icon: iconNormalized,
      confirmButtonText: 'OK',
      // 'OK' is understood across pt-BR/en/es and is left untranslated intentionally.
    });
  }

  showConfirmation(data: any) {
    return this.dialog.open(ConfirmationComponent, {
      data,
      width: '400px',
      panelClass: 'custom-modal',
      autoFocus: false,
    });
  }

  // SweetAlert2: Confirmação
  showSweetConfirmation(
    title: string,
    text: string,
    icon: 'warning' | 'question' = 'question',
    confirmButtonText = this.translationService.instant('COMMON.YES'),
    cancelButtonText = this.translationService.instant('COMMON.CANCEL'),
  ) {
    return Swal.fire({
      title,
      text,
      icon,
      showCancelButton: true,
      confirmButtonText,
      confirmButtonColor: '#198754', // Bootstrap success color
      cancelButtonText,
      cancelButtonColor: '#6c757d', // Bootstrap secondary color
      reverseButtons: true,
      showCloseButton: true,
      customClass: {
        confirmButton: 'swal-btn',
        cancelButton: 'swal-btn',
      },
    });
  }

  // PDF exports (orçamentos, pedidos, contratos/OS de viagem, relatórios) can take a few seconds
  // - without this, the button's own disabled state was the only feedback, and it was being
  // cleared well before the actual work even started (see the *-details-page emit* methods), so
  // the UI looked idle for the whole duration. This opens one PdfProgressComponent dialog and
  // hands back a handle that drives it through its states (progress/indeterminate, then a single
  // terminal success/error) via its componentInstance, instead of closing one dialog and opening
  // another - the user watches one continuous modal, and it never dismisses itself: the success/
  // error state always ends in an explicit "OK" click (see PdfProgressComponent).
  showPdfProgress(title: string): PdfProgressHandle {
    const dialogRef = this.dialog.open(PdfProgressComponent, {
      data: { title },
      width: '420px',
      disableClose: true,
      panelClass: 'custom-modal',
      autoFocus: false,
    });
    const instance = dialogRef.componentInstance;

    return {
      setProgress: (current: number, total: number) => instance.setProgress(current, total),
      setIndeterminate: () => instance.setIndeterminate(),
      success: (message: string, file?: PdfProgressFile) => instance.success(message, file),
      error: (message: string) => instance.error(message),
    };
  }

  hideModal(dialogRef?: MatDialogRef<any>): void {
    if (dialogRef) {
      dialogRef.close();
    } else {
      this.dialog.closeAll();
    }
  }

  private mapStatusToIcon(
    status: string,
  ): 'success' | 'error' | 'warning' | 'info' {
    const normalized = status.toLowerCase();

    if (['success', 'ok'].includes(normalized)) {
      return 'success';
    }

    if (['error', 'fail', 'failed'].includes(normalized)) {
      return 'error';
    }

    if (['warning', 'warn', 'alert'].includes(normalized)) {
      return 'warning';
    }

    return 'info';
  }
}
