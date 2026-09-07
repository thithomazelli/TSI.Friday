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
    const table = element?.querySelector('#report-data-table');
    const theadEl = table?.querySelector('thead');
    if (!element || !table || !theadEl) {
      return;
    }
    const totalsEl = element.querySelector('#report-totals-row');

    this.generatingPdf = true;
    const progress = this.modalService.showPdfProgress(
      this.translationService.instant('PDF_EXPORT.PREPARING_TITLE'),
    );

    const startDate = this.filterStartDate
      ? this.formatDate(this.filterStartDate)
      : '';
    const endDate = this.filterEndDate
      ? this.formatDate(this.filterEndDate)
      : '';
    const reportTitle = this.translationService.instant('REPORTS.TITLE');
    const dateRangeText = this.translationService.instant('REPORTS.DATE_RANGE', { start: startDate || '-', end: endDate || '-' });
    const fullHeaderHtml = `
      <h4 style="margin: 0 0 4px;">${reportTitle}</h4>
      <div style="font-weight: bold; margin-bottom: 12px;">${dateRangeText}</div>
    `;

    const rowsHtml = Array.from(table.querySelectorAll('tbody > tr')).map(
      (row) => (row as HTMLElement).outerHTML,
    );

    // Dynamic import: report-pdf.ts pulls in jsPDF/html2canvas (~1MB) that only this button
    // actually needs, so it's loaded on click rather than in the app's initial bundle - see
    // core/utilities/index.ts for why it isn't re-exported via @nexus/core.
    const { downloadReportPdf } = await import('../core/utilities/report-pdf');

    downloadReportPdf(
      {
        fullHeaderHtml,
        continuationTitle: reportTitle,
        theadHtml: theadEl.outerHTML,
        rowsHtml,
        totalsHtml: totalsEl ? (totalsEl as HTMLElement).outerHTML : '',
        pageLabel: (current, total) =>
          this.translationService.instant('PDF_EXPORT.PAGE_PROGRESS', {
            current: String(current),
            total: String(total),
          }),
      },
      'relatorio.pdf',
      (completed: number, total: number) => progress.setProgress(completed, total),
    )
      .then(() => {
        progress.success(this.translationService.instant('PDF_EXPORT.SUCCESS'));
      })
      .catch(() => {
        progress.error(this.translationService.instant('PDF_EXPORT.ERROR'));
      })
      .finally(() => {
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
