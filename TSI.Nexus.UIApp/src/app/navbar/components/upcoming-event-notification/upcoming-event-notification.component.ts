import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  AccountService,
  AgendaEvent,
  AlertConfigKeys,
  AlertConfigService,
  EventService,
  ModalService,
  ResponseStatus,
  WebApiResponse,
} from '@nexus/core';
import { of, Subject, switchMap, takeUntil } from 'rxjs';
import { NgIf, NgFor, DatePipe } from '@angular/common';

import { EventDetailsModalComponent } from '../../../agenda/components/event-details-modal/event-details-modal.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

// Same shape as StockAlertNotificationComponent: fetches its own data (the current user's events
// via EventService.getByUserId) and filters client-side, this time against the
// UpcomingEventReminder AlertConfig's thresholdDays instead of a hardcoded stock level.
@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-upcoming-event-notification',
    templateUrl: './upcoming-event-notification.component.html',
    styleUrl: './upcoming-event-notification.component.scss',
    imports: [NgIf, NgFor, DatePipe, TranslatePipe],
})
export class UpcomingEventNotificationComponent implements OnInit, OnDestroy {
  upcomingEvents: AgendaEvent[] = [];
  total = 0;

  private _destroy$ = new Subject<void>();

  constructor(
    private eventService: EventService,
    private alertConfigService: AlertConfigService,
    private accountService: AccountService,
    private modalService: ModalService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.load();
    this.eventService.eventChanged$.pipe(takeUntil(this._destroy$)).subscribe(() => this.load());
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  get showBadge(): boolean {
    return this.total > 0;
  }

  openEvent(event: AgendaEvent): void {
    this.modalService.showTemplateModal(EventDetailsModalComponent, {
      isEdit: true,
      data: event,
    });
  }

  onSeeAll(): void {
    this.router.navigateByUrl('/agenda?onlyMine=true');
  }

  private load(): void {
    this.accountService.user$
      .pipe(
        switchMap((user) =>
          user?.id
            ? this.eventService.getByUserId(user.id)
            : of({ data: [], message: '', status: ResponseStatus.Success } as WebApiResponse<AgendaEvent[]>),
        ),
        takeUntil(this._destroy$),
      )
      .subscribe((response: WebApiResponse<AgendaEvent[]>) => {
        const events = response?.data || [];
        this.alertConfigService
          .getAll()
          .pipe(takeUntil(this._destroy$))
          .subscribe((alertConfigResponse) => {
            const config = (alertConfigResponse?.data || []).find(
              (c) => c.key === AlertConfigKeys.UpcomingEventReminder,
            );
            if (config && config.enabled === false) {
              this.upcomingEvents = [];
              this.total = 0;
              return;
            }
            const thresholdDays = config?.thresholdDays ?? 1;
            const now = new Date();
            const limit = new Date(now.getTime() + thresholdDays * 24 * 60 * 60 * 1000);
            this.upcomingEvents = events
              .filter((e) => {
                if (!e.startDate) {
                  return false;
                }
                const start = new Date(e.startDate);
                return start >= now && start <= limit;
              })
              .sort(
                (a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime(),
              );
            this.total = this.upcomingEvents.length;
          });
      });
  }
}
