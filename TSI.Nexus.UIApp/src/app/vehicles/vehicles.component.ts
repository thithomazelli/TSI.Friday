import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import {
  ModalService,
  NotificationService,
  PagedRequest,
  PagedResult,
  ResponseStatus,
  TranslationService,
  Vehicle,
  VehicleService,
  WebApiResponse,
} from '@nexus/core';
import { Observable, Subscription, Subject, skip, takeUntil } from 'rxjs';
import { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community';

import { VehicleDetailsModalComponent } from './components/vehicle-details-modal/vehicle-details-modal.component';
import { HeaderComponent } from '../shared/header/header.component';
import { GridComponent } from '../shared/grid/grid.component';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { formatCurrencyBRL } from '../core/utilities/format-utils';

@Component({
    selector: 'app-vehicles',
    templateUrl: './vehicles.component.html',
    styleUrl: './vehicles.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HeaderComponent,
        GridComponent,
        TranslatePipe,
    ],
})
export class VehiclesComponent implements OnInit, OnDestroy {
  private _vehicleChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  baseEndPoint = 'vehicles';

  get typeMap(): { [key: string]: string } {
    return {
      Bus: this.translationService.instant('VEHICLES.BUS'),
      MiniBus: this.translationService.instant('VEHICLES.MINI_BUS'),
      Van: this.translationService.instant('VEHICLES.VAN'),
      Car: this.translationService.instant('VEHICLES.CAR'),
      Other: this.translationService.instant('VEHICLES.OTHER'),
    };
  }

  get statusMap(): { [key: string]: { label: string; color: string } } {
    return {
      Available: { label: this.translationService.instant('VEHICLES.STATUS_AVAILABLE'), color: 'success' },
      InMaintenance: { label: this.translationService.instant('VEHICLES.STATUS_IN_MAINTENANCE'), color: 'warning' },
      Blocked: { label: this.translationService.instant('VEHICLES.STATUS_BLOCKED'), color: 'danger' },
      Inactive: { label: this.translationService.instant('VEHICLES.STATUS_INACTIVE'), color: 'secondary' },
    };
  }

  columnDefs: ColDef[] = [];

  @ViewChild('gridRef') private gridRef?: GridComponent<Vehicle>;

  pagedDataSource = (request: PagedRequest): Observable<PagedResult<Vehicle>> => {
    return this.vehicleService.getAllPaged(request);
  };

  private buildColumnDefs(): void {
    this.columnDefs = [
    {
      field: 'id',
      headerName: 'ID',
      hide: true,
    },
    {
      field: 'plate',
      headerName: this.translationService.instant('VEHICLES.PLATE'),
      width: 110,
      cellRenderer: (params: ValueFormatterParams) => {
        const value = params.value ?? '';
        return `<a data-action="view" class="ag-link">${value}</a>`;
      },
    },
    {
      field: 'brand',
      headerName: this.translationService.instant('VEHICLES.BRAND'),
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'model',
      headerName: this.translationService.instant('VEHICLES.MODEL'),
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'seatCapacity',
      headerName: this.translationService.instant('VEHICLES.SEATS'),
      maxWidth: 110,
    },
    {
      field: 'type',
      headerName: this.translationService.instant('COMMON.TYPE'),
      maxWidth: 140,
      valueFormatter: (params: ValueFormatterParams) =>
        this.typeMap[params.value] ?? params.value ?? '',
    },
    {
      field: 'status',
      headerName: this.translationService.instant('COMMON.STATUS'),
      maxWidth: 150,
      cellRenderer: (params: ICellRendererParams) => {
        const info = this.statusMap[params.value] ?? {
          label: params.value,
          color: 'secondary',
        };
        return `<span class="badge bg-${info.color}">${info.label}</span>`;
      },
    },
    {
      field: 'pricePerKm',
      headerName: this.translationService.instant('VEHICLES.PRICE_PER_KM_SHORT'),
      maxWidth: 110,
      valueFormatter: (params: ValueFormatterParams) =>
        formatCurrencyBRL(params.value),
    },
    {
      field: 'dailyRate',
      headerName: this.translationService.instant('VEHICLES.DAILY_RATE'),
      maxWidth: 110,
      valueFormatter: (params: ValueFormatterParams) =>
        formatCurrencyBRL(params.value),
    },
    {
      headerName: this.translationService.instant('COMMON.ACTIONS'),
      minWidth: 150,
      sortable: false,
      filter: false,
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

  constructor(
    private modalService: ModalService,
    private notificationService: NotificationService,
    private vehicleService: VehicleService,
    private translationService: TranslationService,
  ) {
    this.buildColumnDefs();
    this.translationService.language$.subscribe(() => this.buildColumnDefs());
  }

  openModal(initialState: any): void {
    this.modalService.showTemplateModal(
      VehicleDetailsModalComponent,
      initialState,
    );
  }

  ngOnInit(): void {
    // vehicleChanged$ replays immediately on subscribe (BehaviorSubject) - skip that first, inert
    // emission so this doesn't purge the grid's cache before it has even loaded its first page.
    this._vehicleChangedSub = this.vehicleService.vehicleChanged$
      .pipe(skip(1), takeUntil(this._destroy$))
      .subscribe(() => {
        this.gridRef?.gridApi?.purgeInfiniteCache();
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._vehicleChangedSub) {
      this._vehicleChangedSub.unsubscribe();
    }
  }

  deleteVehicle(vehicle: Vehicle): void {
    this.vehicleService
      .delete(vehicle)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<Vehicle>) => {
        if (response.status === ResponseStatus.Success) {
          this.gridRef?.gridApi?.purgeInfiniteCache();
        }
        this.notificationService.showMessage(response.status, response.message);
      });
  }

  refreshVehicles(): void {
    // <app-grid>'s own refresh button already purges the infinite cache (see
    // GridComponent.onRefreshClicked) - this only needs to invalidate the separate shared getAll()
    // cache (pickers/forms elsewhere) and show the notification.
    this.vehicleService.refresh().pipe(takeUntil(this._destroy$)).subscribe({
      next: () =>
        this.notificationService.showMessage(
          ResponseStatus.Success,
          this.translationService.instant('VEHICLES.VEHICLES_REFRESHED'),
        ),
      error: () =>
        this.notificationService.showMessage(
          ResponseStatus.Error,
          this.translationService.instant('VEHICLES.VEHICLES_REFRESH_ERROR'),
        ),
    });
  }
}
