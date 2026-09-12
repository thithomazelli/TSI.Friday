import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AccountService } from '../services';

// Requests where a 401 must never trigger a renewal attempt: retrying the refresh endpoint off
// its own 401 would recurse into itself, and a 401 on login is just a wrong-password response
// the login screen already handles - neither is a "session went stale mid-use" case.
const AUTH_EXEMPT_URL_FRAGMENTS = ['/account/refresh-user-token', '/account/login'];

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private accountService: AccountService) {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((err: HttpErrorResponse) => {
        if (
          err.status !== 401 ||
          AUTH_EXEMPT_URL_FRAGMENTS.some((fragment) => request.url.includes(fragment))
        ) {
          // Not an auth failure (network error, 5xx, timeout, ...) - propagate as-is without
          // touching the session. This used to be indistinguishable from a real 401 because the
          // whole handler was commented out, which is exactly what made an ordinary transient
          // failure look identical to a dead session.
          return throwError(() => err);
        }

        const jwt = this.accountService.getJWT();
        if (!jwt) {
          return throwError(() => err);
        }

        // A 401 mid-session isn't necessarily a dead session - attempt one real renewal before
        // giving up, then retry the original request with the fresh token.
        return this.accountService.refreshUser(jwt).pipe(
          switchMap(() => {
            const newJwt = this.accountService.getJWT();
            const retried = newJwt
              ? request.clone({ setHeaders: { Authorization: `Bearer ${newJwt}` } })
              : request;
            return next.handle(retried);
          }),
          catchError(() => {
            this.accountService.logout();
            return throwError(() => err);
          }),
        );
      }),
    );
  }
}
