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

    it('falls back to a translated generic error message', () => {
      const component = createComponent();
      component.ngOnInit();
      accountServiceMock.login.mockReturnValue(throwError(() => ({ error: {} })));

      component.form.setValue({ userName: 'admin', password: 'wrong' });
      component.login().subscribe({ error: () => {} });

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
