import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  ModalService,
  NotificationService,
  Product,
  ResponseStatus,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { ProductService } from '../core/services/product/product.service';
import { Subscription, tap, Subject, takeUntil, skip, take } from 'rxjs';
import {
  ColDef,
  ValueFormatterParams,
  ICellRendererParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { ProductDetailsModalComponent } from './components/product-details-modal/product-details-modal.component';
import { HeaderComponent } from '../shared/header/header.component';
import { GridComponent } from '../shared/grid/grid.component';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { formatCurrencyBRL } from '../core/utilities/format-utils';

@Component({
    selector: 'app-products',
    templateUrl: './products.component.html',
    styleUrl: './products.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HeaderComponent,
        GridComponent,
        TranslatePipe,
    ],
})
export class ProductsComponent implements OnInit, OnDestroy {
  private _productChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  baseEndPoint = 'products';

  get unitMap(): { [key: string]: string } {
    return {
      Unit: this.translationService.instant('PRODUCTS.UNIT_UNIT'),
      Kilogram: this.translationService.instant('PRODUCTS.UNIT_KILOGRAM'),
      Gram: this.translationService.instant('PRODUCTS.UNIT_GRAM'),
    };
  }

  get typeMap(): { [key: string]: string } {
    return {
      Sale: this.translationService.instant('PRODUCTS.TYPE_SALE'),
      Rental: this.translationService.instant('PRODUCTS.TYPE_RENTAL'),
      Service: this.translationService.instant('PRODUCTS.SINGULAR'),
    };
  }

  rowData: Product[] = [];
  filteredRowData: Product[] = [];
  loading: boolean = false;
  columnDefs: ColDef[] = [];

  // Set from the ?stockStatus=Low query param (navbar stock alert's "ver todos"): same "<=3" rule
  // as the alert itself, includes both zero and low stock.
  private _stockStatusFilter: string | null = null;

