import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
  ApiType,
  Company,
  Individual,
  ModalService,
  NotificationService,
  Order,
  OrderService,
  PagedRequest,
  PagedResult,
  ResponseStatus,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import {
  ColDef,
  ICellRendererParams,
  ValueFormatterParams,
} from 'ag-grid-community';
import { OrderDetailsModalComponent } from './components/order-details-modal/order-details-modal.component';
import { Observable, Subject, Subscription, skip, takeUntil } from 'rxjs';
import { NgIf } from '@angular/common';
import { HeaderComponent } from '../shared/header/header.component';
import { GridComponent } from '../shared/grid/grid.component';
import { DateFieldComponent } from '../shared/components/date-field/date-field.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { formatCurrencyBRL, formatDateBR } from '../core/utilities/format-utils';

@Component({
    selector: 'app-orders',
    templateUrl: './orders.component.html',
    styleUrl: './orders.component.scss',
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
export class OrdersComponent implements OnInit, OnDestroy {
  @Input()
  compact: boolean = false;

  @Input()
  entity: string | null = '';

  @Input()
  parentData: Individual | Company | null = null;

  baseEndPoint = ApiType.Orders;
  rowData: Order[] = [];
  columnDefs: ColDef[] = [];
  loading: boolean = false;

  filteredRowData: Order[] = [];
  filterStartDate: string | null = null;
  filterEndDate: string | null = null;
  filterStatus = {
    Open: false,
    WaitingPayment: false,
    Closed: false,
  };
  showFiltersOnInit = false;

  @ViewChild('gridRef') private gridRef?: GridComponent<Order>;

  private _orderChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  constructor(
    private modalService: ModalService,
    private notificationService: NotificationService,
    private orderService: OrderService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
  ) {}

  // True for the main Orders listing screen (server-side paginated); false for the tab embedded
  // inside a BusinessPartner details page, which stays client-side exactly as before - mirrors
  // getOrders()'s own branching.
  get isTopLevelList(): boolean {
    return this.entity === '' || this.parentData?.id == null;
  }

  pagedDataSource = (request: PagedRequest): Observable<PagedResult<Order>> => {
    return this.orderService.getAllPaged({
      ...request,
      startDate: this.filterStartDate ?? undefined,
      endDate: this.filterEndDate ?? undefined,
      statuses: this.getSelectedStatuses(),
    });
  };

  ngOnInit(): void {
    this.setFiltersFromQueryParams();
    this.initializeGrid();
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        this.initializeGrid();
        this.cdr.markForCheck();
      });

    const orderChanged$ = this.isTopLevelList
      ? this.orderService.orderChanged$.pipe(skip(1))
      : this.orderService.orderChanged$;

    this._orderChangedSub = orderChanged$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        if (this.isTopLevelList) {
          this.gridRef?.gridApi?.purgeInfiniteCache();
        } else {
          this.getOrders(() => this.applyFilters());
        }
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._orderChangedSub) {
      this._orderChangedSub.unsubscribe();
    }
  }

  openModal(initialState: any) {
    // Only pre-fill a blank Order with the parent client on Add - editAction() already put the
    // real order (and its id) on initialState.data, and overwriting it here was discarding that
    // and showing an empty form when editing an order from within a client's Pedidos tab.
    if (this.parentData != null && !initialState.isEdit) {
      initialState = {
        ...initialState,
        data: <Order>{
          businessPartnerId: this.parentData?.id,
          businessPartnerName: this.parentData?.name,
          orderProducts: [],
        },
      };
    }

    this.modalService.showTemplateModal(
      OrderDetailsModalComponent,
      initialState,
    );
  }

  deleteOrder(order: Order): void {
    this.orderService
      .delete(order)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<Order>) => {
        if (response.status === ResponseStatus.Success) {
          if (this.isTopLevelList) {
            this.gridRef?.gridApi?.purgeInfiniteCache();
          } else {
            this.filteredRowData = this.filteredRowData.filter(
              (p) => p.id !== order.id,
            );
          }
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

  refreshOrders(): void {
    if (this.isTopLevelList) {
      this.notificationService.showMessage(
        ResponseStatus.Success,
        this.translationService.instant('ORDERS.ORDERS_REFRESHED'),
      );
      return;
    }
    this.getOrders(() => this.applyFilters(), true);
  }

  applyFilters(): void {
    if (this.isTopLevelList) {
      this.gridRef?.gridApi?.purgeInfiniteCache();
      return;
    }
    let filtered = [...this.rowData];
    // Filter by date range (start and end) using createDate
    if (this.filterStartDate || this.filterEndDate) {
      filtered = filtered.filter((item) => {
        if (!item.createDate) return false;
        const itemDate = new Date(item.createDate).toISOString().slice(0, 10);
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
    // Filter by status (compare directly with status value in EN)
    const selectedStatuses = Object.entries(this.filterStatus)
      .filter(([_, checked]) => checked)
      .map(([label]) => label);
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((item) =>
        selectedStatuses.includes(item.status ?? ''),
      );
    }
    this.filteredRowData = filtered;
  }

  clearFilters(): void {
    this.filterStartDate = null;
    this.filterEndDate = null;
    this.filterStatus = {
      Open: false,
      WaitingPayment: false,
      Closed: false,
    };
    if (this.isTopLevelList) {
      this.gridRef?.gridApi?.purgeInfiniteCache();
      return;
    }
    this.filteredRowData = [...this.rowData];
  }

  private getSelectedStatuses(): string[] {
    return Object.entries(this.filterStatus)
      .filter(([, checked]) => checked)
      .map(([label]) => label);
  }

  private initializeGrid(): void {
    this.columnDefs = [
      {
        field: 'id',
        headerName: 'ID',
        sortable: true,
        filter: true,
        // minWidth: 80,
        hide: true,
      },
      {
        field: 'orderNumber',
        headerName: this.translationService.instant('ORDERS.ORDER_NUMBER'),
        sortable: true,
        filter: true,
        width: 150,
        resizable: true,
        // minWidth: 150,
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? '';
          // href="#" prevents full page reload; onCellClicked handles navigation
          return `<a data-action="view" class="ag-link">${value}</a>`;
        },
      },
      {
        field: 'businessPartnerName',
        headerName: this.translationService.instant('BUSINESS_PARTNER.CLIENT_NAME'),
        sortable: true,
        filter: true,
        flex: 1,
        hide: this.entity === 'BusinessPartner',
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? '';
          // href="#" prevents full page reload; onCellClicked handles navigation
          return `<a data-action="view" class="ag-link">${value}</a>`;
        },
      },
      {
        field: 'description',
        headerName: this.translationService.instant('COMMON.DESCRIPTION'),
        sortable: true,
        filter: true,
        flex: 2,
        width: 200,
      },
      {
        field: 'totalPrice',
        headerName: this.translationService.instant('COMMON.TOTAL_VALUE'),
        sortable: true,
        filter: true,
        width: 120,
        cellClass: 'text-start',
        valueFormatter: (params: ValueFormatterParams) =>
          formatCurrencyBRL(params.value),
      },
      {
        field: 'date',
        headerName: this.translationService.instant('COMMON.DATE'),
        sortable: true,
        filter: true,
        flex: 2,
        minWidth: 160,
        valueFormatter: (params: ValueFormatterParams) =>
          formatDateBR(params.value),
      },
      {
        field: 'status',
        headerName: this.translationService.instant('COMMON.STATUS'),
        sortable: true,
        filter: true,
        flex: 2,
        width: 80,
        cellRenderer: (params: ICellRendererParams) => {
          const value = params.value;
          let color = 'secondary';
          // Importar OrderStatus corretamente no topo do arquivo se necessário
          let label = value;
          if (value === 'Closed') {
            color = 'success';
            label = this.translationService.instant('QUOTES.STATUS_CLOSED');
          } else if (value === 'Open') {
            color = 'info';
            label = this.translationService.instant('QUOTES.STATUS_OPEN');
          } else if (value === 'WaitingPayment') {
            color = 'warning';
            label = this.translationService.instant('QUOTES.STATUS_WAITING_PAYMENT');
          }
          return `<span class="badge bg-${color}">${label}</span>`;
        },
      },
      {
        headerName: this.translationService.instant('COMMON.ACTIONS'),
        flex: 1,
        minWidth: 150,
        sortable: false,
        filter: false,
        resizable: true,
        width: 280,
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

  private getOrders(callback?: () => void, isRefresh = false): void {
    let orders$: Observable<WebApiResponse<Order[]>> =
      this.entity != '' && this.parentData?.id != null
        ? this.orderService.getByBusinessPartnerId(this.parentData.id)
        : this.orderService.getAll();

    this.loading = true;
    this.cdr.markForCheck();
    orders$.pipe(takeUntil(this._destroy$)).subscribe({
      next: (response: WebApiResponse<Order[]>) => {
        this.rowData = response.data ?? [];

        if (callback) {
          callback();
        }

        if (isRefresh) {
          this.notificationService.showMessage(
            ResponseStatus.Success,
            this.translationService.instant('ORDERS.ORDERS_REFRESHED'),
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

  private setFiltersFromQueryParams(): void {
    // Reads filters from URL (query params)
    const params =
      window && window.location && window.location.search
        ? Object.fromEntries(new URLSearchParams(window.location.search))
        : {};

    // Initializes filters
    this.filterStatus = { Open: false, WaitingPayment: false, Closed: false };
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
    // Date filters
    if (params['startDate']) this.filterStartDate = params['startDate'];
    if (params['endDate']) this.filterEndDate = params['endDate'];

    // Set showFiltersOnInit only on initialization
    this.showFiltersOnInit = this.hasInitialFilters();
  }

  private hasInitialFilters(): boolean {
    // Checks if any filter is active
    if (this.filterStartDate || this.filterEndDate) return true;
    if (Object.values(this.filterStatus).some((v) => v)) return true;
    return false;
  }
}
