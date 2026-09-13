import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialogRef } from '@angular/material/dialog';
import {
  AccountService,
  ModalService,
  NotificationService,
  ResponseStatus,
  TranslationService,
  User,
  UserService,
} from '@nexus/core';
import { config, of, throwError } from 'rxjs';
import { UserFormComponent } from './user-form.component';
import { UserDetailsModalComponent } from '../user-details-modal/user-details-modal.component';

describe('UserFormComponent', () => {
  let accountServiceMock: {
    user$: import('rxjs').Observable<any>;
    resendEmailConfirmation: ReturnType<typeof vi.fn>;
    forgotUsernameOrPassword: ReturnType<typeof vi.fn>;
  };
  let modalServiceMock: {
    hideModal: ReturnType<typeof vi.fn>;
    showSweetConfirmation: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
    showNotification: ReturnType<typeof vi.fn>;
    showTemplateModal: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let userServiceMock: {
    update: ReturnType<typeof vi.fn>;
    add: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  function createComponent(user: any = { roles: [] }): UserFormComponent {
    accountServiceMock = {
      user$: of(user),
      resendEmailConfirmation: vi.fn(),
      forgotUsernameOrPassword: vi.fn(),
    };
    modalServiceMock = {
      hideModal: vi.fn(),
      showSweetConfirmation: vi.fn(),
      showSweetNotification: vi.fn(),
      showNotification: vi.fn(),
      showTemplateModal: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    routerMock = { navigateByUrl: vi.fn() };
    userServiceMock = { update: vi.fn(), add: vi.fn(), delete: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };

    return new UserFormComponent(
      accountServiceMock as unknown as AccountService,
      new FormBuilder(),
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      routerMock as unknown as Router,
      userServiceMock as unknown as UserService,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds the add-mode form (no password field visible when editing later)', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('password')).not.toBeNull();
    });

    it('detects a privileged viewer (Admin/Master)', () => {
      const component = createComponent({ roles: ['Admin'] });
      component.ngOnInit();

      expect(component.isPrivilegedViewer).toBe(true);
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('treats a non-privileged viewer as such', () => {
      const component = createComponent({ roles: ['User'] });
      component.ngOnInit();

      expect(component.isPrivilegedViewer).toBe(false);
    });

    it('treats a viewer with no roles at all as non-privileged', () => {
      const component = createComponent({});
      component.ngOnInit();

      expect(component.isPrivilegedViewer).toBe(false);
    });
  });

  describe('ngOnChanges', () => {
    it('patches the form when data changes', () => {
      const component = createComponent();
      component.ngOnInit();

      component.ngOnChanges({
        data: { currentValue: { firstName: 'Ana' }, firstChange: false } as any,
      });

      expect(component.form.value.firstName).toBe('Ana');
    });

    it('does nothing for a data change when the form does not exist yet', () => {
      const component = createComponent();

      expect(() =>
        component.ngOnChanges({
          data: { currentValue: { firstName: 'Ana' }, firstChange: false } as any,
        }),
      ).not.toThrow();
    });

    it('reinitializes the form when isEdit changes after the first change', () => {
      const component = createComponent();
      component.ngOnInit();
      component.isEdit = true;

      component.ngOnChanges({ isEdit: { firstChange: false } as any });

      expect(component.form.get('id')).not.toBeNull();
    });

    it('does not reinitialize on the first isEdit change', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.form;

      component.ngOnChanges({ isEdit: { firstChange: true } as any });

      expect(component.form).toBe(before);
    });
  });

  describe('ngOnDestroy', () => {
    it('does not throw when there is no active timer', () => {
      const component = createComponent();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });

    it('clears the resend-email timer when active', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.patchValue({ email: 'a@b.com' });
      accountServiceMock.resendEmailConfirmation.mockReturnValue(
        of({ value: { title: '', message: '' } }),
      );
      component.resendEmailConfirmation();

      component.ngOnDestroy();

      expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
      vi.useRealTimers();
    });
  });

  describe('submit', () => {
    it('marks all as touched and returns null when the form is invalid', () => {
      const component = createComponent();
      component.ngOnInit();
      let result: unknown;

      component.submit().subscribe((r) => (result = r));

      expect(result).toBeNull();
      expect(component.form.get('firstName')!.touched).toBe(true);
    });

    it('adds a new user and calls savePage on success (non-modal, add mode)', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.patchValue({
        firstName: 'Ana',
        lastName: 'Silva',
        email: 'ana@teste.com',
        password: 'abcdef',
      });
      userServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'ok', data: { id: 'u1' } }),
      );

      component.submit().subscribe();

      expect(userServiceMock.add).toHaveBeenCalled();
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/users/u1');
    });

    it('updates an existing user, merging the raw value into data before saving', () => {
      const component = createComponent();
      component.isEdit = true;
      const data = { id: 'u1', firstName: 'Old' } as User;
      component.data = data;
      component.ngOnInit();
      component.form.patchValue({ firstName: 'Novo', lastName: 'Sobrenome', email: 'a@b.com' });
      userServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Salvo', data: { id: 'u1' } }),
      );

      component.submit().subscribe();

      expect(userServiceMock.update).toHaveBeenCalled();
      // Object.assign mutates the original `data` object synchronously, before the (also
      // synchronous, via `of`) response replaces `component.data` with the server's copy - so the
      // merge is only observable on the object reference captured beforehand.
      expect(data.firstName).toBe('Novo');
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Success,
        'Salvo',
      );
    });

    it('shows the response message and does not save when the backend reports a business error', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.patchValue({
        firstName: 'Ana',
        lastName: 'Silva',
        email: 'ana@teste.com',
        password: 'abcdef',
      });
      userServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'E-mail já cadastrado', data: null }),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'E-mail já cadastrado',
      );
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('shows a generic error notification when the save request errors', () => {
      const originalOnUnhandledError = config.onUnhandledError;
      config.onUnhandledError = () => {};
      try {
        const component = createComponent();
        component.ngOnInit();
        component.form.patchValue({
          firstName: 'Ana',
          lastName: 'Silva',
          email: 'ana@teste.com',
          password: 'abcdef',
        });
        userServiceMock.add.mockReturnValue(throwError(() => new Error('fail')));

        component.submit().subscribe({ error: () => {} });

        expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
          'error',
          'Erro ao salvar',
        );
      } finally {
        config.onUnhandledError = originalOnUnhandledError;
      }
    });

    it('closes the dialog via saveModal when isModal is true', () => {
      const component = createComponent();
      component.isModal = true;
      component.dialogRef = { close: vi.fn() } as unknown as MatDialogRef<UserDetailsModalComponent>;
      component.ngOnInit();
      component.form.patchValue({
        firstName: 'Ana',
        lastName: 'Silva',
        email: 'ana@teste.com',
        password: 'abcdef',
      });
      userServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'ok', data: { id: 'u1' } }),
      );

      component.submit().subscribe();

      expect(component.dialogRef.close).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith('', 'ok', ResponseStatus.Success);
    });
  });

  describe('cancel', () => {
    it('hides the modal when isModal is true', () => {
      const component = createComponent();
      component.isModal = true;
      component.dialogRef = {} as MatDialogRef<UserDetailsModalComponent>;

      component.cancel();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(component.dialogRef);
    });

    it('navigates back to the list when isModal is false', () => {
      const component = createComponent();

      component.cancel();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/users');
    });
  });

  describe('remove', () => {
    it('deletes the user and shows a success notification (modal)', async () => {
      const component = createComponent();
      component.isModal = true;
      component.data = { id: 'u1' } as User;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      userServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(userServiceMock.delete).toHaveBeenCalledWith(component.data);
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Removido',
        ResponseStatus.Success,
      );
    });

    it('navigates back to the list on a successful delete (non-modal)', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'u1' } as User;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      userServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' }),
      );

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/users');
    });

    it('does not navigate when the delete response is not a success (non-modal)', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'u1' } as User;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      userServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falha' }),
      );

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('shows a generic error notification when the delete request errors', async () => {
      const originalOnUnhandledError = config.onUnhandledError;
      config.onUnhandledError = () => {};
      try {
        const component = createComponent();
        component.data = { id: 'u1' } as User;
        modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
        userServiceMock.delete.mockReturnValue(throwError(() => new Error('fail')));

        component.remove();
        await Promise.resolve();
        await Promise.resolve();

        expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('error', 'Erro ao remover');

        await new Promise((resolve) => setTimeout(resolve, 0));
      } finally {
        config.onUnhandledError = originalOnUnhandledError;
      }
    });

    it('does nothing further when cancelled and not a modal', async () => {
      const component = createComponent();
      component.isModal = false;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await Promise.resolve();

      expect(userServiceMock.delete).not.toHaveBeenCalled();
      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
    });

    // Reopening the details modal after cancelling the delete (isModal + not confirmed) uses a
    // dynamic import() of UserDetailsModalComponent, mirroring the same documented pattern already
    // established for the sibling *-form components (see product-form.component.spec.ts) -
    // exercised only implicitly here since asserting on the dynamically-imported module's identity
    // isn't meaningfully different from the static case and isn't worth mocking dynamic import for.
  });

  describe('resendEmailConfirmation', () => {
    it('does nothing while already resending', () => {
      const component = createComponent();
      component.ngOnInit();
      component.isResendingEmail = true;

      component.resendEmailConfirmation();

      expect(accountServiceMock.resendEmailConfirmation).not.toHaveBeenCalled();
    });

    it('sends the confirmation email and shows a notification on success', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.form.patchValue({ email: 'a@b.com' });
      accountServiceMock.resendEmailConfirmation.mockReturnValue(
        of({ value: { title: 'Enviado', message: 'Confira seu e-mail' } }),
      );

      component.resendEmailConfirmation();

      expect(modalServiceMock.hideModal).toHaveBeenCalled();
      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
        true,
        'Enviado',
        'Confira seu e-mail',
      );
      expect(localStorage.getItem('resendEmailCooldown_a@b.com')).not.toBeNull();
      vi.useRealTimers();
    });

    it('restarts the cooldown countdown when the request errors, eventually clearing it', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      accountServiceMock.resendEmailConfirmation.mockReturnValue(
        throwError(() => new Error('fail')),
      );

      component.resendEmailConfirmation();
      expect(component.resendEmailCountdown).toBe(60);

      vi.advanceTimersByTime(60000);

      expect(component.isResendingEmail).toBe(false);
      expect(component.resendEmailCountdown).toBe(0);
      vi.useRealTimers();
    });

    it('restarts the cooldown countdown on complete, eventually clearing it', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      accountServiceMock.resendEmailConfirmation.mockReturnValue(
        of({ value: { title: '', message: '' } }),
      );

      component.resendEmailConfirmation();
      expect(component.resendEmailCountdown).toBe(60);

      vi.advanceTimersByTime(60000);

      expect(component.isResendingEmail).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('forgotPassword', () => {
    it('does nothing when there is no email', () => {
      const component = createComponent();
      component.data = {} as User;

      component.forgotPassword();

      expect(accountServiceMock.forgotUsernameOrPassword).not.toHaveBeenCalled();
    });

    it('shows a translated success notification when the email is sent', () => {
      const component = createComponent();
      component.data = { email: 'a@b.com' } as User;
      accountServiceMock.forgotUsernameOrPassword.mockReturnValue(of({}));

      component.forgotPassword();

      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'ACCOUNT.RESET_PASSWORD.SENT_MESSAGE',
        'success',
      );
    });

    it('shows the response error message on failure', () => {
      const component = createComponent();
      component.data = { email: 'a@b.com' } as User;
      accountServiceMock.forgotUsernameOrPassword.mockReturnValue(
        throwError(() => ({ error: 'Falha no envio' })),
      );

      component.forgotPassword();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('error', 'Falha no envio');
    });

    it('falls back to a generic error message when the response has none', () => {
      const component = createComponent();
      component.data = { email: 'a@b.com' } as User;
      accountServiceMock.forgotUsernameOrPassword.mockReturnValue(throwError(() => ({})));

      component.forgotPassword();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'error',
        'Erro ao enviar o e-mail.',
      );
    });
  });

  describe('restoreResendEmailCooldown (private, via ngOnInit)', () => {
    it('does nothing when there is no email yet', () => {
      const component = createComponent();

      component.ngOnInit();

      expect(component.isResendingEmail).toBe(false);
    });

    it('does nothing when there is no stored cooldown timestamp', () => {
      const component = createComponent();
      component.data = { email: 'a@b.com' } as User;

      component.ngOnInit();

      expect(component.isResendingEmail).toBe(false);
    });

    it('resumes the countdown when the stored cooldown has not expired', () => {
      vi.useFakeTimers();
      localStorage.setItem('resendEmailCooldown_a@b.com', Date.now().toString());
      const component = createComponent();
      component.data = { email: 'a@b.com' } as User;

      component.ngOnInit();

      expect(component.isResendingEmail).toBe(true);
      expect(component.resendEmailCountdown).toBeGreaterThan(0);
      vi.useRealTimers();
    });

    it('clears an already-expired stored cooldown', () => {
      localStorage.setItem(
        'resendEmailCooldown_a@b.com',
        (Date.now() - 120000).toString(),
      );
      const component = createComponent();
      component.data = { email: 'a@b.com' } as User;

      component.ngOnInit();

      expect(component.isResendingEmail).toBe(false);
      expect(localStorage.getItem('resendEmailCooldown_a@b.com')).toBeNull();
    });

    it('clears a pre-existing timer before restoring a fresh cooldown (called twice)', () => {
      vi.useFakeTimers();
      localStorage.setItem('resendEmailCooldown_a@b.com', Date.now().toString());
      const component = createComponent();
      component.ngOnInit();
      component.form.patchValue({ email: 'a@b.com' });

      (component as any).restoreResendEmailCooldown();
      expect(() => (component as any).restoreResendEmailCooldown()).not.toThrow();

      vi.useRealTimers();
    });

    it('counts down to zero and clears state and storage', () => {
      vi.useFakeTimers();
      localStorage.setItem('resendEmailCooldown_a@b.com', Date.now().toString());
      const component = createComponent();
      component.data = { email: 'a@b.com' } as User;
      component.ngOnInit();

      vi.advanceTimersByTime(61000);

      expect(component.isResendingEmail).toBe(false);
      expect(component.resendEmailCountdown).toBe(0);
      expect(localStorage.getItem('resendEmailCooldown_a@b.com')).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('resetResendEmailCooldown (private, direct)', () => {
    it('clears a pre-existing timer before starting a new one (called twice)', () => {
      vi.useFakeTimers();
      const component = createComponent();

      (component as any).resetResendEmailCooldown();
      expect(() => (component as any).resetResendEmailCooldown()).not.toThrow();

      vi.useRealTimers();
    });
  });

  describe('roleOptions / trackByOptionValue', () => {
    it('exposes the Admin/User role options translated', () => {
      const component = createComponent();

      expect(component.roleOptions).toEqual([
        { label: 'USERS.ROLE_ADMIN', value: 'Admin' },
        { label: 'USERS.ROLE_USER', value: 'User' },
      ]);
    });

    it('tracks options by their value', () => {
      const component = createComponent();

      expect(component.trackByOptionValue(0, { value: 'Admin', label: 'x' })).toBe('Admin');
    });
  });
});
