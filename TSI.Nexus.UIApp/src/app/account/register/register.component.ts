import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  AccountService,
  FormBaseComponent,
  ModalService,
  TranslationService,
  User,
  WebApiResponse,
} from '@nexus/core';
import { take } from 'rxjs';
import { ValidationMessagesComponent } from '../../shared/components/errors/validation-messages/validation-messages.component';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
    selector: 'app-register',
    templateUrl: './register.component.html',
    styleUrl: './register.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterLink,
        ReactiveFormsModule,
        ValidationMessagesComponent,
        TranslatePipe,
    ],
})
export class RegisterComponent extends FormBaseComponent implements OnInit {
  constructor(
    private accountService: AccountService,
    private modalService: ModalService,
    private formBuilder: FormBuilder,
    private router: Router,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
  ) {
    super();
    this.accountService.user$.pipe(take(1)).subscribe({
      next: (user: User | null) => {
        if (user) {
          this.router.navigateByUrl('/');
        }
      },
    });
  }

  ngOnInit(): void {
    this.initializeForm();
  }

  initializeForm(): void {
    this.form = this.formBuilder.group({
      firstName: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(15),
        ],
      ],
      lastName: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(30),
        ],
      ],
      email: [
        '',
        [
          Validators.required,
          Validators.pattern('[a-z0-9._%+-]+@[a-z0-9.-]+.[a-z]{2,4}$'),
        ],
      ],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(6),
          Validators.maxLength(15),
        ],
      ],
    });
  }

  register(): void {
    this.submitted = true;
    this.errorMessages = [];

    if (!this.form.valid) {
      return;
    }

    this.accountService.register(this.form.value).subscribe({
      next: (response: WebApiResponse<User>) => {
        this.modalService.showSweetNotification(
          this.translationService.instant('ACCOUNT.USER_REGISTERED'),
          response.message,
          'success'
        );

        this.router.navigateByUrl('account/login');
      },
      error: (response) => {
        // response.error is null (not just missing .errors) for a failure that never reached the
        // API with a JSON body - see login.component.ts's error handler for the full story.
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
