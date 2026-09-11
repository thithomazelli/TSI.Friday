// ...existing code...
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  Renderer2,
} from '@angular/core';
import { combineLatest, map, Observable } from 'rxjs';
import { AccountService, PhotoService, User } from '@nexus/core';
import { NgIf, AsyncPipe, TitleCasePipe } from '@angular/common';
import { PaymentNotificationComponent } from './components/payment-notification/payment-notification.component';
import { VehicleBlockedNotificationComponent } from './components/vehicle-blocked-notification/vehicle-blocked-notification.component';
import { DriverLicenseNotificationComponent } from './components/driver-license-notification/driver-license-notification.component';
import { StockAlertNotificationComponent } from './components/stock-alert-notification/stock-alert-notification.component';
import { UpcomingEventNotificationComponent } from './components/upcoming-event-notification/upcoming-event-notification.component';
import { PhotoComponent } from '../shared/photo/photo.component';
import { UserPreferencesComponent } from '../shared/components/user-preferences/user-preferences.component';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { FeatureFlagService } from '../core/services/feature-flag/feature-flag.service';
import { FeatureToggleKeys } from '../core/models/feature-toggle.model';

@Component({
    selector: 'app-navbar',
    templateUrl: './navbar.component.html',
    styleUrls: ['./navbar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgIf,
        PaymentNotificationComponent,
        VehicleBlockedNotificationComponent,
        DriverLicenseNotificationComponent,
        StockAlertNotificationComponent,
        UpcomingEventNotificationComponent,
        PhotoComponent,
        UserPreferencesComponent,
        RouterLink,
        AsyncPipe,
        TitleCasePipe,
        TranslatePipe,
    ],
})
export class NavbarComponent implements OnInit, AfterViewInit, OnDestroy {
  isFullscreen = false;
  imageUrl: string = '';
  data: User | null = null;

  // Shown only when both the alert's own toggle and its module's group toggle are enabled -
  // same "group AND entity" rule documented on FeatureToggleKeys, so each alert can be silenced
  // individually or hidden along with its whole module.
  // Exposed as observables and read via the async pipe in the template rather than subscribed
  // into plain fields: the async pipe treats "no emission yet" as falsy, so an alert stays out
  // of the DOM until FeatureFlagService's toggles$ genuinely resolves instead of a guessed
  // default flashing on screen first, and there's no Subscription/ngOnDestroy bookkeeping to get
  // out of sync. toggles$ is a single shareReplay(1) stream shared by every isEnabled() call
  // below, so this is one HTTP request total regardless of how many alerts read from it.
  // Assigned in the constructor, not here: a class field initializer runs before constructor
  // parameter properties are assigned, so featureFlagService wouldn't exist yet at this point.
  isAgendaModuleEnabled$!: Observable<boolean>;
  isDriverLicenseAlertEnabled$!: Observable<boolean>;
  isVehicleBlockedAlertEnabled$!: Observable<boolean>;
  isPaymentAlertEnabled$!: Observable<boolean>;
  isStockAlertEnabled$!: Observable<boolean>;
  isUpcomingEventAlertEnabled$!: Observable<boolean>;

  private lastBlobUrl?: string;
  private mobileBreakpoint = 992;
  private resizeUnlisten: (() => void) | null = null;

  // simple overlay refs
  private overlayEl: HTMLElement | null = null;
  private overlayClickUnlisten: (() => void) | null = null;

