import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountService, TranslationService } from '@nexus/core';
import { Subject, of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let accountServiceMock: { user$: Subject<unknown>; login: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let queryParamMap$: Subject<{ get: (key: string) => string | null }>;
  let activatedRouteMock: { queryParamMap: Subject<{ get: (key: string) => string | null }> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  function createComponent(): LoginComponent {
    accountServiceMock = { user$: new Subject(), login: vi.fn() };
    routerMock = { navigateByUrl: vi.fn() };
    queryParamMap$ = new Subject();
    activatedRouteMock = { queryParamMap: queryParamMap$ };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };

    return new LoginComponent(
      accountServiceMock as unknown as AccountService,
      new FormBuilder(),
      routerMock as unknown as Router,
      activatedRouteMock as unknown as ActivatedRoute,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  function paramMap(entries: Record<string, string | null>) {
    return { get: (key: string) => entries[key] ?? null };
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('redirects home immediately when already logged in', () => {
    const component = createComponent();
    accountServiceMock.user$.next({ id: 'u1' });

    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('picks up the returnUrl query param when logged out', () => {
    const component = createComponent();
    accountServiceMock.user$.next(null);
    queryParamMap$.next(paramMap({ returnUrl: '/orders' }));

    expect(component.returnUrl).toBe('/orders');
  });

  it('does not touch returnUrl when the query param map itself is falsy', () => {
    const component = createComponent();
    accountServiceMock.user$.next(null);
    queryParamMap$.next(null as unknown as { get: (key: string) => string | null });

    expect(component.returnUrl).toBeNull();
  });

  describe('login', () => {
    it('does not submit an invalid form', () => {
      const component = createComponent();
      component.ngOnInit();

      const result$ = component.login();

      let value: unknown;
      result$.subscribe((v) => (value = v));
      expect(value).toBeNull();
      expect(component.submitted).toBe(true);
      expect(accountServiceMock.login).not.toHaveBeenCalled();
    });

    it('navigates to returnUrl on successful login', () => {
      const component = createComponent();
      component.ngOnInit();
      accountServiceMock.user$.next(null);
      queryParamMap$.next(paramMap({ returnUrl: '/orders' }));
      accountServiceMock.login.mockReturnValue(of({ data: { id: 'u1' } }));

      component.form.setValue({ userName: 'admin', password: 'x' });
      component.login().subscribe();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/orders');
    });

    it('navigates to the home route when there is no returnUrl', () => {
      const component = createComponent();
      component.ngOnInit();
      accountServiceMock.login.mockReturnValue(of({ data: { id: 'u1' } }));

      component.form.setValue({ userName: 'admin', password: 'x' });
      component.login().subscribe();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('');
    });

    it('surfaces server validation errors', () => {
      const component = createComponent();
      component.ngOnInit();
      accountServiceMock.login.mockReturnValue(
        throwError(() => ({ error: { errors: ['Invalid credentials'] } })),
      );

      component.form.setValue({ userName: 'admin', password: 'wrong' });
      component.login().subscribe({ error: () => {} });

      expect(component.errorMessages).toEqual(['Invalid credentials']);
    });

    it('appends a plain string server error to errorMessages', () => {
      const component = createComponent();
      component.ngOnInit();
      accountServiceMock.login.mockReturnValue(throwError(() => ({ error: 'Conta bloqueada' })));

      component.form.setValue({ userName: 'admin', password: 'wrong' });
      component.login().subscribe({ error: () => {} });

      expect(component.errorMessages).toEqual(['Conta bloqueada']);
    });

    it('falls back to a translated generic error message', () => {
      const component = createComponent();
      component.ngOnInit();
      accountServiceMock.login.mockReturnValue(throwError(() => ({ error: {} })));

      component.form.setValue({ userName: 'admin', password: 'wrong' });
      component.login().subscribe({ error: () => {} });

      expect(component.errorMessages).toEqual(['ACCOUNT.SERVER_ERROR']);
    });

    it('falls back to the generic message without throwing when response.error itself is null', () => {
      // Regression test: a failure that never reaches the API with a JSON body - a dead
      // upstream/dev-proxy 500, a timeout - carries response.error === null, not an object with
      // no .errors. `response.error.errors` used to throw reading .errors off null right there in
      // tap()'s error handler, which aborted before errorMessages/markForCheck() ever ran and left
      // the login page blank with no feedback at all, instead of falling through to this message.
      const component = createComponent();
      component.ngOnInit();
      accountServiceMock.login.mockReturnValue(throwError(() => ({ status: 500, error: null })));

      component.form.setValue({ userName: 'admin', password: 'wrong' });

      expect(() => component.login().subscribe({ error: () => {} })).not.toThrow();
      expect(component.errorMessages).toEqual(['ACCOUNT.SERVER_ERROR']);
    });
  });

  describe('resendEmailConfirmation', () => {
    it('navigates to the resend-confirmation route', () => {
      const component = createComponent();
      component.resendEmailConfirmation();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith(
        '/account/send-email/resend-email-confirmation',
      );
    });
  });

  describe('togglePasswordVisibility', () => {
    it('flips passwordVisible', () => {
      const component = createComponent();
      expect(component.passwordVisible).toBe(false);
      component.togglePasswordVisibility();
      expect(component.passwordVisible).toBe(true);
    });
  });
});
