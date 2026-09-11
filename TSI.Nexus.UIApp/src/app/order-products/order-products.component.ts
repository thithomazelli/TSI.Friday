import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import {
  ModalService,
  NotificationService,
  OrderProduct,
  OrderProductService,
  ResponseStatus,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { ColDef, ValueFormatterParams } from 'ag-grid-community';
import { Observable, Subject, takeUntil } from 'rxjs';

import { OrderProductsDetailsModalComponent } from './components/order-product-details-modal/order-products-details-modal.component';
import { GridComponent } from '../shared/grid/grid.component';
import { TranslatePipe } from '../core/pipes/translate.pipe';

// Embedded 1-N grid for order items, used in two places:
// - Order details page, "Produtos" tab (parentId = orderId): full CRUD, the actual way items get
//   added/edited/removed from a Pedido de Venda.
// - Product details page, "Histórico" tab (parentId = productId, isFromProductsView = true):
//   read-only list of which orders this product has been sold on.
@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-order-products',
    templateUrl: './order-products.component.html',
    styleUrl: './order-products.component.scss',
    imports: [GridComponent, TranslatePipe],
})
export class OrderProductsComponent implements OnInit, OnChanges, OnDestroy {
  @Input()
  compact: boolean = false;

  @Input()
  parentId?: string | null = null;

  @Input()
  isFromProductsView: boolean = false;

  rowData: OrderProduct[] = [];
  columnDefs: ColDef[] = [];
  loading: boolean = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private modalService: ModalService,
    private notificationService: NotificationService,
    private orderProductService: OrderProductService,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.initializeColumnDefs();
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.initializeColumnDefs());
    this.load();
    this.orderProductService.orderProductChanged$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.load());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['parentId'] && !changes['parentId'].firstChange) {
      this.load();
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  openModal(initialState: any): void {
    this.modalService.showTemplateModal(OrderProductsDetailsModalComponent, {
      ...initialState,
      parentId: initialState.data?.orderId ?? this.parentId,
    });
  }

  refresh(): void {
    this.load(true);
  }

  // <app-grid>'s [update] input is required (no toggle-style action column here to trigger it).
  noop(): void {}

  deleteOrderProduct(orderProduct: OrderProduct): void {
    this.orderProductService
      .delete(orderProduct)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<OrderProduct>) => {
        this.rowData = this.rowData.filter((p) => p.id !== orderProduct.id);
        this.modalService.hideModal();
        this.modalService.showSweetNotification(
          this.translationService.instant('ORDER_PRODUCTS.ITEM_DELETED'),
          response.message,
          'success',
        );
      });
  }

  private initializeColumnDefs(): void {
    this.columnDefs = [
      {
        field: 'id',
        headerName: 'ID',
        hide: true,
      },
      {
        field: 'productSku',
        headerName: 'SKU',
        sortable: true,
        filter: true,
        hide: this.isFromProductsView,
        maxWidth: 100,
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? '';
          return `<a data-action="edit" class="ag-link">${value}</a>`;
        },
      },
      {
        field: 'productName',
        headerName: this.translationService.instant('PRODUCTS.SINGULAR'),
        sortable: true,
        filter: true,
        hide: this.isFromProductsView,
        minWidth: 180,
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? '';
          return `<a data-action="edit" class="ag-link">${value}</a>`;
        },
      },
      {
        field: 'orderNumber',
        headerName: this.translationService.instant('ORDERS.SINGULAR'),
        sortable: true,
        filter: true,
        flex: 1,
        minWidth: 120,
        hide: !this.isFromProductsView,
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? 'N/A';
          return `<a data-action="edit" class="ag-link">${value}</a>`;
        },
      },
      {
        field: 'businessPartnerName',
        headerName: this.translationService.instant('BUSINESS_PARTNER.CLIENT_SINGULAR'),
        sortable: true,
        filter: true,
        flex: 1,
        minWidth: 200,
        hide: !this.isFromProductsView,
      },
      {
        field: 'quantity',
        headerName: this.translationService.instant('COMMON.QUANTITY'),
        sortable: true,
        filter: true,
        maxWidth: 120,
      },
      {
        field: 'totalPrice',
        headerName: this.translationService.instant('COMMON.TOTAL_VALUE'),
        sortable: true,
        filter: true,
        maxWidth: 140,
        valueFormatter: (params: ValueFormatterParams) =>
          params.value ? `R$ ${params.value.toFixed(2)}` : 'R$ 0,00',
      },
      {
        headerName: this.translationService.instant('COMMON.ACTIONS'),
        flex: 1,
        minWidth: 150,
        sortable: false,
        filter: false,
        resizable: true,
        cellRenderer: () => {
          return `
          <button class="btn btn-info btn-sm" data-action="edit">
            <i class="fas fa-edit" data-action="edit"></i>
          </button>
          ${
            !this.isFromProductsView
              ? `
          <button class="btn btn-danger btn-sm" data-action="delete">
            <i class="fas fa-trash" data-action="delete"></i>
          </button>
          `
              : ''
          }
        `;
        },
      },
    ];
  }

  private load(isRefresh = false): void {
    if (!this.parentId) {
      return;
    }

    const entity = this.isFromProductsView ? 'Product' : 'Order';
    const orderProducts$: Observable<WebApiResponse<OrderProduct[]>> =
      this.orderProductService.getByEntityId(this.parentId, entity);

    this.loading = true;
    orderProducts$.pipe(takeUntil(this._destroy$)).subscribe({
      next: (response: WebApiResponse<OrderProduct[]>) => {
        this.rowData = response.data ?? [];
        this.loading = false;

        if (isRefresh) {
          this.notificationService.showMessage(
            ResponseStatus.Success,
            this.translationService.instant('ORDER_PRODUCTS.ORDER_PRODUCTS_REFRESHED'),
          );
        }
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
