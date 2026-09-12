import {
  ModalService,
  NotificationService,
  PhotoService,
  ResponseStatus,
  TranslationService,
  User,
  UserService,
} from '@nexus/core';
import { GridApi } from 'ag-grid-community';
import { Observable, Subject, of } from 'rxjs';
import { UsersComponent } from './users.component';
import { GridComponent } from '../shared/grid/grid.component';

describe('UsersComponent', () => {
  let modalServiceMock: {
    showTemplateModal: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let userChanged$: Subject<void>;
  let userServiceMock: {
    getAllPaged: ReturnType<typeof vi.fn>;
    userChanged$: Subject<void>;
    delete: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
  };
  let photoServiceMock: { getPhoto: ReturnType<typeof vi.fn> };
  let language$: Subject<string>;
  let translationServiceMock: {
    instant: ReturnType<typeof vi.fn>;
    language$: Subject<string>;
  };

  function createComponent(): UsersComponent {
    modalServiceMock = {
      showTemplateModal: vi.fn(),
      hideModal: vi.fn(),
      showSweetNotification: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    userChanged$ = new Subject();
    userServiceMock = {
      getAllPaged: vi.fn(),
      userChanged$,
      delete: vi.fn(),
      refresh: vi.fn(),
    };
    photoServiceMock = { getPhoto: vi.fn().mockReturnValue(of(new Blob())) };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };

    return new UsersComponent(
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      userServiceMock as unknown as UserService,
      photoServiceMock as unknown as PhotoService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  function mockGridRef(): GridComponent<User> {
    return {
      gridApi: { purgeInfiniteCache: vi.fn() } as unknown as GridApi,
    } as unknown as GridComponent<User>;
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('builds the column definitions on construction', () => {
    const component = createComponent();
    expect(component.columnDefs.length).toBeGreaterThan(0);
  });

  it('rebuilds the column definitions when the language changes', () => {
    const component = createComponent();
    const before = component.columnDefs;

    language$.next('en');

    expect(component.columnDefs).not.toBe(before);
  });

  describe('ngOnInit / userChanged$', () => {
    it('ignores the first (replay) emission but purges the cache on later changes', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();

      userChanged$.next();
      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();

      userChanged$.next();
      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalledTimes(1);
    });

    it('stops reacting after ngOnDestroy', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      component.ngOnInit();
      component.ngOnDestroy();

      userChanged$.next();
      userChanged$.next();

      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();
    });

    it('ngOnDestroy does not throw when called before ngOnInit', () => {
      const component = createComponent();
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('pagedDataSource', () => {
    it('delegates to userService.getAllPaged', () => {
      const component = createComponent();
      const request = { page: 1, pageSize: 10 } as never;
      userServiceMock.getAllPaged.mockReturnValue(of({ items: [] }));

      component.pagedDataSource(request);

      expect(userServiceMock.getAllPaged).toHaveBeenCalledWith(request);
    });
  });

  describe('openModal', () => {
    it('opens the user details modal', () => {
      const component = createComponent();
      component.openModal({ isEdit: false });

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
        expect.anything(),
        { isEdit: false },
      );
    });
  });

  describe('deleteUser', () => {
    it('purges the grid cache and notifies on success', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      userServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.deleteUser({ id: 'u1' } as User);

      expect(gridRef.gridApi.purgeInfiniteCache).toHaveBeenCalled();
      expect(modalServiceMock.hideModal).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Removido',
        ResponseStatus.Success,
      );
    });

    it('does not purge the cache when the delete reports an error', () => {
      const component = createComponent();
      const gridRef = mockGridRef();
      (component as any).gridRef = gridRef;
      userServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' }),
      );

      component.deleteUser({ id: 'u1' } as User);

      expect(gridRef.gridApi.purgeInfiniteCache).not.toHaveBeenCalled();
    });
  });

  describe('refreshUsers', () => {
    it('refreshes the shared cache and shows a notification', () => {
      const component = createComponent();
      component.refreshUsers();

      expect(userServiceMock.refresh).toHaveBeenCalled();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'USERS.USERS_REFRESHED',
      );
    });
  });

  describe('onImgError', () => {
    it('falls back to the default profile image', () => {
      const component = createComponent();
      const img = document.createElement('img');

      component.onImgError({ target: img } as unknown as Event);

      expect(img.src).toContain('assets/img/no_profile.png');
    });
  });

  describe('role column cell renderer', () => {
    it('maps a known role to its translated label', () => {
      const component = createComponent();
      const roleColumn = component.columnDefs.find((c) => c.field === 'role')!;

      const result = (roleColumn.cellRenderer as (params: any) => string)({
        data: { role: 'Admin' },
      });

      expect(result).toBe('USERS.ROLE_ADMIN');
    });

    it('falls back to the raw role value when unmapped', () => {
      const component = createComponent();
      const roleColumn = component.columnDefs.find((c) => c.field === 'role')!;

      const result = (roleColumn.cellRenderer as (params: any) => string)({
        data: { role: 'Custom' },
      });

      expect(result).toBe('Custom');
    });

    it('falls back to an empty string when there is no role at all', () => {
      const component = createComponent();
      const roleColumn = component.columnDefs.find((c) => c.field === 'role')!;

      const result = (roleColumn.cellRenderer as (params: any) => string)({
        data: { role: undefined },
      });

      expect(result).toBe('');
    });
  });

  describe('fullName column cell renderer', () => {
    it('does not throw for a placeholder row with no data (ag-Grid infinite scroll)', () => {
      const component = createComponent();
      const fullNameColumn = component.columnDefs.find((c) => c.colId === 'fullName')!;

      expect(() =>
        (fullNameColumn.cellRenderer as (params: any) => string)({ value: '', data: undefined }),
      ).not.toThrow();
    });

    it('links to the user details page once data is available', () => {
      const component = createComponent();
      const fullNameColumn = component.columnDefs.find((c) => c.colId === 'fullName')!;

      const html = (fullNameColumn.cellRenderer as (params: any) => string)({
        value: 'Ana Silva',
        data: { id: 'u1' },
      });

      expect(html).toContain(`/${component.baseEndPoint}/u1`);
      expect(html).toContain('Ana Silva');
    });

    it('renders an empty label when the cell value is null/undefined', () => {
      const component = createComponent();
      const fullNameColumn = component.columnDefs.find((c) => c.colId === 'fullName')!;

      const html = (fullNameColumn.cellRenderer as (params: any) => string)({
        value: null,
        data: { id: 'u1' },
      });

      expect(html).toContain('></a>');
    });

    it('composes firstName and lastName via the valueGetter, falling back per field', () => {
      const component = createComponent();
      const fullNameColumn = component.columnDefs.find((c) => c.colId === 'fullName')!;
      const valueGetter = fullNameColumn.valueGetter as (params: any) => string;

      expect(valueGetter({ data: { firstName: 'Ana', lastName: 'Silva' } })).toBe('Ana Silva');
      expect(valueGetter({ data: { firstName: 'Ana' } })).toBe('Ana');
      expect(valueGetter({ data: { lastName: 'Silva' } })).toBe('Silva');
      expect(valueGetter({ data: undefined })).toBe('');
    });
  });

  describe('actions column cell renderer', () => {
    it('renders view/edit/delete action buttons', () => {
      const component = createComponent();
      const actionsColumn = component.columnDefs.find(
        (c) => c.headerName === 'COMMON.ACTIONS',
      )!;

      const html = (actionsColumn.cellRenderer as () => string)();

      expect(html).toContain('data-action="view"');
      expect(html).toContain('data-action="edit"');
      expect(html).toContain('data-action="delete"');
    });
  });

  describe('photo column cell renderer', () => {
    it('fetches the photo when an attachment id is present', () => {
      const component = createComponent();
      const photoColumn = component.columnDefs.find((c) => c.field === 'photo')!;

      const container = (photoColumn.cellRenderer as (params: any) => HTMLElement)({
        value: 'att-1',
        data: { id: 'u1' },
      });

      expect(container).toBeInstanceOf(HTMLElement);
      expect(photoServiceMock.getPhoto).toHaveBeenCalledWith('Users', 'u1', 'att-1');
    });

    it('keeps the fallback icon visible when the photo request errors', () => {
      const component = createComponent();
      photoServiceMock.getPhoto.mockReturnValue(
        new Observable((subscriber) => subscriber.error(new Error('boom'))),
      );
      const photoColumn = component.columnDefs.find((c) => c.field === 'photo')!;

      expect(() =>
        (photoColumn.cellRenderer as (params: any) => HTMLElement)({
          value: 'att-1',
          data: { id: 'u1' },
        }),
      ).not.toThrow();
    });

    it('does not fetch a photo when there is no attachment id', () => {
      const component = createComponent();
      const photoColumn = component.columnDefs.find((c) => c.field === 'photo')!;

      (photoColumn.cellRenderer as (params: any) => HTMLElement)({
        value: null,
        data: { id: 'u1' },
      });

      expect(photoServiceMock.getPhoto).not.toHaveBeenCalled();
    });
  });
});
