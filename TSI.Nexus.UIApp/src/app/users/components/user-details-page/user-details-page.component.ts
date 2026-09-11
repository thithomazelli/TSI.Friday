import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountService, PhotoService, User, UserService } from '@nexus/core';
import { combineLatest, map, Subject, takeUntil, Observable } from 'rxjs';
import { HeaderComponent } from '../../../shared/header/header.component';
import { PhotoComponent } from '../../../shared/photo/photo.component';
import { AsyncPipe, NgIf } from '@angular/common';
import { UserFormComponent } from '../user-form/user-form.component';
import { AttachmentsComponent } from '../../../shared/attachments/attachments.component';
import { UserPreferencesComponent } from '../../../shared/components/user-preferences/user-preferences.component';
import { AuditTabComponent } from '../../../shared/components/audit-tab/audit-tab.component';
import { EventListComponent } from '../../../shared/components/event-list/event-list.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { FeatureToggleKeys } from '../../../core/models/feature-toggle.model';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-user-details-page',
    templateUrl: './user-details-page.component.html',
    styleUrl: './user-details-page.component.scss',
    imports: [
        HeaderComponent,
        PhotoComponent,
        NgIf,
        AsyncPipe,
        UserFormComponent,
        AttachmentsComponent,
        UserPreferencesComponent,
        AuditTabComponent,
        EventListComponent,
        LoadingSpinnerComponent,
        TranslatePipe,
    ],
})
export class UserDetailsPageComponent {
  isEdit = false;
  data?: User | null = null;
  id: string | null = null;
  loading = false;
  activeTab: 'details' | 'attachments' | 'agenda' | 'preferences' | 'audit' = 'details';
  isOwnProfile = false;
  // Read via the async pipe in the template rather than subscribed into a plain field: no
  // manual Subscription/ngOnDestroy bookkeeping, and the async pipe treats "no emission yet" as
  // falsy, so the tab stays out of the DOM until the real state is known instead of a guessed
  // default flashing on screen first.
  isAgendaEnabled$!: Observable<boolean>;

  private _destroy$ = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private routerService: Router,
    private photoService: PhotoService,
    private userService: UserService,
    private accountService: AccountService,
    private featureFlagService: FeatureFlagService,
  ) {
    this.isAgendaEnabled$ = combineLatest([
      this.featureFlagService.isEnabled(FeatureToggleKeys.AgendaModule),
      this.featureFlagService.isEnabled(FeatureToggleKeys.Event),
    ]).pipe(map(([groupEnabled, entityEnabled]) => groupEnabled && entityEnabled));
  }

  ngOnInit(): void {
    this.activatedRoute.paramMap.subscribe((params) => {
      const idParam = params.get('id');

      if (idParam && idParam !== 'new') {
        this.isEdit = true;
        this.id = idParam;
        this.getUserById(idParam);
      } else {
        this.isEdit = false;
        this.data = null;
      }
    });

    this.photoService.photo$.subscribe((response) => {
      if (response.photoPath) {
        this.data!.photo = response.photoPath;
      }
    });

    this.accountService.user$.subscribe((currentUser) => {
      this.isOwnProfile = !!currentUser && currentUser.id === this.id;
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  private getUserById(id: string): void {
    this.loading = true;
    this.userService
      .getById(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.data == null) {
            this.routerService.navigateByUrl('/not-found');
            return;
          }
          this.data = response.data;
        },
        error: () => {
          this.loading = false;
          this.routerService.navigateByUrl('/not-found');
        },
      });
  }
}
