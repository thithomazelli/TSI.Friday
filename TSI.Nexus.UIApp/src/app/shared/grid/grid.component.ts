import { TemplateRef } from '@angular/core';
import {
  AG_GRID_LOCALE_BR,
  AG_GRID_LOCALE_EN,
  AG_GRID_LOCALE_ES,
} from '@ag-grid-community/locale';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { cardCollapseAnimation } from '../../core/animations/card-collapse.animation';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalService, PagedRequest, PagedResult, TranslationService } from '@nexus/core';
import {
  AllCommunityModule,
  CellClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  IDatasource,
  IGetRowsParams,
  ModuleRegistry,
  RowDoubleClickedEvent,
} from 'ag-grid-community';
import { Observable, Subject, debounceTime, map, takeUntil } from 'rxjs';
import { NgIf, NgClass, NgTemplateOutlet, LowerCasePipe } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

const AG_GRID_LOCALES: Record<string, Record<string, string>> = {
  'pt-BR': AG_GRID_LOCALE_BR,
  en: AG_GRID_LOCALE_EN,
  es: AG_GRID_LOCALE_ES,
};

// Registered here instead of main.ts: every consumer of <app-grid> sits behind a lazy feature
// route, so keeping this import and call out of the app's eager entry point keeps ag-grid's
// ~1MB library out of the initial bundle for screens that never render a grid. Module-scope, not
// per-instance - ES modules only evaluate once no matter how many <app-grid> instances mount
// (e.g. several tabs on one details page), so this runs exactly once regardless.
ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
    selector: 'app-grid',
    templateUrl: './grid.component.html',
    styleUrl: './grid.component.scss',
    animations: [cardCollapseAnimation],
    imports: [
        NgIf,
        NgClass,
        NgTemplateOutlet,
        AgGridAngular,
        TranslatePipe,
        LowerCasePipe,
    ],
})
export class GridComponent<T> implements OnInit, OnChanges, OnDestroy {
  @Input()
  filtersTemplate?: TemplateRef<any>;

  @Input()
  extraActionsTemplate?: TemplateRef<any>;

  @Input()
  baseEndPoint: string = '';

  @Input()
  className: string = '';

  @Input()
  compactView: boolean = false;

  @Input()
  rowData: T[] = [];

  // Opt-in server-side pagination (ag-Grid Infinite Row Model) for the highest-volume listings -
  // when false (default), the grid behaves exactly as before: rowData is the full, already-loaded
  // array and every existing screen is unaffected. When true, rowData is ignored and dataSource is
  // called instead, one page/block at a time, as the grid scrolls.
  @Input()
  serverSide: boolean = false;

  @Input()
  dataSource?: (request: PagedRequest) => Observable<PagedResult<T>>;

  // Optional: callers that track a loading flag around their fetch can bind it here so the grid
  // shows a spinner overlay instead of briefly flashing the "no rows" message while rowData is
  // still empty. Left unbound (false), the grid behaves exactly as before.
  @Input()
  loading: boolean = false;

  @Input()
  columnDefs: ColDef[] = [];

  @Input()
  canAdd: boolean = true;

  @Input()
  showFilters: boolean = false;

  @Input()
  refresh!: () => void;

  @Input()
  delete!: (data: T) => void;

  @Input()
  update!: (data: T) => void;

  // Some entities (e.g. Orders) are too large to edit in a modal - only a full add flow and the
  // view/delete actions make sense there, so the double-click shortcut has to follow suit instead
  // of always opening the (removed) edit modal.
  @Input()
  rowDoubleClickAction: 'edit' | 'view' | 'none' = 'edit';

  @Output() openModal = new EventEmitter<any>();

  gridStyle: string = '';
  gridApi!: GridApi;
  quickFilter = '';
  localeText: Record<string, string> = AG_GRID_LOCALE_BR;
  noRowsOverlayTemplate = '';
  overlayLoadingTemplate = '';

  // Fixed block size for the Infinite Row Model - kept independent from the visible
  // paginationPageSize (10/20/50/100, picked via the grid's own selector) since it's only how many
  // rows are fetched per request; ag-Grid fetches several blocks to fill a larger page. A divisor
  // of every option in the page-size selector, so it composes cleanly with all of them.
  readonly cacheBlockSize = 10;

  private readonly _quickFilterChanged$ = new Subject<void>();

