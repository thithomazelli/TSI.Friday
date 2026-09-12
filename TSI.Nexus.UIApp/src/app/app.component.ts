import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  Renderer2,
  OnDestroy,
  NgZone,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { AccountService, TranslationService } from './core';
import { combineLatest, filter, map, Observable, startWith, Subscription } from 'rxjs';
import { NavigationEnd, NavigationError, Router } from '@angular/router';
import { environment } from '../environments/environment';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { AsyncPipe, NgClass } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { SidebarComponent } from './shared/sidebar/sidebar.component';
import { FooterComponent } from './shared/footer/footer.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, AsyncPipe, RouterOutlet, NavbarComponent, SidebarComponent, FooterComponent],
})
export class AppComponent implements OnInit, OnDestroy {
  private sub?: Subscription;
  private chunkErrorSub?: Subscription;
  private applied: string[] = [];
  private lastRefresh = 0;
  private refreshIntervalMs: number;

  // expose login state for template
  isLoggedIn$: Observable<boolean>;

  // The navbar/sidebar/footer used to show as soon as isLoggedIn$ flipped true, regardless of
  // whether the router had actually finished navigating away from an /account/* page (login,
  // reset-password, ...) yet. Those pages render their own full-screen layout with no room for
  // the shell, so a user landing on login right after their session got restored - or logging in
  // and waiting on a lazy-loaded route chunk - would briefly (or, if that navigation stalled,
  // indefinitely) see the shell rendered on top of the still-mounted account page. Gating on the
  // current route too means the shell only ever appears once we're actually off /account/*.
  showShell$: Observable<boolean>;

  private activityEvents = [
    'mousemove',
    'mousedown',
    'keydown',
    'touchstart',
    'scroll',
  ];
  private activityUnlisteners: Array<() => void> = [];

  constructor(
    private router: Router,
    private renderer: Renderer2,
    private accountService: AccountService,
    private ngZone: NgZone,
    private swUpdate: SwUpdate,
    private titleService: Title,
    private translationService: TranslationService,
  ) {
    this.isLoggedIn$ = this.accountService.user$.pipe(map((u) => !!u));

    const isAccountRoute$ = this.router.events.pipe(
      filter((evt): evt is NavigationEnd => evt instanceof NavigationEnd),
      map((evt) => (evt.urlAfterRedirects || evt.url).startsWith('/account')),
      startWith(this.router.url.startsWith('/account')),
    );
    this.showShell$ = combineLatest([this.isLoggedIn$, isAccountRoute$]).pipe(
      map(([loggedIn, isAccountRoute]) => loggedIn && !isAccountRoute),
    );

    // read interval from environment (seconds) with fallback to 30 seconds
    const sec = (environment && environment.tokenRefreshIntervalSeconds) ?? 30;
    this.refreshIntervalMs = Number(sec) * 1000;
  }

  ngOnInit(): void {
    this.titleService.setTitle(this.translationService.instant('APP_TITLE'));
    this.translationService.language$.subscribe(() =>
      this.titleService.setTitle(this.translationService.instant('APP_TITLE')),
    );

    // Ativa automaticamente uma nova versão publicada assim que o service worker a detecta,
    // em vez de deixar o usuário preso na versão antiga em cache até fechar todas as abas.
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(
          filter(
            (evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY',
          ),
        )
        .subscribe(() => {
          this.swUpdate.activateUpdate().then(() => document.location.reload());
        });
    }

    // Adiciona listeners de atividade do usuário para resetar autologoff
    this.ngZone.runOutsideAngular(() => {
      this.activityEvents.forEach((event) => {
        const unlisten = this.renderer.listen('document', event, () => {
          // Só reseta se estiver logado
          const storedUser = this.accountService.getStoredUser();
          if (storedUser?.tokenExpiresAtUtc) {
            this.accountService.startAutoLogout(storedUser.tokenExpiresAtUtc);
          }
        });
        this.activityUnlisteners.push(unlisten);
      });
    });
    this.refreshUser();
    this.sub = this.router.events
      .pipe(filter((evt) => evt instanceof NavigationEnd))
      .subscribe((evt: NavigationEnd) => {
        const url = evt.urlAfterRedirects || evt.url;
        let classes: string[] = [];

        if (url.startsWith('/account/register'))
          classes = ['register-page', 'bg-body-secondary'];
        else if (url.startsWith('/account/login'))
          classes = ['login-page', 'bg-body-secondary'];

        this.updateBodyClass(classes);

        // attempt to refresh token on every navigation except account pages
        this.checkRefreshOnNavigation(url);
      });

    this.chunkErrorSub = this.router.events
      .pipe(filter((evt): evt is NavigationError => evt instanceof NavigationError))
      .subscribe((evt) => this.handleChunkLoadError(evt));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.chunkErrorSub?.unsubscribe();
    this.applied.forEach((c) => this.renderer.removeClass(document.body, c));
    // Remove listeners de atividade
    this.activityUnlisteners.forEach((unlisten) => {
      try {
        unlisten();
      } catch {}
    });
    this.activityUnlisteners = [];
  }

