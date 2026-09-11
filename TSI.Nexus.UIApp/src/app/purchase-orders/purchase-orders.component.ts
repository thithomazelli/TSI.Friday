import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
  ApiType,
  Company,
  Individual,
  ModalService,
  NotificationService,
  PagedRequest,
  PagedResult,
  PurchaseOrder,
  PurchaseOrderService,
  ResponseStatus,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import {
  ColDef,
  ICellRendererParams,
  ValueFormatterParams,
} from 'ag-grid-community';
import { PurchaseOrderDetailsModalComponent } from './components/purchase-order-details-modal/purchase-order-details-modal.component';
import { Observable, Subject, Subscription, skip, takeUntil } from 'rxjs';
import { NgIf } from '@angular/common';
import { HeaderComponent } from '../shared/header/header.component';
import { GridComponent } from '../shared/grid/grid.component';
import { DateFieldComponent } from '../shared/components/date-field/date-field.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { formatCurrencyBRL, formatDateBR } from '../core/utilities/format-utils';

@Component({
    selector: 'app-purchase-orders',
    templateUrl: './purchase-orders.component.html',
    styleUrl: './purchase-orders.component.scss',
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
export class PurchaseOrdersComponent implements OnInit, OnDestroy {
  @Input()
  compact: boolean = false;

  @Input()
  entity: string | null = '';

  @Input()
  parentData: Individual | Company | null = null;

  baseEndPoint = ApiType.PurchaseOrders;
  rowData: PurchaseOrder[] = [];
  columnDefs: ColDef[] = [];
  loading: boolean = false;

  filteredRowData: PurchaseOrder[] = [];
  filterStartDate: string | null = null;
  filterEndDate: string | null = null;
  filterStatus = {
    Open: false,
    WaitingPayment: false,
    Closed: false,
  };
  showFiltersOnInit = false;

  @ViewChild('gridRef') private gridRef?: GridComponent<PurchaseOrder>;

  // True for the main Purchase Orders listing screen (server-side paginated); false for the tab
  // embedded inside a Supplier's details page, which shows a small, already-scoped subset and
  // stays client-side exactly as before - mirrors the same branching getPurchaseOrders() uses to
  // pick which fetch method to call.
  get isTopLevelList(): boolean {
    return !(this.entity !== '' && this.parentData?.id != null);
  }

  pagedDataSource = (request: PagedRequest): Observable<PagedResult<PurchaseOrder>> => {
    return this.purchaseOrderService.getAllPaged({
      ...request,
      startDate: this.filterStartDate ?? undefined,
      endDate: this.filterEndDate ?? undefined,
      statuses: this.getSelectedStatuses(),
    });
  };

  private _purchaseOrderChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  constructor(
    private modalService: ModalService,
    private notificationService: NotificationService,
    private purchaseOrderService: PurchaseOrderService,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.setFiltersFromQueryParams();
    this.initializeGrid();
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.initializeGrid());

    // For the top-level list, the grid fetches its own first page once ag-Grid is ready - the
    // BehaviorSubject's immediate replay on subscribe is skipped so it doesn't also trigger a
    // pointless getPurchaseOrders()/getAll() call; only later, real change notifications matter.
    const purchaseOrderChanged$ = this.isTopLevelList
      ? this.purchaseOrderService.purchaseOrderChanged$.pipe(skip(1))
      : this.purchaseOrderService.purchaseOrderChanged$;

    this._purchaseOrderChangedSub = purchaseOrderChanged$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        if (this.isTopLevelList) {
          this.gridRef?.gridApi?.purgeInfiniteCache();
        } else {
          this.getPurchaseOrders(() => this.applyFilters());
        }
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._purchaseOrderChangedSub) {
      this._purchaseOrderChangedSub.unsubscribe();
    }
  }

  openModal(initialState: any) {
    // Only pre-fill a blank Purchase Order with the parent supplier on Add - editAction() already
    // put the real purchase order (and its id) on initialState.data, and overwriting it here was
    // discarding that and showing an empty form when editing from within a supplier's Pedidos tab.
    if (this.parentData != null && !initialState.isEdit) {
      initialState = {
        ...initialState,
        data: <PurchaseOrder>{
          businessPartnerId: this.parentData?.id,
          businessPartnerName: this.parentData?.name,
          purchaseOrderProducts: [],
        },
      };
    }

    this.modalService.showTemplateModal(
      PurchaseOrderDetailsModalComponent,
      initialState,
    );
  }

  deletePurchaseOrder(purchaseOrder: PurchaseOrder): void {
    this.purchaseOrderService
      .delete(purchaseOrder)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<PurchaseOrder>) => {
        if (response.status === ResponseStatus.Success) {
          if (this.isTopLevelList) {
            this.gridRef?.gridApi?.purgeInfiniteCache();
          } else {
            this.filteredRowData = this.filteredRowData.filter(
              (p) => p.id !== purchaseOrder.id,
            );
          }
        }
        this.modalService.hideModal();
        this.modalService.showSweetNotification(
          '',
          response.message,
          response.status,
        );
      });
  }

  refreshPurchaseOrders(): void {
    // For the top-level list, <app-grid>'s own refresh button already purges the infinite cache
    // (see GridComponent.onRefreshClicked) - calling getPurchaseOrders() here would additionally
    // load the entire table, defeating the point of pagination. Only the notification is this
    // call's job.
    if (this.isTopLevelList) {
      this.notificationService.showMessage(
        ResponseStatus.Success,
        this.translationService.instant('PURCHASE_ORDERS.PURCHASE_ORDERS_REFRESHED'),
      );
      return;
    }
    this.getPurchaseOrders(() => this.applyFilters(), true);
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
        hide: true,
      },
      {
        field: 'purchaseOrderNumber',
        headerName: this.translationService.instant('PURCHASE_ORDERS.PURCHASE_ORDER_NUMBER'),
        sortable: true,
        filter: true,
        width: 150,
        resizable: true,
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? '';
          return `<a data-action="view" class="ag-link">${value}</a>`;
        },
      },
      {
        field: 'businessPartnerName',
        headerName: this.translationService.instant('BUSINESS_PARTNER.SUPPLIER_NAME'),
        sortable: true,
        filter: true,
        flex: 1,
        hide: this.entity === 'BusinessPartner',
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? '';
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

  private getPurchaseOrders(callback?: () => void, isRefresh = false): void {
    let purchaseOrders$: Observable<WebApiResponse<PurchaseOrder[]>> =
      this.entity != '' && this.parentData?.id != null
        ? this.purchaseOrderService.getByBusinessPartnerId(this.parentData.id)
        : this.purchaseOrderService.getAll();

    this.loading = true;
    purchaseOrders$.pipe(takeUntil(this._destroy$)).subscribe({
      next: (response: WebApiResponse<PurchaseOrder[]>) => {
        this.rowData = response.data ?? [];
        this.loading = false;

        if (callback) {
          callback();
        }

        if (isRefresh) {
          this.notificationService.showMessage(
            ResponseStatus.Success,
            this.translationService.instant('PURCHASE_ORDERS.PURCHASE_ORDERS_REFRESHED'),
          );
        }
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private setFiltersFromQueryParams(): void {
    const params =
      window && window.location && window.location.search
        ? Object.fromEntries(new URLSearchParams(window.location.search))
        : {};

    this.filterStatus = { Open: false, WaitingPayment: false, Closed: false };
    this.filterStartDate = null;
    this.filterEndDate = null;

    if (params['status']) {
      const statuses = String(params['status']).split(',');
      statuses.forEach((s: string) => {
        if (Object.prototype.hasOwnProperty.call(this.filterStatus, s)) {
          (this.filterStatus as Record<string, boolean>)[s] = true;
        }
      });
    }
    if (params['startDate']) this.filterStartDate = params['startDate'];
    if (params['endDate']) this.filterEndDate = params['endDate'];

    this.showFiltersOnInit = this.hasInitialFilters();
  }

  private hasInitialFilters(): boolean {
    if (this.filterStartDate || this.filterEndDate) return true;
    if (Object.values(this.filterStatus).some((v) => v)) return true;
    return false;
  }
}
