import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, Subject, takeUntil, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { ModalService, PaymentService, TranslationService } from '@nexus/core';
import { PaymentDetailsModalComponent } from '../../../payments/components/payment-details-modal/payment-details-modal.component';

import { Payment, PaymentStatus, WebApiResponse } from '@nexus/core';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-payment-notification',
    templateUrl: './payment-notification.component.html',
    styleUrl: './payment-notification.component.scss',
    imports: [
        NgIf,
        NgFor,
        NgClass,
        TranslatePipe,
    ],
})
export class PaymentNotificationComponent implements OnInit, OnDestroy {
  payments: Payment[] = [];
  total: number = 0;

  private _statusIconMap: Record<PaymentStatus, string> = {
    [PaymentStatus.Delayed]: 'bi bi-exclamation-triangle-fill text-danger',
    [PaymentStatus.Pending]: 'bi bi-hourglass-split text-info',
    [PaymentStatus.Approved]: 'bi bi-check-circle-fill text-success',
  };

  private get _statusTextMap(): Record<PaymentStatus, string> {
    return {
      [PaymentStatus.Delayed]: this.translationService.instant('NAVBAR.PAYMENT_DELAYED'),
      [PaymentStatus.Pending]: this.translationService.instant('NAVBAR.PAYMENT_PENDING'),
      [PaymentStatus.Approved]: this.translationService.instant('NAVBAR.PAYMENT_APPROVED'),
    };
  }

  private _paymentChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  constructor(
    private modalService: ModalService,
    private paymentService: PaymentService,
    private router: Router,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this._paymentChangedSub = this.paymentService.paymentChanged$
      .pipe(
        switchMap(() => this.paymentService.getDelayed()),
        takeUntil(this._destroy$),
      )
      .subscribe((response: WebApiResponse<Payment[]>) => {
        this.payments = response?.data || [];
        this.total = this.payments.length;
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._paymentChangedSub) {
      this._paymentChangedSub.unsubscribe();
    }
  }

  get displayPayments(): Payment[] {
    return this.payments.slice(0, 10);
  }

  get showBadge(): boolean {
    return this.total > 0;
  }

  get showSeeMore(): boolean {
    return this.total > 10;
  }

  getStatusIcon(payment: Payment): string {
    return this._statusIconMap[payment.status!] || 'bi bi-question-circle';
  }

  getStatusText(payment: Payment): string {
    return this._statusTextMap[payment.status!] || this.translationService.instant('NAVBAR.UNKNOWN_STATUS');
  }

  getRelativeDate(date?: Date): string {
    if (!date) {
      return '';
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.abs(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    if (diffDays === 0) {
      return this.translationService.instant('NAVBAR.TODAY');
    }
    if (diffDays === 1) {
      return this.translationService.instant('NAVBAR.YESTERDAY');
    }
    return this.translationService.instant('NAVBAR.DAYS_AGO', { days: diffDays + '' });
  }

  openModal(payment: Payment) {
    this.modalService.showTemplateModal(PaymentDetailsModalComponent, {
      isEdit: true,
      id: payment.id,
      data: payment,
      parentId: payment.transactionId,
    });
  }

  onSeeMore() {
    // Pass filters: status=Pending,Delayed and endDate=today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const endDate = `${yyyy}-${mm}-${dd}`;
    this.router.navigate(['/payments'], {
      queryParams: {
        status: 'Pending,Delayed',
        endDate,
      },
    });
  }
}
