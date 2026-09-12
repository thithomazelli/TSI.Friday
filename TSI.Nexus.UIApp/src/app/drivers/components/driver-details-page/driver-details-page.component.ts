import { ChangeDetectionStrategy, Component, computed, OnDestroy, OnInit, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Driver, DriverService, TranslationService } from '@nexus/core';
import { Subject, takeUntil } from 'rxjs';
import { HeaderComponent } from '../../../shared/header/header.component';
import { PhotoComponent } from '../../../shared/photo/photo.component';
import { DriverFormComponent } from '../driver-form/driver-form.component';
import { ServiceOrderListComponent } from '../service-order-list/service-order-list.component';
import { TripsComponent } from '../../../trips/trips.component';
import { PaymentsComponent } from '../../../payments/payments.component';
import { AttachmentsComponent } from '../../../shared/attachments/attachments.component';
import { AuditTabComponent } from '../../../shared/components/audit-tab/audit-tab.component';
import { EventListComponent } from '../../../shared/components/event-list/event-list.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { FeatureToggleKeys } from '../../../core/models/feature-toggle.model';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-driver-details-page',
    templateUrl: './driver-details-page.component.html',
    styleUrl: './driver-details-page.component.scss',
    imports: [
        HeaderComponent,
        PhotoComponent,
        DriverFormComponent,
        ServiceOrderListComponent,
        TripsComponent,
        PaymentsComponent,
        AttachmentsComponent,
        AuditTabComponent,
        EventListComponent,
        LoadingSpinnerComponent,
        TranslatePipe,
    ],
})
export class DriverDetailsPageComponent implements OnInit, OnDestroy {
  isEdit = false;
  data?: Driver | null = null;
  loading = false;
  // toSignal's initialValue: false matches the async pipe's own "no emission yet reads as falsy"
  // this used to rely on - the tab stays out of the DOM until the real state is known instead of
  // a guessed default flashing on screen first.
  isAgendaEnabled!: Signal<boolean>;
  activeTab:
    | 'details'
    | 'serviceOrders'
    | 'trips'
    | 'payments'
    | 'attachments'
    | 'agenda'
    | 'audit' = 'details';

  get statusMap(): { [key: string]: string } {
    return {
      Active: this.translationService.instant('DRIVERS.STATUS_ACTIVE'),
      Inactive: this.translationService.instant('DRIVERS.STATUS_INACTIVE'),
      OnLeave: this.translationService.instant('DRIVERS.STATUS_ON_LEAVE'),
    };
  }

  private _destroy$ = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private translationService: TranslationService,
    private driverService: DriverService,
    private routerService: Router,
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

  getStatusLabel(): string {
    if (!this.data?.status) {
      return '';
    }
    return this.statusMap[this.data.status] || '';
  }

  ngOnInit(): void {
    this.activatedRoute.paramMap
      .pipe(takeUntil(this._destroy$))
      .subscribe((paramMap) => {
        const idParam = paramMap.get('id');

        if (idParam && idParam !== 'new') {
          this.isEdit = true;
          this.getDriverById(idParam);
        } else {
          this.isEdit = false;
          this.data = null;
        }
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  private getDriverById(id: string): void {
    this.loading = true;
    this.driverService
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
