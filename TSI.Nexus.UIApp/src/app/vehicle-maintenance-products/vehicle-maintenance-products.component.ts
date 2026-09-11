import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import {
  ModalService,
  NotificationService,
  ResponseStatus,
  TranslationService,
  VehicleMaintenanceProduct,
  VehicleMaintenanceProductService,
  WebApiResponse,
} from '@nexus/core';
import { ColDef, ValueFormatterParams } from 'ag-grid-community';
import { Observable, Subject, takeUntil } from 'rxjs';

import { VehicleMaintenanceProductDetailsModalComponent } from './components/vehicle-maintenance-product-details-modal/vehicle-maintenance-products-details-modal.component';
import { GridComponent } from '../shared/grid/grid.component';
import { TranslatePipe } from '../core/pipes/translate.pipe';

// Embedded 1-N grid for maintenance parts, used in the Manutenção details page's "Produtos" tab
// (parentId = vehicleMaintenanceId): full CRUD, mirrors PurchaseOrderProductsComponent/
// OrderProductsComponent instead of the lighter app-product-picker-grid used for staging in the
// create-mode form.
@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-vehicle-maintenance-products',
    templateUrl: './vehicle-maintenance-products.component.html',
    styleUrl: './vehicle-maintenance-products.component.scss',
    imports: [GridComponent, TranslatePipe],
})
export class VehicleMaintenanceProductsComponent implements OnInit, OnChanges, OnDestroy {
  @Input()
  compact: boolean = false;

  @Input()
  parentId?: string | null = null;

  rowData: VehicleMaintenanceProduct[] = [];
  columnDefs: ColDef[] = [];
  loading: boolean = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private modalService: ModalService,
    private notificationService: NotificationService,
    private vehicleMaintenanceProductService: VehicleMaintenanceProductService,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.initializeColumnDefs();
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.initializeColumnDefs());
    this.load();
    this.vehicleMaintenanceProductService.vehicleMaintenanceProductChanged$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.load());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['parentId'] && !changes['parentId'].firstChange) {
      this.load();
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  openModal(initialState: any): void {
    this.modalService.showTemplateModal(
      VehicleMaintenanceProductDetailsModalComponent,
      {
        ...initialState,
        parentId: initialState.data?.vehicleMaintenanceId ?? this.parentId,
      },
    );
  }

  refresh(): void {
    this.load(true);
  }

  // <app-grid>'s [update] input is required (no toggle-style action column here to trigger it).
  noop(): void {}

  deleteVehicleMaintenanceProduct(vehicleMaintenanceProduct: VehicleMaintenanceProduct): void {
    this.vehicleMaintenanceProductService
      .delete(vehicleMaintenanceProduct)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<VehicleMaintenanceProduct>) => {
        this.rowData = this.rowData.filter((p) => p.id !== vehicleMaintenanceProduct.id);
        this.modalService.hideModal();
        this.modalService.showSweetNotification(
          this.translationService.instant('VEHICLE_MAINTENANCE_PRODUCTS.ITEM_DELETED'),
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
        field: 'productSku',
        headerName: 'SKU',
        sortable: true,
        filter: true,
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
        maxWidth: 140,
        valueFormatter: (params: ValueFormatterParams) =>
          params.value ? `R$ ${params.value.toFixed(2)}` : 'R$ 0,00',
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
          <button class="btn btn-danger btn-sm" data-action="delete">
            <i class="fas fa-trash" data-action="delete"></i>
          </button>
        `;
        },
      },
    ];
  }

  private load(isRefresh = false): void {
    if (!this.parentId) {
      return;
    }

    const vehicleMaintenanceProducts$: Observable<WebApiResponse<VehicleMaintenanceProduct[]>> =
      this.vehicleMaintenanceProductService.getByEntityId(this.parentId, 'VehicleMaintenance');

    this.loading = true;
    vehicleMaintenanceProducts$.pipe(takeUntil(this._destroy$)).subscribe({
      next: (response: WebApiResponse<VehicleMaintenanceProduct[]>) => {
        this.rowData = response.data ?? [];
        this.loading = false;

        if (isRefresh) {
          this.notificationService.showMessage(
            ResponseStatus.Success,
            this.translationService.instant('VEHICLE_MAINTENANCE_PRODUCTS.VEHICLE_MAINTENANCE_PRODUCTS_REFRESHED'),
          );
        }
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
