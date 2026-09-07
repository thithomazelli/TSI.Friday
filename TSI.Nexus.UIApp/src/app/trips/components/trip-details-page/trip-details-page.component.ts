import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Trip,
  WebApiResponse,
  OrderStatus,
  TripService,
  PaymentService,
  BusinessPartnerService,
  VehicleService,
  DriverService,
  TripLegService,
  PassengerService,
  ServiceOrderService,
  DocumentTemplateService,
  TranslationService,
  ModalService,
} from '@nexus/core';
import {
  combineLatest,
  map,
  Subject,
  Subscription,
  switchMap,
  takeUntil,
  merge,
  forkJoin,
  of,
  skip,
  Observable,
} from 'rxjs';
import { catchError } from 'rxjs/operators';

import { buildContractPages, buildServiceOrderPages } from '../../utilities/trip-documents';
import { HeaderComponent } from '../../../shared/header/header.component';
import { AsyncPipe, NgIf } from '@angular/common';
import { TripFormComponent } from '../trip-form/trip-form.component';
import { TripDriverListComponent } from '../trip-driver-list/trip-driver-list.component';
import { TripLegListComponent } from '../trip-leg-list/trip-leg-list.component';
import { PassengerListComponent } from '../passenger-list/passenger-list.component';
import { PaymentsComponent } from '../../../payments/payments.component';
import { AttachmentsComponent } from '../../../shared/attachments/attachments.component';
import { AuditTabComponent } from '../../../shared/components/audit-tab/audit-tab.component';
import { EventListComponent } from '../../../shared/components/event-list/event-list.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { FeatureToggleKeys } from '../../../core/models/feature-toggle.model';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    selector: 'app-trip-details-page',
    templateUrl: './trip-details-page.component.html',
    styleUrl: './trip-details-page.component.scss',
    imports: [
        HeaderComponent,
        NgIf,
        AsyncPipe,
        TripFormComponent,
        TripDriverListComponent,
        TripLegListComponent,
        PassengerListComponent,
        PaymentsComponent,
        AttachmentsComponent,
        AuditTabComponent,
        EventListComponent,
        LoadingSpinnerComponent,
        TranslatePipe,
    ],
})
export class TripDetailsPageComponent implements OnInit, OnDestroy {
  isEdit = false;
  data?: Trip | null = null;
  id: string | null = null;
  loading = false;
  // Read via the async pipe in the template rather than subscribed into a plain field: no
  // manual Subscription/ngOnDestroy bookkeeping, and the async pipe treats "no emission yet" as
  // falsy, so the tab stays out of the DOM until the real state is known instead of a guessed
  // default flashing on screen first.
  isAgendaEnabled$!: Observable<boolean>;

  activeTab:
    | 'details'
    | 'drivers'
    | 'triplegs'
    | 'passengers'
    | 'payments'
    | 'attachments'
    | 'agenda'
    | 'audit' = 'details';

  tripStatusOptions: Record<OrderStatus, string> = {
    [OrderStatus.Open]: 'Em aberto',
    [OrderStatus.Closed]: 'Finalizado',
    [OrderStatus.WaitingPayment]: 'Aguardando pagamento',
  };

  emittingContract = false;
  emittingServiceOrder = false;

