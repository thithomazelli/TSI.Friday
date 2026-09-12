import { FormBuilder } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AccountService } from '@nexus/core';
import { Subject, of, throwError } from 'rxjs';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  let accountServiceMock: {
    forgotUsernameOrPassword: ReturnType<typeof vi.fn>;
    resetPassword: ReturnType<typeof vi.fn>;
  };
  let queryParamMap$: Subject<{ get: (key: string) => string | null }>;
  let activatedRouteMock: { queryParamMap: Subject<{ get: (key: string) => string | null }> };

  function createComponent(): ResetPasswordComponent {
    accountServiceMock = {
      forgotUsernameOrPassword: vi.fn(),
      resetPassword: vi.fn(),
    };
    queryParamMap$ = new Subject();
    activatedRouteMock = { queryParamMap: queryParamMap$ };

    return new ResetPasswordComponent(
      accountServiceMock as unknown as AccountService,
      new FormBuilder(),
      activatedRouteMock as unknown as ActivatedRoute,
    );
  }

  function paramMap(entries: Record<string, string | null>) {
    return { get: (key: string) => entries[key] ?? null };
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('starts on the "request" step when there is no token/email', () => {
      const component = createComponent();
      component.ngOnInit();
      queryParamMap$.next(paramMap({}));

      expect(component.step).toBe('request');
      expect(component.form.get('email')).toBeTruthy();
    });

    it('starts on the "reset" step when token and email are present', () => {
      const component = createComponent();
      component.ngOnInit();
      queryParamMap$.next(paramMap({ token: 'tok', email: 'a@b.com' }));

      expect(component.step).toBe('reset');
      expect(component.form.get('newPassword')).toBeTruthy();
    });
  });

  describe('requestReset', () => {
    it('does not submit an invalid form', () => {
      const component = createComponent();
      component.ngOnInit();
      queryParamMap$.next(paramMap({}));

      component.requestReset();

      expect(component.submitted).toBe(true);
      expect(accountServiceMock.forgotUsernameOrPassword).not.toHaveBeenCalled();
    });

    it('moves to the "sent" step on success', () => {
      const component = createComponent();
      component.ngOnInit();
      queryParamMap$.next(paramMap({}));
      accountServiceMock.forgotUsernameOrPassword.mockReturnValue(of(undefined));

      component.form.setValue({ email: 'a@b.com' });
      component.requestReset();

      expect(accountServiceMock.forgotUsernameOrPassword).toHaveBeenCalledWith('a@b.com');
      expect(component.step).toBe('sent');
    });

    it('surfaces an error message on failure', () => {
      const component = createComponent();
      component.ngOnInit();
      queryParamMap$.next(paramMap({}));
      accountServiceMock.forgotUsernameOrPassword.mockReturnValue(
        throwError(() => ({ error: { errors: ['E-mail não encontrado'] } })),
      );

      component.form.setValue({ email: 'a@b.com' });
      component.requestReset();

      expect(component.errorMessages).toEqual(['E-mail não encontrado']);
    });

    it('falls back to the plain response.error string when there is no errors array', () => {
      const component = createComponent();
      component.ngOnInit();
      queryParamMap$.next(paramMap({}));
      accountServiceMock.forgotUsernameOrPassword.mockReturnValue(
        throwError(() => ({ error: 'Conta bloqueada' })),
      );

      component.form.setValue({ email: 'a@b.com' });
      component.requestReset();

      expect(component.errorMessages).toEqual(['Conta bloqueada']);
    });

    it('falls back to a generic message when the response has no error at all', () => {
      const component = createComponent();
      component.ngOnInit();
      queryParamMap$.next(paramMap({}));
      accountServiceMock.forgotUsernameOrPassword.mockReturnValue(throwError(() => ({})));

      component.form.setValue({ email: 'a@b.com' });
      component.requestReset();

      expect(component.errorMessages).toEqual(['Erro ao enviar o e-mail.']);
    });
  });

  describe('resetPassword', () => {
    it('does not submit without a valid form/token/email', () => {
      const component = createComponent();
      component.ngOnInit();
      queryParamMap$.next(paramMap({}));

      component.resetPassword();

      expect(accountServiceMock.resetPassword).not.toHaveBeenCalled();
    });

    it('resets the password and moves to the "done" step', () => {
      const component = createComponent();
      component.ngOnInit();
      queryParamMap$.next(paramMap({ token: 'tok', email: 'a@b.com' }));
      accountServiceMock.resetPassword.mockReturnValue(of(undefined));

      component.form.setValue({ newPassword: '123456' });
      component.resetPassword();

      expect(accountServiceMock.resetPassword).toHaveBeenCalledWith({
        token: 'tok',
        email: 'a@b.com',
        newPassword: '123456',
      });
      expect(component.step).toBe('done');
    });

    it('surfaces an error message on failure', () => {
      const component = createComponent();
      component.ngOnInit();
      queryParamMap$.next(paramMap({ token: 'bad', email: 'a@b.com' }));
      accountServiceMock.resetPassword.mockReturnValue(
        throwError(() => ({ error: { errors: ['Token expirado'] } })),
      );

      component.form.setValue({ newPassword: '123456' });
      component.resetPassword();

      expect(component.errorMessages).toEqual(['Token expirado']);
    });

    it('falls back to the plain response.error string when there is no errors array', () => {
      const component = createComponent();
      component.ngOnInit();
      queryParamMap$.next(paramMap({ token: 'tok', email: 'a@b.com' }));
      accountServiceMock.resetPassword.mockReturnValue(
        throwError(() => ({ error: 'Token invalido' })),
      );

      component.form.setValue({ newPassword: '123456' });
      component.resetPassword();

      expect(component.errorMessages).toEqual(['Token invalido']);
    });

    it('falls back to a generic message when the response has no error at all', () => {
      const component = createComponent();
      component.ngOnInit();
      queryParamMap$.next(paramMap({ token: 'tok', email: 'a@b.com' }));
      accountServiceMock.resetPassword.mockReturnValue(throwError(() => ({})));

      component.form.setValue({ newPassword: '123456' });
      component.resetPassword();

      expect(component.errorMessages).toEqual(['Erro ao redefinir a senha.']);
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
