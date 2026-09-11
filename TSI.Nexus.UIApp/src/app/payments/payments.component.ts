import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  ApiType,
  BusinessPartner,
  Driver,
  ModalService,
  Order,
  Trip,
  Transaction,
  Payment,
  WebApiResponse,
  PaymentStatus,
  PaymentService,
  PaymentType,
  ResponseStatus,
  NotificationService,
  TranslationService,
} from '@nexus/core';
import {
  ColDef,
  ICellRendererParams,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { PaymentDetailsModalComponent } from './components/payment-details-modal/payment-details-modal.component';
import { Observable, Subject, Subscription, takeUntil } from 'rxjs';
import { NgIf } from '@angular/common';
import { HeaderComponent } from '../shared/header/header.component';
import { GridComponent } from '../shared/grid/grid.component';
import { DateFieldComponent } from '../shared/components/date-field/date-field.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { formatCurrencyBRL, formatDateBR } from '../core/utilities/format-utils';

@Component({
    selector: 'app-payments',
    templateUrl: './payments.component.html',
    styleUrl: './payments.component.scss',
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
export class PaymentsComponent implements OnInit, OnDestroy {
  @Input()
  entity: string = '';

  @Input()
  parentData?: BusinessPartner | Order | Trip | Transaction | Driver | null = null;

  @Input()
  compact: boolean = false;

  @Input()
  canAdd: boolean = false;

  @Input()
  filterByType: PaymentType | null = null;

  baseEndPoint = ApiType.Payments;

  rowData: Payment[] = [];
  loading: boolean = false;

  get typeMap(): { [key: string]: string } {
    return {
      Incoming: this.translationService.instant('REPORTS.INCOMING'),
      Outgoing: this.translationService.instant('REPORTS.OUTGOING'),
    };
  }

  typeIconMap: { [key: string]: string } = {
    Incoming: '<i class="bi bi-arrow-up-circle-fill text-success me-1"></i>',
    Outgoing: '<i class="bi bi-arrow-down-circle-fill text-danger me-1"></i>',
  };

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

  filteredRowData: Payment[] = [];
  filterStartDate: string | null = null;
  filterEndDate: string | null = null;
  filterStatus = { Approved: false, Pending: false, Delayed: false };
  filterType = { Incoming: false, Outgoing: false };
  showFiltersOnInit = false;

  private _paymentChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  constructor(
    private modalService: ModalService,
    private notificationService: NotificationService,
    private paymentService: PaymentService,
    private route: ActivatedRoute,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.initializeColumnDefs();
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.initializeColumnDefs());
    this.route.queryParams.subscribe((params) => {
      this.setFiltersFromQueryParams(params);
      this.showFiltersOnInit = this.hasInitialFilters();
      this._paymentChangedSub = this.paymentService.paymentChanged$
        .pipe(takeUntil(this._destroy$))
        .subscribe(() => {
          this.getPayment(() => this.applyFilters(), false);
        });
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._paymentChangedSub) {
      this._paymentChangedSub.unsubscribe();
    }
  }

  openModal(initialState: any) {
    const initialStateWithParent = {
      ...initialState,
      parentId: this.parentData?.id,
      parentData: this.parentData,
    };

    this.modalService.showTemplateModal(
      PaymentDetailsModalComponent,
      initialStateWithParent,
    );
  }

  deleteOrder(payment: Payment): void {
    this.paymentService
      .delete(payment)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<Payment>) => {
        const isSuccess = response.status === ResponseStatus.Success;
        if (isSuccess) {
          this.filteredRowData = this.filteredRowData.filter(
            (p) => p.id !== payment.id,
          );
        }

        this.modalService.hideModal();
        this.modalService.showSweetNotification(
          '',
          response.message,
          response.status,
        );
      });
  }

  refreshOrders(): void {
    this.getPayment(() => this.applyFilters(), true);
  }

  updatePaymentStatus(payment: Payment): void {
    if (!payment || payment.status === 'Approved') {
      return;
    }

    this.modalService
      .showSweetConfirmation(
        '',
        this.translationService.instant('PAYMENTS.CONFIRM_MARK_PAID'),
      )
      .then((result: any) => {
        if (!result.isConfirmed) {
          this.applyFilters();
          return;
        }

        this.markAsApproved(payment);
      });
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

  private initializeColumnDefs(): void {
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
        field: 'status',
        headerName: this.translationService.instant('PAYMENTS.PAID_QUESTION'),
        sortable: true,
        filter: true,
        maxWidth: 100,
        cellRenderer: (params: any) => {
          const isApproved = params.value === PaymentStatus.Approved;
          return `<input type="checkbox" ${
            isApproved ? 'checked disabled' : ''
          } data-action="update" />`;
        },
      },
      {
        field: 'description',
        headerName: this.translationService.instant('COMMON.DESCRIPTION'),
        sortable: true,
        filter: true,
        flex: 2,
        maxWidth: 450,
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? '';
          return `<a data-action="edit" class="ag-link">${value}</a>`;
        },
      },
      {
        field: 'paymentNumber',
        headerName: '#',
        sortable: true,
        filter: true,
        flex: 2,
        maxWidth: 100,
        hide: !this.compact,
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? '';
          return `<a data-action="edit" class="ag-link">${value}</a>`;
        },
      },
      {
        field: 'type',
        headerName: this.translationService.instant('COMMON.TYPE'),
        sortable: true,
        filter: true,
        maxWidth: 120,
        resizable: true,
        filterValueGetter: (params: ValueGetterParams) => {
          return this.getTypeLabel(params.data?.type);
        },
        cellRenderer: (params: ValueFormatterParams) => {
          const type = params.value ?? '';
          return this.getTypeIcon(type) + this.getTypeLabel(type);
        },
      },
      {
        field: 'price',
        headerName: this.translationService.instant('COMMON.VALUE'),
        sortable: true,
        filter: true,
        maxWidth: 120,
        cellClass: (params: ValueFormatterParams) => {
          const type = params.data?.type;
          if (type === 'Incoming') {
            return 'text-success'; // verde escuro
          } else if (type === 'Outgoing') {
            return 'text-danger'; // vermelho
          }
          return '';
        },
        valueFormatter: (params: ValueFormatterParams) =>
          formatCurrencyBRL(params.value),
      },
      {
        field: 'status',
        headerName: this.translationService.instant('COMMON.STATUS'),
        sortable: true,
        filter: true,
        flex: 2,
        maxWidth: 100,
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
        field: 'date',
        headerName: this.translationService.instant('COMMON.DATE'),
        sortable: true,
        filter: true,
        flex: 2,
        maxWidth: 120,
        valueFormatter: (params: ValueFormatterParams) =>
          formatDateBR(params.value),
      },
      {
        field: 'businessPartnerName',
        headerName: this.translationService.instant('BUSINESS_PARTNER.CLIENT_SINGULAR'),
        sortable: true,
        filter: true,
        flex: 1,
        maxWidth: 150,
        hide: this.entity === 'BusinessPartner',
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
        maxWidth: 150,
        hide: this.entity === 'Order' || this.entity === 'Trip',
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? 'N/A';
          return value;
        },
      },
      {
        field: 'tripNumber',
        headerName: this.translationService.instant('TRIPS.SINGULAR'),
        sortable: true,
        filter: true,
        flex: 1,
        maxWidth: 150,
        hide: this.entity === 'Order' || this.entity === 'Trip',
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
        cellRenderer: () => {
          return `
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

  private getPayment(callback?: () => void, isRefresh = false): void {
    let payments$: Observable<WebApiResponse<Payment[]>>;

    if (this.entity === '') {
      payments$ = this.paymentService.getAll();
    } else if (!this.parentData?.id) {
      // Scoped to a parent entity (Order/Trip/BusinessPartner) that hasn't been saved yet (Add
      // mode) - nothing to fetch, and calling the API with an undefined id 400s.
      this.rowData = [];
      if (callback) {
        callback();
      }
      return;
    } else {
      payments$ = this.paymentService.getByEntityId(
        this.parentData.id,
        this.entity,
      );
    }

    this.loading = true;
    payments$.pipe(takeUntil(this._destroy$)).subscribe({
      next: (response: WebApiResponse<Payment[]>) => {
        this.rowData = response.data ?? [];
        this.loading = false;

        if (callback) {
          callback();
        }

        if (isRefresh) {
          this.notificationService.showMessage(
            ResponseStatus.Success,
            this.translationService.instant('PAYMENTS.PAYMENTS_REFRESHED'),
          );
        }
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private markAsApproved(payment: Payment): void {
    if (!payment) {
      return;
    }

    const updatedPayment = { ...payment, status: PaymentStatus.Approved };

    this.paymentService
      .update(updatedPayment)
      .subscribe((response: WebApiResponse<Payment>) => {
        this.getPayment(() => this.applyFilters(), false);
        this.modalService.hideModal();
        this.modalService.showSweetNotification(
          '',
          response.message,
          response.status,
        );
      });
  }

  private getTypeLabel(type: string): string {
    return this.typeMap[type] ?? type ?? '';
  }

  private getTypeIcon(type: string): string {
    return this.typeIconMap[type] ?? '';
  }

  private getStatusLabel(status: string): string {
    return this.statusMap[status] ?? status ?? '';
  }

  private getStatusColor(status: string): string {
    return this.statusColorMap[status] ?? this.statusColorMap['default'];
  }

  private setFiltersFromQueryParams(params: any): void {
    // Always initialize all filters
    this.filterStatus = { Approved: false, Pending: false, Delayed: false };
    this.filterType = { Incoming: false, Outgoing: false };

    // Status filters
    if (params['status']) {
      const statuses = Array.isArray(params['status'])
        ? params['status']
        : String(params['status']).split(',');
      statuses.forEach((s: string) => {
        if (Object.prototype.hasOwnProperty.call(this.filterStatus, s)) {
          (this.filterStatus as Record<string, boolean>)[s] = true;
        }
      });
    }

    // Type filters
    if (params['type']) {
      const types = Array.isArray(params['type'])
        ? params['type']
        : String(params['type']).split(',');
      types.forEach((t: string) => {
        if (Object.prototype.hasOwnProperty.call(this.filterType, t)) {
          (this.filterType as Record<string, boolean>)[t] = true;
        }
      });
    }

    // Date filters
    this.filterStartDate = params['startDate'] || null;
    this.filterEndDate = params['endDate'] || null;
  }

  private hasInitialFilters(): boolean {
    // Checks if any filter is active
    if (this.filterStartDate || this.filterEndDate) {
      return true;
    }
    if (Object.values(this.filterStatus).some((v) => v)) {
      return true;
    }
    if (Object.values(this.filterType).some((v) => v)) {
      return true;
    }
    return false;
  }

}
