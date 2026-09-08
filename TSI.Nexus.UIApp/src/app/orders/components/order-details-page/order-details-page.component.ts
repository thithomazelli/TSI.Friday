import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Order,
  WebApiResponse,
  OrderStatus,
  OrderService,
  OrderProductService,
  PaymentService,
  TranslationService,
  ModalService,
  triggerBlobDownload,
} from '@nexus/core';
import { combineLatest, Subject, Subscription, switchMap, takeUntil, merge, map, skip, Observable } from 'rxjs';

import { HeaderComponent } from '../../../shared/header/header.component';
import { AsyncPipe, NgIf } from '@angular/common';
import { OrderFormComponent } from '../order-form/order-form.component';
import { OrderProductsComponent } from '../../../order-products/order-products.component';
import { PaymentsComponent } from '../../../payments/payments.component';
import { AttachmentsComponent } from '../../../shared/attachments/attachments.component';
import { AuditTabComponent } from '../../../shared/components/audit-tab/audit-tab.component';
import { EventListComponent } from '../../../shared/components/event-list/event-list.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { FeatureToggleKeys } from '../../../core/models/feature-toggle.model';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    selector: 'app-order-details-page',
    templateUrl: './order-details-page.component.html',
    styleUrl: './order-details-page.component.scss',
    imports: [
        HeaderComponent,
        NgIf,
        AsyncPipe,
        OrderFormComponent,
        OrderProductsComponent,
        PaymentsComponent,
        AttachmentsComponent,
        AuditTabComponent,
        EventListComponent,
        LoadingSpinnerComponent,
        TranslatePipe,
    ],
})
export class OrderDetailsPageComponent implements OnInit, OnDestroy {
  isEdit = false;
  data?: Order | null = null;
  id: string | null = null;
  loading = false;
  // Read via the async pipe in the template rather than subscribed into a plain field: no
  // manual Subscription/ngOnDestroy bookkeeping, and the async pipe treats "no emission yet" as
  // falsy, so the tab stays out of the DOM until the real state is known instead of a guessed
  // default flashing on screen first.
  isAgendaEnabled$!: Observable<boolean>;

  activeTab: 'details' | 'products' | 'payments' | 'attachments' | 'agenda' | 'audit' =
    'details';

  orderStatusOptions: Record<OrderStatus, string> = {
    [OrderStatus.Open]: 'Em aberto',
    [OrderStatus.Closed]: 'Finalizado',
    [OrderStatus.WaitingPayment]: 'Aguardando pagamento',
  };

  emittingSalesOrder = false;

  private _orderChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private orderService: OrderService,
    private orderProductService: OrderProductService,
    private paymentService: PaymentService,
    private routerService: Router,
    private featureFlagService: FeatureFlagService,
    private modalService: ModalService,
    private translationService: TranslationService,
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
      this.getOrderById(idParam);
    } else {
      this.isEdit = false;
      this.data = null;
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._orderChangedSub) {
      this._orderChangedSub.unsubscribe();
    }
  }

  getStatusLabel(): string {
    if (!this.data || this.data.status == null) {
      return '';
    }

    return this.orderStatusOptions[this.data?.status] || '';
  }

  emitSalesOrder(): void {
    if (!this.data || this.emittingSalesOrder) {
      return;
    }
    const order = this.data;
    this.emittingSalesOrder = true;

    const progress = this.modalService.showPdfProgress(
      this.translationService.instant('PDF_EXPORT.PREPARING_TITLE'),
    );
    // Generation now happens server-side in a single request - there's no "página X de Y" to
    // report mid-flight, so the modal shows an indeterminate spinner until the PDF comes back.
    progress.setIndeterminate();

    this.orderService.getPdf(order.id!).subscribe({
      next: (blob) => {
        const fileName = `pedido-de-venda-${order.orderNumber}.pdf`;
        const url = triggerBlobDownload(blob, fileName);
        progress.success(this.translationService.instant('PDF_EXPORT.SUCCESS'), { url, name: fileName });
        this.emittingSalesOrder = false;
      },
      error: () => {
        progress.error(this.translationService.instant('PDF_EXPORT.ERROR'));
        this.emittingSalesOrder = false;
      },
    });
  }

  private getOrderById(id: string): void {
    this.loading = true;

    const handleResponse = (response: WebApiResponse<Order>): void => {
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

    this.orderService
      .getById(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({ next: handleResponse, error: handleError });

    // orderChanged$/orderProductChanged$/paymentChanged$ are BehaviorSubjects, so merging them
    // raw would replay their current value the moment this subscribes - three extra getById
    // calls firing alongside the one above, just to load the page once. skip(1) drops that
    // replay and leaves this reacting only to real subsequent changes (e.g. a product added from
    // the Products tab, which should refresh the totals shown here).
    this._orderChangedSub = merge(
      this.orderService.orderChanged$.pipe(skip(1)),
      this.orderProductService.orderProductChanged$.pipe(skip(1)),
      this.paymentService.paymentChanged$.pipe(skip(1)),
    )
      .pipe(
        switchMap(() => this.orderService.getById(id)),
        takeUntil(this._destroy$),
      )
      .subscribe({ next: handleResponse, error: handleError });
  }
}
