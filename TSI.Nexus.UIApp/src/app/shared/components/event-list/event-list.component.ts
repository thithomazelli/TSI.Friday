import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AccountService,
  AgendaEvent,
  EventService,
  ModalService,
  NotificationService,
  ResponseStatus,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community';
import { Observable, Subject, takeUntil } from 'rxjs';

import { cardCollapseAnimation } from '../../../core/animations/card-collapse.animation';
import { GridComponent } from '../../grid/grid.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { formatDateTimeBR } from '../../../core/utilities/format-utils';
import { EventCalendarViewComponent } from '../event-calendar-view/event-calendar-view.component';
import { EventDetailsModalComponent } from '../../../agenda/components/event-details-modal/event-details-modal.component';

// Reusable Grid/Calendar dual view for events - embedded either standalone (Agenda main screen,
// entity/entityId left unset, onlyMine filter available) or inside a linked entity's own "Agenda"
// tab (entity/entityId set, new events default-link to that entity), mirroring how
// AttachmentsComponent is embedded across the same 11 entities + User.
@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-event-list',
    templateUrl: './event-list.component.html',
    styleUrl: './event-list.component.scss',
    animations: [cardCollapseAnimation],
    imports: [NgClass, FormsModule, GridComponent, TranslatePipe, EventCalendarViewComponent],
})
export class EventListComponent implements OnInit, OnChanges, OnDestroy {
  @Input() entity?: string | null = null;
  @Input() entityId?: string | null = null;
  @Input() entityLabel?: string | null = null;
  @Input() compact = false;
  @Input() showFilters = false;
  @Input() onlyMine = false;
  // Read-only calendar cards built straight from another entity's own dates (see
  // TripService.buildAgendaEvent) - merged in alongside real Events, never sent to the API.
  @Input() extraEvents: AgendaEvent[] = [];

  viewMode: 'grid' | 'calendar' = 'grid';
  filtersOpen = false;
  events: AgendaEvent[] = [];
  rowData: AgendaEvent[] = [];
  columnDefs: ColDef[] = [];
  loading: boolean = false;

  private _currentUserId?: string;
  private _destroy$ = new Subject<void>();

