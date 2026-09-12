import { TestBed } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { Observable, of, Subject } from 'rxjs';
import { AccountService, TranslationService, User } from './core';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let accountServiceMock: {
    user$: Observable<User | null>;
    getStoredUser: ReturnType<typeof vi.fn>;
    emitNoUser: ReturnType<typeof vi.fn>;
    isTokenExpired: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    refreshUser: ReturnType<typeof vi.fn>;
    startAutoLogout: ReturnType<typeof vi.fn>;
  };
  let routerEvents$: Subject<unknown>;

  function createComponent() {
    accountServiceMock = {
      user$: of(null),
      getStoredUser: vi.fn().mockReturnValue(null),
      emitNoUser: vi.fn(),
      isTokenExpired: vi.fn().mockReturnValue(true),
      logout: vi.fn(),
      refreshUser: vi.fn().mockReturnValue(of(undefined)),
      startAutoLogout: vi.fn(),
    };
    routerEvents$ = new Subject();

    TestBed.configureTestingModule({
      providers: [
        AppComponent,
        { provide: Router, useValue: { events: routerEvents$.asObservable(), url: '/' } },
        { provide: AccountService, useValue: accountServiceMock },
        { provide: SwUpdate, useValue: { isEnabled: false, versionUpdates: of() } },
        { provide: Title, useValue: { setTitle: vi.fn() } },
        {
          provide: TranslationService,
          useValue: { instant: (key: string) => key, language$: of('pt-BR') },
        },
      ],
    });

    return TestBed.createComponent(AppComponent).componentInstance;
  }

  it('should create', () => {
    const app = createComponent();
    expect(app).toBeTruthy();
  });

  it('exposes isLoggedIn$ derived from AccountService.user$', () => {
    const userAccountServiceMock: { user$: Observable<User | null>; getStoredUser: ReturnType<typeof vi.fn> } = {
      user$: of({ id: '1' } as unknown as User),
      getStoredUser: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        AppComponent,
        { provide: Router, useValue: { events: of(), url: '/' } },
        { provide: AccountService, useValue: userAccountServiceMock },
        { provide: SwUpdate, useValue: { isEnabled: false, versionUpdates: of() } },
        { provide: Title, useValue: { setTitle: vi.fn() } },
        { provide: TranslationService, useValue: { instant: (k: string) => k, language$: of('pt-BR') } },
      ],
    });
    const app = TestBed.createComponent(AppComponent).componentInstance;

    let loggedIn: boolean | undefined;
    app.isLoggedIn$.subscribe((v) => (loggedIn = v));
    expect(loggedIn).toBe(true);
  });

  describe('showShell$', () => {
    function createComponentAtUrl(loggedIn: boolean, url: string) {
      const userAccountServiceMock = { user$: of(loggedIn ? ({ id: '1' } as unknown as User) : null) };
      const events$ = new Subject<unknown>();
      TestBed.configureTestingModule({
        providers: [
          AppComponent,
          { provide: Router, useValue: { events: events$.asObservable(), url } },
          { provide: AccountService, useValue: userAccountServiceMock },
          { provide: SwUpdate, useValue: { isEnabled: false, versionUpdates: of() } },
          { provide: Title, useValue: { setTitle: vi.fn() } },
          { provide: TranslationService, useValue: { instant: (k: string) => k, language$: of('pt-BR') } },
        ],
      });
      const app = TestBed.createComponent(AppComponent).componentInstance;
      return { app, events$ };
    }

    it('is false while logged out, even off /account', () => {
      const { app } = createComponentAtUrl(false, '/');

      let shown: boolean | undefined;
      app.showShell$.subscribe((v) => (shown = v));

      expect(shown).toBe(false);
    });

    it('is false while logged in but still on an /account page', () => {
      const { app } = createComponentAtUrl(true, '/account/login');

      let shown: boolean | undefined;
      app.showShell$.subscribe((v) => (shown = v));

      expect(shown).toBe(false);
    });

    it('is true once logged in and off /account', () => {
      const { app } = createComponentAtUrl(true, '/');

      let shown: boolean | undefined;
      app.showShell$.subscribe((v) => (shown = v));

      expect(shown).toBe(true);
    });

    it('flips back to false when navigation lands back on an /account page', () => {
      const { app, events$ } = createComponentAtUrl(true, '/');

      let shown: boolean | undefined;
      app.showShell$.subscribe((v) => (shown = v));
      expect(shown).toBe(true);

      events$.next(new NavigationEnd(1, '/account/login', '/account/login'));

      expect(shown).toBe(false);
    });
  });

  it('ngOnInit emits no user and does not call refreshUser when nothing is stored', () => {
    const app = createComponent();
    TestBed.inject(NgZone).run(() => app.ngOnInit());

    expect(accountServiceMock.emitNoUser).toHaveBeenCalled();
    expect(accountServiceMock.refreshUser).not.toHaveBeenCalled();

    app.ngOnDestroy();
  });

  it('ngOnInit logs out when the stored token is already expired', () => {
    const app = createComponent();
    accountServiceMock.getStoredUser.mockReturnValue({ tokenExpiresAtUtc: '2000-01-01' });
    accountServiceMock.isTokenExpired.mockReturnValue(true);

    TestBed.inject(NgZone).run(() => app.ngOnInit());

    expect(accountServiceMock.logout).toHaveBeenCalled();
    expect(accountServiceMock.refreshUser).not.toHaveBeenCalled();

    app.ngOnDestroy();
  });

  it('ngOnInit refreshes the session when a valid token is stored', () => {
    const app = createComponent();
    accountServiceMock.getStoredUser.mockReturnValue({ tokenExpiresAtUtc: '2999-01-01' });
    accountServiceMock.isTokenExpired.mockReturnValue(false);

    TestBed.inject(NgZone).run(() => app.ngOnInit());

    expect(accountServiceMock.refreshUser).toHaveBeenCalled();
    expect(accountServiceMock.logout).not.toHaveBeenCalled();

    app.ngOnDestroy();
  });
});
