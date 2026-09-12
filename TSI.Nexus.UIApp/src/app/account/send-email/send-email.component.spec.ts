import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountService, ModalService, TranslationService } from '@nexus/core';
import { Subject, of, throwError } from 'rxjs';
import { SendEmailComponent } from './send-email.component';

describe('SendEmailComponent', () => {
  let accountServiceMock: {
    user$: Subject<unknown>;
    resendEmailConfirmation: ReturnType<typeof vi.fn>;
    forgotUsernameOrPassword: ReturnType<typeof vi.fn>;
  };
  let modalServiceMock: { showSweetNotification: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let activatedRouteMock: { snapshot: { paramMap: { get: ReturnType<typeof vi.fn> } } };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };

  function createComponent(mode: string | null): SendEmailComponent {
    accountServiceMock = {
      user$: new Subject(),
      resendEmailConfirmation: vi.fn(),
      forgotUsernameOrPassword: vi.fn(),
    };
    modalServiceMock = { showSweetNotification: vi.fn() };
    routerMock = { navigateByUrl: vi.fn() };
    activatedRouteMock = { snapshot: { paramMap: { get: vi.fn().mockReturnValue(mode) } } };
    cdrMock = { markForCheck: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };

    return new SendEmailComponent(
      accountServiceMock as unknown as AccountService,
      modalServiceMock as unknown as ModalService,
      new FormBuilder(),
      routerMock as unknown as Router,
      activatedRouteMock as unknown as ActivatedRoute,
      cdrMock as unknown as ChangeDetectorRef,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent(null)).toBeTruthy();
  });

  it('redirects home immediately when already logged in', () => {
    const component = createComponent('resend-email-confirmation');
    component.ngOnInit();

    accountServiceMock.user$.next({ id: 'u1' });

    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('reads the mode from the route and initializes the form when logged out', () => {
    const component = createComponent('resend-email-confirmation');
    component.ngOnInit();

    accountServiceMock.user$.next(null);

    expect(component.mode).toBe('resend-email-confirmation');
    expect(component.form.get('email')).toBeTruthy();
  });

  it('falls back to an empty mode when the route has none', () => {
    const component = createComponent(null);
    component.ngOnInit();

    accountServiceMock.user$.next(null);

    expect(component.mode).toBe('');
  });

  describe('sendEmail', () => {
    it('does nothing without a valid form', () => {
      const component = createComponent('resend-email-confirmation');
      component.ngOnInit();
      accountServiceMock.user$.next(null);

      component.sendEmail();

      expect(accountServiceMock.resendEmailConfirmation).not.toHaveBeenCalled();
    });

    it('resends the email confirmation and navigates to login on success', () => {
      const component = createComponent('resend-email-confirmation');
      component.ngOnInit();
      accountServiceMock.user$.next(null);
      accountServiceMock.resendEmailConfirmation.mockReturnValue(
        of({ value: { title: 'OK', message: 'Sent' } }),
      );

      component.form.setValue({ email: 'a@b.com' });
      component.sendEmail();

      expect(accountServiceMock.resendEmailConfirmation).toHaveBeenCalledWith('a@b.com');
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/account/login');
    });

    it('sends a forgot-password email when in that mode', () => {
      const component = createComponent('forgot-username-or-password');
      component.ngOnInit();
      accountServiceMock.user$.next(null);
      accountServiceMock.forgotUsernameOrPassword.mockReturnValue(
        of({ value: { title: 'OK', message: 'Sent' } }),
      );

      component.form.setValue({ email: 'a@b.com' });
      component.sendEmail();

      expect(accountServiceMock.forgotUsernameOrPassword).toHaveBeenCalledWith('a@b.com');
    });

    it('does nothing when the mode matches neither known flow', () => {
      const component = createComponent('some-other-mode');
      component.ngOnInit();
      accountServiceMock.user$.next(null);

      component.form.setValue({ email: 'a@b.com' });
      component.sendEmail();

      expect(accountServiceMock.resendEmailConfirmation).not.toHaveBeenCalled();
      expect(accountServiceMock.forgotUsernameOrPassword).not.toHaveBeenCalled();
    });

    it('surfaces server validation errors', () => {
      const component = createComponent('resend-email-confirmation');
      component.ngOnInit();
      accountServiceMock.user$.next(null);
      accountServiceMock.resendEmailConfirmation.mockReturnValue(
        throwError(() => ({ error: { errors: ['E-mail inválido'] } })),
      );

      component.form.setValue({ email: 'a@b.com' });
      component.sendEmail();

      expect(component.errorMessages).toEqual(['E-mail inválido']);
    });

    it('falls back to the generic message without throwing when response.error is null (resend flow)', () => {
      const component = createComponent('resend-email-confirmation');
      component.ngOnInit();
      accountServiceMock.user$.next(null);
      accountServiceMock.resendEmailConfirmation.mockReturnValue(
        throwError(() => ({ status: 500, error: null })),
      );

      component.form.setValue({ email: 'a@b.com' });

      expect(() => component.sendEmail()).not.toThrow();
      expect(component.errorMessages).toEqual(['ACCOUNT.SERVER_ERROR']);
    });

    it('surfaces server validation errors for the forgot-password flow', () => {
      const component = createComponent('forgot-username-or-password');
      component.ngOnInit();
      accountServiceMock.user$.next(null);
      accountServiceMock.forgotUsernameOrPassword.mockReturnValue(
        throwError(() => ({ error: { errors: ['E-mail não encontrado'] } })),
      );

      component.form.setValue({ email: 'a@b.com' });
      component.sendEmail();

      expect(component.errorMessages).toEqual(['E-mail não encontrado']);
    });

    it('falls back to the generic message without throwing when response.error is null (forgot-password flow)', () => {
      const component = createComponent('forgot-username-or-password');
      component.ngOnInit();
      accountServiceMock.user$.next(null);
      accountServiceMock.forgotUsernameOrPassword.mockReturnValue(
        throwError(() => ({ status: 500, error: null })),
      );

      component.form.setValue({ email: 'a@b.com' });

      expect(() => component.sendEmail()).not.toThrow();
      expect(component.errorMessages).toEqual(['ACCOUNT.SERVER_ERROR']);
    });
  });

  describe('cancel', () => {
    it('navigates back to login', () => {
      const component = createComponent(null);
      component.cancel();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/account/login');
    });
  });
});