  // A new deploy replaces every content-hashed JS chunk on the server (see deploy.yml's
  // --delete mirror), so a tab that was already open with the previous build's main.js can fail
  // to lazy-load a route's chunk that no longer exists - surfaces as a NavigationError whose
  // underlying error is "Failed to fetch dynamically imported module" (Chrome) or a
  // "ChunkLoadError"/"Loading chunk ... failed" (webpack/older browsers). A hard navigation to
  // the same URL re-fetches the current index.html/main.js and resolves it. Guarded by
  // sessionStorage so a genuinely broken route (or an offline connection) doesn't reload forever.
  private handleChunkLoadError(event: NavigationError): void {
    const message = String((event.error as { message?: unknown })?.message ?? event.error ?? '');
    const isChunkLoadFailure =
      /Failed to fetch dynamically imported module/i.test(message) ||
      /ChunkLoadError/i.test(message) ||
      /Loading chunk [\w.-]+ failed/i.test(message);

    if (!isChunkLoadFailure) {
      return;
    }

    const storageKey = 'nexusChunkReload';
    const now = Date.now();
    const last = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as {
      url: string;
      ts: number;
    } | null;

    if (last && last.url === event.url && now - last.ts < 15000) {
      return;
    }

    sessionStorage.setItem(storageKey, JSON.stringify({ url: event.url, ts: now }));
    window.location.href = event.url;
  }

  private updateBodyClass(classes: string[]) {
    this.applied.forEach((c) => this.renderer.removeClass(document.body, c));
    this.applied = [];
    classes.forEach((c) => {
      this.renderer.addClass(document.body, c);
      this.applied.push(c);
    });
  }

  private refreshUser(): void {
    const storedUser = this.accountService.getStoredUser();

    if (!storedUser) {
      this.accountService.emitNoUser();
      return;
    }

    // avoid calling refresh endpoint with expired token — logout instead
    if (this.accountService.isTokenExpired(storedUser.tokenExpiresAtUtc)) {
      this.accountService.logout();
      return;
    }

    this.accountService.refreshUser().subscribe({
      next: (_) => {},
      error: (_) => {
        this.accountService.logout();
      },
    });
  }

  private checkRefreshOnNavigation(url: string): void {
    // do not attempt refresh on auth pages
    if (url.startsWith('/account')) {
      return;
    }

    // throttle by interval
    const now = Date.now();
    if (now - this.lastRefresh < this.refreshIntervalMs) {
      return;
    }

    const storedUser = this.accountService.getStoredUser();
    if (!storedUser) {
      return;
    }

    // if token expired, force logout immediately
    if (this.accountService.isTokenExpired(storedUser.tokenExpiresAtUtc)) {
      this.accountService.logout();
      return;
    }

    this.accountService.refreshUser().subscribe({
      next: () => {
        this.lastRefresh = Date.now();
      },
      error: () => {
        this.lastRefresh = Date.now();
        this.accountService.logout();
      },
    });
  }
}
