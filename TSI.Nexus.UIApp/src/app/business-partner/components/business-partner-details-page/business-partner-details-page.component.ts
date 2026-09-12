import { ChangeDetectionStrategy, Component, computed, OnDestroy, OnInit, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BusinessPartnerService,
  BusinessPartnerType,
  Company,
  Individual,
  TranslationService,
} from '@nexus/core';
import { Subject, takeUntil } from 'rxjs';
import { HeaderComponent } from '../../../shared/header/header.component';
import { PhotoComponent } from '../../../shared/photo/photo.component';
import { NgIf } from '@angular/common';
import { BusinessPartnerFormComponent } from '../business-partner-form/business-partner-form.component';
import { AddressComponent } from '../../../address/address.component';
import { OrdersComponent } from '../../../orders/orders.component';
import { TransactionsComponent } from '../../../transactions/transactions.component';
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
    selector: 'app-business-partner-details-page',
    templateUrl: './business-partner-details-page.component.html',
    styleUrl: './business-partner-details-page.component.scss',
    imports: [
        HeaderComponent,
        PhotoComponent,
        NgIf,
        BusinessPartnerFormComponent,
        AddressComponent,
        OrdersComponent,
        TransactionsComponent,
        PaymentsComponent,
        AttachmentsComponent,
        AuditTabComponent,
        EventListComponent,
        LoadingSpinnerComponent,
        TranslatePipe,
    ],
})
export class BusinessPartnerDetailsPageComponent implements OnInit, OnDestroy {
  isEdit = false;
  data: Company | Individual | null = null;
  id: string | null = null;
  loading = false;
  activeTab:
    | 'details'
    | 'address'
    | 'orders'
    | 'transaction'
    | 'payments'
    | 'attachments'
    | 'agenda'
    | 'audit' = 'details';
  title: string = '';
  baseEndPoint: string = '';
  canDisplayOrdersTab = true;
  // toSignal's initialValue: false matches the async pipe's own "no emission yet reads as falsy"
  // this used to rely on - the tab stays out of the DOM until the real state is known instead of
  // a guessed default flashing on screen first.
  isAgendaEnabled!: Signal<boolean>;

  private _destroy$ = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private businessPartnerService: BusinessPartnerService,
    private routerService: Router,
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
    this.initialize();
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.initialize());
    const idParam = this.activatedRoute.snapshot.paramMap.get('id');

    if (idParam && idParam !== 'new') {
      this.isEdit = true;
      this.id = idParam;
      this.getBusinessPartnerById(idParam);
    } else {
      this.isEdit = false;
      // business-partner-form's `type` control is required but has no visible input of its own -
      // it's meant to be set from context (Client vs Supplier), the same way the list page's
      // "Adicionar" modal already does via business-partners.component.ts's openModal(). Without
      // this, the form is permanently invalid and "Adicionar Cliente"/"Adicionar Fornecedor" via
      // the full page (as opposed to the modal) could never actually be submitted.
      this.data = {
        type:
          this.baseEndPoint === 'clients'
            ? BusinessPartnerType.Client
            : BusinessPartnerType.Supplier,
      } as Individual;
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  private initialize(): void {
    const url = this.routerService.url;
    if (url.includes('clients')) {
      this.baseEndPoint = 'clients';
      this.title = this.translationService.instant(
        'BUSINESS_PARTNER.CLIENT_SINGULAR',
      );
    } else if (url.includes('suppliers')) {
      this.baseEndPoint = 'suppliers';
      this.title = this.translationService.instant(
        'BUSINESS_PARTNER.SUPPLIER_SINGULAR',
      );
      this.canDisplayOrdersTab = false;
    } else {
      this.baseEndPoint = '';
      this.title = '';
    }
  }

  private getBusinessPartnerById(id: string): void {
    this.loading = true;
    this.businessPartnerService
      .getById(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.data == null) {
            this.routerService.navigateByUrl('/not-found');
            return;
          }
          this.data = response.data;
        },
        error: () => {
          this.loading = false;
          this.routerService.navigateByUrl('/not-found');
        },
      });
  }
}
