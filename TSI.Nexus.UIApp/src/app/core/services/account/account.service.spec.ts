import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { ApiService, ThemeService, TranslationService } from '@nexus/core';
import { AccountService } from './account.service';

describe('AccountService', () => {
  let service: AccountService;
  let apiServiceMock: { post: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiServiceMock = { post: vi.fn(), get: vi.fn() };

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
    it('posts credentials and emits the resulting user on user$', async () => {
      const user = { id: '1', role: 'Master', tokenExpiresAtUtc: null } as any;
      apiServiceMock.post.mockReturnValue(of(user));

      const emitted: unknown[] = [];
      service.user$.subscribe((u) => emitted.push(u));

      await new Promise<void>((resolve) => {
        service.login({ userName: 'admin', password: 'x' } as any).subscribe(() => resolve());
      });

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

      expect(emitted.at(-1)).toBeNull();
      expect(apiServiceMock.post).toHaveBeenCalledWith('account/logout', {});
    });
  });
});
