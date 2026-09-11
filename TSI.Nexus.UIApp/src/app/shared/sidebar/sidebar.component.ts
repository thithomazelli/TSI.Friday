import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  Renderer2,
  OnInit,
} from '@angular/core';
import { Observable, Subscription, combineLatest, map } from 'rxjs';
import { AccountService } from '../../core/services/account/account.service';
import { FeatureFlagService } from '../../core/services/feature-flag/feature-flag.service';
import { FeatureToggleKeys } from '../../core/models/feature-toggle.model';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AsyncPipe, NgIf } from '@angular/common';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
    selector: 'app-sidebar',
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterLink,
        RouterLinkActive,
        NgIf,
        AsyncPipe,
        TranslatePipe,
    ],
})
export class SidebarComponent implements AfterViewInit, OnInit, OnDestroy {
  private listeners: (() => void)[] = [];
  private transitionCleanups: (() => void)[] = [];
  private osInstance: any = null;
  private userSub: Subscription | null = null;

  isAdmin = false;
  isMaster = false;

  // Exposed as observables and read via the async pipe in the template rather than subscribed
  // into plain fields: no manual Subscription/ngOnDestroy bookkeeping, and - the point that
  // actually matters here - the async pipe treats "no emission yet" as falsy, so a module stays
  // out of the DOM until FeatureFlagService's toggles$ genuinely resolves instead of a guessed
  // default flashing on screen first. toggles$ itself is a single shareReplay(1) stream shared by
  // every one of these, so this fires one HTTP request total, not one per module.
  // Assigned in the constructor, not here: a class field initializer runs before constructor
  // parameter properties are assigned, so featureFlagService wouldn't exist yet at this point.
  isFleetModuleEnabled$!: Observable<boolean>;
  isQuotesModuleEnabled$!: Observable<boolean>;
  isSalesOrdersModuleEnabled$!: Observable<boolean>;
  isPurchaseOrdersModuleEnabled$!: Observable<boolean>;
  isVehicleMaintenanceEnabled$!: Observable<boolean>;
  isFuelLogEnabled$!: Observable<boolean>;
  isAgendaModuleEnabled$!: Observable<boolean>;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
    private accountService: AccountService,
    private featureFlagService: FeatureFlagService,
    private cdr: ChangeDetectorRef,
  ) {
    this.isFleetModuleEnabled$ = this.featureFlagService.isEnabled(
      FeatureToggleKeys.FleetModule,
    );
    this.isQuotesModuleEnabled$ = this.featureFlagService.isEnabled(
      FeatureToggleKeys.QuotesModule,
    );
    this.isSalesOrdersModuleEnabled$ = this.featureFlagService.isEnabled(
      FeatureToggleKeys.SalesOrdersModule,
    );
    this.isPurchaseOrdersModuleEnabled$ = this.featureFlagService.isEnabled(
      FeatureToggleKeys.PurchaseOrdersModule,
    );
    this.isVehicleMaintenanceEnabled$ = combineLatest([
      this.featureFlagService.isEnabled(FeatureToggleKeys.FleetModule),
      this.featureFlagService.isEnabled(FeatureToggleKeys.VehicleMaintenance),
    ]).pipe(map(([groupEnabled, entityEnabled]) => groupEnabled && entityEnabled));
    this.isFuelLogEnabled$ = combineLatest([
      this.featureFlagService.isEnabled(FeatureToggleKeys.FleetModule),
      this.featureFlagService.isEnabled(FeatureToggleKeys.FuelLog),
    ]).pipe(map(([groupEnabled, entityEnabled]) => groupEnabled && entityEnabled));
    this.isAgendaModuleEnabled$ = combineLatest([
      this.featureFlagService.isEnabled(FeatureToggleKeys.AgendaModule),
      this.featureFlagService.isEnabled(FeatureToggleKeys.Event),
    ]).pipe(map(([groupEnabled, entityEnabled]) => groupEnabled && entityEnabled));
  }

  ngOnInit(): void {
    this.userSub = this.accountService.user$.subscribe((user) => {
      this.isAdmin = !!user?.roles?.includes('Admin');
      this.isMaster = !!user?.roles?.includes('Master');
      this.cdr.markForCheck();
    });
  }

  ngAfterViewInit(): void {
    // inicializa OverlayScrollbars no wrapper, se disponível
    const global: any = window as any;
    const OSFactory =
      global?.OverlayScrollbars ??
      (global?.OverlayScrollbarsGlobal &&
        global.OverlayScrollbarsGlobal.OverlayScrollbars);
    const sidebarWrapper: HTMLElement | null =
      this.el.nativeElement.querySelector('.sidebar-wrapper');

    if (OSFactory && sidebarWrapper) {
      try {
        this.osInstance = OSFactory(sidebarWrapper, {
          scrollbars: {
            theme: 'os-theme-light',
            autoHide: 'leave',
            clickScroll: true,
          },
        });
      } catch (e) {
        // fallback silencioso
        console.warn('OverlayScrollbars init failed', e);
        this.osInstance = null;
      }
    }

    const links: NodeListOf<HTMLElement> =
      this.el.nativeElement.querySelectorAll('.nav-item > a');

    links.forEach((link) => {
      const submenu = link.nextElementSibling as HTMLElement | null;
      if (!submenu || !submenu.classList.contains('nav-treeview')) return;

      // estado inicial
      if (link.parentElement?.classList.contains('menu-open')) {
        this.renderer.setStyle(submenu, 'display', 'block');
        this.renderer.setStyle(submenu, 'opacity', '1');
        this.renderer.setStyle(submenu, 'transform', 'translateY(0)');
      } else {
        this.renderer.setStyle(submenu, 'display', 'none');
        this.renderer.setStyle(submenu, 'opacity', '0');
        this.renderer.setStyle(submenu, 'transform', 'translateY(-6px)');
      }

      const handler = (e: Event) => {
        e.preventDefault();
        const parent = link.parentElement as HTMLElement;
        const isOpen = parent.classList.contains('menu-open');

        // remove quaisquer cleanups anteriores ligados a transições
        this.transitionCleanups.forEach((c) => c());
        this.transitionCleanups = [];

        const transitionValue =
          'height 280ms ease, opacity 220ms ease, transform 280ms ease';
        const TRANSITION_DURATION = 280 + 60; // ms, margem para fallback

        if (isOpen) {
          // FECHAR
          this.renderer.setStyle(submenu, 'display', 'block');
          const startHeight = submenu.scrollHeight;
          this.renderer.setStyle(submenu, 'height', `${startHeight}px`);
          this.renderer.setStyle(submenu, 'overflow', 'hidden');
          this.renderer.setStyle(submenu, 'transition', transitionValue);

          // forçar reflow
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          submenu.getBoundingClientRect();

          requestAnimationFrame(() => {
            this.renderer.setStyle(submenu, 'height', '0px');
            this.renderer.setStyle(submenu, 'opacity', '0');
            this.renderer.setStyle(submenu, 'transform', 'translateY(-6px)');
            this.renderer.setAttribute(link, 'aria-expanded', 'false');
          });

          let didCleanup = false;
          const finish = () => {
            if (didCleanup) return;
            didCleanup = true;
            this.renderer.removeClass(parent, 'menu-open');
            this.renderer.setStyle(submenu, 'display', 'none');
            this.renderer.removeStyle(submenu, 'height');
            this.renderer.removeStyle(submenu, 'overflow');
            this.renderer.removeStyle(submenu, 'transition');
            this.renderer.setStyle(submenu, 'opacity', '0');
            this.renderer.setStyle(submenu, 'transform', 'translateY(-6px)');

            // atualizar OverlayScrollbars para recalcular o conteúdo/altura do sidebar
            try {
              this.osInstance?.update?.();
            } catch (err) {
              // ignore
            }
          };

          const onEnd = (ev: TransitionEvent) => {
            if (ev.target === submenu && ev.propertyName === 'height') {
              finish();
            }
          };
          const unlisten = this.renderer.listen(
            submenu,
            'transitionend',
            onEnd,
          );
          const fallbackId = window.setTimeout(
            () => finish(),
            TRANSITION_DURATION,
          );

          const cleanup = () => {
            unlisten();
            clearTimeout(fallbackId);
          };
          this.transitionCleanups.push(cleanup);
        } else {
          // ABRIR
          this.renderer.addClass(parent, 'menu-open');
          this.renderer.setStyle(submenu, 'display', 'block');
          this.renderer.setStyle(submenu, 'overflow', 'hidden');
          this.renderer.setStyle(submenu, 'height', '0px');
          this.renderer.setStyle(submenu, 'opacity', '0');
          this.renderer.setStyle(submenu, 'transform', 'translateY(-6px)');
          this.renderer.setStyle(submenu, 'transition', transitionValue);

          // forçar reflow
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          submenu.getBoundingClientRect();

          requestAnimationFrame(() => {
            this.renderer.setStyle(
              submenu,
              'height',
              `${submenu.scrollHeight}px`,
            );
            this.renderer.setStyle(submenu, 'opacity', '1');
            this.renderer.setStyle(submenu, 'transform', 'translateY(0)');
            this.renderer.setAttribute(link, 'aria-expanded', 'true');
          });

          let didCleanup = false;
          const finishOpen = () => {
            if (didCleanup) return;
            didCleanup = true;
            // limpa estilos para que o conteúdo possa crescer normalmente
            this.renderer.removeStyle(submenu, 'height');
            this.renderer.removeStyle(submenu, 'overflow');
            this.renderer.removeStyle(submenu, 'transition');
            this.renderer.removeStyle(submenu, 'transform');
            this.renderer.removeStyle(submenu, 'opacity');

            // atualizar OverlayScrollbars para recalcular o conteúdo/altura do sidebar
            try {
              this.osInstance?.update?.();
            } catch (err) {
              // ignore
            }
          };

          const onEnd = (ev: TransitionEvent) => {
            if (ev.target === submenu && ev.propertyName === 'height') {
              finishOpen();
            }
          };
          const unlisten = this.renderer.listen(
            submenu,
            'transitionend',
            onEnd,
          );
          const fallbackId = window.setTimeout(
            () => finishOpen(),
            TRANSITION_DURATION,
          );

          const cleanup = () => {
            unlisten();
            clearTimeout(fallbackId);
          };
          this.transitionCleanups.push(cleanup);
        }
      };

      const unlistenLink = this.renderer.listen(link, 'click', handler);
      this.listeners.push(unlistenLink);
    });
  }

  ngOnDestroy(): void {
    this.listeners.forEach((un) => un());
    this.transitionCleanups.forEach((un) => un());
    this.listeners = [];
    this.transitionCleanups = [];

    // destruir instância do OverlayScrollbars ao desmontar
    try {
      this.osInstance?.destroy?.();
      this.osInstance = null;
    } catch {
      // ignore
    }

    if (this.userSub) {
      this.userSub.unsubscribe();
      this.userSub = null;
    }
  }

  onSidebarMenuClick(event: MouseEvent) {
    // Só fecha se for mobile e se clicou em um link
    if (window.innerWidth <= 991) {
      const target = event.target as HTMLElement;
      if (target.closest('a.nav-link')) {
        document.body.classList.remove('sidebar-open');
        // Se usar ngIf/ngClass, pode setar uma variável para esconder
      }
    }
  }
}
