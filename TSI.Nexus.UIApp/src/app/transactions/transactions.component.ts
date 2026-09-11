import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';

import {
  ApiType,
  ModalService,
  Transaction,
  ResponseStatus,
  WebApiResponse,
  TransactionService,
  NotificationService,
  TranslationService,
} from '@nexus/core';
import {
  ColDef,
  ICellRendererParams,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { TransactionDetailsModalComponent } from './components/transaction-details-modal/transaction-details-modal.component';
import { Observable, Subject, Subscription, takeUntil } from 'rxjs';
import { NgIf } from '@angular/common';
import { HeaderComponent } from '../shared/header/header.component';
import { GridComponent } from '../shared/grid/grid.component';
import { DateFieldComponent } from '../shared/components/date-field/date-field.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { formatCurrencyBRL, formatDateBR } from '../core/utilities/format-utils';

@Component({
    selector: 'app-transactions',
    templateUrl: './transactions.component.html',
    styleUrl: './transactions.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgIf,
        HeaderComponent,
        GridComponent,
        DateFieldComponent,
        ReactiveFormsModule,
        FormsModule,
        TranslatePipe,
    ],
})
export class TransactionsComponent implements OnInit, OnDestroy {
  @Input()
  compact: boolean = false;

  @Input()
  entity: string | null = '';

  @Input()
  parentData: any = null;

  baseEndPoint = ApiType.Transactions;
  rowData: Transaction[] = [];
  loading: boolean = false;

  get typeMap(): { [key: string]: string } {
    return {
      Incoming: this.translationService.instant('REPORTS.INCOMING'),
      Outgoing: this.translationService.instant('REPORTS.OUTGOING'),
    };
  }

  get conditionMap(): { [key: string]: string } {
    return {
      FullPayment: this.translationService.instant('TRANSACTIONS.FULL_PAYMENT'),
      InPayments: this.translationService.instant('TRANSACTIONS.IN_PAYMENTS'),
    };
  }

  get statusMap(): { [key: string]: string } {
    return {
      Approved: this.translationService.instant('REPORTS.STATUS_PAID'),
      Pending: this.translationService.instant('REPORTS.STATUS_OPEN'),
      Delayed: this.translationService.instant('REPORTS.STATUS_DELAYED'),
    };
  }

  statusColorMap: { [key: string]: string } = {
    Approved: 'success',
    Pending: 'info',
    Delayed: 'danger',
    default: 'secondary',
  };

  columnDefs: ColDef[] = [];

  filteredRowData: Transaction[] = [];
  filterStartDate: string | null = null;
  filterEndDate: string | null = null;
  filterStatus = { Approved: false, Pending: false, Delayed: false };
  filterType = { Incoming: false, Outgoing: false };
  showFiltersOnInit = false;

