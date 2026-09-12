import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AccountService,
  FormBaseComponent,
  TranslationService,
  User,
  WebApiResponse,
} from '@nexus/core';
import { Observable, of, take, tap } from 'rxjs';
import { NgClass } from '@angular/common';
import { ValidationMessagesComponent } from '../../shared/components/errors/validation-messages/validation-messages.component';
import { ClickDirective } from '../../core/directives/click.directive';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        NgClass,
        FormsModule,
        RouterLink,
        ValidationMessagesComponent,
        ClickDirective,
        TranslatePipe,
    ],
})
export class LoginComponent extends FormBaseComponent implements OnInit {
  returnUrl: string | null = null;
  // toggle show/hide password
  passwordVisible = false;
  rememberMe = false;

  constructor(
    private accountService: AccountService,
    private formBuilder: FormBuilder,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
  ) {
    super();
    this.accountService.user$.pipe(take(1)).subscribe({
      next: (user: User | null) => {
        if (user) {
          this.router.navigateByUrl('/');
        } else {
          this.activatedRoute.queryParamMap.subscribe({
            next: (params: any) => {
              if (params) {
                this.returnUrl = params.get('returnUrl');
              }
            },
          });
        }
      },
    });
  }

  ngOnInit(): void {
    this.initializeForm();
  }

  initializeForm(): void {
    this.form = this.formBuilder.group({
      userName: ['', [Validators.required]],
      password: ['', [Validators.required]],
    });
  }

  login(): Observable<WebApiResponse<User> | null> {
    this.submitted = true;
    this.errorMessages = [];

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return of(null);
    }

    return this.accountService.login(this.form.value).pipe(
      tap({
        next: (response: any) => {
          if (this.returnUrl) {
            this.router.navigateByUrl(this.returnUrl);
          } else {
            this.router.navigateByUrl('');
          }
        },
        error: (response) => {
          // response.error is null (not just missing .errors) for a failure that never reached
          // the API with a JSON body - a dead upstream/dev-proxy 500, a timeout, a CORS-blocked
          // response. response.error.errors used to assume an object was always there and threw
          // reading .errors off null, and that exception - inside tap()'s own error handler -
          // aborted before errorMessages/markForCheck() ever ran, leaving the login page blank
          // with no visible feedback at all instead of falling through to the generic message.
          if (response.error?.errors) {
            this.errorMessages = response.error.errors;
          } else if (typeof response.error === 'string') {
            this.errorMessages = [...this.errorMessages, response.error];
          } else {
            this.errorMessages = [
              this.translationService.instant('ACCOUNT.SERVER_ERROR'),
            ];
          }
          this.cdr.markForCheck();
        },
      }),
    );
  }

  resendEmailConfirmation(): void {
    this.router.navigateByUrl('/account/send-email/resend-email-confirmation');
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }
}
