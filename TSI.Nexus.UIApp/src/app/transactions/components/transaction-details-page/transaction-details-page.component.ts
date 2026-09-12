import { ChangeDetectionStrategy, Component, computed, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  PaymentStatus,
  Transaction,
  PaymentType,
  WebApiResponse,
  PaymentService,
  TransactionService,
  TranslationService,
} from '@nexus/core';
import { merge, skip, Subject, Subscription, switchMap, takeUntil } from 'rxjs';
import { HeaderComponent } from '../../../shared/header/header.component';
import { NgIf } from '@angular/common';
import { TransactionFormComponent } from '../transactions-form/transaction-form.component';
import { PaymentsComponent } from '../../../payments/payments.component';
import { AttachmentsComponent } from '../../../shared/attachments/attachments.component';
import { AuditTabComponent } from '../../../shared/components/audit-tab/audit-tab.component';
import { EventListComponent } from '../../../shared/components/event-list/event-list.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { FeatureToggleKeys } from '../../../core/models/feature-toggle.model';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-transaction-details-page',
    templateUrl: './transaction-details-page.component.html',
    styleUrl: './transaction-details-page.component.scss',
    imports: [
        HeaderComponent,
        NgIf,
        TransactionFormComponent,
        PaymentsComponent,
        AttachmentsComponent,
        AuditTabComponent,
        EventListComponent,
        LoadingSpinnerComponent,
        TranslatePipe,
    ],
})
export class TransactionDetailsPageComponent {
  isEdit = false;
  data?: Transaction | null = null;
  id: string | null = null;
  loading = false;
  // toSignal's initialValue: false matches the async pipe's own "no emission yet reads as falsy"
  // this used to rely on - the tab stays out of the DOM until the real state is known instead of
  // a guessed default flashing on screen first.
  isAgendaEnabled!: Signal<boolean>;
  activeTab: 'details' | 'payments' | 'attachments' | 'agenda' | 'audit' = 'details';

  get paymentTypeOptions(): Record<PaymentType, string> {
    return {
      [PaymentType.Incoming]: this.translationService.instant('REPORTS.INCOMING'),
      [PaymentType.Outgoing]: this.translationService.instant('REPORTS.OUTGOING'),
    };
  }

  get transactionStatusOptions(): Record<PaymentStatus, string> {
    return {
      [PaymentStatus.Approved]: this.translationService.instant('TRANSACTIONS.STATUS_APPROVED'),
      [PaymentStatus.Delayed]: this.translationService.instant('REPORTS.STATUS_DELAYED'),
      [PaymentStatus.Pending]: this.translationService.instant('TRANSACTIONS.STATUS_PENDING'),
    };
  }

  private _transactionChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private paymentService: PaymentService,
    private routerService: Router,
    private transactionService: TransactionService,
    private translationService: TranslationService,
    private featureFlagService: FeatureFlagService,
  ) {
    const isAgendaModuleEnabled = toSignal(
      this.featureFlagService.isEnabled(FeatureToggleKeys.AgendaModule),
      { initialValue: false },
    );
    const isEventEnabled = toSignal(
      this.featureFlagService.isEnabled(FeatureToggleKeys.Event),
      { initialValue: false },
    );
    this.isAgendaEnabled = computed(() => isAgendaModuleEnabled() && isEventEnabled());
  }

  ngOnInit(): void {
    const idParam = this.activatedRoute.snapshot.paramMap.get('id');

    if (idParam && idParam !== 'new') {
      this.isEdit = true;
      this.id = idParam;
      this.getTransactionById(idParam);
    } else {
      this.isEdit = false;
      this.data = null;
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._transactionChangedSub) {
      this._transactionChangedSub.unsubscribe();
    }
  }

  getTransactionStatusLabel(): string {
    if (!this.data?.status || this.data?.status === undefined) {
      return '';
    }
    return this.transactionStatusOptions[this.data.status];
  }

  getPaymentTypeLabel(): string {
    if (!this.data?.type || this.data?.type === undefined) {
      return '';
    }
    return this.paymentTypeOptions[this.data.type];
  }

  private getTransactionById(id: string): void {
    this.loading = true;

    const handleResponse = (response: WebApiResponse<Transaction>): void => {
      this.loading = false;
      if (response.data == null) {
        this.routerService.navigateByUrl('/not-found');
        return;
      }
      this.data = response.data;
    };
    const handleError = (): void => {
      this.loading = false;
      this.routerService.navigateByUrl('/not-found');
    };

    this.transactionService
      .getById(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({ next: handleResponse, error: handleError });

    // transactionChanged$/paymentChanged$ are BehaviorSubjects, so merging them raw would replay
    // their current value the moment this subscribes - an extra getById call firing alongside
    // the one above, just to load the page once. skip(1) drops that replay and leaves this
    // reacting only to real subsequent changes.
    this._transactionChangedSub = merge(
      this.transactionService.transactionChanged$.pipe(skip(1)),
      this.paymentService.paymentChanged$.pipe(skip(1)),
    )
      .pipe(
        switchMap(() => this.transactionService.getById(id)),
        takeUntil(this._destroy$),
      )
      .subscribe({ next: handleResponse, error: handleError });
  }
}
