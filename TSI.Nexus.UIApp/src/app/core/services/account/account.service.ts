import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
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
import { map, Observable } from 'rxjs';
import { filter, finalize, shareReplay } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AccountService {
  // undefined = "session state not known yet" (before app.component.ts's bootstrap calls
  // emitNoUser()/refreshUser()); null = "known logged out". Consumers (authorization.guard.ts in
  // particular) rely on getting NO emission until the session state is actually known - the
  // router guard's Observable<boolean> only resolves on the first emission, so a route decision
  // correctly waits rather than firing prematurely against a still-unknown session. undefined is
  // filtered out of user$ below to preserve that, the same "not loaded yet" sentinel pattern used
  // by FeatureFlagService/ProductService/etc.
  private readonly _user = signal<User | null | undefined>(undefined);

  // In-flight refresh Observable, deduplicating concurrent refreshUser() callers onto a single
  // HTTP request. Deliberately kept as RxJS rather than migrated: this isn't "current state" a
  // Signal would model (there's no meaningful "value" between requests, only "is one in flight
  // right now"), it's a single-use share+finalize dedup exactly matching the addTemporary()-style
  // carve-out documented in spec-12 section 3 for one-shot RxJS mechanisms Signals don't replace.
  private _refresh$?: Observable<void>;

  // Safety margin against client clock drift relative to the server, roughly matching the
  // ASP.NET JWT bearer's own default 5-minute ClockSkew - keeps the two tolerances in the same
  // ballpark so the client doesn't give up on a token the server would still accept.
  private readonly clockSkewToleranceMs = 60_000;

  readonly user$: Observable<User | null> = toObservable(this._user).pipe(
    filter((u): u is User | null => u !== undefined),
  );

  constructor(
    private apiService: ApiService,
    private router: Router,
    private themeService: ThemeService,
    private translationService: TranslationService,
  ) {}

  /**
   * Returns true when the token's expiry is missing, unparseable, or in the past. False when
   * still within its validity window (plus clock-skew tolerance).
   */
  isTokenExpired(expiresAtUtc: string | null | undefined): boolean {
    if (!expiresAtUtc) {
      return true;
    }

    const exp = new Date(expiresAtUtc).getTime();
    if (Number.isNaN(exp)) {
      return true;
    }
    return Date.now() >= exp + this.clockSkewToleranceMs;
  }

  /**
   * Reads the last-known user (including token expiry) straight from localStorage, without
   * touching the network or the user$ stream - used at app bootstrap and on navigation to decide
   * whether a session is even worth trying to renew, before calling refreshUser().
   */
  getStoredUser(): User | null {
    try {
      const raw = localStorage.getItem(environment.userKey);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  /** Marks the session as logged-out locally, without navigating - see getStoredUser() callers. */
  emitNoUser(): void {
    this._user.set(null);
  }

  refreshUser(): Observable<void> {
    // if a refresh is already in-flight, return the existing observable
    if (this._refresh$) {
      return this._refresh$;
    }

    // The httpOnly auth cookie rides along automatically (withCredentials on ApiService) - no
    // token to attach here.
    const req$ = this.apiService.get<User>('account/refresh-user-token').pipe(
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
        // A fresh, explicit login always wins over a previous logout - see the flag itself for
        // why it exists.
        this.loggedOut = false;
        this.setUser(user);
      }),
    );
  }

  // Guards setUser() against a refreshUser() call that was already in flight (from the periodic
  // checkRefreshOnNavigation() timer, or the auto-logout renewal attempt) when logout() ran: that
  // request was issued against the still-valid pre-logout cookie, so it can resolve successfully
  // *after* local state was cleared and resurrect a session the user just explicitly ended -
  // leaving the shell hidden (isLoggedIn$ still reflects the logout) while the app is actually
  // holding a live user again, or racing the navigation to the login page. Only a real login()
  // clears the flag.
  private loggedOut = false;

  logout(): void {
    this.loggedOut = true;

    // A pending auto-logout timer firing later would just attempt a renewal that setUser() now
    // ignores, but there is no reason to let it fire at all once the session has been ended here.
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = undefined;
    }

    // Clear client state immediately so application stops using invalid token
    try {
      localStorage.removeItem(environment.userKey);
      this._user.set(null);
    } catch {
      // ignore
    }

    // Best-effort: clears the httpOnly cookie server-side. Fire-and-forget - local state above is
    // already cleared, so a network failure here doesn't block navigating to login.
    this.apiService.post('account/logout', {}).subscribe({ error: () => {} });

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

  // Timer para autologoff
  private logoutTimer: any;
  /**
   * Inicia ou reinicia o timer de autologoff baseado na expiração do token.
   * Chame este método sempre que um novo token for emitido (login, refresh, etc).
   */
  startAutoLogout(expiresAtUtc: string | null | undefined) {
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
    }
    if (!expiresAtUtc) {
      this.logout();
      return;
    }
    const expiresAt = new Date(expiresAtUtc).getTime();
    if (Number.isNaN(expiresAt)) {
      this.logout();
      return;
    }
    const timeout = expiresAt - Date.now();
    if (timeout > 0) {
      this.logoutTimer = setTimeout(() => {
        this.attemptRenewalOrLogout();
      }, timeout);
    } else {
      this.attemptRenewalOrLogout();
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
  private attemptRenewalOrLogout(): void {
    this.refreshUser().subscribe({
      next: () => {},
      error: () => this.logout(),
    });
  }

  private setUser(user: User): void {
    if (!user || this.loggedOut) {
      return;
    }

    // `role` (singular) is what the backend DTO actually carries - `roles` (array) used to be
    // decoded from the JWT's role claim(s), but the token itself is no longer readable client-side
    // (httpOnly cookie). The backend only ever assigns one role per user, so a single-element
    // array preserves exactly what every `roles.includes(...)`/`roles.some(...)` check needs.
    if (user.role) {
      user.roles = [user.role];
    }

    // Sempre reinicia o timer de autologoff ao setar novo usuário/token
    this.startAutoLogout(user.tokenExpiresAtUtc);

    localStorage.setItem(environment.userKey, JSON.stringify(user));
    this._user.set(user);

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
