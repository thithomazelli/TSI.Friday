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
  TripDriver,
  TripDriverService,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { ColDef, ValueFormatterParams } from 'ag-grid-community';
import { Subject, takeUntil } from 'rxjs';

import { formatCurrencyBRL, formatDateBR } from '../../../core/utilities/format-utils';
import { TripDriverDetailsModalComponent } from '../trip-driver-details-modal/trip-driver-details-modal.component';
import { GridComponent } from '../../../shared/grid/grid.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    selector: 'app-trip-driver-list',
    templateUrl: './trip-driver-list.component.html',
    styleUrl: './trip-driver-list.component.scss',
    imports: [GridComponent, TranslatePipe],
})
export class TripDriverListComponent
  implements OnInit, OnChanges, OnDestroy
{
  @Input()
  tripId!: string;

  rowData: TripDriver[] = [];
  columnDefs: ColDef[] = [];
  loading: boolean = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private modalService: ModalService,
    private notificationService: NotificationService,
    private translationService: TranslationService,
    private tripDriverService: TripDriverService,
  ) {}

  ngOnInit(): void {
    this.initializeColumnDefs();
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.initializeColumnDefs());
    this.load();
    this.tripDriverService.tripDriverChanged$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.load());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tripId'] && !changes['tripId'].firstChange) {
      this.load();
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  openModal(initialState: any): void {
    const initialStateWithParent = {
      ...initialState,
      parentId: this.tripId,
      parentData: this.rowData,
    };

    this.modalService.showTemplateModal(
      TripDriverDetailsModalComponent,
      initialStateWithParent,
    );
  }

  refresh(): void {
    this.load(true);
  }

  // <app-grid>'s [update] input is required (no toggle-style action column here to trigger it).
  noop(): void {}

  deleteTripDriver(tripDriver: TripDriver): void {
    this.tripDriverService
      .delete(tripDriver)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<TripDriver>) => {
        const isSuccess = response.status === ResponseStatus.Success;
        if (isSuccess) {
          this.rowData = this.rowData.filter((td) => td.id !== tripDriver.id);
        }

        this.modalService.hideModal();
        this.modalService.showSweetNotification(
          '',
          response.message,
          response.status,
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
        field: 'driverName',
        headerName: this.translationService.instant('COMMON.NAME'),
        sortable: true,
        filter: true,
        flex: 2,
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? '';
          return `<a data-action="edit" class="ag-link">${value}</a>`;
        },
      },
      {
        field: 'driverLicenseNumber',
        headerName: this.translationService.instant('DRIVERS.LICENSE_NUMBER'),
        sortable: true,
        filter: true,
        flex: 1,
      },
      {
        field: 'driverLicenseExpiryDate',
        headerName: this.translationService.instant('DRIVERS.LICENSE_EXPIRY'),
        sortable: true,
        filter: true,
        flex: 1,
        valueFormatter: (params: ValueFormatterParams) =>
          formatDateBR(params.value),
      },
      {
        field: 'amount',
        headerName: this.translationService.instant('TRIPS.DRIVER_AMOUNT'),
        sortable: true,
        filter: true,
        flex: 1,
        valueFormatter: (params: ValueFormatterParams) =>
          formatCurrencyBRL(params.value),
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
    if (!this.tripId) {
      return;
    }
    this.loading = true;
    this.tripDriverService
      .getByTripId(this.tripId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (response) => {
          this.rowData = response.data ?? [];
          this.loading = false;

          if (isRefresh) {
            this.notificationService.showMessage(
              ResponseStatus.Success,
              this.translationService.instant('TRIPS.DRIVERS_REFRESHED'),
            );
          }
        },
        error: () => {
          this.loading = false;
        },
      });
  }

}
