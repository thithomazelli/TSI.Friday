import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AccountService,
  FormBaseComponent,
  ModalService,
  TranslationService,
  User,
} from '@nexus/core';
import { take } from 'rxjs';
import { ValidationMessagesComponent } from '../../shared/components/errors/validation-messages/validation-messages.component';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
    selector: 'app-send-email',
    templateUrl: './send-email.component.html',
    styleUrl: './send-email.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        ValidationMessagesComponent,
        TranslatePipe,
    ],
})
export class SendEmailComponent extends FormBaseComponent implements OnInit {
  mode: string | null = '';

  constructor(
    private accountService: AccountService,
    private modalService: ModalService,
    private formBuilder: FormBuilder,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private translationService: TranslationService,
  ) {
    super();
  }

  ngOnInit(): void {
    this.accountService.user$.pipe(take(1)).subscribe({
      next: (user: User | null) => {
        if (user) {
          this.router.navigateByUrl('/');
        } else {
          this.mode = this.activatedRoute.snapshot.paramMap.get('mode') || '';
          this.initializeForm();
        }
        this.cdr.markForCheck();
      },
    });
  }

  initializeForm(): void {
    this.form = this.formBuilder.group({
      email: [
        '',
        [
          Validators.required,
          Validators.pattern('[a-z0-9._%+-]+@[a-z0-9.-]+.[a-z]{2,4}$'),
        ],
      ],
    });
  }

  sendEmail(): void {
    this.submitted = true;
    this.errorMessages = [];

    if (!(this.form.valid && this.mode)) {
      return;
    }

    if (this.mode.includes('resend-email-confirmation')) {
      this.accountService
        .resendEmailConfirmation(this.form.get('email')?.value)
        .subscribe({
          next: (response: any) => {
            this.modalService.showSweetNotification(
              response.value.title,
              response.value.message,
              'success'
            );
            this.router.navigateByUrl('/account/login');
          },
          error: (response: any) => {
            // response.error is null (not just missing .errors) for a failure that never reached
            // the API with a JSON body - see login.component.ts's error handler for the full story.
            if (response.error?.errors) {
              this.errorMessages = response.error.errors;
            } else {
              this.errorMessages = [
                ...this.errorMessages,
                response.error ?? this.translationService.instant('ACCOUNT.SERVER_ERROR'),
              ];
            }
            this.cdr.markForCheck();
          },
        });
    } else if (this.mode.includes('forgot-username-or-password')) {
      this.accountService
        .forgotUsernameOrPassword(this.form.get('email')?.value)
        .subscribe({
          next: (response: any) => {
            this.modalService.showSweetNotification(
              response.value.title,
              response.value.message,
              'success'
            );
            this.router.navigateByUrl('/account/login');
          },
          error: (response: any) => {
            // response.error is null (not just missing .errors) for a failure that never reached
            // the API with a JSON body - see login.component.ts's error handler for the full story.
            if (response.error?.errors) {
              this.errorMessages = response.error.errors;
            } else {
              this.errorMessages = [
                ...this.errorMessages,
                response.error ?? this.translationService.instant('ACCOUNT.SERVER_ERROR'),
              ];
            }
            this.cdr.markForCheck();
          },
        });
    }
  }

  cancel(): void {
    this.router.navigateByUrl('/account/login');
  }
}
