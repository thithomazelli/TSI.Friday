import {
  ChangeDetectionStrategy,
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
  TripLeg,
  TripLegService,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { ColDef, ValueFormatterParams } from 'ag-grid-community';
import { Subject, takeUntil } from 'rxjs';

import { formatDateTimeBR } from '../../../core/utilities/format-utils';
import { TripLegDetailsModalComponent } from '../trip-leg-details-modal/trip-leg-details-modal.component';
import { GridComponent } from '../../../shared/grid/grid.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-trip-leg-list',
    templateUrl: './trip-leg-list.component.html',
    styleUrl: './trip-leg-list.component.scss',
    imports: [GridComponent, TranslatePipe],
})
export class TripLegListComponent implements OnInit, OnChanges, OnDestroy {
  @Input()
  tripId!: string;

  rowData: TripLeg[] = [];
  columnDefs: ColDef[] = [];
  loading: boolean = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private modalService: ModalService,
    private notificationService: NotificationService,
    private translationService: TranslationService,
    private tripLegService: TripLegService,
  ) {}

  ngOnInit(): void {
    this.initializeColumnDefs();
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.initializeColumnDefs());
    this.load();
    this.tripLegService.tripLegChanged$
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
    this.modalService.showTemplateModal(TripLegDetailsModalComponent, {
      ...initialState,
      tripId: this.tripId,
      nextSequenceNumber: this.rowData.length + 1,
    });
  }

  refresh(): void {
    this.load(true);
  }

  // <app-grid>'s [update] input is required (no toggle-style action column here to trigger it).
  noop(): void {}

  deleteTripLeg(tripLeg: TripLeg): void {
    this.tripLegService
      .delete(tripLeg)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<TripLeg>) => {
        const isSuccess = response.status === ResponseStatus.Success;
        if (isSuccess) {
          this.rowData = this.rowData.filter((tl) => tl.id !== tripLeg.id);
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
        field: 'sequenceNumber',
        headerName: '#',
        sortable: true,
        filter: true,
        width: 90,
        cellRenderer: (params: ValueFormatterParams) => {
          const value = params.value ?? '';
          return `<a data-action="edit" class="ag-link">${value}</a>`;
        },
      },
      {
        field: 'origin',
        headerName: this.translationService.instant('TRIPS.ORIGIN'),
        sortable: true,
        filter: true,
        flex: 2,
      },
      {
        field: 'destination',
        headerName: this.translationService.instant('TRIPS.DESTINATION'),
        sortable: true,
        filter: true,
        flex: 2,
      },
      {
        field: 'departureDate',
        headerName: this.translationService.instant('TRIPS.DEPARTURE'),
        sortable: true,
        filter: true,
        flex: 1,
        valueFormatter: (params: ValueFormatterParams) =>
          formatDateTimeBR(params.value),
      },
      {
        field: 'distanceKm',
        headerName: this.translationService.instant('VEHICLES.KM'),
        sortable: true,
        filter: true,
        flex: 1,
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
    this.tripLegService
      .getByTrip(this.tripId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (response) => {
          this.rowData = response.data ?? [];
          this.loading = false;

          if (isRefresh) {
            this.notificationService.showMessage(
              ResponseStatus.Success,
              this.translationService.instant('TRIPS.LEGS_REFRESHED'),
            );
          }
        },
        error: () => {
          this.loading = false;
        },
      });
  }

}