  constructor(
    private renderer: Renderer2,
    private accountService: AccountService,
    private photoService: PhotoService,
    private featureFlagService: FeatureFlagService,
    private cdr: ChangeDetectorRef,
  ) {
    const fleetEnabled$ = this.featureFlagService.isEnabled(FeatureToggleKeys.FleetModule);
    const financeEnabled$ = this.featureFlagService.isEnabled(FeatureToggleKeys.FinanceModule);
    const purchaseOrdersEnabled$ = this.featureFlagService.isEnabled(
      FeatureToggleKeys.PurchaseOrdersModule,
    );
    this.isAgendaModuleEnabled$ = this.featureFlagService.isEnabled(
      FeatureToggleKeys.AgendaModule,
    );
    this.isDriverLicenseAlertEnabled$ = combineLatest([
      fleetEnabled$,
      this.featureFlagService.isEnabled(FeatureToggleKeys.DriverLicenseAlert),
    ]).pipe(map(([groupEnabled, entityEnabled]) => groupEnabled && entityEnabled));
    this.isVehicleBlockedAlertEnabled$ = combineLatest([
      fleetEnabled$,
      this.featureFlagService.isEnabled(FeatureToggleKeys.VehicleBlockedAlert),
    ]).pipe(map(([groupEnabled, entityEnabled]) => groupEnabled && entityEnabled));
    this.isPaymentAlertEnabled$ = combineLatest([
      financeEnabled$,
      this.featureFlagService.isEnabled(FeatureToggleKeys.PaymentAlert),
    ]).pipe(map(([groupEnabled, entityEnabled]) => groupEnabled && entityEnabled));
    this.isStockAlertEnabled$ = combineLatest([
      purchaseOrdersEnabled$,
      this.featureFlagService.isEnabled(FeatureToggleKeys.StockAlert),
    ]).pipe(map(([groupEnabled, entityEnabled]) => groupEnabled && entityEnabled));
    this.isUpcomingEventAlertEnabled$ = combineLatest([
      this.isAgendaModuleEnabled$,
      this.featureFlagService.isEnabled(FeatureToggleKeys.UpcomingEventAlert),
    ]).pipe(map(([groupEnabled, entityEnabled]) => groupEnabled && entityEnabled));
  }

  get user$(): Observable<User | null> {
    return this.accountService.user$;
  }

  async toggleFullscreen(): Promise<void> {
    const doc: any = document;
    try {
      if (!doc.fullscreenElement) {
        await (document.documentElement as any).requestFullscreen();
        this.isFullscreen = true;
      } else {
        await doc.exitFullscreen();
        this.isFullscreen = false;
      }
    } catch {
      /* swallow fullscreen errors */
    }
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.photoService.photo$.subscribe((response) => {
      if (response.photoPath && this.data?.id == response.userId) {
        this.data!.photo = response.photoPath;
        this.loadUserPhoto(response.photoPath);
      }
      this.cdr.markForCheck();
    });

    this.user$.subscribe((user) => {
      this.data = user;

      if (user?.photo) {
        this.loadUserPhoto(user.photo);
      } else {
        this.imageUrl = 'assets/img/no_profile.png';
      }
      this.cdr.markForCheck();
    });
  }

  ngAfterViewInit(): void {
    this.applyResponsiveState(window.innerWidth);
    this.resizeUnlisten = this.renderer.listen(
      'window',
      'resize',
      (ev: UIEvent) =>
        this.applyResponsiveState((ev.target as Window).innerWidth),
    );
  }

  ngOnDestroy(): void {
    if (this.lastBlobUrl) {
      URL.revokeObjectURL(this.lastBlobUrl);
    }
    if (this.resizeUnlisten) {
      try {
        this.resizeUnlisten();
      } catch {}
      this.resizeUnlisten = null;
    }
    this.removeOverlay(true);
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/img/no_profile.png';
  }