  private buildColumnDefs(): void {
    this.columnDefs = [
    {
      field: 'id',
      headerName: 'ID',
      sortable: true,
      filter: true,
      hide: true,
    },
    {
      field: 'sku',
      headerName: 'SKU',
      sortable: true,
      filter: true,
      width: 90,
      resizable: true,
      cellRenderer: (params: ValueFormatterParams) => {
        const value = params.value ?? '';
        // href="#" prevents full page reload; onCellClicked handles navigation
        return `<a data-action="view" class="ag-link">${value}</a>`;
      },
    },
    {
      field: 'name',
      headerName: this.translationService.instant('COMMON.NAME'),
      sortable: true,
      filter: true,
      flex: 1,
      minWidth: 250,
      cellRenderer: (params: ValueFormatterParams) => {
        const value = params.value ?? '';
        // href="#" prevents full page reload; onCellClicked handles navigation
        return `<a data-action="view" class="ag-link">${value}</a>`;
      },
    },
    {
      field: 'quantityInStock',
      headerName: this.translationService.instant('COMMON.STATUS'),
      sortable: true,
      filter: true,
      maxWidth: 120,
      cellRenderer: (params: ICellRendererParams) => {
        const value = params.value;
        const type = params.data?.type;
        let color = 'secondary';
        let label = value;

        if (type === 'Service') {
          color = 'success';
          label = this.translationService.instant('PRODUCTS.STATUS_AVAILABLE');
        } else if (value === 0) {
          color = 'danger';
          label = this.translationService.instant('PRODUCTS.STATUS_UNAVAILABLE');
        } else {
          color = 'success';
          label = this.translationService.instant('PRODUCTS.STATUS_AVAILABLE');
        }
        return `<span class="badge bg-${color}">${label}</span>`;
      },
    },
    {
      field: 'quantityInStock',
      headerName: this.translationService.instant('PRODUCTS.STOCK'),
      sortable: true,
      filter: true,
      maxWidth: 120,
    },
    {
      field: 'price',
      headerName: this.translationService.instant('COMMON.PRICE'),
      sortable: true,
      filter: true,
      maxWidth: 120,
      valueFormatter: (params: ValueFormatterParams) =>
        formatCurrencyBRL(params.value),
    },
    {
      field: 'category',
      headerName: this.translationService.instant('VEHICLES.CATEGORY'),
      sortable: true,
      filter: true,
      maxWidth: 120,
    },
    {
      field: 'unit',
      headerName: this.translationService.instant('PRODUCTS.UNIT_UNIT'),
      sortable: true,
      filter: true,
      maxWidth: 120,
      filterValueGetter: (params: ValueGetterParams) => {
        return this.getUnitLabel(params.data?.unit);
      },
      cellRenderer: (params: ICellRendererParams) => {
        return this.getUnitLabel(params.data?.unit);
      },
    },
    {
      field: 'type',
      headerName: this.translationService.instant('COMMON.TYPE'),
      sortable: true,
      filter: true,
      maxWidth: 120,
      filterValueGetter: (params: ValueGetterParams) => {
        return this.getTypeLabel(params.data?.type);
      },
      cellRenderer: (params: ICellRendererParams) => {
        return this.getTypeLabel(params.data?.type);
      },
    },
    {
      headerName: this.translationService.instant('COMMON.ACTIONS'),
      flex: 1,
      minWidth: 150,
      sortable: false,
      filter: false,
      resizable: true,
      cellRenderer: (params: ICellRendererParams) => {
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

  constructor(
    private activatedRoute: ActivatedRoute,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private productService: ProductService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
  ) {
    this.buildColumnDefs();
    this.translationService.language$.subscribe(() => {
      this.buildColumnDefs();
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    this._stockStatusFilter = this.activatedRoute.snapshot.queryParamMap.get('stockStatus');

    this._productChangedSub = this.productService.productChanged$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        this.getProducts();
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._productChangedSub) {
      this._productChangedSub.unsubscribe();
    }
  }

  openModal(initialState: any) {
    this.modalService.showTemplateModal(
      ProductDetailsModalComponent,
      initialState,
    );
  }

  deleteProduct(product: Product): void {
    this.productService
      .delete(product)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<Product>) => {
        if (response.status === ResponseStatus.Success) {
          this.rowData = this.rowData.filter((p) => p.id !== product.id);
          this.applyStockStatusFilter();
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

  refreshProducts(): void {
    this.loading = true;
    this.cdr.markForCheck();
    // getAll() is now the shared cached stream (see ProductService), so subscribing to it no
    // longer triggers its own fetch - skip(1) drops the value it replays immediately on
    // subscribe (whatever is currently cached) and waits for the one fresh emission that
    // refresh() below is about to cause.
    this.productService
      .getAll()
      .pipe(
        skip(1),
        take(1),
        tap({
          next: () =>
            this.notificationService.showMessage(
              ResponseStatus.Success,
              this.translationService.instant('PRODUCTS.PRODUCTS_REFRESHED'),
            ),
          error: () =>
            this.notificationService.showMessage(
              ResponseStatus.Error,
              this.translationService.instant('PRODUCTS.PRODUCTS_REFRESH_ERROR'),
            ),
        }),
        takeUntil(this._destroy$),
      )
      .subscribe({
        next: (response: WebApiResponse<Product[]>) => {
          this.rowData = response.data ?? [];
          this.applyStockStatusFilter();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
    this.productService.refresh();
  }

  private getProducts(): void {
    this.loading = true;
    this.cdr.markForCheck();
    // This screen is the authoritative product list, so it can't settle for whatever the shared
    // cache happens to hold (e.g. left over from a picker opened on a previous visit) - subscribe
    // first, then force a fresh fetch so every other getAll() consumer picks up the same result.
    this.productService
      .getAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (response: WebApiResponse<Product[]>) => {
          this.rowData = response.data ?? [];
          this.applyStockStatusFilter();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
    this.productService.refresh();
  }

  private applyStockStatusFilter(): void {
    this.filteredRowData =
      this._stockStatusFilter === 'Low'
        ? this.rowData.filter((p) => (p.quantityInStock ?? 0) <= 3)
        : this.rowData;
  }

  private getUnitLabel(unit: string): string {
    return this.unitMap[unit] ?? unit ?? '';
  }

  private getTypeLabel(type: string): string {
    return this.typeMap[type] ?? type ?? '';
  }
}