  private _tripChangedSub?: Subscription;
  private _destroy$ = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private tripService: TripService,
    private paymentService: PaymentService,
    private routerService: Router,
    private businessPartnerService: BusinessPartnerService,
    private vehicleService: VehicleService,
    private driverService: DriverService,
    private tripLegService: TripLegService,
    private passengerService: PassengerService,
    private serviceOrderService: ServiceOrderService,
    private documentTemplateService: DocumentTemplateService,
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
      this.getTripById(idParam);
    } else {
      this.isEdit = false;
      // app-trip-form's own default for its `data` @Input is `{}`, which it relies on to build up
      // the new Trip via submit()'s Object.assign(this.data!, rawValue) - passing null here (as
      // opposed to just omitting the binding) overrides that default and leaves it null all the
      // way to save(), which then POSTs a null body (see TripDto Add() 415 - same class of bug
      // fixed earlier for business-partner-details-page's Add-mode `type` field).
      this.data = {} as Trip;
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    if (this._tripChangedSub) {
      this._tripChangedSub.unsubscribe();
    }
  }

  getStatusLabel(): string {
    if (!this.data || this.data.status == null) {
      return '';
    }

    return this.tripStatusOptions[this.data?.status] || '';
  }

  emitContract(): void {
    if (!this.data || this.emittingContract) {
      return;
    }
    const trip = this.data;
    this.emittingContract = true;

    const progress = this.modalService.showPdfProgress(
      this.translationService.instant('PDF_EXPORT.PREPARING_TITLE'),
    );

    forkJoin({
      businessPartner: trip.businessPartnerId
        ? this.businessPartnerService
            .getById(trip.businessPartnerId)
            .pipe(catchError(() => of({ data: null } as WebApiResponse<any>)))
        : of({ data: null } as WebApiResponse<any>),
      vehicle: trip.vehicleId
        ? this.vehicleService
            .getById(trip.vehicleId)
            .pipe(catchError(() => of({ data: null } as WebApiResponse<any>)))
        : of({ data: null } as WebApiResponse<any>),
      tripLegs: this.tripLegService
        .getByTrip(trip.id!)
        .pipe(catchError(() => of({ data: [] } as WebApiResponse<any>))),
    }).subscribe({
      next: ({ businessPartner, vehicle, tripLegs }) => {
        buildContractPages(
          this.documentTemplateService,
          trip,
          businessPartner.data ?? null,
          vehicle.data ?? null,
          tripLegs.data ?? [],
        ).subscribe((pages) => {
          // Dynamic import: downloadLetterheadPdf pulls in jsPDF/html2canvas (~1MB) that only
          // this button actually needs, so it's loaded on click rather than in the app's initial
          // bundle - see core/utilities/index.ts for why it isn't re-exported via @nexus/core.
          import('../../../core/utilities/letterhead-pdf').then(({ downloadLetterheadPdf }) => {
            downloadLetterheadPdf(
              pages,
              `contrato-${trip.tripNumber}.pdf`,
              (completed: number, total: number) => progress.setProgress(completed, total),
            )
              .then(() => {
                progress.success(this.translationService.instant('PDF_EXPORT.SUCCESS'));
                this.emittingContract = false;
              })
              .catch(() => {
                progress.error(this.translationService.instant('PDF_EXPORT.ERROR'));
                this.emittingContract = false;
              });
          });
        });
      },
      error: () => {
        progress.error(this.translationService.instant('PDF_EXPORT.ERROR'));
        this.emittingContract = false;
      },
    });
  }

  emitServiceOrder(): void {
    if (!this.data || this.emittingServiceOrder) {
      return;
    }
    const trip = this.data;
    this.emittingServiceOrder = true;

    const progress = this.modalService.showPdfProgress(
      this.translationService.instant('PDF_EXPORT.PREPARING_TITLE'),
    );

    forkJoin({
      vehicle: trip.vehicleId
        ? this.vehicleService
            .getById(trip.vehicleId)
            .pipe(catchError(() => of({ data: null } as WebApiResponse<any>)))
        : of({ data: null } as WebApiResponse<any>),
      driver: trip.driverId
        ? this.driverService
            .getById(trip.driverId)
            .pipe(catchError(() => of({ data: null } as WebApiResponse<any>)))
        : of({ data: null } as WebApiResponse<any>),
      passengers: this.passengerService
        .getByTrip(trip.id!)
        .pipe(catchError(() => of({ data: [] } as WebApiResponse<any>))),
      serviceOrders: trip.driverId
        ? this.serviceOrderService
            .getByDriver(trip.driverId)
            .pipe(catchError(() => of({ data: [] } as WebApiResponse<any>)))
        : of({ data: [] } as WebApiResponse<any>),
    }).subscribe({
      next: ({ vehicle, driver, passengers, serviceOrders }) => {
        const matchingServiceOrder = (serviceOrders.data ?? []).find(
          (so: any) => so.tripId === trip.id,
        );
        const commissionAmount = matchingServiceOrder?.commission?.amount ?? null;
        buildServiceOrderPages(
          this.documentTemplateService,
          trip,
          vehicle.data ?? null,
          driver.data ?? null,
          (passengers.data ?? []).length,
          commissionAmount,
        ).subscribe((pages) => {
          // Dynamic import: downloadLetterheadPdf pulls in jsPDF/html2canvas (~1MB) that only
          // this button actually needs, so it's loaded on click rather than in the app's initial
          // bundle - see core/utilities/index.ts for why it isn't re-exported via @nexus/core.
          import('../../../core/utilities/letterhead-pdf').then(({ downloadLetterheadPdf }) => {
            downloadLetterheadPdf(
              pages,
              `os-${trip.tripNumber}.pdf`,
              (completed: number, total: number) => progress.setProgress(completed, total),
            )
              .then(() => {
                progress.success(this.translationService.instant('PDF_EXPORT.SUCCESS'));
                this.emittingServiceOrder = false;
              })
              .catch(() => {
                progress.error(this.translationService.instant('PDF_EXPORT.ERROR'));
                this.emittingServiceOrder = false;
              });
          });
        });
      },
      error: () => {
        progress.error(this.translationService.instant('PDF_EXPORT.ERROR'));
        this.emittingServiceOrder = false;
      },
    });
  }

  private getTripById(id: string): void {
    this.loading = true;

    const handleResponse = (response: WebApiResponse<Trip>): void => {
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

    this.tripService
      .getById(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({ next: handleResponse, error: handleError });

    // tripChanged$/paymentChanged$ are BehaviorSubjects, so merging them raw would replay their
    // current value the moment this subscribes - an extra getById call firing alongside the one
    // above, just to load the page once. skip(1) drops that replay and leaves this reacting only
    // to real subsequent changes.
    this._tripChangedSub = merge(
      this.tripService.tripChanged$.pipe(skip(1)),
      this.paymentService.paymentChanged$.pipe(skip(1)),
    )
      .pipe(
        switchMap(() => this.tripService.getById(id)),
        takeUntil(this._destroy$),
      )
      .subscribe({ next: handleResponse, error: handleError });
  }
}
