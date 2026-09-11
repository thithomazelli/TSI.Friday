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
  Passenger,
  PassengerService,
  ResponseStatus,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { ColDef, ValueFormatterParams } from 'ag-grid-community';
import { Subject, takeUntil } from 'rxjs';

import { PassengerDetailsModalComponent } from '../passenger-details-modal/passenger-details-modal.component';
import { PassengerImportComponent } from '../passenger-import/passenger-import.component';
import { GridComponent } from '../../../shared/grid/grid.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-passenger-list',
    templateUrl: './passenger-list.component.html',
    styleUrl: './passenger-list.component.scss',
    imports: [GridComponent, TranslatePipe],
})
export class PassengerListComponent implements OnInit, OnChanges, OnDestroy {
  @Input()
  tripId!: string;

  rowData: Passenger[] = [];
  columnDefs: ColDef[] = [];
  loading: boolean = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private modalService: ModalService,
    private notificationService: NotificationService,
    private passengerService: PassengerService,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.initializeColumnDefs();
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.initializeColumnDefs());
    this.load();
    this.passengerService.passengerChanged$
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
    this.modalService.showTemplateModal(PassengerDetailsModalComponent, {
      ...initialState,
      tripId: this.tripId,
    });
  }

  openImportModal(): void {
    this.modalService.showTemplateModal(PassengerImportComponent, {
      tripId: this.tripId,
    });
  }

  refresh(): void {
    this.load(true);
  }

  // <app-grid>'s [update] input is required (no toggle-style action column here to trigger it).
  noop(): void {}

  deletePassenger(passenger: Passenger): void {
    this.passengerService
      .delete(passenger)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<Passenger>) => {
        const isSuccess = response.status === ResponseStatus.Success;
        if (isSuccess) {
          this.rowData = this.rowData.filter((p) => p.id !== passenger.id);
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
        field: 'name',
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
        field: 'documentNumber',
        headerName: this.translationService.instant('TRIPS.DOCUMENT'),
        sortable: true,
        filter: true,
        flex: 1,
      },
      {
        field: 'seat',
        headerName: this.translationService.instant('TRIPS.SEAT'),
        sortable: true,
        filter: true,
        flex: 1,
      },
      {
        field: 'phone',
        headerName: this.translationService.instant('COMMON.PHONE'),
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
    this.passengerService
      .getByTrip(this.tripId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (response) => {
          this.rowData = response.data ?? [];
          this.loading = false;

          if (isRefresh) {
            this.notificationService.showMessage(
              ResponseStatus.Success,
              this.translationService.instant('TRIPS.PASSENGERS_REFRESHED'),
            );
          }
        },
        error: () => {
          this.loading = false;
        },
      });
  }
}
