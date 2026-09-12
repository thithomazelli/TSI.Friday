import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  OnDestroy,
  Renderer2,
  Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { User } from '@nexus/core';
import { AccountService } from '../../core/services/account/account.service';
import { FeatureFlagService } from '../../core/services/feature-flag/feature-flag.service';
import { FeatureToggleKeys } from '../../core/models/feature-toggle.model';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIf } from '@angular/common';
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
        TranslatePipe,
    ],
})
export class SidebarComponent implements AfterViewInit, OnDestroy {
  private listeners: (() => void)[] = [];
  private transitionCleanups: (() => void)[] = [];

  // toSignal's initialValue: false is the direct signal equivalent of the async pipe's own
  // "no emission yet reads as falsy" behavior this template always relied on - a module stays out
  // of the DOM until FeatureFlagService's toggles$ genuinely resolves instead of a guessed default
  // flashing on screen first. isEnabled() is backed by a single shared signal internally (see
  // feature-flag.service.ts), so this still fires one HTTP request total, not one per module.
  // Assigned in the constructor, not here: a class field initializer runs before constructor
  // parameter properties are assigned, so featureFlagService wouldn't exist yet at this point.
  readonly isFleetModuleEnabled!: Signal<boolean>;
  readonly isQuotesModuleEnabled!: Signal<boolean>;
  readonly isSalesOrdersModuleEnabled!: Signal<boolean>;
  readonly isPurchaseOrdersModuleEnabled!: Signal<boolean>;
  readonly isVehicleMaintenanceEnabled!: Signal<boolean>;
  readonly isFuelLogEnabled!: Signal<boolean>;
  readonly isAgendaModuleEnabled!: Signal<boolean>;
  readonly isAdmin!: Signal<boolean>;
  readonly isMaster!: Signal<boolean>;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
    private accountService: AccountService,
    private featureFlagService: FeatureFlagService,
  ) {
    this.isFleetModuleEnabled = toSignal(
      this.featureFlagService.isEnabled(FeatureToggleKeys.FleetModule),
      { initialValue: false },
    );
    this.isQuotesModuleEnabled = toSignal(
      this.featureFlagService.isEnabled(FeatureToggleKeys.QuotesModule),
      { initialValue: false },
    );
    this.isSalesOrdersModuleEnabled = toSignal(
      this.featureFlagService.isEnabled(FeatureToggleKeys.SalesOrdersModule),
      { initialValue: false },
    );
    this.isPurchaseOrdersModuleEnabled = toSignal(
      this.featureFlagService.isEnabled(FeatureToggleKeys.PurchaseOrdersModule),
      { initialValue: false },
    );

    const isVehicleMaintenanceModuleEnabled = toSignal(
      this.featureFlagService.isEnabled(FeatureToggleKeys.VehicleMaintenance),
      { initialValue: false },
    );
    this.isVehicleMaintenanceEnabled = computed(
      () => this.isFleetModuleEnabled() && isVehicleMaintenanceModuleEnabled(),
    );

    const isFuelLogModuleEnabled = toSignal(
      this.featureFlagService.isEnabled(FeatureToggleKeys.FuelLog),
      { initialValue: false },
    );
    this.isFuelLogEnabled = computed(
      () => this.isFleetModuleEnabled() && isFuelLogModuleEnabled(),
    );

    const isAgendaModuleGroupEnabled = toSignal(
      this.featureFlagService.isEnabled(FeatureToggleKeys.AgendaModule),
      { initialValue: false },
    );
    const isEventModuleEnabled = toSignal(
      this.featureFlagService.isEnabled(FeatureToggleKeys.Event),
      { initialValue: false },
    );
    this.isAgendaModuleEnabled = computed(
      () => isAgendaModuleGroupEnabled() && isEventModuleEnabled(),
    );

    const currentUser = toSignal<User | null>(this.accountService.user$, { initialValue: null });
    this.isAdmin = computed(() => !!currentUser()?.roles?.includes('Admin'));
    this.isMaster = computed(() => !!currentUser()?.roles?.includes('Master'));
  }

  ngAfterViewInit(): void {
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
