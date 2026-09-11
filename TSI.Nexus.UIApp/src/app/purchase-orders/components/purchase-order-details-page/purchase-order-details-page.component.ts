import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  PurchaseOrder,
  WebApiResponse,
  OrderStatus,
  PurchaseOrderService,
  PurchaseOrderProductService,
  PaymentService,
} from '@nexus/core';
import { combineLatest, Subject, Subscription, switchMap, takeUntil, merge, map, skip, Observable } from 'rxjs';

import { HeaderComponent } from '../../../shared/header/header.component';
import { AsyncPipe, NgIf } from '@angular/common';
import { PurchaseOrderFormComponent } from '../purchase-order-form/purchase-order-form.component';
import { PurchaseOrderProductsComponent } from '../../../purchase-order-products/purchase-order-products.component';
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
    selector: 'app-purchase-order-details-page',
    templateUrl: './purchase-order-details-page.component.html',
    styleUrl: './purchase-order-details-page.component.scss',
    imports: [
        HeaderComponent,
        NgIf,
        AsyncPipe,
        PurchaseOrderFormComponent,
        PurchaseOrderProductsComponent,
        PaymentsComponent,
        AttachmentsComponent,
        AuditTabComponent,
        EventListComponent,
        LoadingSpinnerComponent,
        TranslatePipe,
    ],
})
export class PurchaseOrderDetailsPageComponent implements OnInit, OnDestroy {
  isEdit = false;
  data?: PurchaseOrder | null = null;
  id: string | null = null;
  loading = false;
  // Read via the async pipe in the template rather than subscribed into a plain field: no
  // manual Subscription/ngOnDestroy bookkeeping, and the async pipe treats "no emission yet" as
  // falsy, so the tab stays out of the DOM until the real state is known instead of a guessed
  // default flashing on screen first.
  isAgendaEnabled$!: Observable<boolean>;

  activeTab: 'details' | 'products' | 'payments' | 'attachments' | 'agenda' | 'audit' =
    'details';

  purchaseOrderStatusOptions: Record<OrderStatus, string> = {
    [OrderStatus.Open]: 'Em aberto',
    [OrderStatus.Closed]: 'Finalizado',
    [OrderStatus.WaitingPayment]: 'Aguardando pagamento',
  };

  private _purchaseOrderChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private purchaseOrderService: PurchaseOrderService,
    private purchaseOrderProductService: PurchaseOrderProductService,
    private paymentService: PaymentService,
    private routerService: Router,
    private featureFlagService: FeatureFlagService,
  ) {
    this.isAgendaEnabled$ = combineLatest([
      this.featureFlagService.isEnabled(FeatureToggleKeys.AgendaModule),
      this.featureFlagService.isEnabled(FeatureToggleKeys.Event),
    ]).pipe(map(([groupEnabled, entityEnabled]) => groupEnabled && entityEnabled));
  }

  ngOnInit(): void {
    const idParam = this.activatedRoute.snapshot.paramMap.get('id');
    if (idParam && idParam !== 'new') {
      this.isEdit = true;
      this.id = idParam;
      this.getPurchaseOrderById(idParam);
    } else {
      this.isEdit = false;
      this.data = null;
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._purchaseOrderChangedSub) {
      this._purchaseOrderChangedSub.unsubscribe();
    }
  }

  getStatusLabel(): string {
    if (!this.data || this.data.status == null) {
      return '';
    }

    return this.purchaseOrderStatusOptions[this.data?.status] || '';
  }

  private getPurchaseOrderById(id: string): void {
    this.loading = true;

    const handleResponse = (response: WebApiResponse<PurchaseOrder>): void => {
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

    this.purchaseOrderService
      .getById(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({ next: handleResponse, error: handleError });

    // purchaseOrderChanged$/purchaseOrderProductChanged$/paymentChanged$ are BehaviorSubjects, so
    // merging them raw would replay their current value the moment this subscribes - three extra
    // getById calls firing alongside the one above, just to load the page once. skip(1) drops
    // that replay and leaves this reacting only to real subsequent changes.
    this._purchaseOrderChangedSub = merge(
      this.purchaseOrderService.purchaseOrderChanged$.pipe(skip(1)),
      this.purchaseOrderProductService.purchaseOrderProductChanged$.pipe(skip(1)),
      this.paymentService.paymentChanged$.pipe(skip(1)),
    )
      .pipe(
        switchMap(() => this.purchaseOrderService.getById(id)),
        takeUntil(this._destroy$),
      )
      .subscribe({ next: handleResponse, error: handleError });
  }
}
