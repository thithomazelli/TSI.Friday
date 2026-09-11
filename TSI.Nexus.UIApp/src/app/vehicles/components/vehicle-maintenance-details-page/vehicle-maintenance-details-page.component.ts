import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  TranslationService,
  VehicleMaintenance,
  VehicleMaintenanceService,
} from '@nexus/core';
import { combineLatest, map, Subject, takeUntil, Observable } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { HeaderComponent } from '../../../shared/header/header.component';
import { VehicleMaintenanceFormComponent } from '../vehicle-maintenance-form/vehicle-maintenance-form.component';
import { VehicleMaintenanceProductsComponent } from '../../../vehicle-maintenance-products/vehicle-maintenance-products.component';
import { AttachmentsComponent } from '../../../shared/attachments/attachments.component';
import { AuditTabComponent } from '../../../shared/components/audit-tab/audit-tab.component';
import { EventListComponent } from '../../../shared/components/event-list/event-list.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { FeatureToggleKeys } from '../../../core/models/feature-toggle.model';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-vehicle-maintenance-details-page',
    templateUrl: './vehicle-maintenance-details-page.component.html',
    styleUrl: './vehicle-maintenance-details-page.component.scss',
    imports: [
        HeaderComponent,
        AsyncPipe,
        VehicleMaintenanceFormComponent,
        VehicleMaintenanceProductsComponent,
        AttachmentsComponent,
        AuditTabComponent,
        EventListComponent,
        LoadingSpinnerComponent,
        TranslatePipe,
    ],
})
export class VehicleMaintenanceDetailsPageComponent implements OnInit, OnDestroy {
  data: VehicleMaintenance | null = null;
  loading = false;
  // Read via the async pipe in the template rather than subscribed into a plain field: no
  // manual Subscription/ngOnDestroy bookkeeping, and the async pipe treats "no emission yet" as
  // falsy, so the tab stays out of the DOM until the real state is known instead of a guessed
  // default flashing on screen first.
  isAgendaEnabled$!: Observable<boolean>;
  activeTab: 'details' | 'products' | 'attachments' | 'agenda' | 'audit' = 'details';

  get statusMap(): { [key: string]: { label: string; color: string } } {
    return {
      Scheduled: { label: this.translationService.instant('VEHICLES.MAINTENANCE_SCHEDULED'), color: 'info' },
      InProgress: { label: this.translationService.instant('VEHICLES.MAINTENANCE_IN_PROGRESS'), color: 'warning' },
      Completed: { label: this.translationService.instant('VEHICLES.MAINTENANCE_COMPLETED'), color: 'success' },
      Overdue: { label: this.translationService.instant('VEHICLES.MAINTENANCE_OVERDUE'), color: 'danger' },
      Cancelled: { label: this.translationService.instant('VEHICLES.MAINTENANCE_CANCELLED'), color: 'secondary' },
    };
  }

  private _destroy$ = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private translationService: TranslationService,
    private vehicleMaintenanceService: VehicleMaintenanceService,
    private routerService: Router,
    private featureFlagService: FeatureFlagService,
  ) {
    this.isAgendaEnabled$ = combineLatest([
      this.featureFlagService.isEnabled(FeatureToggleKeys.AgendaModule),
      this.featureFlagService.isEnabled(FeatureToggleKeys.Event),
    ]).pipe(map(([groupEnabled, entityEnabled]) => groupEnabled && entityEnabled));
  }

  getStatusInfo(): { label: string; color: string } {
    const status = this.data?.status;
    if (!status) {
      return { label: '', color: 'secondary' };
    }
    return this.statusMap[status] ?? { label: status, color: 'secondary' };
  }

  ngOnInit(): void {
    this.activatedRoute.paramMap
      .pipe(takeUntil(this._destroy$))
      .subscribe((paramMap) => {
        const idParam = paramMap.get('id');

        if (idParam) {
          this.getMaintenanceById(idParam);
        } else {
          this.routerService.navigateByUrl('/not-found');
        }
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  private getMaintenanceById(id: string): void {
    this.loading = true;
    this.vehicleMaintenanceService
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
