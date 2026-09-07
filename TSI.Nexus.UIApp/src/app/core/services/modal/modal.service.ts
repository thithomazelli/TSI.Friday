import { Injectable, TemplateRef, Type, Inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import Swal from 'sweetalert2';
import { NotificationComponent } from '../../../shared/components/modals/notification/notification.component';
import { ConfirmationComponent } from '../../../shared/components/modals/confirmation/confirmation.component';
import { TranslationService } from '../translation/translation.service';

// Handle returned by ModalService.showPdfProgress() - lets the caller drive the same open modal
// through its lifecycle (progress updates, then a single terminal success/error state) without
// reaching back into SweetAlert2 directly.
export interface PdfProgressHandle {
  setProgress(current: number, total: number): void;
  setIndeterminate(): void;
  success(message: string): void;
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

  // PDF/print exports (orçamentos, pedidos, contratos/OS de viagem, relatórios) run client-side
  // and can take several seconds for multi-page documents - without this, the button's own
  // disabled state was the only feedback, and it was being cleared well before the actual
  // rendering work even started (see the *-details-page emit* methods), so the UI looked idle
  // for the whole duration. This keeps one Swal instance open across the whole operation -
  // in-progress bar, then flipped to a success/error icon via Swal.update() - instead of a
  // separate showSweetNotification() call at the end, so the user watches one continuous modal
  // rather than a loading dialog vanishing and a different one popping up.
  showPdfProgress(title: string): PdfProgressHandle {
    let container: HTMLElement | null = null;

    Swal.fire({
      title,
      html: `
        <div class="pdf-progress-track" style="background:#e9ecef;border-radius:6px;height:10px;overflow:hidden;">
          <div class="pdf-progress-fill" style="background:#198754;height:100%;width:0%;transition:width .2s ease;"></div>
        </div>
        <div class="pdf-progress-label" style="margin-top:10px;font-size:0.85rem;color:#6c757d;"></div>
      `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        container = Swal.getHtmlContainer();
      },
    });

    const fillEl = () => container?.querySelector<HTMLElement>('.pdf-progress-fill');
    const labelEl = () => container?.querySelector<HTMLElement>('.pdf-progress-label');

    return {
      setProgress: (current: number, total: number) => {
        if (!Swal.isVisible()) {
          return;
        }
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        const fill = fillEl();
        if (fill) {
          fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
        const label = labelEl();
        if (label) {
          label.textContent = this.translationService.instant('PDF_EXPORT.PAGE_PROGRESS', {
            current: String(current),
            total: String(total),
          });
        }
      },
      setIndeterminate: () => {
        if (!Swal.isVisible()) {
          return;
        }
        const fill = fillEl();
        if (fill) {
          fill.style.width = '100%';
          fill.style.background = 'repeating-linear-gradient(45deg, #198754, #198754 10px, #14653f 10px, #14653f 20px)';
        }
        const label = labelEl();
        if (label) {
          label.textContent = this.translationService.instant('PDF_EXPORT.PROCESSING');
        }
      },
      success: (message: string) => {
        if (!Swal.isVisible()) {
          return;
        }
        // Swal.update() treats a falsy `html` as "leave it as-is" rather than clearing it - the
        // progress bar/label would otherwise keep showing underneath the success icon - so the
        // container's own content has to be cleared directly instead.
        if (container) {
          container.innerHTML = '';
        }
        Swal.update({
          icon: 'success',
          title: message,
          showConfirmButton: false,
        });
        setTimeout(() => {
          if (Swal.isVisible()) {
            Swal.close();
          }
        }, 1500);
      },
      error: (message: string) => {
        if (!Swal.isVisible()) {
          return;
        }
        if (container) {
          container.innerHTML = '';
        }
        Swal.update({
          icon: 'error',
          title: message,
          showConfirmButton: true,
          confirmButtonText: 'OK',
        });
      },
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