  gridDatasource: IDatasource = {
    getRows: (params: IGetRowsParams) => this.getRows(params),
  };

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    suppressMovable: true,
  };

  private _parentId: string | null = null;
  private _destroy$ = new Subject<void>();
  private readonly _actionsMap: {
    [key: string]: (data: any) => void;
  } = {
    edit: this.editAction.bind(this),
    view: this.viewAction.bind(this),
    delete: this.deleteAction.bind(this),
    update: this.updateAction.bind(this),
  };
  constructor(
    private modalService: ModalService,
    private routerService: Router,
    private activatedRoute: ActivatedRoute,
    private translationService: TranslationService,
  ) {
    this.localeText =
      AG_GRID_LOCALES[this.translationService.current] ?? AG_GRID_LOCALE_BR;
    this.noRowsOverlayTemplate = `<span class="text-muted p-3">${this.translationService.instant(
      'GRID.NO_ROWS',
    )}</span>`;
    this.overlayLoadingTemplate = this.buildLoadingOverlayTemplate();
  }

  ngOnInit(): void {
    this.gridStyle = this.compactView ? 'compact-view' : 'regular-view';

    this.activatedRoute.paramMap
      .pipe(
        map((params) => params.get('id')),
        takeUntil(this._destroy$),
      )
      .subscribe((id) => {
        this._parentId = id;
      });

    this.translationService.language$.pipe(takeUntil(this._destroy$)).subscribe((language) => {
      // ag-grid's own localeText isn't a live-updatable grid option - it's read once when the
      // grid initializes. The initial locale (set in the constructor from the current language)
      // covers the common case; a full reload picks up a language switch made mid-session.
      this.noRowsOverlayTemplate = `<span class="text-muted p-3">${this.translationService.instant(
        'GRID.NO_ROWS',
      )}</span>`;
      this.gridApi?.setGridOption?.(
        'overlayNoRowsTemplate',
        this.noRowsOverlayTemplate,
      );
      this.overlayLoadingTemplate = this.buildLoadingOverlayTemplate();
      this.gridApi?.setGridOption?.(
        'overlayLoadingTemplate',
        this.overlayLoadingTemplate,
      );
    });

    // Server-side quick filter can't use ag-Grid's own [quickFilterText] (that only filters
    // already-loaded client-side data) - typing re-fetches from row 0 instead, debounced so it
    // doesn't fire a request per keystroke.
    this._quickFilterChanged$
      .pipe(debounceTime(300), takeUntil(this._destroy$))
      .subscribe(() => {
        this.gridApi?.purgeInfiniteCache();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loading'] && !changes['loading'].firstChange) {
      this.applyLoadingOverlay();
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    // Covers the case where the caller already had loading=true before the grid finished
    // initializing (ngOnChanges' first change is skipped above since gridApi doesn't exist yet).
    this.applyLoadingOverlay();
  }

  onFirstDataRendered(params: any): void {
    if (
      !params ||
      !params.columnApi ||
      typeof params.columnApi.getAllColumns !== 'function'
    ) {
      return;
    }
    const allColumnIds: string[] = [];
    params.columnApi.getAllColumns()?.forEach((column: any) => {
      if (column.getColId) {
        allColumnIds.push(column.getColId());
      } else if (typeof column.colId === 'string') {
        allColumnIds.push(column.colId);
      }
    });
    if (
      allColumnIds.length &&
      typeof params.columnApi.autoSizeColumns === 'function'
    ) {
      params.columnApi.autoSizeColumns(allColumnIds, false);
    }
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  onFilterTextBoxChanged(event: Event): void {
    this.quickFilter = (event.target as HTMLInputElement).value || '';
    if (this.serverSide) {
      this._quickFilterChanged$.next();
    }
  }

  onRefreshClicked(): void {
    this.refresh();
    if (this.serverSide) {
      this.gridApi?.purgeInfiniteCache();
    }
  }

  onCellClicked(event: CellClickedEvent): void {
    const target = event.event?.target as HTMLElement | null;
    if (!target) {
      return;
    }

    const action = target.getAttribute('data-action');
    if (!action || !(action in this._actionsMap)) {
      return;
    }

    this._actionsMap[action](event.data);
  }

  onRowDoubleClicked(event: RowDoubleClickedEvent): void {
    if (!event.data || this.rowDoubleClickAction === 'none') {
      return;
    }
    if (this.rowDoubleClickAction === 'view') {
      this.viewAction(event.data);
    } else {
      this.editAction(event.data);
    }
  }

  openAddModal(): void {
    const initialState = {
      isEdit: false,
      id: null,
      parentId: this._parentId,
    };
    this.openModal.emit(initialState);
  }

  editAction(data: any): void {
    const initialState = {
      isEdit: true,
      data: data,
      id: data.id,
      parentId: this._parentId,
    };
    this.openModal.emit(initialState);
  }

  private viewAction(data: any): void {
    this.routerService.navigateByUrl(`/${this.baseEndPoint}/${data.id}`);
  }

  private deleteAction(data: any): void {
    this.modalService
      .showSweetConfirmation(
        '',
        this.translationService.instant('GRID.CONFIRM_DELETE'),
        'question',
      )
      .then((result: any) => {
        if (result.isConfirmed) {
          this.confirmDelete(data);
        }
      });
  }

  private updateAction(data: any): void {
    this.update(data);
  }

  private confirmDelete(data: T): void {
    if (!data) {
      return;
    }

    this.delete(data);
  }

  private getRows(params: IGetRowsParams): void {
    if (!this.dataSource) {
      params.successCallback([], 0);
      return;
    }

    const pageSize = params.endRow - params.startRow;
    const page = Math.floor(params.startRow / pageSize) + 1;
    const sortModel = params.sortModel?.[0];

    const request: PagedRequest = {
      page,
      pageSize,
      sortField: sortModel?.colId,
      sortDescending: sortModel?.sort === 'desc',
      quickFilter: this.quickFilter || undefined,
    };

    this.dataSource(request)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          params.successCallback(result.items, result.totalCount);
        },
        error: () => {
          params.failCallback();
        },
      });
  }

  private applyLoadingOverlay(): void {
    if (!this.gridApi) {
      return;
    }
    if (this.loading) {
      this.gridApi.showLoadingOverlay();
    } else {
      // Reverts to ag-Grid's own default state, which shows the "no rows" overlay on its own if
      // rowData is still empty at this point - no need to handle that case here too.
      this.gridApi.hideOverlay();
    }
  }

  private buildLoadingOverlayTemplate(): string {
    return `
      <div class="text-center p-3">
        <svg width="32" height="32" viewBox="0 0 50 50" aria-hidden="true" style="color: var(--bs-primary);">
          <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-dasharray="31.415, 31.415">
            <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
          </circle>
        </svg>
        <div class="mt-2 text-muted small">${this.translationService.instant('COMMON.LOADING')}</div>
      </div>
    `;
  }
}