  constructor(
    private eventService: EventService,
    private accountService: AccountService,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private translationService: TranslationService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.initializeColumnDefs();
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => this.initializeColumnDefs());
    this.accountService.user$.pipe(takeUntil(this._destroy$)).subscribe((user) => {
      this._currentUserId = user?.id;
      this.load();
    });
    this.eventService.eventChanged$.pipe(takeUntil(this._destroy$)).subscribe(() => this.load());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['entity'] || changes['entityId']) && !changes['entity']?.firstChange) {
      this.load();
    }
    if (changes['extraEvents'] && !changes['extraEvents'].firstChange) {
      this.events = [...this.events.filter((e) => !e.readOnly), ...this.extraEvents];
      this.rowData = this.events;
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  toggleFilters(): void {
    this.filtersOpen = !this.filtersOpen;
  }

  refresh(): void {
    this.load(true);
  }

  // <app-grid>'s [update] input is required (no toggle-style action column here to trigger it).
  noop(): void {}

  openModal(initialState: any): void {
    const clicked: AgendaEvent | null = initialState?.data ?? null;
    if (clicked?.readOnly && clicked.tripId) {
      this.router.navigateByUrl(`/trips/${clicked.tripId}`);
      return;
    }

    const isEdit = !!initialState?.isEdit;
    const lockedLinkField = !isEdit && this.entity && this.entity !== 'user' ? `${this.entity}Id` : null;
    this.modalService.showTemplateModal(EventDetailsModalComponent, {
      isEdit,
      data: initialState?.data ?? null,
      prefillStart: initialState?.prefillStart ?? null,
      prefillEnd: initialState?.prefillEnd ?? null,
      lockedLinkField,
      lockedLinkId: lockedLinkField ? this.entityId : null,
      lockedLinkLabel: lockedLinkField ? this.entityLabel : null,
    });
  }

  onRangeSelected(range: { start: Date; end: Date }): void {
    this.openModal({ isEdit: false, prefillStart: range.start, prefillEnd: range.end });
  }

  deleteEvent(event: AgendaEvent): void {
    if (event.readOnly) {
      return;
    }
    this.eventService
      .delete(event)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<AgendaEvent>) => {
        this.events = this.events.filter((e) => e.id !== event.id);
        this.rowData = this.events;
        this.modalService.hideModal();
        this.modalService.showSweetNotification('', response.message, response.status);
      });
  }

  private initializeColumnDefs(): void {
    this.columnDefs = [
      {
        field: 'id',
        headerName: 'ID',
        hide: true,
      },
      {
        field: 'title',
        headerName: this.translationService.instant('AGENDA.EVENT_TITLE'),
        sortable: true,
        filter: true,
        flex: 2,
        cellRenderer: (params: ICellRendererParams) => {
          const value = params.value ?? '';
          return `<a data-action="edit" class="ag-link">${value}</a>`;
        },
      },
      {
        field: 'eventTypeName',
        headerName: this.translationService.instant('AGENDA.EVENT_TYPE'),
        sortable: true,
        filter: true,
        flex: 1,
        cellRenderer: (params: ICellRendererParams) => {
          const color = params.data?.eventTypeColor || '#6c757d';
          const label = params.value ?? '';
          return `<span class="badge" style="background-color:${color}">${label}</span>`;
        },
      },
      {
        field: 'startDate',
        headerName: this.translationService.instant('AGENDA.START_DATE'),
        sortable: true,
        filter: true,
        flex: 1,
        valueFormatter: (params: ValueFormatterParams) => formatDateTimeBR(params.value),
      },
      {
        field: 'endDate',
        headerName: this.translationService.instant('AGENDA.END_DATE'),
        sortable: true,
        filter: true,
        flex: 1,
        valueFormatter: (params: ValueFormatterParams) => formatDateTimeBR(params.value),
      },
      {
        field: 'linkedEntityLabel',
        headerName: this.translationService.instant('AGENDA.LINKED_ENTITY'),
        sortable: true,
        filter: true,
        flex: 1,
      },
      {
        headerName: this.translationService.instant('COMMON.ACTIONS'),
        flex: 1,
        minWidth: 150,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: (params: ICellRendererParams) => {
          if (params.data?.readOnly) {
            return `
              <button class="btn btn-info btn-sm" data-action="edit">
                <i class="fas fa-eye" data-action="edit"></i>
              </button>
            `;
          }
          return `
            <button class="btn btn-info btn-sm" data-action="edit">
              <i class="fas fa-edit" data-action="edit"></i>
            </button>
            <button class="btn btn-danger btn-sm" data-action="delete">
              <i class="fas fa-trash" data-action="delete"></i>
            </button>
          `;
        },
      },
    ];
  }

  load(isRefresh = false): void {
    const request$ = this.resolveRequest();
    if (!request$) {
      return;
    }
    this.loading = true;
    request$.pipe(takeUntil(this._destroy$)).subscribe({
      next: (response) => {
        this.events = [...(response.data ?? []), ...this.extraEvents];
        this.rowData = this.events;
        this.loading = false;
        if (isRefresh) {
          this.notificationService.showMessage(response.status, response.message);
        }
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private resolveRequest(): Observable<WebApiResponse<AgendaEvent[]>> | null {
    if (this.entity === 'user') {
      return this.entityId ? this.eventService.getByUserId(this.entityId) : null;
    }
    if (this.entity && this.entityId) {
      const apiEntity = this.entity.charAt(0).toUpperCase() + this.entity.slice(1);
      return this.eventService.getByEntityId(this.entityId, apiEntity);
    }
    if (this.onlyMine) {
      return this._currentUserId ? this.eventService.getByUserId(this._currentUserId) : null;
    }
    return this.eventService.getAll();
  }

}
