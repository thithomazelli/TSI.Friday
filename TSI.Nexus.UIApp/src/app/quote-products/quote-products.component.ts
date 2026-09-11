import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  ApiType,
  ModalService,
  NotificationService,
  QuoteProductService,
  ResponseStatus,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';

import { ColDef, ValueFormatterParams } from 'ag-grid-community';
import { QuoteProduct } from '@nexus/core';
import { QuoteProductDetailsModalComponent } from './components/quote-product-details-modal/quote-product-details-modal.component';
import { Observable, Subject, Subscription, takeUntil } from 'rxjs';
import { NgIf } from '@angular/common';
import { HeaderComponent } from '../shared/header/header.component';
import { GridComponent } from '../shared/grid/grid.component';
import { TranslatePipe } from '../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-quote-products',
    templateUrl: './quote-products.component.html',
    styleUrl: './quote-products.component.scss',
    imports: [
        NgIf,
        HeaderComponent,
        GridComponent,
        TranslatePipe,
    ],
})
export class QuoteProductsComponent implements OnInit, OnDestroy {
  @Input()
  compact: boolean = false;

  @Input()
  parentId?: string | null = null;

  @Input()
  isFullList: boolean = true;

  @Input()
  isFromProductsView: boolean = false;

  baseEndPoint = ApiType.QuoteProducts;

  columnDefs: ColDef[] = [];
  rowData: QuoteProduct[] = [];
  filteredRowData: QuoteProduct[] = [];
  loading: boolean = false;

  private _quoteProductChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  constructor(
    private modalService: ModalService,
    private notificationService: NotificationService,
    private quoteProductService: QuoteProductService,
    private route: ActivatedRoute,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this._quoteProductChangedSub = this.quoteProductService.quoteProductChanged$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        this.getQuoteProducts();
      });
    this.initializeGrid();
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.initializeGrid());
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._quoteProductChangedSub) {
      this._quoteProductChangedSub.unsubscribe();
    }
  }

  openModal(initialState: any) {
    const initialStateWithParent = {
      ...initialState,
      parentId: initialState.data?.orderId || this.parentId,
    };

    this.modalService.showTemplateModal(
      QuoteProductDetailsModalComponent,
      initialStateWithParent,
    );
  }

  deleteQuoteProduct(quoteProduct: QuoteProduct): void {
    this.quoteProductService
      .delete(quoteProduct)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<QuoteProduct>) => {
        this.filteredRowData = this.filteredRowData.filter(
          (p) => p.id !== quoteProduct.id,
        );
        this.modalService.hideModal();
        this.modalService.showSweetNotification(
          this.translationService.instant('QUOTES.ITEM_DELETED'),
          response.message,
          'success',
        );
      });
  }

  refreshQuoteProducts(): void {
    this.getQuoteProducts(true);
  }

  private getQuoteProducts(isRefresh = false): void {
    if (!this.parentId && !this.isFullList) {
      return;
    }

    const entity = this.isFromProductsView ? 'Product' : 'Order';
    let quoteProducts$: Observable<WebApiResponse<QuoteProduct[]>>;

    if (this.isFullList) {
      quoteProducts$ = this.quoteProductService.getAll();
    } else {
      quoteProducts$ = this.quoteProductService.getByEntityId(
        this.parentId!,
        entity,
      );
    }

    this.loading = true;
    quoteProducts$.pipe(takeUntil(this._destroy$)).subscribe({
      next: (response: WebApiResponse<QuoteProduct[]>) => {
        this.rowData = response.data ?? [];
        this.filteredRowData = [...this.rowData];
        this.loading = false;

        if (isRefresh) {
          this.notificationService.showMessage(
            ResponseStatus.Success,
            this.translationService.instant('QUOTES.QUOTE_PRODUCTS_REFRESHED'),
          );
        }
      },
      error: () => {
        this.loading = false;
      },
    });
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
        maxWidth: 120,
        valueFormatter: (params: ValueFormatterParams) =>
          params.value ? `R$ ${params.value.toFixed(2)}` : 'R$ 0,00',
      },
      {
        field: 'orderNumber',
        headerName: this.translationService.instant('QUOTES.SINGULAR'),
        sortable: true,
        filter: true,
        flex: 1,
        minWidth: 120,
        hide: !this.isFullList,
      },
      {
        field: 'businessPartnerName',
        headerName: this.translationService.instant('BUSINESS_PARTNER.CLIENT_SINGULAR'),
        sortable: true,
        filter: true,
        flex: 1,
        minWidth: 220,
        hide: !this.isFullList,
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
}
