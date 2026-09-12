import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
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
