import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalService, PagedRequest, PagedResult, TranslationService } from '@nexus/core';
import { GridApi, IGetRowsParams } from 'ag-grid-community';
import { Subject, of, throwError } from 'rxjs';
import { GridComponent } from './grid.component';

describe('GridComponent', () => {
  let modalServiceMock: { showSweetConfirmation: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let paramMap$: Subject<{ get: (key: string) => string | null }>;
  let activatedRouteMock: { paramMap: Subject<{ get: (key: string) => string | null }> };
  let language$: Subject<string>;
  let translationServiceMock: {
    current: string;
    instant: ReturnType<typeof vi.fn>;
    language$: Subject<string>;
  };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  function createComponent(): GridComponent<{ id: string }> {
    modalServiceMock = { showSweetConfirmation: vi.fn() };
    routerMock = { navigateByUrl: vi.fn() };
    paramMap$ = new Subject();
    activatedRouteMock = { paramMap: paramMap$ };
    language$ = new Subject();
    translationServiceMock = {
      current: 'pt-BR',
      instant: vi.fn((key: string) => key),
      language$,
    };
    cdrMock = { markForCheck: vi.fn() };

    return new GridComponent(
      modalServiceMock as unknown as ModalService,
      routerMock as unknown as Router,
      activatedRouteMock as unknown as ActivatedRoute,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  function mockGridApi(): GridApi {
    return {
      setGridOption: vi.fn(),
      showLoadingOverlay: vi.fn(),
      hideOverlay: vi.fn(),
      purgeInfiniteCache: vi.fn(),
    } as unknown as GridApi;
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('builds the no-rows overlay from the current translation on construction', () => {
    const component = createComponent();

    expect(component.noRowsOverlayTemplate).toContain('GRID.NO_ROWS');
    expect(component.overlayLoadingTemplate).toContain('COMMON.LOADING');
  });

  it('falls back to the pt-BR locale when the current language has no matching ag-Grid locale', () => {
    const component = new GridComponent(
      { showSweetConfirmation: vi.fn() } as unknown as ModalService,
      { navigateByUrl: vi.fn() } as unknown as Router,
      { paramMap: new Subject() } as unknown as ActivatedRoute,
      { current: 'fr', instant: vi.fn((key: string) => key), language$: new Subject() } as unknown as TranslationService,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
    );

    expect(component.localeText).toEqual(component.localeText);
    expect(Object.keys(component.localeText).length).toBeGreaterThan(0);
  });

  describe('ngOnInit', () => {
    it('sets the grid style from compactView', () => {
      const component = createComponent();
      component.compactView = true;

      component.ngOnInit();

      expect(component.gridStyle).toBe('compact-view');
    });

    it('tracks the route parentId from the paramMap', () => {
      const component = createComponent();
      component.ngOnInit();

      paramMap$.next({ get: () => 'parent-1' });
      component.editAction({ id: 'row-1' });

      expect(component.openModal).toBeTruthy();
    });

    it('stops reacting to route changes after destroy', () => {
      const component = createComponent();
      const emitted: any[] = [];
      component.openModal.subscribe((v) => emitted.push(v));
      component.ngOnInit();
      component.ngOnDestroy();

      paramMap$.next({ get: () => 'parent-1' });
      component.editAction({ id: 'row-1' });

      expect(emitted[0].parentId).toBeNull();
    });

    it('refreshes the overlay templates when the language changes', () => {
      const component = createComponent();
      component.ngOnInit();
      const gridApi = mockGridApi();
      component.gridApi = gridApi;

      language$.next('en');

      expect(gridApi.setGridOption).toHaveBeenCalledWith(
        'overlayNoRowsTemplate',
        expect.any(String),
      );
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('debounces the server-side quick filter and purges the infinite cache', async () => {
      const component = createComponent();
      component.serverSide = true;
      component.ngOnInit();
      const gridApi = mockGridApi();
      component.gridApi = gridApi;

      component.onFilterTextBoxChanged({ target: { value: 'abc' } } as unknown as Event);
      expect(gridApi.purgeInfiniteCache).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 320));

      expect(gridApi.purgeInfiniteCache).toHaveBeenCalled();
    });
  });

  describe('onFilterTextBoxChanged', () => {
    it('falls back to an empty string when the input has no value', () => {
      const component = createComponent();

      component.onFilterTextBoxChanged({ target: {} } as unknown as Event);

      expect(component.quickFilter).toBe('');
    });

    it('does not touch the infinite cache when not server-side', async () => {
      const component = createComponent();
      component.serverSide = false;
      component.ngOnInit();
      const gridApi = mockGridApi();
      component.gridApi = gridApi;

      component.onFilterTextBoxChanged({ target: { value: 'abc' } } as unknown as Event);
      await new Promise((resolve) => setTimeout(resolve, 320));

      expect(gridApi.purgeInfiniteCache).not.toHaveBeenCalled();
    });
  });

  describe('ngOnChanges', () => {
    it('applies the loading overlay when loading changes after the first change', () => {
      const component = createComponent();
      const gridApi = mockGridApi();
      component.gridApi = gridApi;
      component.loading = true;

      component.ngOnChanges({
        loading: { firstChange: false, currentValue: true, previousValue: false, isFirstChange: () => false },
      });

      expect(gridApi.showLoadingOverlay).toHaveBeenCalled();
    });

    it('does nothing on the first change', () => {
      const component = createComponent();
      const gridApi = mockGridApi();
      component.gridApi = gridApi;

      component.ngOnChanges({
        loading: { firstChange: true, currentValue: true, previousValue: false, isFirstChange: () => true },
      });

      expect(gridApi.showLoadingOverlay).not.toHaveBeenCalled();
    });
  });

  describe('onGridReady', () => {
    it('stores the grid api and applies the current loading state', () => {
      const component = createComponent();
      component.loading = true;
      const gridApi = mockGridApi();

      component.onGridReady({ api: gridApi } as any);

      expect(component.gridApi).toBe(gridApi);
      expect(gridApi.showLoadingOverlay).toHaveBeenCalled();
    });
  });

  describe('onFirstDataRendered', () => {
    it('does nothing when params is missing', () => {
      const component = createComponent();

      expect(() => component.onFirstDataRendered(null)).not.toThrow();
    });

    it('does nothing when params has no columnApi', () => {
      const component = createComponent();

      expect(() => component.onFirstDataRendered({})).not.toThrow();
    });

    it('does nothing when columnApi.getAllColumns is not a function', () => {
      const component = createComponent();

      expect(() =>
        component.onFirstDataRendered({ columnApi: {} }),
      ).not.toThrow();
    });

    it('auto-sizes every column, resolving ids via getColId or the raw colId field', () => {
      const component = createComponent();
      const autoSizeColumns = vi.fn();
      const columnApi = {
        getAllColumns: () => [
          { getColId: () => 'col1' },
          { colId: 'col2' },
        ],
        autoSizeColumns,
      };

      component.onFirstDataRendered({ columnApi });

      expect(autoSizeColumns).toHaveBeenCalledWith(['col1', 'col2'], false);
    });

    it('skips columns with neither getColId nor a string colId', () => {
      const component = createComponent();
      const autoSizeColumns = vi.fn();
      const columnApi = {
        getAllColumns: () => [{}],
        autoSizeColumns,
      };

      component.onFirstDataRendered({ columnApi });

      expect(autoSizeColumns).not.toHaveBeenCalled();
    });

    it('does not throw when getAllColumns returns nothing', () => {
      const component = createComponent();
      const columnApi = { getAllColumns: () => undefined, autoSizeColumns: vi.fn() };

      expect(() => component.onFirstDataRendered({ columnApi })).not.toThrow();
    });

    it('does not call autoSizeColumns when it is not a function, even with resolved column ids', () => {
      const component = createComponent();
      const columnApi = {
        getAllColumns: () => [{ getColId: () => 'col1' }],
      };

      expect(() => component.onFirstDataRendered({ columnApi })).not.toThrow();
    });
  });

  describe('toggleFilters', () => {
    it('flips showFilters', () => {
      const component = createComponent();
      expect(component.showFilters).toBe(false);
      component.toggleFilters();
      expect(component.showFilters).toBe(true);
    });
  });

  describe('onRefreshClicked', () => {
    it('calls refresh and purges the cache when server-side', () => {
      const component = createComponent();
      component.serverSide = true;
      component.refresh = vi.fn();
      const gridApi = mockGridApi();
      component.gridApi = gridApi;

      component.onRefreshClicked();

      expect(component.refresh).toHaveBeenCalled();
      expect(gridApi.purgeInfiniteCache).toHaveBeenCalled();
    });

    it('does not purge the cache when not server-side', () => {
      const component = createComponent();
      component.serverSide = false;
      component.refresh = vi.fn();
      const gridApi = mockGridApi();
      component.gridApi = gridApi;

      component.onRefreshClicked();

      expect(gridApi.purgeInfiniteCache).not.toHaveBeenCalled();
    });
  });

  describe('onCellClicked', () => {
    function cellEvent(action: string | null, data: any) {
      const target = document.createElement('button');
      if (action) {
        target.setAttribute('data-action', action);
      }
      return { event: { target }, data } as any;
    }

    it('ignores a click event with no target', () => {
      const component = createComponent();
      const emitted: any[] = [];
      component.openModal.subscribe((v) => emitted.push(v));

      expect(() => component.onCellClicked({ event: {}, data: { id: 'r1' } } as any)).not.toThrow();
      expect(emitted).toHaveLength(0);
    });

    it('ignores clicks with no recognized action', () => {
      const component = createComponent();
      const emitted: any[] = [];
      component.openModal.subscribe((v) => emitted.push(v));

      component.onCellClicked(cellEvent(null, { id: 'r1' }));
      component.onCellClicked(cellEvent('unknown', { id: 'r1' }));

      expect(emitted).toHaveLength(0);
    });

    it('dispatches the edit action', () => {
      const component = createComponent();
      const emitted: any[] = [];
      component.openModal.subscribe((v) => emitted.push(v));

      component.onCellClicked(cellEvent('edit', { id: 'r1' }));

      expect(emitted[0]).toMatchObject({ isEdit: true, id: 'r1' });
    });

    it('dispatches the view action', () => {
      const component = createComponent();
      component.baseEndPoint = 'orders';

      component.onCellClicked(cellEvent('view', { id: 'r1' }));

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/orders/r1');
    });

    it('dispatches the delete action and confirms before deleting', async () => {
      const component = createComponent();
      component.delete = vi.fn();
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });

      component.onCellClicked(cellEvent('delete', { id: 'r1' }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.delete).toHaveBeenCalledWith({ id: 'r1' });
    });

    it('does not delete when the user cancels the confirmation', async () => {
      const component = createComponent();
      component.delete = vi.fn();
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.onCellClicked(cellEvent('delete', { id: 'r1' }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.delete).not.toHaveBeenCalled();
    });

    it('confirmDelete does nothing when called with no data (direct call)', () => {
      const component = createComponent();
      component.delete = vi.fn();

      expect(() => (component as any).confirmDelete(null)).not.toThrow();

      expect(component.delete).not.toHaveBeenCalled();
    });

    it('dispatches the update action', () => {
      const component = createComponent();
      component.update = vi.fn();

      component.onCellClicked(cellEvent('update', { id: 'r1' }));

      expect(component.update).toHaveBeenCalledWith({ id: 'r1' });
    });
  });

  describe('onRowDoubleClicked', () => {
    it('does nothing when there is no row data', () => {
      const component = createComponent();
      const emitted: any[] = [];
      component.openModal.subscribe((v) => emitted.push(v));

      component.onRowDoubleClicked({ data: null } as any);

      expect(emitted).toHaveLength(0);
    });

    it('does nothing when the action is "none"', () => {
      const component = createComponent();
      component.rowDoubleClickAction = 'none';
      const emitted: any[] = [];
      component.openModal.subscribe((v) => emitted.push(v));

      component.onRowDoubleClicked({ data: { id: 'r1' } } as any);

      expect(emitted).toHaveLength(0);
    });

    it('views the row when the action is "view"', () => {
      const component = createComponent();
      component.rowDoubleClickAction = 'view';
      component.baseEndPoint = 'orders';

      component.onRowDoubleClicked({ data: { id: 'r1' } } as any);

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/orders/r1');
    });

    it('edits the row when the action is "edit"', () => {
      const component = createComponent();
      component.rowDoubleClickAction = 'edit';
      const emitted: any[] = [];
      component.openModal.subscribe((v) => emitted.push(v));

      component.onRowDoubleClicked({ data: { id: 'r1' } } as any);

      expect(emitted[0]).toMatchObject({ isEdit: true, id: 'r1' });
    });
  });

  describe('openAddModal', () => {
    it('emits an add initial state', () => {
      const component = createComponent();
      const emitted: any[] = [];
      component.openModal.subscribe((v) => emitted.push(v));

      component.openAddModal();

      expect(emitted[0]).toMatchObject({ isEdit: false, id: null });
    });
  });

  describe('getRows (server-side pagination)', () => {
    function paramsFor(startRow: number, endRow: number): IGetRowsParams {
      return {
        startRow,
        endRow,
        sortModel: [],
        successCallback: vi.fn(),
        failCallback: vi.fn(),
      } as unknown as IGetRowsParams;
    }

    it('calls the success callback with empty rows when there is no dataSource', () => {
      const component = createComponent();
      const params = paramsFor(0, 10);

      component.gridDatasource.getRows(params);

      expect(params.successCallback).toHaveBeenCalledWith([], 0);
    });

    it('requests the correct page and forwards the result to the success callback', () => {
      const component = createComponent();
      const dataSource = vi.fn().mockReturnValue(
        of({ items: [{ id: 'r1' }], totalCount: 1 } as PagedResult<{ id: string }>),
      );
      component.dataSource = dataSource;
      const params = paramsFor(10, 20);

      component.gridDatasource.getRows(params);

      const request = dataSource.mock.calls[0][0] as PagedRequest;
      expect(request.page).toBe(2);
      expect(request.pageSize).toBe(10);
      expect(params.successCallback).toHaveBeenCalledWith([{ id: 'r1' }], 1);
    });

    it('calls the fail callback when the dataSource errors', () => {
      const component = createComponent();
      component.dataSource = vi.fn().mockReturnValue(throwError(() => new Error('fail')));
      const params = paramsFor(0, 10);

      component.gridDatasource.getRows(params);

      expect(params.failCallback).toHaveBeenCalled();
    });
  });

  describe('applyLoadingOverlay (via ngOnChanges)', () => {
    it('does nothing when there is no gridApi yet', () => {
      const component = createComponent();
      component.loading = true;

      expect(() =>
        component.ngOnChanges({
          loading: { firstChange: false, currentValue: true, previousValue: false, isFirstChange: () => false },
        }),
      ).not.toThrow();
    });

    it('hides the overlay when loading is false', () => {
      const component = createComponent();
      const gridApi = mockGridApi();
      component.gridApi = gridApi;
      component.loading = false;

      component.ngOnChanges({
        loading: { firstChange: false, currentValue: false, previousValue: true, isFirstChange: () => false },
      });

      expect(gridApi.hideOverlay).toHaveBeenCalled();
    });
  });
});
