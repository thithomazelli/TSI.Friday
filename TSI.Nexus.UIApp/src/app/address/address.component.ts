import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  Address,
  ModalService,
  WebApiResponse,
  BusinessPartner,
  AddressService,
  NotificationService,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';

import { ColDef, ValueFormatterParams } from 'ag-grid-community';
import { AddressDetailsModalComponent } from './components/address-details-modal/address-details-modal.component';
import { Subject, Subscription, takeUntil, tap } from 'rxjs';
import { GridComponent } from '../shared/grid/grid.component';
import { TranslatePipe } from '../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-address',
    templateUrl: './address.component.html',
    styleUrl: './address.component.scss',
    imports: [GridComponent, TranslatePipe],
})
export class AddressComponent {
  @Input()
  parentData?: BusinessPartner | null = null;

  rowData: Address[] = [];
  columnDefs: ColDef[] = [];
  loading: boolean = false;

  private buildColumnDefs(): void {
    this.columnDefs = [
    {
      field: 'id',
      headerName: 'ID',
      sortable: true,
      filter: true,
      hide: true,
    },
    {
      headerName: this.translationService.instant('ADDRESS.DEFAULT_ADDRESS'),
      field: 'isDefault',
      width: 140,
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        const isDefault = params.value === true;
        return `<input type="checkbox" ${
          isDefault ? 'checked disabled' : ''
        } data-action="update" />`;
      },
    },
    {
      field: 'name',
      headerName: this.translationService.instant('COMMON.NAME'),
      sortable: true,
      filter: true,
    },
    {
      field: 'type',
      headerName: this.translationService.instant('COMMON.TYPE'),
      sortable: true,
      filter: true,
      width: 115,
      cellRenderer: (params: ValueFormatterParams) => {
        const value = params.value ?? '';
        // href="#" prevents full page reload; onCellClicked handles navigation
        return `<a data-action="edit" class="ag-link">${value}</a>`;
      },
    },
    {
      field: 'zipCode',
      headerName: 'CEP',
      sortable: true,
      filter: true,
      width: 100,
      valueFormatter: (params) => {
        const cep = (params.value || '').replace(/\D/g, '');
        return cep.length === 8
          ? cep.replace(/(\d{5})(\d{3})/, '$1-$2')
          : params.value;
      },
      cellRenderer: (params: ValueFormatterParams) => {
        const value = params.value ?? '';
        // href="#" prevents full page reload; onCellClicked handles navigation
        return `<a data-action="edit" class="ag-link">${value}</a>`;
      },
    },
    {
      headerName: this.translationService.instant('COMMON.ADDRESS'),
      sortable: true,
      filter: true,
      width: 325,
      valueGetter: (params: any) => {
        const street = params.data?.street || '';
        const number = params.data?.number != null ? params.data.number : '';
        return street && number ? `${street}, ${number}` : street || number;
      },
      cellRenderer: (params: ValueFormatterParams) => {
        const value = params.value ?? '';
        // href="#" prevents full page reload; onCellClicked handles navigation
        return `<a data-action="edit" class="ag-link">${value}</a>`;
      },
    },
    {
      field: 'city',
      headerName: this.translationService.instant('ADDRESS.CITY'),
      sortable: true,
      filter: true,
      width: 200,
    },
    {
      field: 'state',
      headerName: this.translationService.instant('ADDRESS.STATE'),
      sortable: true,
      filter: true,
      width: 100,
    },
    {
      headerName: this.translationService.instant('COMMON.ACTIONS'),
      flex: 1,
      minWidth: 150,
      sortable: false,
      filter: false,
      resizable: true,
      width: 190,
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

  private _addressChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  constructor(
    private addressService: AddressService,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private translationService: TranslationService,
  ) {
    this.buildColumnDefs();
    this.translationService.language$.subscribe(() => this.buildColumnDefs());
  }

  ngOnInit(): void {
    this._addressChangedSub = this.addressService.addressChanged$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        this.getAddresses();
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._addressChangedSub) {
      this._addressChangedSub.unsubscribe();
    }
  }

  openModal(initialState: any) {
    this.modalService.showTemplateModal(
      AddressDetailsModalComponent,
      initialState,
    );
  }

  deleteAddress(address: Address): void {
    if (address.isDefault === true) {
      this.modalService.showSweetNotification(
        '',
        this.translationService.instant('ADDRESS.CANNOT_DELETE_DEFAULT'),
        'warning',
      );
      return;
    }

    this.addressService
      .delete(address)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<Address>) => {
        this.rowData = this.rowData.filter((p) => p.id !== address.id);
        this.modalService.hideModal();
        this.modalService.showSweetNotification(
          this.translationService.instant('ADDRESS.ADDRESS_DELETED'),
          response.message,
          'success',
        );
      });
  }

  refreshAddresses(): void {
    this.loading = true;
    this.addressService
      .refresh(this.parentData?.id ?? '')
      .pipe(
        tap({
          next: () =>
            this.notificationService.showMessage(
              ResponseStatus.Success,
              this.translationService.instant('ADDRESS.ADDRESSES_REFRESHED'),
            ),
          error: () =>
            this.notificationService.showMessage(
              ResponseStatus.Error,
              this.translationService.instant('ADDRESS.ADDRESSES_REFRESH_ERROR'),
            ),
        }),
        takeUntil(this._destroy$),
      )
      .subscribe({
        next: (response: WebApiResponse<Address[]>) => {
          this.rowData = response.data ?? [];
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  updateDefaultAddress(address: Address): void {
    address.isDefault = true;
    this.addressService
      .update(address)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<Address>) => {
        this.getAddresses();
        this.modalService.hideModal();
        this.modalService.showSweetNotification(
          this.translationService.instant('ADDRESS.ADDRESS_UPDATED'),
          response.message,
          'success',
        );
      });
  }

  private getAddresses(): void {
    // No parentData.id yet means the business partner hasn't been saved (Add mode) - there's
    // nothing to fetch, and calling the API with an empty id 404s.
    if (!this.parentData?.id) {
      this.rowData = [];
      return;
    }

    this.loading = true;
    this.addressService
      .getAllByBusinessPartnerId(this.parentData.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (response: WebApiResponse<Address[]>) => {
          this.rowData = response.data ?? [];
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }
}
