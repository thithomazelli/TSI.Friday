import { ChangeDetectionStrategy, Component, OnInit, OnDestroy } from '@angular/core';
import {
  Driver,
  DriverService,
  ModalService,
  NotificationService,
  ResponseStatus,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { Subscription, tap, Subject, takeUntil } from 'rxjs';
import { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community';

import { DriverDetailsModalComponent } from './components/driver-details-modal/driver-details-modal.component';
import { HeaderComponent } from '../shared/header/header.component';
import { GridComponent } from '../shared/grid/grid.component';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { formatDateBR } from '../core/utilities/format-utils';

@Component({
    selector: 'app-drivers',
    templateUrl: './drivers.component.html',
    styleUrl: './drivers.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HeaderComponent,
        GridComponent,
        TranslatePipe,
    ],
})
export class DriversComponent implements OnInit, OnDestroy {
  private _driverChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  baseEndPoint = 'drivers';

  get employmentTypeMap(): { [key: string]: string } {
    return {
      CLT: 'CLT',
      Outsourced: this.translationService.instant('DRIVERS.OUTSOURCED'),
      Autonomous: this.translationService.instant('DRIVERS.AUTONOMOUS'),
    };
  }

  get statusMap(): { [key: string]: { label: string; color: string } } {
    return {
      Active: { label: this.translationService.instant('DRIVERS.STATUS_ACTIVE'), color: 'success' },
      Inactive: { label: this.translationService.instant('DRIVERS.STATUS_INACTIVE'), color: 'secondary' },
      OnLeave: { label: this.translationService.instant('DRIVERS.STATUS_ON_LEAVE'), color: 'warning' },
    };
  }

  rowData: Driver[] = [];
  columnDefs: ColDef[] = [];
  loading: boolean = false;

  private buildColumnDefs(): void {
    this.columnDefs = [
    {
      field: 'id',
      headerName: 'ID',
      hide: true,
    },
    {
      field: 'name',
      headerName: this.translationService.instant('COMMON.NAME'),
      flex: 1,
      minWidth: 200,
      cellRenderer: (params: ValueFormatterParams) => {
        const value = params.value ?? '';
        return `<a data-action="view" class="ag-link">${value}</a>`;
      },
    },
    {
      field: 'socialSecurityCard',
      headerName: this.translationService.instant('DRIVERS.CPF'),
      width: 140,
    },
    {
      field: 'licenseNumber',
      headerName: this.translationService.instant('DRIVERS.CNH'),
      width: 140,
    },
    {
      field: 'licenseCategory',
      headerName: this.translationService.instant('VEHICLES.CATEGORY'),
      maxWidth: 110,
    },
    {
      field: 'licenseExpiryDate',
      headerName: this.translationService.instant('DRIVERS.LICENSE_EXPIRY_SHORT'),
      maxWidth: 140,
      valueFormatter: (params: ValueFormatterParams) => formatDateBR(params.value),
    },
    {
      field: 'employmentType',
      headerName: this.translationService.instant('DRIVERS.EMPLOYMENT_TYPE_SHORT'),
      maxWidth: 130,
      valueFormatter: (params: ValueFormatterParams) =>
        this.employmentTypeMap[params.value] ?? params.value ?? '',
    },
    {
      field: 'status',
      headerName: this.translationService.instant('COMMON.STATUS'),
      maxWidth: 130,
      cellRenderer: (params: ICellRendererParams) => {
        const info = this.statusMap[params.value] ?? {
          label: params.value,
          color: 'secondary',
        };
        return `<span class="badge bg-${info.color}">${info.label}</span>`;
      },
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
    private driverService: DriverService,
    private translationService: TranslationService,
  ) {
    this.buildColumnDefs();
    this.translationService.language$.subscribe(() => this.buildColumnDefs());
  }

  ngOnInit(): void {
    this.getDrivers();
    this._driverChangedSub = this.driverService.driverChanged$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.getDrivers());
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._driverChangedSub) {
      this._driverChangedSub.unsubscribe();
    }
  }

  openModal(initialState: any): void {
    this.modalService.showTemplateModal(
      DriverDetailsModalComponent,
      initialState,
    );
  }

  deleteDriver(driver: Driver): void {
    this.driverService
      .delete(driver)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<Driver>) => {
        if (response.status === ResponseStatus.Success) {
          this.rowData = this.rowData.filter((d) => d.id !== driver.id);
        }
        this.notificationService.showMessage(response.status, response.message);
      });
  }

  refreshDrivers(): void {
    this.loading = true;
    this.driverService
      .refresh()
      .pipe(
        tap({
          next: () =>
            this.notificationService.showMessage(
              ResponseStatus.Success,
              this.translationService.instant('DRIVERS.DRIVERS_REFRESHED'),
            ),
          error: () =>
            this.notificationService.showMessage(
              ResponseStatus.Error,
              this.translationService.instant('DRIVERS.DRIVERS_REFRESH_ERROR'),
            ),
        }),
        takeUntil(this._destroy$),
      )
      .subscribe({
        next: (response: WebApiResponse<Driver[]>) => {
          this.rowData = response.data ?? [];
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  private getDrivers(): void {
    this.loading = true;
    this.driverService
      .getAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (response: WebApiResponse<Driver[]>) => {
          this.rowData = response.data ?? [];
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }
}
