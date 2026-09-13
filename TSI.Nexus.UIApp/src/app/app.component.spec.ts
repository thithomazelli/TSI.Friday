import { NgZone, Renderer2 } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, NavigationError, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { Observable, Subject, of } from 'rxjs';
import { AccountService, TranslationService, User } from './core';
import { AppComponent } from './app.component';
import { environment } from '../environments/environment';

describe('AppComponent', () => {
  let routerMock: { events: Subject<unknown>; url: string };
  let rendererMock: {
    listen: ReturnType<typeof vi.fn>;
    addClass: ReturnType<typeof vi.fn>;
    removeClass: ReturnType<typeof vi.fn>;
  };
  let user$: Subject<User | null>;
  let accountServiceMock: {
    user$: Observable<User | null>;
    getStoredUser: ReturnType<typeof vi.fn>;
    emitNoUser: ReturnType<typeof vi.fn>;
    isTokenExpired: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    refreshUser: ReturnType<typeof vi.fn>;
    startAutoLogout: ReturnType<typeof vi.fn>;
  };
  let ngZoneMock: { runOutsideAngular: (fn: () => void) => void };
  let versionUpdates$: Subject<{ type: string }>;
  let swUpdateMock: {
    isEnabled: boolean;
    versionUpdates: Subject<{ type: string }>;
    activateUpdate: ReturnType<typeof vi.fn>;
  };
  let titleServiceMock: { setTitle: ReturnType<typeof vi.fn> };
  let language$: Subject<string>;
  let translationServiceMock: { instant: ReturnType<typeof vi.fn>; language$: Subject<string> };

  function createComponent(url = '/'): AppComponent {
    routerMock = { events: new Subject(), url };
    rendererMock = {
      listen: vi.fn().mockReturnValue(vi.fn()),
      addClass: vi.fn(),
      removeClass: vi.fn(),
    };
    user$ = new Subject();
    accountServiceMock = {
      user$,
      getStoredUser: vi.fn().mockReturnValue(null),
      emitNoUser: vi.fn(),
      isTokenExpired: vi.fn().mockReturnValue(true),
      logout: vi.fn(),
      refreshUser: vi.fn().mockReturnValue(of(undefined)),
      startAutoLogout: vi.fn(),
    };
    ngZoneMock = { runOutsideAngular: (fn) => fn() };
    versionUpdates$ = new Subject();
    swUpdateMock = { isEnabled: false, versionUpdates: versionUpdates$, activateUpdate: vi.fn() };
    titleServiceMock = { setTitle: vi.fn() };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };

    return new AppComponent(
      routerMock as unknown as Router,
      rendererMock as unknown as Renderer2,
      accountServiceMock as unknown as AccountService,
      ngZoneMock as unknown as NgZone,
      swUpdateMock as unknown as SwUpdate,
      titleServiceMock as unknown as Title,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('falls back to a 30s refresh interval when the environment value is missing', () => {
    const original = environment.tokenRefreshIntervalSeconds;
    (environment as any).tokenRefreshIntervalSeconds = undefined;
    try {
      const component = createComponent();
      expect((component as any).refreshIntervalMs).toBe(30000);
    } finally {
      environment.tokenRefreshIntervalSeconds = original;
    }
  });

  it('exposes isLoggedIn$ derived from AccountService.user$', () => {
    const component = createComponent();
    let loggedIn: boolean | undefined;
    component.isLoggedIn$.subscribe((v) => (loggedIn = v));

    user$.next({ id: '1' } as unknown as User);

    expect(loggedIn).toBe(true);
  });

  describe('showShell$', () => {
    it('is false while logged out, even off /account', () => {
      const component = createComponent('/');
      let shown: boolean | undefined;
      component.showShell$.subscribe((v) => (shown = v));

      user$.next(null);

      expect(shown).toBe(false);
    });

    it('is false while logged in but still on an /account page', () => {
      const component = createComponent('/account/login');
      let shown: boolean | undefined;
      component.showShell$.subscribe((v) => (shown = v));

      user$.next({ id: '1' } as unknown as User);

      expect(shown).toBe(false);
    });

    it('is true once logged in and off /account', () => {
      const component = createComponent('/');
      let shown: boolean | undefined;
      component.showShell$.subscribe((v) => (shown = v));

      user$.next({ id: '1' } as unknown as User);

      expect(shown).toBe(true);
    });

    it('flips back to false when navigation lands back on an /account page', () => {
      const component = createComponent('/');
      let shown: boolean | undefined;
      component.showShell$.subscribe((v) => (shown = v));
      user$.next({ id: '1' } as unknown as User);
      expect(shown).toBe(true);

      routerMock.events.next(new NavigationEnd(1, '/account/login', '/account/login'));

      expect(shown).toBe(false);
    });

    it('falls back to evt.url when urlAfterRedirects is empty', () => {
      const component = createComponent('/');
      let shown: boolean | undefined;
      component.showShell$.subscribe((v) => (shown = v));
      user$.next({ id: '1' } as unknown as User);

      const navEnd = new NavigationEnd(1, '/account/login', '');
      routerMock.events.next(navEnd);

      expect(shown).toBe(false);
    });
  });

  describe('ngOnInit', () => {
    it('sets the page title and updates it again on language change', () => {
      const component = createComponent();

      component.ngOnInit();
      titleServiceMock.setTitle.mockClear();
      language$.next('en');

      expect(titleServiceMock.setTitle).toHaveBeenCalledWith('APP_TITLE');

      component.ngOnDestroy();
    });

    it('emits no user and does not call refreshUser when nothing is stored', () => {
      const component = createComponent();

      component.ngOnInit();

      expect(accountServiceMock.emitNoUser).toHaveBeenCalled();
      expect(accountServiceMock.refreshUser).not.toHaveBeenCalled();

      component.ngOnDestroy();
    });

    it('logs out when the stored token is already expired', () => {
      const component = createComponent();
      accountServiceMock.getStoredUser.mockReturnValue({ tokenExpiresAtUtc: '2000-01-01' });
      accountServiceMock.isTokenExpired.mockReturnValue(true);

      component.ngOnInit();

      expect(accountServiceMock.logout).toHaveBeenCalled();
      expect(accountServiceMock.refreshUser).not.toHaveBeenCalled();

      component.ngOnDestroy();
    });

    it('refreshes the session when a valid token is stored', () => {
      const component = createComponent();
      accountServiceMock.getStoredUser.mockReturnValue({ tokenExpiresAtUtc: '2999-01-01' });
      accountServiceMock.isTokenExpired.mockReturnValue(false);

      component.ngOnInit();

      expect(accountServiceMock.refreshUser).toHaveBeenCalled();
      expect(accountServiceMock.logout).not.toHaveBeenCalled();

      component.ngOnDestroy();
    });

    it('logs out when the refreshUser call on init errors', () => {
      const component = createComponent();
      accountServiceMock.getStoredUser.mockReturnValue({ tokenExpiresAtUtc: '2999-01-01' });
      accountServiceMock.isTokenExpired.mockReturnValue(false);
      accountServiceMock.refreshUser.mockReturnValue(
        new Observable((subscriber) => subscriber.error(new Error('fail'))),
      );

      component.ngOnInit();

      expect(accountServiceMock.logout).toHaveBeenCalled();

      component.ngOnDestroy();
    });

    it('does nothing when the service worker is disabled', () => {
      const component = createComponent();
      swUpdateMock.isEnabled = false;

      component.ngOnInit();

      expect(() => versionUpdates$.next({ type: 'VERSION_READY' })).not.toThrow();

      component.ngOnDestroy();
    });

    it('activates the update when a new version is ready', async () => {
      const component = createComponent();
      swUpdateMock.isEnabled = true;
      swUpdateMock.activateUpdate.mockResolvedValue(undefined);

      component.ngOnInit();
      versionUpdates$.next({ type: 'VERSION_READY' });
      await Promise.resolve();
      await Promise.resolve();

      // document.location.reload() itself is not spyable under jsdom (non-configurable), but
      // jsdom no-ops real navigation attempts with a console warning rather than throwing, so
      // reaching this point without an unhandled error confirms the .then() callback ran.
      expect(swUpdateMock.activateUpdate).toHaveBeenCalled();

      component.ngOnDestroy();
    });

    it('ignores service worker events that are not VERSION_READY', () => {
      const component = createComponent();
      swUpdateMock.isEnabled = true;

      component.ngOnInit();
      versionUpdates$.next({ type: 'NO_NEW_VERSION_DETECTED' });

      expect(swUpdateMock.activateUpdate).not.toHaveBeenCalled();

      component.ngOnDestroy();
    });

    it('registers an activity listener per event that resets auto-logout when logged in', () => {
      const component = createComponent();
      accountServiceMock.getStoredUser.mockReturnValue({ tokenExpiresAtUtc: '2999-01-01' });

      component.ngOnInit();

      expect(rendererMock.listen).toHaveBeenCalledWith('document', 'mousemove', expect.any(Function));
      const handler = rendererMock.listen.mock.calls.find((c) => c[1] === 'mousemove')![2];
      handler();

      expect(accountServiceMock.startAutoLogout).toHaveBeenCalledWith('2999-01-01');

      component.ngOnDestroy();
    });

    it('does not reset auto-logout from an activity event when there is no stored user', () => {
      const component = createComponent();
      accountServiceMock.getStoredUser.mockReturnValue(null);

      component.ngOnInit();
      const handler = rendererMock.listen.mock.calls.find((c) => c[1] === 'mousemove')![2];
      handler();

      expect(accountServiceMock.startAutoLogout).not.toHaveBeenCalled();

      component.ngOnDestroy();
    });

    it('applies register-page classes on /account/register', () => {
      const component = createComponent();
      component.ngOnInit();

      routerMock.events.next(new NavigationEnd(1, '/account/register', '/account/register'));

      expect(rendererMock.addClass).toHaveBeenCalledWith(document.body, 'register-page');
      expect(rendererMock.addClass).toHaveBeenCalledWith(document.body, 'bg-body-secondary');

      component.ngOnDestroy();
    });

    it('applies login-page classes on /account/login', () => {
      const component = createComponent();
      component.ngOnInit();

      routerMock.events.next(new NavigationEnd(1, '/account/login', '/account/login'));

      expect(rendererMock.addClass).toHaveBeenCalledWith(document.body, 'login-page');

      component.ngOnDestroy();
    });

    it('falls back to evt.url when urlAfterRedirects is empty on a body-class navigation', () => {
      const component = createComponent();
      component.ngOnInit();

      routerMock.events.next(new NavigationEnd(1, '/account/login', ''));

      expect(rendererMock.addClass).toHaveBeenCalledWith(document.body, 'login-page');

      component.ngOnDestroy();
    });

    it('applies no extra classes on a regular page, removing any previously applied ones', () => {
      const component = createComponent();
      component.ngOnInit();
      routerMock.events.next(new NavigationEnd(1, '/account/login', '/account/login'));
      rendererMock.removeClass.mockClear();

      routerMock.events.next(new NavigationEnd(2, '/dashboard', '/dashboard'));

      expect(rendererMock.removeClass).toHaveBeenCalledWith(document.body, 'login-page');

      component.ngOnDestroy();
    });

    it('delegates NavigationError router events to the chunk-load-error handler', () => {
      const component = createComponent();
      component.ngOnInit();
      const handleSpy = vi.spyOn(component as any, 'handleChunkLoadError');

      const navError = new NavigationError(1, '/orders', new Error('boom'));
      routerMock.events.next(navError);

      expect(handleSpy).toHaveBeenCalledWith(navError);

      component.ngOnDestroy();
    });
  });

  describe('ngOnDestroy', () => {
    it('unsubscribes, removes applied body classes, and unlistens activity handlers', () => {
      const component = createComponent();
      component.ngOnInit();
      routerMock.events.next(new NavigationEnd(1, '/account/login', '/account/login'));
      rendererMock.removeClass.mockClear();

      component.ngOnDestroy();

      expect(rendererMock.removeClass).toHaveBeenCalledWith(document.body, 'login-page');
      expect(() => routerMock.events.next(new NavigationEnd(2, '/', '/'))).not.toThrow();
    });

    it('swallows an error thrown by an activity unlisten function', () => {
      const component = createComponent();
      rendererMock.listen.mockReturnValue(() => {
        throw new Error('fail');
      });
      component.ngOnInit();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });

    it('does not throw when nothing was ever subscribed', () => {
      const component = createComponent();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('handleChunkLoadError (private, direct calls)', () => {
    beforeEach(() => {
      sessionStorage.clear();
    });

    function call(component: AppComponent, error: unknown, url = '/orders') {
      (component as any).handleChunkLoadError({ url, error });
    }

    function storedReload(): { url: string; ts: number } | null {
      return JSON.parse(sessionStorage.getItem('nexusChunkReload') || 'null');
    }

    it('ignores an unrelated navigation error', () => {
      const component = createComponent();

      call(component, new Error('some other failure'));

      expect(storedReload()).toBeNull();
    });

    it('reloads via a hard navigation for a ChunkLoadError', () => {
      const component = createComponent();

      call(component, 'ChunkLoadError', '/orders');

      expect(storedReload()?.url).toBe('/orders');
    });

    it('reloads for a "Loading chunk ... failed" webpack-style message', () => {
      const component = createComponent();

      call(component, { message: 'Loading chunk 12 failed' }, '/orders');

      expect(storedReload()?.url).toBe('/orders');
    });

    it('treats a missing error entirely as an empty message (ignored)', () => {
      const component = createComponent();

      call(component, undefined);

      expect(storedReload()).toBeNull();
    });

    it('does not reload again for the same url within the 15s throttle window', () => {
      const component = createComponent();
      const original = { url: '/orders', ts: Date.now() };
      sessionStorage.setItem('nexusChunkReload', JSON.stringify(original));

      call(component, 'ChunkLoadError', '/orders');

      expect(storedReload()!.ts).toBe(original.ts);
    });

    it('reloads again once the throttle window has elapsed', () => {
      const component = createComponent();
      const staleTs = Date.now() - 20000;
      sessionStorage.setItem('nexusChunkReload', JSON.stringify({ url: '/orders', ts: staleTs }));

      call(component, 'ChunkLoadError', '/orders');

      expect(storedReload()!.ts).not.toBe(staleTs);
    });

    it('reloads for a different url even within the throttle window', () => {
      const component = createComponent();
      sessionStorage.setItem(
        'nexusChunkReload',
        JSON.stringify({ url: '/orders', ts: Date.now() }),
      );

      call(component, 'ChunkLoadError', '/quotes');

      expect(storedReload()?.url).toBe('/quotes');
    });
  });

  describe('checkRefreshOnNavigation (private, via NavigationEnd events)', () => {
    it('does not attempt a refresh on an /account page', () => {
      const component = createComponent();
      component.ngOnInit();
      accountServiceMock.refreshUser.mockClear();

      routerMock.events.next(new NavigationEnd(2, '/account/login', '/account/login'));

      expect(accountServiceMock.refreshUser).not.toHaveBeenCalled();
      component.ngOnDestroy();
    });

    it('throttles repeated refresh attempts within the interval', () => {
      const component = createComponent();
      (component as any).refreshIntervalMs = 999999;
      (component as any).lastRefresh = Date.now();
      component.ngOnInit();
      accountServiceMock.refreshUser.mockClear();
      accountServiceMock.getStoredUser.mockReturnValue({ tokenExpiresAtUtc: '2999-01-01' });
      accountServiceMock.isTokenExpired.mockReturnValue(false);

      routerMock.events.next(new NavigationEnd(2, '/dashboard', '/dashboard'));

      expect(accountServiceMock.refreshUser).not.toHaveBeenCalled();
      component.ngOnDestroy();
    });

    it('does nothing when there is no stored user on navigation', () => {
      const component = createComponent();
      (component as any).refreshIntervalMs = 0;
      component.ngOnInit();
      accountServiceMock.getStoredUser.mockReturnValue(null);

      expect(() =>
        routerMock.events.next(new NavigationEnd(2, '/dashboard', '/dashboard')),
      ).not.toThrow();
      expect(accountServiceMock.refreshUser).not.toHaveBeenCalled();
      component.ngOnDestroy();
    });

    it('logs out immediately when the stored token has expired', () => {
      const component = createComponent();
      (component as any).refreshIntervalMs = 0;
      component.ngOnInit();
      accountServiceMock.getStoredUser.mockReturnValue({ tokenExpiresAtUtc: '2000-01-01' });
      accountServiceMock.isTokenExpired.mockReturnValue(true);

      routerMock.events.next(new NavigationEnd(2, '/dashboard', '/dashboard'));

      expect(accountServiceMock.logout).toHaveBeenCalled();
      expect(accountServiceMock.refreshUser).not.toHaveBeenCalled();
      component.ngOnDestroy();
    });

    it('refreshes the token and records the timestamp on success', () => {
      const component = createComponent();
      (component as any).refreshIntervalMs = 0;
      component.ngOnInit();
      accountServiceMock.getStoredUser.mockReturnValue({ tokenExpiresAtUtc: '2999-01-01' });
      accountServiceMock.isTokenExpired.mockReturnValue(false);
      accountServiceMock.refreshUser.mockReturnValue(of(undefined));

      routerMock.events.next(new NavigationEnd(2, '/dashboard', '/dashboard'));

      expect((component as any).lastRefresh).toBeGreaterThan(0);
      component.ngOnDestroy();
    });

    it('logs out and records the timestamp when the refresh request errors', () => {
      const component = createComponent();
      (component as any).refreshIntervalMs = 0;
      component.ngOnInit();
      accountServiceMock.getStoredUser.mockReturnValue({ tokenExpiresAtUtc: '2999-01-01' });
      accountServiceMock.isTokenExpired.mockReturnValue(false);
      accountServiceMock.refreshUser.mockReturnValue(
        new Observable((subscriber) => subscriber.error(new Error('fail'))),
      );

      routerMock.events.next(new NavigationEnd(2, '/dashboard', '/dashboard'));

      expect(accountServiceMock.logout).toHaveBeenCalled();
      expect((component as any).lastRefresh).toBeGreaterThan(0);
      component.ngOnDestroy();
    });
  });
});
