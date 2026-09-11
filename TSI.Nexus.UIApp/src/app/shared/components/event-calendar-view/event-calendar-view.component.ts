import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FullCalendarModule, FullCalendarComponent } from '@fullcalendar/angular';
import { CalendarOptions, DateSelectArg, EventClickArg } from '@fullcalendar/core';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import esLocale from '@fullcalendar/core/locales/es';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { AgendaEvent, TranslationService } from '@nexus/core';
import { Subject, takeUntil } from 'rxjs';

// Outlook-style month/week/day/list calendar, shared by the main Agenda screen and by every
// entity's own "Agenda" tab. Knows nothing about how events were fetched/filtered - it only
// renders whatever AgendaEvent[] it's given, colored by eventTypeColor, and reports back clicks
// (edit) and drag-selected ranges (create prefilled).
@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-event-calendar-view',
    templateUrl: './event-calendar-view.component.html',
    styleUrl: './event-calendar-view.component.scss',
    imports: [FullCalendarModule],
})
export class EventCalendarViewComponent implements OnInit, OnChanges, OnDestroy {
  @Input()
  events: AgendaEvent[] = [];

  @Output()
  eventClicked = new EventEmitter<AgendaEvent>();

  @Output()
  rangeSelected = new EventEmitter<{ start: Date; end: Date }>();

  @ViewChild('calendar')
  calendarComponent?: FullCalendarComponent;

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    // Comma-separated items render as one connected Bootstrap-style button-group (no gap, no
    // radius between them) - a space between items instead keeps every button visually distinct
    // with FullCalendar's own margin between them, matching the rest of the app's button spacing
    // (e.g. the "Atualizar"/"Adicionar" pair above the grid) instead of reading as glued together.
    headerToolbar: {
      left: 'prev next today',
      center: 'title',
      right: 'dayGridMonth timeGridWeek timeGridDay listWeek',
    },
    selectable: true,
    selectMirror: true,
    editable: false,
    height: 'auto',
    // Paints the whole event card in its EventType color instead of FullCalendar's default
    // small colored dot, so the color actually stands out on the calendar.
    eventDisplay: 'block',
    // Without this, FullCalendar's default format (hour: 'numeric', omitZeroMinute: true) drops
    // the leading zero and the minutes whenever an event starts exactly on the hour - "9" instead
    // of "09:00" - while an event with non-zero minutes shows inconsistently as e.g. "2:56". Force
    // a fixed HH:mm so every event's time reads the same way regardless of when it starts.
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      meridiem: false,
    },
    events: [],
    eventClick: (arg: EventClickArg) => this.onEventClick(arg),
    select: (arg: DateSelectArg) => this.onRangeSelect(arg),
  };

  private _destroy$ = new Subject<void>();

  constructor(private translationService: TranslationService) {}

  ngOnInit(): void {
    this.applyLocale(this.translationService.current);
    this.translationService.language$
      .pipe(takeUntil(this._destroy$))
      .subscribe((language) => this.applyLocale(language));
    this.applyEvents();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['events'] && !changes['events'].firstChange) {
      this.applyEvents();
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  private applyLocale(language: string): void {
    this.calendarOptions = {
      ...this.calendarOptions,
      locale: language === 'pt-BR' ? ptBrLocale : language === 'es' ? esLocale : 'en',
    };
  }

  private applyEvents(): void {
    this.calendarOptions = {
      ...this.calendarOptions,
      events: (this.events ?? []).map((event) => ({
        id: event.id,
        title: event.title,
        start: event.startDate,
        end: event.endDate,
        backgroundColor: event.eventTypeColor ?? undefined,
        borderColor: event.eventTypeColor ?? undefined,
        extendedProps: { original: event },
      })),
    };
  }

  private onEventClick(arg: EventClickArg): void {
    const original = arg.event.extendedProps['original'] as AgendaEvent;
    if (original) {
      this.eventClicked.emit(original);
    }
  }

  private onRangeSelect(arg: DateSelectArg): void {
    this.rangeSelected.emit({ start: arg.start, end: arg.end });
    this.calendarComponent?.getApi().unselect();
  }
}
