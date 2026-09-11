import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Observable, Subject, Subscription, skip, takeUntil } from 'rxjs';

import {
  ApiType,
  Company,
  FeatureFlagService,
  FeatureToggleKeys,
  Individual,
  ModalService,
  NotificationService,
  PagedRequest,
  PagedResult,
  Quote,
  QuoteService,
  QuoteType,
  ResponseStatus,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';

import {
  ColDef,
  ICellRendererParams,
  ValueFormatterParams,
} from 'ag-grid-community';
import { QuoteDetailsModalComponent } from './components/quote-details-modal/quote-details-modal.component';
import { formatCurrencyBRL, formatDateBR } from '../core/utilities/format-utils';
import { NgIf } from '@angular/common';
import { HeaderComponent } from '../shared/header/header.component';
import { GridComponent } from '../shared/grid/grid.component';
import { DateFieldComponent } from '../shared/components/date-field/date-field.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TranslatePipe } from '../core/pipes/translate.pipe';

@Component({
    selector: 'app-quotes',
    templateUrl: './quotes.component.html',
    styleUrl: './quotes.component.scss',
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
export class QuotesComponent implements OnInit, OnDestroy {
  @Input()
  compact: boolean = false;

  @Input()
  entity: string | null = '';

  @Input()
  parentData: Individual | Company | null = null;

  baseEndPoint = ApiType.Quotes;
  rowData: Quote[] = [];
  columnDefs: ColDef[] = [];
  loading: boolean = false;

  filteredRowData: Quote[] = [];
  filterStartDate: string | null = null;
  filterEndDate: string | null = null;
  filterStatus = {
    Open: false,
    WaitingPayment: false,
    Closed: false,
  };
  showFiltersOnInit = false;
  isFleetModuleEnabled = true;

  @ViewChild('gridRef') private gridRef?: GridComponent<Quote>;

  private _quoteChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  constructor(
    private featureFlagService: FeatureFlagService,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private quoteService: QuoteService,
    private translationService: TranslationService,
  ) {}

  // True for the main Quotes listing screen (server-side paginated); false for the tab embedded
  // inside a BusinessPartner details page, which stays client-side exactly as before - mirrors
  // getQuotes()'s own branching.
  get isTopLevelList(): boolean {
    return this.entity === '' || this.parentData?.id == null;
  }

  pagedDataSource = (request: PagedRequest): Observable<PagedResult<Quote>> => {
    return this.quoteService.getAllPaged({
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
      .subscribe(() => this.initializeGrid());

    const quoteChanged$ = this.isTopLevelList
      ? this.quoteService.quoteChanged$.pipe(skip(1))
      : this.quoteService.quoteChanged$;

    this._quoteChangedSub = quoteChanged$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        if (this.isTopLevelList) {
          this.gridRef?.gridApi?.purgeInfiniteCache();
        } else {
          this.getQuotes(() => this.applyFilters());
        }
      });

    this.featureFlagService
      .isEnabled(FeatureToggleKeys.FleetModule)
      .pipe(takeUntil(this._destroy$))
      .subscribe((enabled) => {
        this.isFleetModuleEnabled = enabled;
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._quoteChangedSub) {
      this._quoteChangedSub.unsubscribe();
    }
  }

  openModal(initialState: any) {
    if (this.parentData != null) {
      initialState = {
        ...initialState,
        data: <Quote>{
          type: initialState?.data?.type,
          businessPartnerId: this.parentData?.id,
          businessPartnerName: this.parentData?.name,
          quoteProducts: [],
        },
      };
    }

    this.modalService.showTemplateModal(
      QuoteDetailsModalComponent,
      initialState,
    );
  }

  openNewProductQuoteModal(): void {
    this.openModal({
      isEdit: false,
      id: null,
      data: <Quote>{
        type: QuoteType.Product,
        quoteProducts: [],
      },
    });
  }

  openNewTripQuoteModal(): void {
    this.openModal({
      isEdit: false,
      id: null,
      data: <Quote>{
        type: QuoteType.Trip,
        quoteProducts: [],
      },
    });
  }

  deleteQuote(quote: Quote): void {
    this.quoteService
      .delete(quote)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<Quote>) => {
        if (response.status === ResponseStatus.Success) {
          if (this.isTopLevelList) {
            this.gridRef?.gridApi?.purgeInfiniteCache();
          } else {
            this.filteredRowData = this.filteredRowData.filter(
              (p) => p.id !== quote.id,
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

  refreshQuotes(): void {
    if (this.isTopLevelList) {
      this.notificationService.showMessage(
        ResponseStatus.Success,
        this.translationService.instant('QUOTES.QUOTES_REFRESHED'),
      );
      return;
    }
    this.getQuotes(() => this.applyFilters(), true);
  }

  applyFilters(): void {
    if (this.isTopLevelList) {
      this.gridRef?.gridApi?.purgeInfiniteCache();
      return;
    }
    let filtered = [...this.rowData];
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
        field: 'quoteNumber',
        headerName: this.translationService.instant('QUOTES.QUOTE_NUMBER'),
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
        field: 'type',
        headerName: this.translationService.instant('COMMON.TYPE'),
        sortable: true,
        filter: true,
        width: 100,
        cellRenderer: (params: ICellRendererParams) => {
          const isTrip = params.value === 'Trip';
          const label = isTrip
            ? this.translationService.instant('TRIPS.SINGULAR')
            : this.translationService.instant('PRODUCTS.SINGULAR');
          const color = isTrip ? 'info' : 'secondary';
          return `<span class="badge bg-${color}">${label}</span>`;
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
        minWidth: 150,
        sortable: false,
        filter: false,
        maxWidth: 400,
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

  private getQuotes(callback?: () => void, isRefresh = false): void {
    let quotes$: Observable<WebApiResponse<Quote[]>> =
      this.entity != '' && this.parentData?.id != null
        ? this.quoteService.getByBusinessPartnerId(this.parentData.id)
        : this.quoteService.getAll();

    this.loading = true;
    quotes$.pipe(takeUntil(this._destroy$)).subscribe({
      next: (response: WebApiResponse<Quote[]>) => {
        this.rowData = response.data ?? [];
        this.loading = false;

        if (callback) {
          callback();
        }

        if (isRefresh) {
          this.notificationService.showMessage(
            ResponseStatus.Success,
            this.translationService.instant('QUOTES.QUOTES_REFRESHED'),
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
