import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import {
  Commission,
  CommissionService,
  CommissionStatus,
  NotificationService,
  ServiceOrder,
  ServiceOrderService,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community';
import { Subject, takeUntil } from 'rxjs';

import { GridComponent } from '../../../shared/grid/grid.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { formatCurrencyBRL, formatDateBR } from '../../../core/utilities/format-utils';

@Component({
    selector: 'app-service-order-list',
    templateUrl: './service-order-list.component.html',
    styleUrl: './service-order-list.component.scss',
    imports: [GridComponent, TranslatePipe],
})
export class ServiceOrderListComponent
  implements OnInit, OnChanges, OnDestroy
{
  @Input()
  driverId!: string;

  @Input()
  compact = false;

  baseEndPoint = 'service-orders';
  rowData: ServiceOrder[] = [];
  columnDefs: ColDef[] = [];
  loading: boolean = false;

  private _destroy$ = new Subject<void>();

  get statusMap(): { [key: string]: { label: string; color: string } } {
    return {
      Pending: {
        label: this.translationService.instant('DRIVERS.COMMISSION_STATUS_PENDING'),
        color: 'warning',
      },
      Paid: {
        label: this.translationService.instant('DRIVERS.COMMISSION_STATUS_PAID'),
        color: 'success',
      },
      Cancelled: {
        label: this.translationService.instant('DRIVERS.COMMISSION_STATUS_CANCELLED'),
        color: 'secondary',
      },
    };
  }

  constructor(
    private commissionService: CommissionService,
    private notificationService: NotificationService,
    private serviceOrderService: ServiceOrderService,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.initializeGrid();
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.initializeGrid());
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['driverId'] && !changes['driverId'].firstChange) {
      this.load();
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  refresh(): void {
    this.load(true);
  }

  // app-grid's [delete] input is required (no delete action is rendered here, so it's never
  // actually invoked - see initializeGrid()).
  noop(): void {}

  // Repurposes app-grid's generic [update] hook (data-action="update") for the one action a
  // Service Order actually supports - these rows are auto-generated when a trip linked to this
  // driver is marked as Closed, and never manually added/edited/deleted.
  markAsPaid(serviceOrder: ServiceOrder): void {
    if (!serviceOrder.commission) {
      return;
    }
    const updated: Commission = { ...serviceOrder.commission, status: CommissionStatus.Paid };

    this.commissionService
      .update(updated)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<Commission>) => {
        this.notificationService.showMessage(response.status, response.message);
        this.load();
      });
  }

  private initializeGrid(): void {
    this.columnDefs = [
      {
        field: 'id',
        headerName: 'ID',
        hide: true,
      },
      {
        field: 'number',
        headerName: this.translationService.instant('DRIVERS.OS_COLUMN'),
        sortable: true,
        filter: true,
        flex: 1,
      },
      {
        field: 'issueDate',
        headerName: this.translationService.instant('DRIVERS.ISSUE_DATE'),
        sortable: true,
        filter: true,
        flex: 1,
        valueFormatter: (params: ValueFormatterParams) => formatDateBR(params.value),
      },
      {
        field: 'commission.baseAmount',
        headerName: this.translationService.instant('DRIVERS.BASE'),
        sortable: true,
        filter: true,
        flex: 1,
        valueFormatter: (params: ValueFormatterParams) => formatCurrencyBRL(params.value),
      },
      {
        field: 'commission.percentage',
        headerName: '%',
        sortable: true,
        filter: true,
        width: 90,
        valueFormatter: (params: ValueFormatterParams) =>
          params.value != null ? `${params.value}%` : '',
      },
      {
        field: 'commission.amount',
        headerName: this.translationService.instant('DRIVERS.COMMISSION_COLUMN'),
        sortable: true,
        filter: true,
        flex: 1,
        valueFormatter: (params: ValueFormatterParams) => formatCurrencyBRL(params.value),
      },
      {
        field: 'commission.status',
        headerName: this.translationService.instant('COMMON.STATUS'),
        sortable: true,
        filter: true,
        flex: 1,
        cellRenderer: (params: ICellRendererParams) => {
          if (!params.value) {
            return '';
          }
          const info = this.statusMap[params.value] ?? { label: params.value, color: 'secondary' };
          return `<span class="badge bg-${info.color}">${info.label}</span>`;
        },
      },
      {
        headerName: this.translationService.instant('COMMON.ACTIONS'),
        flex: 1,
        minWidth: 120,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: (params: ICellRendererParams) => {
          if (params.data?.commission?.status !== CommissionStatus.Pending) {
            return '';
          }
          return `
            <button class="btn btn-link btn-sm p-0" data-action="update" title="${this.translationService.instant('DRIVERS.MARK_AS_PAID_TITLE')}">
              <i class="bi bi-check-circle text-success" data-action="update"></i>
              ${this.translationService.instant('DRIVERS.PAY_BUTTON')}
            </button>
          `;
        },
      },
    ];
  }

  private load(isRefresh = false): void {
    if (!this.driverId) {
      return;
    }
    this.loading = true;
    this.serviceOrderService
      .getByDriver(this.driverId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (response) => {
          this.rowData = response.data ?? [];
          this.loading = false;
          if (isRefresh) {
            this.notificationService.showMessage(response.status, response.message);
          }
        },
        error: () => {
          this.loading = false;
        },
      });
  }

}
