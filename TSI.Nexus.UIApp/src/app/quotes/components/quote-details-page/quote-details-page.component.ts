import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Quote,
  QuoteType,
  WebApiResponse,
  QuoteStatus,
  QuoteService,
  QuoteProductService,
  TranslationService,
  ModalService,
  triggerBlobDownload,
} from '@nexus/core';
import { combineLatest, Subject, Subscription, switchMap, takeUntil, merge, map, skip, Observable } from 'rxjs';

import { HeaderComponent } from '../../../shared/header/header.component';
import { AsyncPipe, NgIf } from '@angular/common';
import { QuoteFormComponent } from '../quote-form/quote-form.component';
import { QuoteProductsComponent } from '../../../quote-products/quote-products.component';
import { QuoteTripLegListComponent } from '../quote-trip-leg-list/quote-trip-leg-list.component';
import { AttachmentsComponent } from '../../../shared/attachments/attachments.component';
import { AuditTabComponent } from '../../../shared/components/audit-tab/audit-tab.component';
import { EventListComponent } from '../../../shared/components/event-list/event-list.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { FeatureToggleKeys } from '../../../core/models/feature-toggle.model';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    selector: 'app-quote-details-page',
    templateUrl: './quote-details-page.component.html',
    styleUrl: './quote-details-page.component.scss',
    imports: [
        HeaderComponent,
        NgIf,
        AsyncPipe,
        QuoteFormComponent,
        QuoteProductsComponent,
        QuoteTripLegListComponent,
        AttachmentsComponent,
        AuditTabComponent,
        EventListComponent,
        LoadingSpinnerComponent,
        TranslatePipe,
    ],
})
export class QuoteDetailsPageComponent implements OnInit, OnDestroy {
  isEdit = false;
  data?: Quote | null = null;
  id: string | null = null;
  loading = false;
  // Read via the async pipe in the template rather than subscribed into a plain field: no
  // manual Subscription/ngOnDestroy bookkeeping, and the async pipe treats "no emission yet" as
  // falsy, so the tab stays out of the DOM until the real state is known instead of a guessed
  // default flashing on screen first.
  isAgendaEnabled$!: Observable<boolean>;

  activeTab: 'details' | 'products' | 'itinerary' | 'attachments' | 'agenda' | 'audit' = 'details';

  quoteStatusOptions: Record<QuoteStatus, string> = {
    [QuoteStatus.Open]: 'Em aberto',
    [QuoteStatus.Canceled]: 'Cancelado',
    [QuoteStatus.Converted]: 'Convertido',
    [QuoteStatus.Expired]: 'Expirado',
  };

  emittingQuote = false;

  private _quoteChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private quoteService: QuoteService,
    private quoteProductService: QuoteProductService,
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
    const idOrNumber = this.activatedRoute.snapshot.paramMap.get('id');

    if (idOrNumber && idOrNumber !== 'new') {
      this.isEdit = true;
      this.id = idOrNumber;
      if (this.isGuid(idOrNumber)) {
        this.getQuoteById(idOrNumber);
      } else {
        this.getQuoteByQuoteNumber(idOrNumber);
      }
    } else {
      this.isEdit = false;
      this.data = null;
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._quoteChangedSub) {
      this._quoteChangedSub.unsubscribe();
    }
  }

  isTripQuote(): boolean {
    return this.data?.type === QuoteType.Trip;
  }

  getStatusLabel(): string {
    if (!this.data || this.data.status == null) {
      return '';
    }

    return this.quoteStatusOptions[this.data?.status] || '';
  }

  emitQuote(): void {
    if (!this.data || this.emittingQuote) {
      return;
    }
    const quote = this.data;
    this.emittingQuote = true;

    const progress = this.modalService.showPdfProgress(
      this.translationService.instant('PDF_EXPORT.PREPARING_TITLE'),
    );
    // Generation now happens server-side in a single request - there's no "página X de Y" to
    // report mid-flight, so the modal shows an indeterminate spinner until the PDF comes back.
    progress.setIndeterminate();

    this.quoteService.getPdf(quote.id!).subscribe({
      next: (blob) => {
        const fileName = `orcamento-${quote.quoteNumber}.pdf`;
        const url = triggerBlobDownload(blob, fileName);
        progress.success(this.translationService.instant('PDF_EXPORT.SUCCESS'), { url, name: fileName });
        this.emittingQuote = false;
      },
      error: () => {
        progress.error(this.translationService.instant('PDF_EXPORT.ERROR'));
        this.emittingQuote = false;
      },
    });
  }

  private getQuoteById(id: string): void {
    this.fetchQuote(() => this.quoteService.getById(id));
  }

  private getQuoteByQuoteNumber(quoteNumber: string): void {
    this.fetchQuote(() => this.quoteService.getByQuoteNumber(quoteNumber));
  }

  // Shared by both entry points (getQuoteById/getQuoteByQuoteNumber) so the refresh-on-change
  // wiring below - the actually tricky part - only has to be written once. Takes a factory
  // rather than a single Observable so the SAME fetch (by id, or by quote number) is reused for
  // both the initial load and every refresh - hardcoding getById here would silently re-fetch by
  // the wrong key whenever the page was opened via quote number.
  private fetchQuote(fetch: () => Observable<WebApiResponse<Quote>>): void {
    this.loading = true;

    const handleResponse = (response: WebApiResponse<Quote>): void => {
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

    fetch()
      .pipe(takeUntil(this._destroy$))
      .subscribe({ next: handleResponse, error: handleError });

    // quoteChanged$/quoteProductChanged$ are BehaviorSubjects, so merging them raw would replay
    // their current value the moment this subscribes - two extra fetch calls firing alongside
    // the one above, just to load the page once. skip(1) drops that replay and leaves this
    // reacting only to real subsequent changes (e.g. a product added from the Products tab).
    this._quoteChangedSub = merge(
      this.quoteService.quoteChanged$.pipe(skip(1)),
      this.quoteProductService.quoteProductChanged$.pipe(skip(1)),
    )
      .pipe(
        switchMap(fetch),
        takeUntil(this._destroy$),
      )
      .subscribe({ next: handleResponse, error: handleError });
  }

  private isGuid(value: string): boolean {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      value,
    );
  }
}
