import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import {
  ModalService,
  NotificationService,
  ResponseStatus,
  VehicleMaintenance,
  VehicleMaintenanceService,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community';
import { Subject, takeUntil } from 'rxjs';
import { NgIf } from '@angular/common';

import { VehicleMaintenanceDetailsModalComponent } from '../vehicle-maintenance-details-modal/vehicle-maintenance-details-modal.component';
import { HeaderComponent } from '../../../shared/header/header.component';
import { GridComponent } from '../../../shared/grid/grid.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { formatCurrencyBRL, formatDateBR } from '../../../core/utilities/format-utils';

@Component({
    selector: 'app-vehicle-maintenance-list',
    templateUrl: './vehicle-maintenance-list.component.html',
    styleUrl: './vehicle-maintenance-list.component.scss',
    imports: [
        NgIf,
        HeaderComponent,
        GridComponent,
        TranslatePipe,
    ],
})
export class VehicleMaintenanceListComponent
  implements OnInit, OnChanges, OnDestroy
{
  @Input()
  vehicleId?: string;

  @Input()
  compact = false;

  baseEndPoint = 'vehicle-maintenances';
  rowData: VehicleMaintenance[] = [];
  columnDefs: ColDef[] = [];
  loading: boolean = false;

  private _destroy$ = new Subject<void>();

  get statusMap(): { [key: string]: { label: string; color: string } } {
    return {
      Scheduled: { label: this.translationService.instant('VEHICLES.MAINTENANCE_SCHEDULED'), color: 'info' },
      InProgress: { label: this.translationService.instant('VEHICLES.MAINTENANCE_IN_PROGRESS'), color: 'warning' },
      Completed: { label: this.translationService.instant('VEHICLES.MAINTENANCE_COMPLETED'), color: 'success' },
      Overdue: { label: this.translationService.instant('VEHICLES.MAINTENANCE_OVERDUE'), color: 'danger' },
      Cancelled: { label: this.translationService.instant('VEHICLES.MAINTENANCE_CANCELLED'), color: 'secondary' },
    };
  }

  constructor(
    private notificationService: NotificationService,
    private vehicleMaintenanceService: VehicleMaintenanceService,
    private modalService: ModalService,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.initializeGrid();
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.initializeGrid());
    this.load();
    this.vehicleMaintenanceService.maintenanceChanged$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.load());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vehicleId'] && !changes['vehicleId'].firstChange) {
      this.load();
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  openModal(initialState: any): void {
    this.modalService.showTemplateModal(VehicleMaintenanceDetailsModalComponent, {
      ...initialState,
      vehicleId: initialState?.data?.vehicleId ?? this.vehicleId,
    });
  }

  deleteMaintenance(maintenance: VehicleMaintenance): void {
    this.vehicleMaintenanceService
      .delete(maintenance)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<VehicleMaintenance>) => {
        if (response.status === ResponseStatus.Success) {
          this.rowData = this.rowData.filter((m) => m.id !== maintenance.id);
        }
        this.modalService.hideModal();
        this.modalService.showSweetNotification('', response.message, response.status);
      });
  }

  refresh(): void {
    this.load(true);
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
        field: 'description',
        headerName: this.translationService.instant('COMMON.DESCRIPTION'),
        sortable: true,
        filter: true,
        flex: 2,
        cellRenderer: (params: ICellRendererParams) => {
          const value = params.value ?? '';
          return `<a data-action="view" class="ag-link">${value}</a>`;
        },
      },
      {
        field: 'vehicle.plate',
        headerName: this.translationService.instant('VEHICLES.SINGULAR'),
        sortable: true,
        filter: true,
        flex: 1,
        hide: !!this.vehicleId,
        cellRenderer: (params: ICellRendererParams) => {
          const value = params.value ?? '';
          return `<a data-action="view" class="ag-link">${value}</a>`;
        },
      },
      {
        field: 'type',
        headerName: this.translationService.instant('COMMON.TYPE'),
        sortable: true,
        filter: true,
        flex: 1,
        cellRenderer: (params: ICellRendererParams) => {
          const label = this.translationService.instant(
            params.value === 'Preventive' ? 'VEHICLES.PREVENTIVE' : 'VEHICLES.CORRECTIVE',
          );
          return `<a data-action="view" class="ag-link">${label}</a>`;
        },
      },
      {
        field: 'scheduledDate',
        headerName: this.translationService.instant('VEHICLES.SCHEDULED_DATE'),
        sortable: true,
        filter: true,
        flex: 1,
        valueFormatter: (params: ValueFormatterParams) => formatDateBR(params.value),
      },
      {
        field: 'cost',
        headerName: this.translationService.instant('VEHICLES.COST'),
        sortable: true,
        filter: true,
        flex: 1,
        valueFormatter: (params: ValueFormatterParams) => formatCurrencyBRL(params.value),
      },
      {
        field: 'status',
        headerName: this.translationService.instant('COMMON.STATUS'),
        sortable: true,
        filter: true,
        flex: 1,
        cellRenderer: (params: ICellRendererParams) => {
          const info = this.statusMap[params.value] ?? { label: params.value, color: 'secondary' };
          return `<span class="badge bg-${info.color}">${info.label}</span>`;
        },
      },
      {
        headerName: this.translationService.instant('COMMON.ACTIONS'),
        flex: 1,
        minWidth: 150,
        sortable: false,
        filter: false,
        resizable: false,
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

  private load(isRefresh = false): void {
    const request$ = this.vehicleId
      ? this.vehicleMaintenanceService.getByVehicle(this.vehicleId)
      : this.vehicleMaintenanceService.getAll();

    this.loading = true;
    request$.pipe(takeUntil(this._destroy$)).subscribe({
      next: (response) => {
        this.rowData = response.data ?? [];
        this.loading = false;
        if (isRefresh) {
          this.notificationService.showMessage(response.status, response.message);
        }
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
