import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
  ApiType,
  ModalService,
  NotificationService,
  PagedRequest,
  PagedResult,
  PhotoService,
  ResponseStatus,
  TranslationService,
  User,
  UserService,
  WebApiResponse,
} from '@nexus/core';
import {
  ColDef,
  ICellRendererParams,
  ValueFormatterParams,
} from 'ag-grid-community';
import { UserDetailsModalComponent } from './components/user-details-modal/user-details-modal.component';
import { Observable, Subject, Subscription, takeUntil, skip } from 'rxjs';
import { HeaderComponent } from '../shared/header/header.component';
import { GridComponent } from '../shared/grid/grid.component';
import { TranslatePipe } from '../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-users',
    templateUrl: './users.component.html',
    styleUrl: './users.component.scss',
    imports: [
        HeaderComponent,
        GridComponent,
        TranslatePipe,
    ],
})
export class UsersComponent implements OnInit, OnDestroy {
  baseEndPoint = ApiType.Users;

  columnDefs: ColDef[] = [];

  @ViewChild('gridRef') private gridRef?: GridComponent<User>;

  pagedDataSource = (request: PagedRequest): Observable<PagedResult<User>> => {
    return this.userService.getAllPaged(request);
  };

  private buildColumnDefs(): void {
    this.columnDefs = [
    {
      field: 'id',
      headerName: 'ID',
      sortable: true,
      filter: false,
      // minWidth: 80,
      hide: true,
      sortingOrder: ['asc', 'desc'],
    },
    {
      field: 'photo',
      headerName: this.translationService.instant('PHOTO.LABEL'),
      sortable: true,
      filter: false,
      width: 70,
      resizable: true,
      cellRenderer: (params: ICellRendererParams) => {
        const attachmentId = params.value;
        const userId = params.data?.id;
        const container = document.createElement('div');
        container.style.cssText =
          'display:flex;justify-content:center;align-items:center;width:100%;height:100%';

        const link = document.createElement('a');
        link.className = 'ag-link';
        link.setAttribute('data-action', 'view');
        container.appendChild(link);

        const fallback = document.createElement('span');
        fallback.style.cssText =
          'width:35px;height:35px;line-height:35px;text-align:center;font-size:22px;color:#adb5bd;background:#f1f3f4;border-radius:50%;display:inline-block';
        fallback.innerHTML = "<i class='fas fa-user'></i>";
        link.appendChild(fallback);

        if (attachmentId) {
          const img = document.createElement('img');
          img.alt = 'User Photo';
          img.style.cssText =
            'width:35px;height:35px;border-radius:50%;object-fit:cover;display:none';
          link.insertBefore(img, fallback);

          this.photoService.getPhoto('Users', userId, attachmentId).subscribe({
            next: (blob) => {
              img.src = URL.createObjectURL(blob);
              img.style.display = '';
              fallback.style.display = 'none';
            },
            error: () => {
              /* keep fallback visible */
            },
          });
        }

        return container;
      },
    },
    {
      headerName: this.translationService.instant('USERS.FULL_NAME'),
      colId: 'fullName',
      sortable: true,
      filter: false,
      width: 200,
      valueGetter: (params) => {
        const user = params.data ?? {};
        return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
      },
      cellRenderer: (params: ValueFormatterParams) => {
        const value = params.value ?? '';
        // href="#" prevents full page reload; onCellClicked handles navigation
        return `<a
          class="ag-link"
          data-action="view"
          routerLink="/${this.baseEndPoint}/${params.data?.id}">${value}</a>`;
      },
    },
    {
      field: 'email',
      headerName: this.translationService.instant('COMMON.EMAIL'),
      sortable: true,
      filter: false,
      width: 300,
      resizable: true,
    },
    {
      field: 'emailConfirmed',
      headerName: this.translationService.instant('USERS.EMAIL_CONFIRMED'),
      sortable: true,
      filter: false,
      maxWidth: 200,
    },
    {
      field: 'role',
      headerName: this.translationService.instant('USERS.PROFILE'),
      sortable: true,
      filter: false,
      resizable: true,
      cellRenderer: (params: ICellRendererParams) => {
        return this.getRoleLabel(params.data?.role);
      },
    },
    {
      headerName: this.translationService.instant('COMMON.ACTIONS'),
      flex: 1,
      minWidth: 150,
      sortable: false,
      filter: false,
      resizable: true,
      width: 280,
      cellRenderer: (params: ICellRendererParams) => {
        return `
          <button class="btn btn-primary btn-sm" data-action="view">
            <i class="fas fa-folder" data-action="view"></i>
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

  get roleMap(): { [key: string]: string } {
    return {
      Admin: this.translationService.instant('USERS.ROLE_ADMIN'),
      User: this.translationService.instant('USERS.ROLE_USER'),
    };
  }

  private _userChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  constructor(
    private modalService: ModalService,
    private notificationService: NotificationService,
    private userService: UserService,
    private photoService: PhotoService,
    private translationService: TranslationService,
  ) {
    this.buildColumnDefs();
    this.translationService.language$.subscribe(() => this.buildColumnDefs());
  }

  ngOnInit(): void {
    // userChanged$ replays immediately on subscribe (BehaviorSubject) - skip that first, inert
    // emission so this doesn't purge the grid's cache before it has even loaded its first page.
    this._userChangedSub = this.userService.userChanged$
      .pipe(skip(1), takeUntil(this._destroy$))
      .subscribe(() => {
        this.gridRef?.gridApi?.purgeInfiniteCache();
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._userChangedSub) {
      this._userChangedSub.unsubscribe();
    }
  }

  openModal(initialState: any) {
    this.modalService.showTemplateModal(
      UserDetailsModalComponent,
      initialState,
    );
  }

  deleteUser(user: User): void {
    this.userService
      .delete(user)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<User>) => {
        if (response.status === ResponseStatus.Success) {
          this.gridRef?.gridApi?.purgeInfiniteCache();
        }
        this.modalService.hideModal();
        this.modalService.showSweetNotification(
          '',
          response.message,
          response.status,
        );
      });
  }

  refreshUsers(): void {
    // <app-grid>'s own refresh button already purges the infinite cache (see
    // GridComponent.onRefreshClicked) - this only needs to invalidate the separate shared getAll()
    // cache (pickers/forms elsewhere) and show the notification.
    this.userService.refresh();
    this.notificationService.showMessage(
      ResponseStatus.Success,
      this.translationService.instant('USERS.USERS_REFRESHED'),
    );
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/img/no_profile.png';
  }

  private getRoleLabel(role: string): string {
    return this.roleMap[role] ?? role ?? '';
  }
}
