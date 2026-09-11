import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import {
  BusinessPartner,
  BusinessPartnerService,
  BusinessPartnerType,
  ModalService,
  NotificationService,
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
import { BusinessPartnerDetailsModalComponent } from './components/business-partner-details-modal/business-partner-details-modal.component';
import { Router } from '@angular/router';
import { Observable, Subject, Subscription, skip, takeUntil } from 'rxjs';
import { HeaderComponent } from '../shared/header/header.component';
import { GridComponent } from '../shared/grid/grid.component';
import { TranslatePipe } from '../core/pipes/translate.pipe';

@Component({
    selector: 'app-business-partners',
    templateUrl: './business-partners.component.html',
    styleUrl: './business-partners.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HeaderComponent,
        GridComponent,
        TranslatePipe,
    ],
})
export class BusinessPartnersComponent {
  title: string = '';
  baseEndPoint: string = '';
  columnDefs: ColDef[] = [];

  @ViewChild('gridRef') private gridRef?: GridComponent<BusinessPartner>;

  get businessPartnerType(): BusinessPartnerType {
    return this.baseEndPoint === 'clients'
      ? BusinessPartnerType.Client
      : BusinessPartnerType.Supplier;
  }

  pagedDataSource = (request: PagedRequest): Observable<PagedResult<BusinessPartner>> => {
    return this.businessPartnerService.getAllPaged(this.businessPartnerType, request);
  };

  private _businessPartnerChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  constructor(
    private businessPartnerService: BusinessPartnerService,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private routerService: Router,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.initialize();
    this.buildColumnDefs();
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        this.initialize();
        this.buildColumnDefs();
        this.cdr.markForCheck();
      });
    // businessPartnerChanged$ replays immediately on subscribe (BehaviorSubject) - skip that
    // first, inert emission so this doesn't purge the grid's cache before it has even loaded
    // its first page.
    this._businessPartnerChangedSub =
      this.businessPartnerService.businessPartnerChanged$
        .pipe(skip(1), takeUntil(this._destroy$))
        .subscribe(() => {
          this.gridRef?.gridApi?.purgeInfiniteCache();
        });
  }

  private buildColumnDefs(): void {
    const t = (key: string) => this.translationService.instant(key);
    this.columnDefs = [
      {
        field: 'id',
        headerName: 'ID',
        sortable: true,
        filter: false,
        hide: true,
      },
      {
        field: 'name',
        headerName: t('COMMON.NAME'),
        sortable: true,
        filter: false,
        minWidth: 250,
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? '';
          return `<a data-action="view" class="ag-link">${value}</a>`;
        },
      },
      {
        field: 'documentType',
        headerName: t('BUSINESS_PARTNER.DOCUMENT_TYPE'),
        sortable: true,
        filter: false,
        flex: 1,
        minWidth: 85,
      },
      {
        headerName: t('BUSINESS_PARTNER.CPF_CNPJ'),
        sortable: true,
        filter: false,
        flex: 1,
        minWidth: 160,
        cellRenderer: (params: ValueFormatterParams) => {
          const documentType = params.data?.documentType;
          let value =
            documentType === 'Física'
              ? params.data?.socialSecurityCard || ''
              : params.data?.nationalRegistry || '';
          const digits = value.replace(/\D/g, '');
          if (documentType === 'Física' && digits.length === 11) {
            return digits.replace(
              /(\d{3})(\d{3})(\d{3})(\d{2})/,
              '$1.$2.$3-$4',
            );
          } else if (documentType !== 'Física' && digits.length === 14) {
            return digits.replace(
              /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
              '$1.$2.$3/$4-$5',
            );
          }
          return value;
        },
      },
      {
        field: 'email',
        headerName: t('COMMON.EMAIL'),
        sortable: true,
        filter: false,
        flex: 1,
        minWidth: 250,
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? '';
          return `<a data-action="view" class="ag-link">${value}</a>`;
        },
      },
      {
        field: 'birthday',
        headerName: t('BUSINESS_PARTNER.BIRTHDAY'),
        sortable: true,
        filter: false,
        flex: 2,
        hide: true,
      },
      {
        field: 'phone',
        headerName: t('COMMON.PHONE'),
        sortable: true,
        filter: false,
        flex: 2,
        hide: true,
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? '';
          const digits = value.replace(/\D/g, '');
          if (digits.length === 10) {
            return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
          }
          return value;
        },
      },
      {
        field: 'mobile',
        headerName: t('BUSINESS_PARTNER.MOBILE'),
        sortable: true,
        filter: false,
        minWidth: 60,
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? '';
          const digits = value.replace(/\D/g, '');
          if (digits.length === 11) {
            return digits.replace(
              /(\d{2})(\d{1})(\d{4})(\d{4})/,
              '($1) $2 $3-$4',
            );
          }
          return value;
        },
      },
      {
        headerName: t('COMMON.ACTIONS'),
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

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._businessPartnerChangedSub) {
      this._businessPartnerChangedSub.unsubscribe();
    }
  }

  openModal(initialState: any) {
    const initialStateWithData = {
      ...initialState,
      data: {
        ...initialState.data,
        type:
          this.baseEndPoint === 'clients'
            ? BusinessPartnerType.Client
            : BusinessPartnerType.Supplier,
      },
    };

    this.modalService.showTemplateModal(
      BusinessPartnerDetailsModalComponent,
      initialStateWithData,
    );
  }

  deleteBusinessPartner(businessPartner: BusinessPartner): void {
    this.businessPartnerService
      .delete(businessPartner)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<BusinessPartner>) => {
        if (response.status === ResponseStatus.Success) {
          this.gridRef?.gridApi?.purgeInfiniteCache();
        }
        this.modalService.hideModal();
        this.modalService.showSweetNotification(
          '',
          response.message,
          response.status,
        );
      });
  }

  refreshBusinessPartners(): void {
    // <app-grid>'s own refresh button already purges the infinite cache (see
    // GridComponent.onRefreshClicked) - this only needs to invalidate the separate shared
    // getClients()/getSuppliers() cache (pickers/forms elsewhere) and show the notification.
    const type = this.businessPartnerType;
    this.businessPartnerService
      .refresh(type)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () =>
          this.notificationService.showMessage(
            ResponseStatus.Success,
            this.translationService.instant(
              type === BusinessPartnerType.Client
                ? 'BUSINESS_PARTNER.CLIENTS_REFRESHED'
                : 'BUSINESS_PARTNER.SUPPLIERS_REFRESHED',
            ),
          ),
        error: () =>
          this.notificationService.showMessage(
            ResponseStatus.Error,
            this.translationService.instant(
              type === BusinessPartnerType.Client
                ? 'BUSINESS_PARTNER.CLIENTS_REFRESH_ERROR'
                : 'BUSINESS_PARTNER.SUPPLIERS_REFRESH_ERROR',
            ),
          ),
      });
  }

  private initialize(): void {
    const url = this.routerService.url;
    if (url.includes('clients')) {
      this.baseEndPoint = 'clients';
      this.title = this.translationService.instant('SIDEBAR.CLIENTS');
    } else if (url.includes('suppliers')) {
      this.baseEndPoint = 'suppliers';
      this.title = this.translationService.instant('SIDEBAR.SUPPLIERS');
    } else {
      this.baseEndPoint = '';
      this.title = '';
    }
  }
}
