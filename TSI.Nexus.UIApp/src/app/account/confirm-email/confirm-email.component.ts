import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountService, ConfirmEmail, ModalService, User } from '@nexus/core';
import { take } from 'rxjs';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-confirm-email',
    templateUrl: './confirm-email.component.html',
    styleUrl: './confirm-email.component.scss',
})
export class ConfirmEmailComponent implements OnInit {
  constructor(
    private accountService: AccountService,
    private modalService: ModalService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) {}

  async ngOnInit(): Promise<void> {
    this.accountService.user$.pipe(take(1)).subscribe({
      next: async (user: User | null) => {
        if (user) {
          this.router.navigate(['/']);
        } else {
          this.activatedRoute.queryParamMap.subscribe({
            next: async (params: any) => {
              const confirmEmail = <ConfirmEmail>{
                token: params.get('token'),
                email: params.get('email'),
              };

              this.accountService.confirmEmail(confirmEmail).subscribe({
                next: async (response: any) => {
                  await this.modalService.showSweetNotification(
                    response.value.title,
                    response.value.message,
                    'success',
                  );
                  this.router.navigate(['/account/login']);
                },
                error: async (response: any) => {
                  await this.modalService.showSweetNotification(
                    'Failed',
                    response.error,
                    'error',
                  );
                  this.router.navigate(['/account/login']);
                },
              });
            },
          });
        }
      },
    });
  }
}
