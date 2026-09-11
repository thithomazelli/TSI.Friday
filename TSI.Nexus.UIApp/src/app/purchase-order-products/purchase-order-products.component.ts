import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import {
  ModalService,
  NotificationService,
  PurchaseOrderProduct,
  PurchaseOrderProductService,
  ResponseStatus,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { ColDef, ValueFormatterParams } from 'ag-grid-community';
import { Observable, Subject, takeUntil } from 'rxjs';

import { PurchaseOrderProductsDetailsModalComponent } from './components/purchase-order-product-details-modal/purchase-order-products-details-modal.component';
import { GridComponent } from '../shared/grid/grid.component';
import { TranslatePipe } from '../core/pipes/translate.pipe';

// Embedded 1-N grid for purchase order items, used in the Purchase Order details page's
// "Produtos" tab (parentId = purchaseOrderId): full CRUD, the actual way items get
// added/edited/removed from a Pedido de Compra. Mirrors OrderProductsComponent.
@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-purchase-order-products',
    templateUrl: './purchase-order-products.component.html',
    styleUrl: './purchase-order-products.component.scss',
    imports: [GridComponent, TranslatePipe],
})
export class PurchaseOrderProductsComponent implements OnInit, OnChanges, OnDestroy {
  @Input()
  compact: boolean = false;

  @Input()
  parentId?: string | null = null;

  rowData: PurchaseOrderProduct[] = [];
  columnDefs: ColDef[] = [];
  loading: boolean = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private modalService: ModalService,
    private notificationService: NotificationService,
    private purchaseOrderProductService: PurchaseOrderProductService,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.initializeColumnDefs();
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.initializeColumnDefs());
    this.load();
    this.purchaseOrderProductService.purchaseOrderProductChanged$
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
    this.modalService.showTemplateModal(
      PurchaseOrderProductsDetailsModalComponent,
      {
        ...initialState,
        parentId: initialState.data?.purchaseOrderId ?? this.parentId,
      },
    );
  }

  refresh(): void {
    this.load(true);
  }

  // <app-grid>'s [update] input is required (no toggle-style action column here to trigger it).
  noop(): void {}

  deletePurchaseOrderProduct(purchaseOrderProduct: PurchaseOrderProduct): void {
    this.purchaseOrderProductService
      .delete(purchaseOrderProduct)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<PurchaseOrderProduct>) => {
        this.rowData = this.rowData.filter((p) => p.id !== purchaseOrderProduct.id);
        this.modalService.hideModal();
        this.modalService.showSweetNotification(
          this.translationService.instant('PURCHASE_ORDER_PRODUCTS.ITEM_DELETED'),
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
        minWidth: 180,
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? '';
          return `<a data-action="edit" class="ag-link">${value}</a>`;
        },
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
          <button class="btn btn-danger btn-sm" data-action="delete">
            <i class="fas fa-trash" data-action="delete"></i>
          </button>
        `;
        },
      },
    ];
  }

  private load(isRefresh = false): void {
    if (!this.parentId) {
      return;
    }

    const purchaseOrderProducts$: Observable<WebApiResponse<PurchaseOrderProduct[]>> =
      this.purchaseOrderProductService.getByEntityId(this.parentId, 'PurchaseOrder');

    this.loading = true;
    purchaseOrderProducts$.pipe(takeUntil(this._destroy$)).subscribe({
      next: (response: WebApiResponse<PurchaseOrderProduct[]>) => {
        this.rowData = response.data ?? [];
        this.loading = false;

        if (isRefresh) {
          this.notificationService.showMessage(
            ResponseStatus.Success,
            this.translationService.instant('PURCHASE_ORDER_PRODUCTS.PURCHASE_ORDER_PRODUCTS_REFRESHED'),
          );
        }
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