  private _transactionChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  constructor(
    private modalService: ModalService,
    private notificationService: NotificationService,
    private transactionService: TransactionService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.setFiltersFromQueryParams();
    this.initializeGrid();
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        this.initializeGrid();
        this.cdr.markForCheck();
      });
    this._transactionChangedSub = this.transactionService.transactionChanged$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        this.getTransactions(() => this.applyFilters());
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._transactionChangedSub) {
      this._transactionChangedSub.unsubscribe();
    }
  }

  openModal(initialState: any) {
    this.modalService.showTemplateModal(
      TransactionDetailsModalComponent,
      initialState,
    );
  }

  deleteTransaction(transaction: Transaction): void {
    this.transactionService
      .delete(transaction)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<Transaction>) => {
        if (response.status === ResponseStatus.Success) {
          this.filteredRowData = this.filteredRowData.filter(
            (p) => p.id !== transaction.id,
          );
          this.cdr.markForCheck();
        }
        this.modalService.hideModal();
        this.modalService.showSweetNotification(
          '',
          response.message,
          response.status,
        );
      });
  }

  refreshTransactions(): void {
    this.getTransactions(() => this.applyFilters(), true);
  }

  applyFilters(): void {
    let filtered = [...this.rowData];
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
    this.filteredRowData = filtered;
  }

  clearFilters(): void {
    this.filterStartDate = null;
    this.filterEndDate = null;
    this.filterStatus = { Approved: false, Pending: false, Delayed: false };
    this.filterType = { Incoming: false, Outgoing: false };
    this.filteredRowData = [...this.rowData];
  }

  private initializeGrid(): void {
    this.columnDefs = [
      {
        field: 'id',
        headerName: 'ID',
        sortable: true,
        filter: true,
        hide: true,
        minWidth: 150,
      },
      {
        field: 'description',
        headerName: this.translationService.instant('COMMON.DESCRIPTION'),
        sortable: true,
        filter: true,
        maxWidth: 400,
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? '';
          return `<a data-action="view" class="ag-link">${value}</a>`;
        },
      },
      {
        field: 'paymentTotalPrice',
        headerName: this.translationService.instant('SIDEBAR.PAYMENTS'),
        sortable: true,
        filter: true,
        maxWidth: 150,
        cellClass: (params: ValueFormatterParams) => {
          return params.value > 0 ? 'text-success' : '';
        },
        valueFormatter: (params: ValueFormatterParams) =>
          formatCurrencyBRL(params.value),
      },
      {
        field: 'expenseTotalPrice',
        headerName: this.translationService.instant('SIDEBAR.EXPENSES'),
        sortable: true,
        filter: true,
        maxWidth: 120,
        cellClass: (params: ValueFormatterParams) => {
          return params.value > 0 ? 'text-danger' : '';
        },
        valueFormatter: (params: ValueFormatterParams) =>
          formatCurrencyBRL(params.value),
      },
      {
        field: 'condition',
        headerName: this.translationService.instant('TRANSACTIONS.CONDITION'),
        sortable: true,
        filter: true,
        maxWidth: 120,
        filterValueGetter: (params: ValueGetterParams) => {
          return this.getConditionLabel(params.data?.condition);
        },
        valueFormatter: (params: ValueFormatterParams): string => {
          return this.getConditionLabel(params.value);
        },
      },
      {
        field: 'date',
        headerName: this.translationService.instant('COMMON.DATE'),
        sortable: true,
        filter: true,
        maxWidth: 120,
        valueFormatter: (params: ValueFormatterParams) =>
          formatDateBR(params.value),
      },
      {
        field: 'status',
        headerName: this.translationService.instant('COMMON.STATUS'),
        sortable: true,
        filter: true,
        width: 100,
        filterValueGetter: (params: ValueGetterParams) => {
          return this.getStatusLabel(params.data?.status);
        },
        cellRenderer: (params: ICellRendererParams) => {
          const status = params.value;
          const color = this.getStatusColor(status);
          const label = this.getStatusLabel(status);
          return `<span class="badge bg-${color}">${label}</span>`;
        },
      },

      {
        field: 'businessPartnerName',
        headerName: this.translationService.instant('BUSINESS_PARTNER.CLIENT_SINGULAR'),
        sortable: true,
        filter: true,
        flex: 1,
        maxWidth: 300,
        hide: this.entity == 'BusinessPartner',
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? 'N/A';
          return value;
        },
      },
      {
        field: 'orderNumber',
        headerName: this.translationService.instant('ORDERS.SINGULAR'),
        sortable: true,
        filter: true,
        flex: 1,
        minWidth: 150,
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? 'N/A';
          return value;
        },
      },
      {
        headerName: this.translationService.instant('COMMON.ACTIONS'),
        flex: 1,
        minWidth: 150,
        sortable: false,
        filter: false,
        resizable: false,
        width: 300,
        cellRenderer: () => {
          return `
          <button class="btn btn-primary btn-sm" data-action="view">
            <i class="fas fa-eye" data-action="view"></i>
          </button>
          <button class="btn btn-info btn-sm" data-action="edit">
            <i class="fas fa-edit" data-action="edit"></i>
          </button>
          <button class="btn btn-danger btn-sm" data-action="delete">
            <i class="fas fa-trash" data-action="delete"></i>
          </button>
        `;
        },
      },
    ];
  }

  private getTransactions(callback?: () => void, isRefresh = false): void {
    let transactions$: Observable<WebApiResponse<Transaction[]>> =
      this.entity != '' && this.parentData?.id != null
        ? this.transactionService.getByBusinessPartnerId(this.parentData.id)
        : this.transactionService.getAll();

    this.loading = true;
    this.cdr.markForCheck();
    transactions$.pipe(takeUntil(this._destroy$)).subscribe({
      next: (response: WebApiResponse<Transaction[]>) => {
        this.rowData = response.data ?? [];

        if (callback) {
          callback();
        }

        if (isRefresh) {
          this.notificationService.showMessage(
            ResponseStatus.Success,
            this.translationService.instant('TRANSACTIONS.TRANSACTIONS_REFRESHED'),
          );
        }

        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private getConditionLabel(condition: string): string {
    return this.conditionMap[condition] ?? condition ?? '';
  }

  private getStatusLabel(status: string): string {
    return this.statusMap[status] ?? status ?? '';
  }

  private getStatusColor(status: string): string {
    return this.statusColorMap[status] ?? this.statusColorMap['default'];
  }

  private setFiltersFromQueryParams(): void {
    const params =
      window && window.location && window.location.search
        ? Object.fromEntries(new URLSearchParams(window.location.search))
        : {};

    // Initializes filters
    this.filterStatus = { Approved: false, Pending: false, Delayed: false };
    this.filterType = { Incoming: false, Outgoing: false };
    this.filterStartDate = null;
    this.filterEndDate = null;

    // Status filters
    if (params['status']) {
      const statuses = String(params['status']).split(',');
      statuses.forEach((s: string) => {
        if (Object.prototype.hasOwnProperty.call(this.filterStatus, s)) {
          (this.filterStatus as Record<string, boolean>)[s] = true;
        }
      });
    }
    // Type filters
    if (params['type']) {
      const types = String(params['type']).split(',');
      types.forEach((t: string) => {
        if (Object.prototype.hasOwnProperty.call(this.filterType, t)) {
          (this.filterType as Record<string, boolean>)[t] = true;
        }
      });
    }
    // Date filters
    if (params['startDate']) {
      this.filterStartDate = params['startDate'];
    }
    if (params['endDate']) {
      this.filterEndDate = params['endDate'];
    }

    // Set showFiltersOnInit only on initialization
    this.showFiltersOnInit = this.hasInitialFilters();
  }

  private hasInitialFilters(): boolean {
    if (this.filterStartDate || this.filterEndDate) return true;
    if (Object.values(this.filterStatus).some((v) => v)) return true;
    if (Object.values(this.filterType).some((v) => v)) return true;
    return false;
  }
}
