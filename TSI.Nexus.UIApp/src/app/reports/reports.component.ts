import { Component, OnInit } from '@angular/core';

import {
  ApiService,
  ApiType,
  ModalService,
  Payment,
  PaymentStatus,
  PaymentType,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';

import { PaymentDetailsModalComponent } from '../payments/components/payment-details-modal/payment-details-modal.component';
import { HeaderComponent } from '../shared/header/header.component';
import { DateFieldComponent } from '../shared/components/date-field/date-field.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgFor, NgIf, CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../core/pipes/translate.pipe';

@Component({
    selector: 'app-reports',
    templateUrl: './reports.component.html',
    styleUrl: './reports.component.scss',
    imports: [
        HeaderComponent,
        DateFieldComponent,
        ReactiveFormsModule,
        FormsModule,
        NgFor,
        NgIf,
        RouterLink,
        CurrencyPipe,
        DatePipe,
        TranslatePipe,
    ],
})
export class ReportsComponent implements OnInit {
  data: Payment[] = [];

  filteredData: Payment[] = [];
  filterStartDate: string | null = null;
  filterEndDate: string | null = null;
  filterStatus = { Approved: false, Pending: false, Delayed: false };
  filterType = { Incoming: false, Outgoing: false };
  generatingPdf = false;

  private _baseEndPoint = ApiType.Payments;

  get typeMap(): { [key in PaymentType]: string } {
    return {
      [PaymentType.Incoming]: this.translationService.instant('REPORTS.INCOMING'),
      [PaymentType.Outgoing]: this.translationService.instant('REPORTS.OUTGOING'),
    };
  }

  get statusMap(): { [key in PaymentStatus]: string } {
    return {
      [PaymentStatus.Approved]: this.translationService.instant('REPORTS.STATUS_PAID'),
      [PaymentStatus.Pending]: this.translationService.instant('REPORTS.STATUS_OPEN'),
      [PaymentStatus.Delayed]: this.translationService.instant('REPORTS.STATUS_DELAYED'),
    };
  }

  statusColorMap: { [key: string]: string } = {
    Approved: 'success',
    Pending: 'info',
    Delayed: 'danger',
    default: 'secondary',
  };

  constructor(
    private apiService: ApiService,
    private modalService: ModalService,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.getPayment(() => this.applyFilters());
  }

  showPaymentDetails(payment: Payment) {
    const initialState = {
      isEdit: false,
      id: payment.id,
      data: payment,
      parentId: payment.transactionId,
    };

    const ref = this.modalService.showTemplateModal(
      PaymentDetailsModalComponent,
      initialState,
    );
    if (ref.componentInstance && ref.componentInstance.saved) {
      ref.componentInstance.saved.subscribe(() => {
        this.getPayment(() => this.applyFilters());
        ref.close();
      });
    }
  }

  applyFilters(): void {
    let filtered = [...this.data];
    // Filter by date range (start and end)
    if (this.filterStartDate || this.filterEndDate) {
      filtered = filtered.filter((item) => {
        if (!item.date) return false;
        const itemDate = new Date(item.date).toISOString().slice(0, 10);
        let isValid = true;
        if (this.filterStartDate) {
          const startDate = new Date(this.filterStartDate)
            .toISOString()
            .slice(0, 10);
          isValid = isValid && itemDate >= startDate;
        }
        if (this.filterEndDate) {
          const endDate = new Date(this.filterEndDate)
            .toISOString()
            .slice(0, 10);
          isValid = isValid && itemDate <= endDate;
        }
        return isValid;
      });
    }
    // Filter by status
    const selectedStatuses = Object.entries(this.filterStatus)
      .filter(([_, checked]) => checked)
      .map(([label]) => label);
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((item) =>
        selectedStatuses.includes(item.status ?? ''),
      );
    }
    // Filter by type
    const selectedTypes = Object.entries(this.filterType)
      .filter(([_, checked]) => checked)
      .map(([label]) => label);
    if (selectedTypes.length > 0) {
      filtered = filtered.filter((item) =>
        selectedTypes.includes(item.type ?? ''),
      );
    }
    this.filteredData = filtered;
  }

  clearFilters(): void {
    this.filterStartDate = null;
    this.filterEndDate = null;
    this.filterStatus = { Approved: false, Pending: false, Delayed: false };
    this.filterType = { Incoming: false, Outgoing: false };
    this.filteredData = [...this.data];
  }

  getTypeLabel(type: PaymentType | undefined): string {
    if (!type) {
      return '';
    }

    return this.typeMap[type] ?? type ?? '';
  }

  getStatusLabel(status: PaymentStatus | undefined): string {
    if (!status) {
      return '';
    }

    return this.statusMap[status] ?? status ?? '';
  }

  getStatusColor(status: PaymentStatus | undefined): string {
    if (!status) {
      return '';
    }

    return this.statusColorMap[status] ?? this.statusColorMap['default'];
  }

  getTotalIncoming(): number {
    return (this.filteredData ?? [])
      .filter((p) => p.type === 'Incoming' && p.price != null)
      .reduce((sum, p) => sum + Number(p.price), 0);
  }

  getTotalOutgoing(): number {
    return (this.filteredData ?? [])
      .filter((p) => p.type === 'Outgoing' && p.price != null)
      .reduce((sum, p) => sum + Number(p.price), 0);
  }

  getTotal(): number {
    return (this.filteredData ?? [])
      .filter((p) => p.price != null)
      .reduce(
        (sum, p) =>
          sum +
          (p.type === 'Incoming'
            ? Number(p.price)
            : p.type === 'Outgoing'
              ? -Number(p.price)
              : 0),
        0,
      );
  }
  printSection() {
    const printContents = document.getElementById('print-section')?.innerHTML;
    if (!printContents) {
      return;
    }

    const originalContents = document.body.innerHTML;
    document.body.innerHTML = printContents;
    window.print();
    document.body.innerHTML = originalContents;
  }

  async generatePDF() {
    if (this.generatingPdf) {
      return;
    }
    const element = document.getElementById('print-section');
    if (!element) {
      return;
    }
    this.generatingPdf = true;
    // A report is captured as a single canvas (unlike the per-page contract/quote/order exports),
    // so there's no natural page count to report progress against - the indeterminate striped bar
    // still tells the user work is happening instead of the button just going quiet for several
    // seconds.
    const progress = this.modalService.showPdfProgress(
      this.translationService.instant('PDF_EXPORT.PREPARING_TITLE'),
    );
    progress.setIndeterminate();

    // Clona o conteúdo do relatório
    const clone = element.cloneNode(true) as HTMLElement;

    // Remove os app-date-field do clone
    const dateFields = clone.querySelectorAll('app-date-field');
    dateFields.forEach((field) => field.remove());

    // Cria linha única de datas
    const startDate = this.filterStartDate
      ? this.formatDate(this.filterStartDate)
      : '';
    const endDate = this.filterEndDate
      ? this.formatDate(this.filterEndDate)
      : '';
    const dateRow = document.createElement('div');
    dateRow.style.fontWeight = 'bold';
    dateRow.style.marginBottom = '0.5rem';
    dateRow.textContent = this.translationService.instant('REPORTS.DATE_RANGE', { start: startDate || '-', end: endDate || '-' });

    // Insere a linha de datas no topo da área de filtros
    const appContent = clone.querySelector('.app-content');
    if (appContent) {
      appContent.insertBefore(dateRow, appContent.firstChild);
    }

    // Oculta elementos .no-print apenas no clone
    clone.querySelectorAll('.no-print').forEach((el) => {
      (el as HTMLElement).classList.add('pdf-hide');
    });

    // Cria um container temporário fora da tela
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-9999px';
    tempDiv.appendChild(clone);
    document.body.appendChild(tempDiv);

    // Dynamic import: html2pdf.js drags in jsPDF/html2canvas (~1MB) that only this button
    // actually needs, so it's loaded on click rather than in the app's initial bundle.
    const { default: html2pdf } = await import('html2pdf.js');

    html2pdf()
      .from(clone)
      .set({
        margin: 0.5,
        filename: 'relatorio.pdf',
        html2canvas: { scale: 1.5 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      })
      .save()
      .then(() => {
        progress.success(this.translationService.instant('PDF_EXPORT.SUCCESS'));
      })
      .catch(() => {
        progress.error(this.translationService.instant('PDF_EXPORT.ERROR'));
      })
      .finally(() => {
        // Remove o container temporário
        document.body.removeChild(tempDiv);
        this.generatingPdf = false;
      });
  }

  // Utilitário para formatar data como dd/MM/yyyy
  private formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private getPayment(callback?: () => void): void {
    const endpoint = `${this._baseEndPoint}/getAll`;

    this.apiService
      .get<WebApiResponse<Payment[]>>(endpoint)
      .subscribe((response: WebApiResponse<Payment[]>) => {
        this.data = response.data ?? [];
        if (callback) callback();
      });
  }
}
