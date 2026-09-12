import { ChangeDetectionStrategy, Component, computed, OnDestroy, OnInit, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountService, PhotoService, User, UserService } from '@nexus/core';
import { Subject, takeUntil } from 'rxjs';
import { HeaderComponent } from '../../../shared/header/header.component';
import { PhotoComponent } from '../../../shared/photo/photo.component';
import { NgIf } from '@angular/common';
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
        UserFormComponent,
        AttachmentsComponent,
        UserPreferencesComponent,
        AuditTabComponent,
        EventListComponent,
        LoadingSpinnerComponent,
        TranslatePipe,
    ],
})
export class UserDetailsPageComponent implements OnInit, OnDestroy {
  isEdit = false;
  data?: User | null = null;
  id: string | null = null;
  loading = false;
  activeTab: 'details' | 'attachments' | 'agenda' | 'preferences' | 'audit' = 'details';
  isOwnProfile = false;
  // toSignal's initialValue: false matches the async pipe's own "no emission yet reads as falsy"
  // this used to rely on - the tab stays out of the DOM until the real state is known instead of
  // a guessed default flashing on screen first.
  isAgendaEnabled!: Signal<boolean>;

  private _destroy$ = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private routerService: Router,
    private photoService: PhotoService,
    private userService: UserService,
    private accountService: AccountService,
    private featureFlagService: FeatureFlagService,
  ) {
    const isAgendaModuleEnabled = toSignal(
      this.featureFlagService.isEnabled(FeatureToggleKeys.AgendaModule),
      { initialValue: false },
    );
    const isEventEnabled = toSignal(
      this.featureFlagService.isEnabled(FeatureToggleKeys.Event),
      { initialValue: false },
    );
    this.isAgendaEnabled = computed(() => isAgendaModuleEnabled() && isEventEnabled());
  }

  ngOnInit(): void {
    this.activatedRoute.paramMap.pipe(takeUntil(this._destroy$)).subscribe((params) => {
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

    this.photoService.photo$.pipe(takeUntil(this._destroy$)).subscribe((response) => {
      if (response.photoPath) {
        this.data!.photo = response.photoPath;
      }
    });

    this.accountService.user$.pipe(takeUntil(this._destroy$)).subscribe((currentUser) => {
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
