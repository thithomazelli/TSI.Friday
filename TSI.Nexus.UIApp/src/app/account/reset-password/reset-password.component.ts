import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgClass, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { AccountService, FormBaseComponent } from '@nexus/core';
import { ValidationMessagesComponent } from '../../shared/components/errors/validation-messages/validation-messages.component';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

// Two entry points land here, distinguished by the query string:
// - no token/email: reached from the "Esqueceu sua senha?" link on the login page - collects an
//   e-mail and asks the backend to send a reset link (AccountService.forgotUsernameOrPassword).
// - token+email present: reached by clicking that emailed link - collects only the new password
//   and submits it along with the token, which the backend now actually validates (see
//   ResetPasswordDto.Token / UserManagerService.ResetPassword) instead of silently accepting any
//   request as it used to.
type Step = 'request' | 'sent' | 'reset' | 'done';

@Component({
    selector: 'app-reset-password',
    templateUrl: './reset-password.component.html',
    styleUrl: './reset-password.component.scss',
    imports: [
        ReactiveFormsModule,
        NgClass,
        NgIf,
        NgSwitch,
        NgSwitchCase,
        RouterLink,
        ValidationMessagesComponent,
        TranslatePipe,
    ],
})
export class ResetPasswordComponent extends FormBaseComponent implements OnInit {
  step: Step = 'request';
  passwordVisible = false;

  private token: string | null = null;
  private email: string | null = null;

  constructor(
    private accountService: AccountService,
    private formBuilder: FormBuilder,
    private activatedRoute: ActivatedRoute,
  ) {
    super();
  }

  ngOnInit(): void {
    this.activatedRoute.queryParamMap.subscribe((params) => {
      this.token = params.get('token');
      this.email = params.get('email');
      this.step = this.token && this.email ? 'reset' : 'request';
      this.initializeForm();
    });
  }

  initializeForm(): void {
    this.submitted = false;
    this.errorMessages = [];
    this.form =
      this.step === 'reset'
        ? this.formBuilder.group({
            newPassword: [
              '',
              [Validators.required, Validators.minLength(6), Validators.maxLength(15)],
            ],
          })
        : this.formBuilder.group({
            email: ['', [Validators.required, Validators.email]],
          });
  }

  requestReset(): void {
    this.submitted = true;
    this.errorMessages = [];
    if (this.form.invalid) {
      return;
    }

    this.accountService.forgotUsernameOrPassword(this.form.get('email')?.value).subscribe({
      next: () => {
        this.step = 'sent';
      },
      error: (response: any) => {
        this.errorMessages = response?.error?.errors ?? [response?.error ?? 'Erro ao enviar o e-mail.'];
      },
    });
  }

  resetPassword(): void {
    this.submitted = true;
    this.errorMessages = [];
    if (this.form.invalid || !this.token || !this.email) {
      return;
    }

    this.accountService
      .resetPassword({
        token: this.token,
        email: this.email,
        newPassword: this.form.get('newPassword')?.value,
      })
      .subscribe({
        next: () => {
          this.step = 'done';
        },
        error: (response: any) => {
          this.errorMessages = response?.error?.errors ?? [
            response?.error ?? 'Erro ao redefinir a senha.',
          ];
        },
      });
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }
}