  toggleSidebar(): void {
    const body = document.body;
    const sidebarExists = !!document.querySelector(
      '.app-sidebar, .main-sidebar, .sidebar',
    );

    if (window.innerWidth < this.mobileBreakpoint) {
      // Mobile overlay flow: open -> remove collapse then add open; close -> remove open then add collapse.
      if (body.classList.contains('sidebar-open')) {
        // close: remove open first so CSS transform transition runs
        requestAnimationFrame(() => {
          this.renderer.removeClass(body, 'sidebar-open');
          this.renderer.addClass(body, 'sidebar-collapse');
        });
        // hide overlay (keep in DOM to allow transition)
        this.hideOverlay();
      } else {
        // open
        this.renderer.removeClass(body, 'sidebar-collapse');
        this.renderer.addClass(body, 'sidebar-open');
        this.ensureOverlay();
        // show overlay (trigger opacity transition)
        requestAnimationFrame(() => this.overlayEl?.classList.add('visible'));
      }
    } else {
      // Desktop: persistent collapse toggle; no overlay
      if (body.classList.contains('sidebar-collapse')) {
        this.renderer.removeClass(body, 'sidebar-collapse');
      } else {
        this.renderer.addClass(body, 'sidebar-collapse');
      }
      this.removeOverlay(true);
    }

    // If there is no sidebar element, ensure overlay removed to avoid stale UI
    if (!sidebarExists && !body.classList.contains('sidebar-open')) {
      this.removeOverlay(true);
    }
  }

  logout(): void {
    this.accountService.logout();
  }

  private loadUserPhoto(photoPath: string): void {
    this.photoService.getPhoto('Users', this.data!.id, photoPath).subscribe({
      next: (blob) => {
        if (this.lastBlobUrl) {
          URL.revokeObjectURL(this.lastBlobUrl);
        }
        this.lastBlobUrl = URL.createObjectURL(blob);
        this.imageUrl = this.lastBlobUrl;
        this.cdr.markForCheck();
      },
      error: () => {
        this.imageUrl = 'assets/img/no_profile.png';
        this.cdr.markForCheck();
      },
    });
  }

  private applyResponsiveState(width: number): void {
    const body = document.body;
    if (width < this.mobileBreakpoint) {
      this.renderer.addClass(body, 'sidebar-collapse');
      this.renderer.removeClass(body, 'sidebar-open');
      this.removeOverlay();
    } else {
      this.renderer.removeClass(body, 'sidebar-collapse');
      this.renderer.removeClass(body, 'sidebar-open');
      this.removeOverlay();
    }
  }

  private ensureOverlay(): void {
    if (this.overlayEl) return;
    const wrapper = document.querySelector('.app-wrapper') || document.body;
    const div = document.createElement('div');
    div.className = 'sidebar-overlay';
    wrapper.appendChild(div);
    this.overlayEl = div;

    const onClick = (ev: Event) => {
      ev.preventDefault();
      // close sidebar on overlay click
      this.toggleSidebar();
    };
    div.addEventListener('click', onClick);
    this.overlayClickUnlisten = () => div.removeEventListener('click', onClick);
  }

  private hideOverlay(): void {
    if (!this.overlayEl) return;
    this.overlayEl.classList.remove('visible');
    // don't remove DOM immediately: allow CSS transition to finish
    // remove after a short delay if app doesn't use transitionend
    setTimeout(() => {
      if (this.overlayEl && !this.overlayEl.classList.contains('visible')) {
        this.removeOverlay(true);
      }
    }, 500);
  }

  private removeOverlay(forceRemove = false): void {
    if (!this.overlayEl) return;
    const el = this.overlayEl;

    if (this.overlayClickUnlisten) {
      try {
        this.overlayClickUnlisten();
      } catch {}
      this.overlayClickUnlisten = null;
    }

    const doRemove = () => {
      try {
        if (el.parentElement) el.parentElement.removeChild(el);
      } catch {}
      if (this.overlayEl === el) this.overlayEl = null;
    };

    if (forceRemove) {
      doRemove();
      return;
    }

    // remove visible class and wait a short time before removing DOM
    el.classList.remove('visible');
    const onEnd = () => {
      doRemove();
      el.removeEventListener('transitionend', onEnd);
    };
    el.addEventListener('transitionend', onEnd);
    // fallback
    setTimeout(() => {
      if (this.overlayEl === el) doRemove();
    }, 800);
  }
}
