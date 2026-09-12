import { Injectable } from '@angular/core';
import {
  ApiService,
  ConfirmEmail,
  Login,
  Register,
  ResetPassword,
  ThemeService,
  TranslationService,
  User,
  WebApiResponse,
} from '@nexus/core';
import { map, Observable, of, ReplaySubject } from 'rxjs';
import { finalize, shareReplay } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AccountService {
  private _userSource = new ReplaySubject<User | null>(1);

  // in-flight refresh observable to prevent duplicate requests
  private _refresh$?: Observable<void>;

  // Safety margin against client clock drift relative to the server, roughly matching the
  // ASP.NET JWT bearer's own default 5-minute ClockSkew - keeps the two tolerances in the same
  // ballpark so the client doesn't give up on a token the server would still accept.
  private readonly clockSkewToleranceMs = 60_000;

  user$ = this._userSource.asObservable();

  constructor(
    private apiService: ApiService,
    private router: Router,
    private themeService: ThemeService,
    private translationService: TranslationService,
  ) {}

  /**
   * Returns true when token is expired or invalid. False when token is present and not expired.
   */
  isTokenExpired(token: string | null): boolean {
    if (!token) {
      return true;
    }

    try {
      const parts = token.split('.');
      if (parts.length < 2) return true;
      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
      );
      if (!payload || !payload.exp) {
        return true;
      }
      // exp is in seconds since epoch
      const exp = Number(payload.exp) * 1000;
      return Date.now() >= exp + this.clockSkewToleranceMs;
    } catch {
      return true;
    }
  }

  refreshUser(jwt: string | null) {
    if (jwt === null) {
      this._userSource.next(null);
      return of(undefined);
    }

    // if a refresh is already in-flight, return the existing observable
    if (this._refresh$) {
      return this._refresh$;
    }

    let headers = new HttpHeaders();
    headers = headers.set('Authorization', `Bearer ${jwt}`);

    const req$ = this.apiService
      .get<User>('account/refresh-user-token', headers)
      .pipe(
        map((user: User) => {
          this.setUser(user);
        }),
        // ensure the in-flight observable is cleared when completed or errored
        finalize(() => {
          this._refresh$ = undefined;
        }),
        // share the single underlying request for multiple subscribers
        shareReplay(1),
      );

    // store and return the in-flight observable
    this._refresh$ = req$;
    return req$;
  }

  register(model: Register): Observable<WebApiResponse<User>> {
    return this.apiService.post('account/register', model);
  }

  confirmEmail(model: ConfirmEmail) {
    return this.apiService.put('account/confirm-email', model);
  }

  resendEmailConfirmation(email: string) {
    return this.apiService.post(
      `account/resend-email-confirmation/${email}`,
      {},
    );
  }

  forgotUsernameOrPassword(email: string): Observable<void> {
    return this.apiService.post(
      `account/forgot-username-or-password/${email}`,
      {},
    );
  }

  resetPassword(model: ResetPassword): Observable<void> {
    return this.apiService.put('account/reset-password', model);
  }

  login(model: Login): Observable<void> {
    return this.apiService.post<User>('account/login', model).pipe(
      map((user: User) => {
        this.setUser(user);
        if (user.jwt) {
          this.startAutoLogout(user.jwt);
        }
      }),
    );
  }

  logout(): void {
    // Clear client state immediately so application stops using invalid token
    try {
      localStorage.removeItem(environment.userKey);
      this._userSource.next(null);
    } catch {
      // ignore
    }

    // Navigate to logout page then to login; if navigation promise never resolves,
    // at least the client state is already cleared.
    this.router
      .navigateByUrl('/account/logout', { replaceUrl: true })
      .then(() => {
        // ensure final redirect to login
        this.router.navigateByUrl('/account/login');
      })
      .catch(() => {
        // If navigation fails, still try to go to login
        try {
          this.router.navigateByUrl('/account/login');
        } catch {
          // ignore
        }
      });
  }

  getJWT(): string | null {
    const key = localStorage.getItem(environment.userKey);

    if (!key) {
      return null;
    }

    const user: User = JSON.parse(key);
    return user.jwt;
  }

  // Timer para autologoff
  private logoutTimer: any;
  /**
   * Inicia ou reinicia o timer de autologoff baseado no exp do token JWT.
   * Chame este método sempre que um novo token for emitido (login, refresh, etc).
   */
  startAutoLogout(token: string | null) {
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
    }
    if (!token) {
      this.logout();
      return;
    }
    try {
      const parts = token.split('.');
      if (parts.length < 2) {
        this.logout();
        return;
      }
      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
      );
      if (!payload || !payload.exp) {
        this.logout();
        return;
      }
      const expiresAt = Number(payload.exp) * 1000;
      const now = Date.now();
      const timeout = expiresAt - now;
      if (timeout > 0) {
        this.logoutTimer = setTimeout(() => {
          this.attemptRenewalOrLogout(token);
        }, timeout);
      } else {
        this.attemptRenewalOrLogout(token);
      }
    } catch {
      this.logout();
    }
  }

  /**
   * Called when the access token's nominal lifetime is up. Rather than assuming the session is
   * dead, tries one real renewal first - the backend's JWT validation tolerates a few minutes of
   * clock skew (see clockSkewToleranceMs above), so a token that just hit its nominal expiry
   * still has a real chance of being accepted. Only logs out if that renewal genuinely fails.
   * On success, refreshUser()'s setUser() call reschedules this same timer against the new
   * token's expiry.
   */
  private attemptRenewalOrLogout(token: string): void {
    this.refreshUser(token).subscribe({
      next: () => {},
      error: () => this.logout(),
    });
  }

  private setUser(user: User): void {
    if (!user) {
      return;
    }

    // ensure roles from token payload
    try {
      if (user.jwt) {
        const token = user.jwt;
        const parts = token.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(
            atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
          );
          const roles =
            payload['role'] ||
            payload['roles'] ||
            payload[
              'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
            ];
          if (roles) {
            if (Array.isArray(roles)) {
              user.roles = roles;
            } else if (typeof roles === 'string') {
              user.roles = [roles];
            }
          }
        }
        // Sempre reinicia o timer de autologoff ao setar novo usuário/token
        this.startAutoLogout(token);
      }
    } catch (e) {
      // ignore decode errors
    }

    localStorage.setItem(environment.userKey, JSON.stringify(user));
    this._userSource.next(user);

    // Apply the user's saved theme/language preference (falls back to whatever was already
    // applied from localStorage before login when the user has no saved preference yet).
    if (user.theme === 'light' || user.theme === 'dark') {
      this.themeService.apply(user.theme);
    }
    if (
      user.language === 'pt-BR' ||
      user.language === 'en' ||
      user.language === 'es'
    ) {
      this.translationService.use(user.language);
    }
  }
}
