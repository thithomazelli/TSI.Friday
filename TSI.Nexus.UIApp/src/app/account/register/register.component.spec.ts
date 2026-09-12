import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { AccountService, ModalService, TranslationService } from '@nexus/core';
import { Subject, of, throwError } from 'rxjs';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  let accountServiceMock: { user$: Subject<unknown>; register: ReturnType<typeof vi.fn> };
  let modalServiceMock: { showSweetNotification: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  function createComponent(): RegisterComponent {
    accountServiceMock = { user$: new Subject(), register: vi.fn() };
    modalServiceMock = { showSweetNotification: vi.fn() };
    routerMock = { navigateByUrl: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };

    return new RegisterComponent(
      accountServiceMock as unknown as AccountService,
      modalServiceMock as unknown as ModalService,
      new FormBuilder(),
      routerMock as unknown as Router,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('redirects home immediately when already logged in', () => {
    const component = createComponent();
    accountServiceMock.user$.next({ id: 'u1' });

    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/');
  });

  describe('register', () => {
    it('does not submit an invalid form', () => {
      const component = createComponent();
      component.ngOnInit();

      component.register();

      expect(component.submitted).toBe(true);
      expect(accountServiceMock.register).not.toHaveBeenCalled();
    });

    it('registers and navigates to login on success', () => {
      const component = createComponent();
      component.ngOnInit();
      accountServiceMock.register.mockReturnValue(
        of({ data: { id: 'u1' }, message: 'Welcome' }),
      );

      component.form.setValue({
        firstName: 'Ana',
        lastName: 'Silva',
        email: 'ana@example.com',
        password: '123456',
      });
      component.register();

      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        'ACCOUNT.USER_REGISTERED',
        'Welcome',
        'success',
      );
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('account/login');
    });

    it('surfaces server validation errors', () => {
      const component = createComponent();
      component.ngOnInit();
      accountServiceMock.register.mockReturnValue(
        throwError(() => ({ error: { errors: ['Email already in use'] } })),
      );

      component.form.setValue({
        firstName: 'Ana',
        lastName: 'Silva',
        email: 'ana@example.com',
        password: '123456',
      });
      component.register();

      expect(component.errorMessages).toEqual(['Email already in use']);
    });
  });
});
