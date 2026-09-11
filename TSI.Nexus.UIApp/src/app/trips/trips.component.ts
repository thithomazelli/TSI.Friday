import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
  ApiType,
  Company,
  Driver,
  Individual,
  ModalService,
  NotificationService,
  PagedRequest,
  PagedResult,
  Trip,
  TripService,
  Vehicle,
  ResponseStatus,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import {
  ColDef,
  ICellRendererParams,
  ValueFormatterParams,
} from 'ag-grid-community';
import { TripDetailsModalComponent } from './components/trip-details-modal/trip-details-modal.component';
import { Observable, Subject, Subscription, skip, takeUntil } from 'rxjs';
import { NgIf } from '@angular/common';
import { HeaderComponent } from '../shared/header/header.component';
import { GridComponent } from '../shared/grid/grid.component';
import { DateFieldComponent } from '../shared/components/date-field/date-field.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { formatCurrencyBRL, formatDateBR } from '../core/utilities/format-utils';

@Component({
    selector: 'app-trips',
    templateUrl: './trips.component.html',
    styleUrl: './trips.component.scss',
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
export class TripsComponent implements OnInit, OnDestroy {
  @Input()
  compact: boolean = false;

  @Input()
  entity: string | null = '';

  @Input()
  parentData: Individual | Company | Driver | Vehicle | null | undefined = null;

  baseEndPoint = ApiType.Trips;
  rowData: Trip[] = [];
  loading: boolean = false;
  columnDefs: ColDef[] = [];

  filteredRowData: Trip[] = [];
  filterStartDate: string | null = null;
  filterEndDate: string | null = null;
  filterStatus = {
    Open: false,
    WaitingPayment: false,
    Closed: false,
  };
  showFiltersOnInit = false;

  @ViewChild('gridRef') private gridRef?: GridComponent<Trip>;

  private _tripChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  constructor(
    private modalService: ModalService,
    private notificationService: NotificationService,
    private tripService: TripService,
    private translationService: TranslationService,
  ) {}

  // True for the main Trips listing screen (server-side paginated); false for the tab embedded
  // inside a Vehicle/Driver/BusinessPartner details page, which shows a small, already-scoped
  // subset and stays client-side exactly as before - mirrors the same branching getTrips() uses
  // to pick which fetch method to call.
  get isTopLevelList(): boolean {
    if (this.entity === 'Driver' && this.parentData?.id != null) {
      return false;
    }
    if (this.entity === 'Vehicle' && this.parentData?.id != null) {
      return false;
    }
    if (this.entity !== '' && this.parentData?.id != null) {
      return false;
    }
    return true;
  }

  pagedDataSource = (request: PagedRequest): Observable<PagedResult<Trip>> => {
    return this.tripService.getAllPaged({
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

    // For the top-level list, the grid fetches its own first page once ag-Grid is ready - the
    // BehaviorSubject's immediate replay on subscribe is skipped so it doesn't also trigger a
    // pointless getTrips()/getAll() call; only later, real change notifications matter there.
    const tripChanged$ = this.isTopLevelList
      ? this.tripService.tripChanged$.pipe(skip(1))
      : this.tripService.tripChanged$;

    this._tripChangedSub = tripChanged$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        if (this.isTopLevelList) {
          this.gridRef?.gridApi?.purgeInfiniteCache();
        } else {
          this.getTrips(() => this.applyFilters());
        }
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._tripChangedSub) {
      this._tripChangedSub.unsubscribe();
    }
  }

  openModal(initialState: any) {
    // Only a brand-new Trip should be prefilled from the tab's parent entity (Vehicle/Driver/
    // BusinessPartner) - editing/viewing an existing one already carries its own real data in
    // initialState.data (from the grid row or calendar event), which this must never overwrite.
    if (!initialState?.isEdit && this.parentData != null && this.entity === 'Vehicle') {
      initialState = {
        ...initialState,
        data: <Trip>{
          vehicleId: this.parentData?.id,
          vehiclePlate: (this.parentData as Vehicle)?.plate,
        },
      };
    } else if (!initialState?.isEdit && this.parentData != null) {
      const parentData = this.parentData as Individual | Company | Driver;
      initialState = {
        ...initialState,
        data: <Trip>{
          businessPartnerId: parentData?.id,
          businessPartnerName: parentData?.name,
        },
      };
    }

    this.modalService.showTemplateModal(
      TripDetailsModalComponent,
      initialState,
    );
  }

  deleteTrip(trip: Trip): void {
    this.tripService
      .delete(trip)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<Trip>) => {
        if (response.status === ResponseStatus.Success) {
          if (this.isTopLevelList) {
            this.gridRef?.gridApi?.purgeInfiniteCache();
          } else {
            this.filteredRowData = this.filteredRowData.filter(
              (p) => p.id !== trip.id,
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

  refreshTrips(): void {
    // For the top-level list, <app-grid>'s own refresh button already purges the infinite cache
    // (see GridComponent.onRefreshClicked) - calling getTrips() here would additionally load the
    // entire table, defeating the point of pagination. Only the notification is this call's job.
    if (this.isTopLevelList) {
      this.notificationService.showMessage(
        ResponseStatus.Success,
        this.translationService.instant('TRIPS.TRIPS_REFRESHED'),
      );
      return;
    }
    this.getTrips(() => this.applyFilters(), true);
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
        field: 'tripNumber',
        headerName: this.translationService.instant('TRIPS.TRIP_NUMBER'),
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
        field: 'route',
        headerName: this.translationService.instant('TRIPS.ROUTE'),
        sortable: true,
        filter: true,
        flex: 2,
        width: 200,
      },
      {
        field: 'vehiclePlate',
        headerName: this.translationService.instant('VEHICLES.SINGULAR'),
        sortable: true,
        filter: true,
        width: 120,
        hide: this.entity === 'Vehicle',
      },
      {
        field: 'driverName',
        headerName: this.translationService.instant('SIDEBAR.DRIVER'),
        sortable: true,
        filter: true,
        width: 150,
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

  private getTrips(callback?: () => void, isRefresh = false): void {
    let trips$: Observable<WebApiResponse<Trip[]>>;
    if (this.entity === 'Driver' && this.parentData?.id != null) {
      trips$ = this.tripService.getByDriverId(this.parentData.id);
    } else if (this.entity === 'Vehicle' && this.parentData?.id != null) {
      trips$ = this.tripService.getByVehicleId(this.parentData.id);
    } else if (this.entity != '' && this.parentData?.id != null) {
      trips$ = this.tripService.getByBusinessPartnerId(this.parentData.id);
    } else {
      trips$ = this.tripService.getAll();
    }

    this.loading = true;
    trips$.pipe(takeUntil(this._destroy$)).subscribe({
      next: (response: WebApiResponse<Trip[]>) => {
        this.rowData = response.data ?? [];
        this.loading = false;

        if (callback) {
          callback();
        }

        if (isRefresh) {
          this.notificationService.showMessage(
            ResponseStatus.Success,
            this.translationService.instant('TRIPS.TRIPS_REFRESHED'),
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
