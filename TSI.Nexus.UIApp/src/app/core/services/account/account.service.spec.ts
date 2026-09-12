import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { ApiService, ThemeService, TranslationService, User } from '@nexus/core';
import { AccountService } from './account.service';

describe('AccountService', () => {
  let service: AccountService;
  let apiServiceMock: { post: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Default post() to a harmless completed Observable - startAutoLogout() can synchronously
    // cascade into logout() (which fires a fire-and-forget account/logout post) whenever a test
    // user has no tokenExpiresAtUtc, so every test needs a safe default rather than each one
    // remembering to mock it.
    apiServiceMock = { post: vi.fn().mockReturnValue(of(undefined)), get: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: apiServiceMock },
        { provide: Router, useValue: { navigateByUrl: vi.fn().mockResolvedValue(true) } },
        { provide: ThemeService, useValue: { apply: vi.fn() } },
        { provide: TranslationService, useValue: { use: vi.fn() } },
      ],
    });
    service = TestBed.inject(AccountService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('user$ does not emit until the session state is known (no emitNoUser()/setUser() yet)', () => {
    let emissions = 0;
    service.user$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(0);
  });

  it('emitNoUser marks the session as logged out without touching the network', () => {
    let emitted: (User | null)[] = [];
    service.user$.subscribe((u) => emitted.push(u));

    service.emitNoUser();
    TestBed.flushEffects();

    expect(emitted).toEqual([null]);
    expect(apiServiceMock.get).not.toHaveBeenCalled();
    expect(apiServiceMock.post).not.toHaveBeenCalled();
  });

  describe('getStoredUser', () => {
    afterEach(() => {
      localStorage.clear();
    });

    it('returns null when nothing is stored', () => {
      expect(service.getStoredUser()).toBeNull();
    });

    it('returns the parsed user when one is stored', () => {
      localStorage.setItem('nexusAppUser', JSON.stringify({ id: '1' }));
      expect(service.getStoredUser()).toEqual({ id: '1' });
    });

    it('returns null instead of throwing when the stored value is not valid JSON', () => {
      localStorage.setItem('nexusAppUser', 'not-json{');
      expect(service.getStoredUser()).toBeNull();
    });
  });

  describe('simple delegating endpoints', () => {
    it('register posts to account/register', () => {
      apiServiceMock.post.mockReturnValue(of({}));
      service.register({ userName: 'a' } as never).subscribe();
      expect(apiServiceMock.post).toHaveBeenCalledWith('account/register', { userName: 'a' });
    });

    it('confirmEmail puts to account/confirm-email', () => {
      const putMock = vi.fn().mockReturnValue(of(undefined));
      (apiServiceMock as unknown as { put: typeof putMock }).put = putMock;
      service.confirmEmail({ userId: 'u1' } as never).subscribe();
      expect(putMock).toHaveBeenCalledWith('account/confirm-email', { userId: 'u1' });
    });

    it('resendEmailConfirmation posts to the email-scoped endpoint', () => {
      apiServiceMock.post.mockReturnValue(of(undefined));
      service.resendEmailConfirmation('a@b.com').subscribe();
      expect(apiServiceMock.post).toHaveBeenCalledWith(
        'account/resend-email-confirmation/a@b.com',
        {},
      );
    });

    it('forgotUsernameOrPassword posts to the email-scoped endpoint', () => {
      apiServiceMock.post.mockReturnValue(of(undefined));
      service.forgotUsernameOrPassword('a@b.com').subscribe();
      expect(apiServiceMock.post).toHaveBeenCalledWith(
        'account/forgot-username-or-password/a@b.com',
        {},
      );
    });

    it('resetPassword puts to account/reset-password', () => {
      const putMock = vi.fn().mockReturnValue(of(undefined));
      (apiServiceMock as unknown as { put: typeof putMock }).put = putMock;
      service.resetPassword({ token: 't1' } as never).subscribe();
      expect(putMock).toHaveBeenCalledWith('account/reset-password', { token: 't1' });
    });
  });

  describe('isTokenExpired', () => {
    it('returns true when expiresAtUtc is missing', () => {
      expect(service.isTokenExpired(null)).toBe(true);
      expect(service.isTokenExpired(undefined)).toBe(true);
    });

    it('returns true when expiresAtUtc is unparseable', () => {
      expect(service.isTokenExpired('not-a-date')).toBe(true);
    });

    it('returns true when expiresAtUtc is in the past', () => {
      const pastDate = new Date(Date.now() - 60_000).toISOString();
      expect(service.isTokenExpired(pastDate)).toBe(true);
    });

    it('returns false when expiresAtUtc is comfortably in the future', () => {
      const futureDate = new Date(Date.now() + 5 * 60_000).toISOString();
      expect(service.isTokenExpired(futureDate)).toBe(false);
    });
  });

  describe('login', () => {
    it('posts credentials and emits the resulting user on user$', () => {
      const user = { id: '1', role: 'Master', tokenExpiresAtUtc: null } as unknown as User;
      apiServiceMock.post.mockReturnValue(of(user));

      const emitted: unknown[] = [];
      service.user$.subscribe((u) => emitted.push(u));

      service.login({ userName: 'admin', password: 'x' } as never).subscribe();
      TestBed.flushEffects();

      expect(apiServiceMock.post).toHaveBeenCalledWith('account/login', {
        userName: 'admin',
        password: 'x',
      });
      expect(emitted.at(-1)).toMatchObject({ id: '1', roles: ['Master'] });
    });

    it('makes the new user visible to a fresh user$ subscriber synchronously, with no flush needed', () => {
      // Regression test: this used to be backed by a Signal + toObservable(), which only reaches
      // subscribers on the next effect flush rather than synchronously on set(). Login's own
      // success handler calls setUser() then immediately navigateByUrl() in the same tick, and
      // AuthorizationGuard subscribes to user$ fresh for every navigation - with the Signal, that
      // brand-new subscription could still observe the pre-login value (no flush had happened
      // yet), reject the navigation, and bounce the user straight back to the login page they had
      // just authenticated out of. This must hold with no TestBed.flushEffects() call at all.
      const user = { id: '1', tokenExpiresAtUtc: null } as unknown as User;
      apiServiceMock.post.mockReturnValue(of(user));

      service.login({ userName: 'admin', password: 'x' } as never).subscribe();

      let sawImmediately: unknown;
      service.user$.subscribe((u) => (sawImmediately = u));

      expect(sawImmediately).toMatchObject({ id: '1' });
    });

    it('applies the saved theme and language preferences from the logged-in user', () => {
      const themeService = TestBed.inject(ThemeService);
      const translationService = TestBed.inject(TranslationService);
      const user = {
        id: '1',
        tokenExpiresAtUtc: null,
        theme: 'dark',
        language: 'es',
      } as unknown as User;
      apiServiceMock.post.mockReturnValue(of(user));

      service.login({ userName: 'admin', password: 'x' } as never).subscribe();

      expect(themeService.apply).toHaveBeenCalledWith('dark');
      expect(translationService.use).toHaveBeenCalledWith('es');
    });

    it('does not touch theme/language when the user has neither saved', () => {
      const themeService = TestBed.inject(ThemeService);
      const translationService = TestBed.inject(TranslationService);
      const user = { id: '1', tokenExpiresAtUtc: null } as unknown as User;
      apiServiceMock.post.mockReturnValue(of(user));

      service.login({ userName: 'admin', password: 'x' } as never).subscribe();

      expect(themeService.apply).not.toHaveBeenCalled();
      expect(translationService.use).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('clears the stored user and emits null on user$ even if the server call fails', () => {
      apiServiceMock.post.mockReturnValue({
        subscribe: (observer: { error: (e: unknown) => void }) => observer.error(new Error('down')),
      });

      const emitted: unknown[] = [];
      service.user$.subscribe((u) => emitted.push(u));

      service.logout();
      TestBed.flushEffects();

      expect(emitted.at(-1)).toBeNull();
      expect(apiServiceMock.post).toHaveBeenCalledWith('account/logout', {});
    });

    it('ignores a refreshUser() call that was already in flight when logout() ran', () => {
      const refresh$ = new Subject<User>();
      apiServiceMock.get = vi.fn().mockReturnValue(refresh$);

      const emitted: unknown[] = [];
      service.user$.subscribe((u) => emitted.push(u));

      service.refreshUser().subscribe();
      service.logout();
      TestBed.flushEffects();
      expect(emitted.at(-1)).toBeNull();

      // The pre-logout refresh resolves afterwards, against the cookie that was still valid when
      // it was issued - it must not resurrect the session logout() just cleared.
      refresh$.next({ id: '1', tokenExpiresAtUtc: null } as unknown as User);
      refresh$.complete();
      TestBed.flushEffects();

      expect(emitted.at(-1)).toBeNull();
    });

    it('lets a fresh login() after logout() set the user again', () => {
      const user = { id: '1', tokenExpiresAtUtc: null } as unknown as User;

      const emitted: unknown[] = [];
      service.user$.subscribe((u) => emitted.push(u));

      service.logout();
      TestBed.flushEffects();
      expect(emitted.at(-1)).toBeNull();

      apiServiceMock.post.mockReturnValue(of(user));
      service.login({ userName: 'admin', password: 'x' } as never).subscribe();
      TestBed.flushEffects();

      expect(emitted.at(-1)).toMatchObject({ id: '1' });
    });

    it('clears a pending auto-logout timer so it cannot fire after logout', () => {
      vi.useFakeTimers();
      try {
        service.startAutoLogout(new Date(Date.now() + 60_000).toISOString());
        service.logout();
        apiServiceMock.get.mockClear();

        vi.advanceTimersByTime(60_000);

        expect(apiServiceMock.get).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('navigates to logout then to login when navigation succeeds', async () => {
      const router = TestBed.inject(Router);

      service.logout();
      await Promise.resolve();
      await Promise.resolve();

      expect(router.navigateByUrl).toHaveBeenNthCalledWith(1, '/account/logout', {
        replaceUrl: true,
      });
      expect(router.navigateByUrl).toHaveBeenNthCalledWith(2, '/account/login');
    });

    it('still tries to navigate to login when the logout navigation promise rejects', async () => {
      const router = TestBed.inject(Router);
      (router.navigateByUrl as ReturnType<typeof vi.fn>).mockReturnValueOnce(
        Promise.reject(new Error('nav failed')),
      );

      service.logout();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/account/login');
    });

    it('swallows a synchronous throw from the fallback login navigation', async () => {
      const router = TestBed.inject(Router);
      (router.navigateByUrl as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(Promise.reject(new Error('nav failed')))
        .mockImplementationOnce(() => {
          throw new Error('boom');
        });

      expect(() => service.logout()).not.toThrow();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  describe('startAutoLogout / attemptRenewalOrLogout', () => {
    it('clears an already-running timer before starting a new one', () => {
      vi.useFakeTimers();
      try {
        service.startAutoLogout(new Date(Date.now() + 60_000).toISOString());
        expect(() =>
          service.startAutoLogout(new Date(Date.now() + 120_000).toISOString()),
        ).not.toThrow();
      } finally {
        vi.useRealTimers();
      }
    });

    it('attempts a renewal once the scheduled timer fires', () => {
      vi.useFakeTimers();
      try {
        apiServiceMock.get.mockReturnValue(of({ id: '1', tokenExpiresAtUtc: null } as unknown as User));

        service.startAutoLogout(new Date(Date.now() + 60_000).toISOString());
        vi.advanceTimersByTime(60_000);

        expect(apiServiceMock.get).toHaveBeenCalledWith('account/refresh-user-token');
      } finally {
        vi.useRealTimers();
      }
    });

    it('logs out immediately when expiresAtUtc is unparseable', () => {
      const emitted: unknown[] = [];
      service.user$.subscribe((u) => emitted.push(u));

      service.startAutoLogout('not-a-date');

      expect(emitted.at(-1)).toBeNull();
    });

    it('attempts a renewal immediately when the token has already expired', () => {
      apiServiceMock.get.mockReturnValue(of({ id: '1', tokenExpiresAtUtc: null } as unknown as User));

      service.startAutoLogout(new Date(Date.now() - 1000).toISOString());

      expect(apiServiceMock.get).toHaveBeenCalledWith('account/refresh-user-token');
    });

    it('logs out when the renewal attempt fails', () => {
      apiServiceMock.get.mockReturnValue(throwError(() => new Error('down')));
      const emitted: unknown[] = [];
      service.user$.subscribe((u) => emitted.push(u));

      service.startAutoLogout(new Date(Date.now() - 1000).toISOString());

      expect(emitted.at(-1)).toBeNull();
    });
  });

  describe('refreshUser', () => {
    it('hits the refresh endpoint and sets the user on success', () => {
      const user = { id: '1', role: 'Master', tokenExpiresAtUtc: null } as unknown as User;
      apiServiceMock.get.mockReturnValue(of(user));

      const emitted: unknown[] = [];
      service.user$.subscribe((u) => emitted.push(u));

      service.refreshUser().subscribe();
      TestBed.flushEffects();

      expect(apiServiceMock.get).toHaveBeenCalledWith('account/refresh-user-token');
      expect(emitted.at(-1)).toMatchObject({ id: '1', roles: ['Master'] });
    });

    it('dedupes concurrent calls onto a single in-flight request', () => {
      const response$ = new Subject<User>();
      apiServiceMock.get.mockReturnValue(response$);

      let firstDone = false;
      let secondDone = false;
      service.refreshUser().subscribe(() => (firstDone = true));
      service.refreshUser().subscribe(() => (secondDone = true));

      expect(apiServiceMock.get).toHaveBeenCalledTimes(1);

      response$.next({ id: '1', tokenExpiresAtUtc: null } as unknown as User);
      response$.complete();

      expect(firstDone).toBe(true);
      expect(secondDone).toBe(true);
    });

    it('starts a new request once the previous one has completed', () => {
      const first$ = new Subject<User>();
      apiServiceMock.get.mockReturnValue(first$);

      service.refreshUser().subscribe();
      first$.next({ id: '1', tokenExpiresAtUtc: null } as unknown as User);
      first$.complete();

      apiServiceMock.get.mockReturnValue(of({ id: '2', tokenExpiresAtUtc: null } as unknown as User));
      service.refreshUser().subscribe();

      expect(apiServiceMock.get).toHaveBeenCalledTimes(2);
    });
  });
});
