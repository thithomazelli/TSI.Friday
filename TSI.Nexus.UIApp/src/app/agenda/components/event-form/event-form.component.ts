import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteTrigger, MatAutocomplete, MatOption } from '@angular/material/autocomplete';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, Subject, combineLatestWith, forkJoin, map, of, shareReplay, startWith, switchMap, take, takeUntil, tap } from 'rxjs';
import {
  AgendaEvent,
  BusinessPartnerService,
  DriverService,
  EventParticipant,
  EventParticipantService,
  EventService,
  FormBaseComponent,
  FuelLogService,
  ModalService,
  NotificationService,
  OrderService,
  PaymentService,
  PurchaseOrderService,
  QuoteService,
  ResponseStatus,
  SelectableOption,
  SelectableOptionGroup,
  SelectableOptionService,
  TransactionService,
  TranslationService,
  TripService,
  User,
  UserService,
  VehicleMaintenanceService,
  VehicleService,
  WebApiResponse,
} from '@nexus/core';
import { DateFieldComponent } from '../../../shared/components/date-field/date-field.component';
import { ClickDirective } from '../../../core/directives/click.directive';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
// Type-only: EventDetailsModalComponent imports this form back (renders <app-event-form> in its
// template), so a normal import would form a module-load-order circular dependency between the
// two files - `import type` is erased at compile time and can't contribute to that cycle.
import type { EventDetailsModalComponent } from '../event-details-modal/event-details-modal.component';
import { cardCollapseAnimation } from '../../../core/animations/card-collapse.animation';

interface LinkOption {
  id: string;
  label: string;
}

interface LinkConfig {
  key: string;
  idField: string;
  labelField: string;
  translationKey: string;
  icon: string;
  items$: Observable<LinkOption[]>;
  filtered$?: Observable<LinkOption[]>;
  // Each link type's full list is only fetched once the user actually focuses that field (see
  // (focus)="config.activate()" in the template) - with 11 link types on this form, eagerly
  // fetching all of them on every open meant opening the "novo evento" modal fired ~11 full,
  // unpaginated GETs even though a real event links to at most one or two of them. activate() is
  // idempotent: only the first call per field instance actually triggers the fetch.
  activate: () => void;
}

// Event form shared by the Add/Edit modal (main Agenda screen) and every entity's own Agenda tab.
// Mirrors VehicleMaintenanceFormComponent's isModal/isEdit/data/dialogRef contract. Links to other
// entities: eleven independent autocomplete fields, at least one must resolve to an id (mirrors
// EventService.HasAnyLink on the backend - validated here too for immediate feedback). When
// embedded inside an entity's own Agenda tab, that one link comes pre-set and locked via
// lockedLinkField/lockedLinkId/lockedLinkLabel, and the other ten fields are hidden.
@Component({
    selector: 'app-event-form',
    templateUrl: './event-form.component.html',
    styleUrl: './event-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [cardCollapseAnimation],
    imports: [
        ReactiveFormsModule,
        AsyncPipe,
        MatAutocompleteTrigger,
        MatAutocomplete,
        MatOption,
        DateFieldComponent,
        ClickDirective,
        TranslatePipe,
    ],
})
export class EventFormComponent extends FormBaseComponent implements OnInit, OnChanges {
  @Input()
  isModal = false;

  @Input()
  isEdit = false;

  @Input()
  data?: AgendaEvent | null;

  @Input()
  compact = false;

  @Input()
  dialogRef?: MatDialogRef<EventDetailsModalComponent>;

  @Input()
  prefillStart?: Date | null;

  @Input()
  prefillEnd?: Date | null;

  @Input()
  lockedLinkField?: string | null;

  @Input()
  lockedLinkId?: string | null;

  @Input()
  lockedLinkLabel?: string | null;

  eventTypeOptions: SelectableOption[] = [];
  participants: EventParticipant[] = [];
  users: User[] = [];
  filteredUsers$!: Observable<User[]>;

  linkConfigs: LinkConfig[] = [];
  linkSectionOpen = true;

  private _linkValues: Record<string, string | null> = {};
  private _removedParticipantIds: string[] = [];
  private _destroy$ = new Subject<void>();

  constructor(
    private formBuilder: FormBuilder,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private eventService: EventService,
    private eventParticipantService: EventParticipantService,
    private selectableOptionService: SelectableOptionService,
    private businessPartnerService: BusinessPartnerService,
    private quoteService: QuoteService,
    private orderService: OrderService,
    private purchaseOrderService: PurchaseOrderService,
    private tripService: TripService,
    private transactionService: TransactionService,
    private paymentService: PaymentService,
    private vehicleService: VehicleService,
    private driverService: DriverService,
    private vehicleMaintenanceService: VehicleMaintenanceService,
    private fuelLogService: FuelLogService,
    private userService: UserService,
    private routerService: Router,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
  ) {
    super();
  }

  ngOnInit(): void {
    this.initForm();
    this.setupLinkConfigs();
    this.setupUserAutoComplete();
    this.loadEventTypes();
    this.patchFormWithData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data && this.form) {
      this.patchFormWithData();
    }
  }

  selectLink(config: LinkConfig, option: LinkOption): void {
    this._linkValues[config.key] = option.id;
    this.form.get(config.labelField)?.setValue(option.label, { emitEvent: false });
  }

  onLinkBlur(config: LinkConfig): void {
    setTimeout(() => {
      const typed = (this.form.get(config.labelField)?.value ?? '').trim();
      if (!typed) {
        this._linkValues[config.key] = null;
      }
    }, 200);
  }

  clearLink(config: LinkConfig): void {
    this._linkValues[config.key] = null;
    this.form.get(config.labelField)?.setValue('');
  }

  toggleLinkSection(): void {
    this.linkSectionOpen = !this.linkSectionOpen;
  }

  selectUser(user: User): void {
    if (this.participants.some((p) => p.userId === user.id)) {
      return;
    }
    this.participants = [
      ...this.participants,
      { id: '', userId: user.id, displayName: `${user.firstName} ${user.lastName}`.trim() },
    ];
    this.form.get('participantSearch')?.setValue('');
  }

  addFreeformParticipant(): void {
    const name = this.form.get('participantName')?.value?.trim();
    const email = this.form.get('participantEmail')?.value?.trim();
    if (!name && !email) {
      return;
    }
    this.participants = [
      ...this.participants,
      { id: '', name: name || null, email: email || null, displayName: name || email },
    ];
    this.form.get('participantName')?.setValue('');
    this.form.get('participantEmail')?.setValue('');
  }

  removeParticipant(index: number): void {
    const participant = this.participants[index];
    if (participant.id) {
      this._removedParticipantIds.push(participant.id);
    }
    this.participants = this.participants.filter((_, i) => i !== index);
  }

  submit(): Observable<WebApiResponse<AgendaEvent> | null> {
    this.submitted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return of(null);
    }

    if (!this.hasAnyLink()) {
      this.notificationService.showMessage(
        ResponseStatus.Error,
        this.translationService.instant('AGENDA.LINK_REQUIRED'),
      );
      return of(null);
    }

    const raw = this.form.getRawValue();
    const event = {
      ...(this.isEdit && this.data ? { id: this.data.id } : {}),
      title: raw.title,
      description: raw.description,
      startDate: this.combineDateTime(raw.startDate, raw.startTime),
      endDate: this.combineDateTime(raw.endDate, raw.endTime),
      eventTypeOptionId: raw.eventTypeOptionId,
      ...this.buildLinkPayload(),
    } as AgendaEvent;

    const save$ = this.isEdit && this.data
      ? this.eventService.update(event)
      : this.eventService.add(event);

    return save$.pipe(
      tap({
        next: (response: WebApiResponse<AgendaEvent>) => {
          if (response.status !== ResponseStatus.Success || !response.data) {
            this.notificationService.showMessage(response.status, response.message);
            return;
          }
          this.syncParticipants(response.data.id!).subscribe(() => {
            if (this.isModal) {
              this.saveModal(response);
            } else {
              this.savePage(response);
            }
          });
        },
        error: () =>
          this.notificationService.showMessage(
            ResponseStatus.Error,
            this.translationService.instant('AGENDA.SAVE_ERROR'),
          ),
      }),
    );
  }

  cancel(): void {
    if (this.isModal) {
      this.modalService.hideModal(this.dialogRef);
    } else {
      this.routerService.navigateByUrl('/agenda');
    }
  }

  remove(): void {
    if (!this.data) {
      return;
    }
    this.eventService
      .delete(this.data)
      .pipe(
        tap({
          next: (response: WebApiResponse<AgendaEvent>) => {
            if (this.isModal) {
              this.modalService.hideModal(this.dialogRef);
            }
            this.notificationService.showMessage(response.status, response.message);
            if (response.status === ResponseStatus.Success && !this.isModal) {
              this.routerService.navigateByUrl('/agenda');
            }
          },
          error: () =>
            this.notificationService.showMessage(
              ResponseStatus.Error,
              this.translationService.instant('AGENDA.SAVE_ERROR'),
            ),
        }),
      )
      .subscribe();
  }

  private hasAnyLink(): boolean {
    if (this.lockedLinkField) {
      return true;
    }
    return Object.values(this._linkValues).some((v) => !!v);
  }

  private buildLinkPayload(): Partial<AgendaEvent> {
    const payload: Record<string, string | null> = {};
    if (this.lockedLinkField && this.lockedLinkId) {
      payload[this.lockedLinkField] = this.lockedLinkId;
    } else {
      for (const config of this.linkConfigs) {
        payload[config.idField] = this._linkValues[config.key] ?? null;
      }
    }
    return payload as Partial<AgendaEvent>;
  }

  private syncParticipants(eventId: string): Observable<unknown> {
    const calls: Observable<unknown>[] = [];

    for (const id of this._removedParticipantIds) {
      calls.push(this.eventParticipantService.delete({ id } as EventParticipant));
    }

    for (const participant of this.participants) {
      if (!participant.id) {
        calls.push(
          this.eventParticipantService.add({ ...participant, eventId } as EventParticipant),
        );
      }
    }

    this._removedParticipantIds = [];

    return calls.length ? forkJoin(calls) : of(null);
  }

  private initForm(): void {
    this.form = this.formBuilder.group({
      title: ['', Validators.required],
      description: [''],
      startDate: ['', Validators.required],
      startTime: ['09:00', Validators.required],
      endDate: ['', Validators.required],
      endTime: ['10:00', Validators.required],
      eventTypeOptionId: ['', Validators.required],
      participantSearch: [''],
      participantName: [''],
      participantEmail: [''],
    });
  }

  private setupLinkConfigs(): void {
    this.linkConfigs = [
      this.buildConfig('businessPartner', 'businessPartnerId', 'AGENDA.LINK_BUSINESS_PARTNER', 'bi-person', () =>
        this.mergeResponses(
          this.businessPartnerService.getClients(),
          this.businessPartnerService.getSuppliers(),
        ).pipe(map((items) => items.map((i) => ({ id: i.id!, label: i.name! })))),
      ),
      this.buildConfig('quote', 'quoteId', 'AGENDA.LINK_QUOTE', 'bi-file-earmark-text', () =>
        this.mapList(this.quoteService.getAll(), (q: any) => ({ id: q.id, label: q.quoteNumber })),
      ),
      this.buildConfig('order', 'orderId', 'AGENDA.LINK_ORDER', 'bi-cart-check', () =>
        this.mapList(this.orderService.getAll(), (o: any) => ({ id: o.id, label: o.orderNumber })),
      ),
      this.buildConfig(
        'purchaseOrder', 'purchaseOrderId', 'AGENDA.LINK_PURCHASE_ORDER', 'bi-cart-plus', () =>
          this.mapList(this.purchaseOrderService.getAll(), (o: any) => ({ id: o.id, label: o.purchaseOrderNumber })),
      ),
      this.buildConfig('trip', 'tripId', 'AGENDA.LINK_TRIP', 'bi-signpost-2', () =>
        this.mapList(this.tripService.getAll(), (t: any) => ({ id: t.id, label: t.tripNumber })),
      ),
      this.buildConfig(
        'transaction', 'transactionId', 'AGENDA.LINK_TRANSACTION', 'bi-arrow-left-right', () =>
          this.mapList(this.transactionService.getAll(), (t: any) => ({ id: t.id, label: t.description })),
      ),
      this.buildConfig('payment', 'paymentId', 'AGENDA.LINK_PAYMENT', 'bi-credit-card', () =>
        this.mapList(this.paymentService.getAll(), (p: any) => ({ id: p.id, label: p.description })),
      ),
      this.buildConfig('vehicle', 'vehicleId', 'AGENDA.LINK_VEHICLE', 'bi-truck', () =>
        this.mapList(this.vehicleService.getAll(), (v: any) => ({ id: v.id, label: v.plate })),
      ),
      this.buildConfig('driver', 'driverId', 'AGENDA.LINK_DRIVER', 'bi-person-badge', () =>
        this.mapList(this.driverService.getAll(), (d: any) => ({ id: d.id, label: d.name })),
      ),
      this.buildConfig(
        'vehicleMaintenance', 'vehicleMaintenanceId', 'AGENDA.LINK_VEHICLE_MAINTENANCE', 'bi-tools', () =>
          this.mapList(this.vehicleMaintenanceService.getAll(), (m: any) => ({ id: m.id, label: m.description })),
      ),
      this.buildConfig('fuelLog', 'fuelLogId', 'AGENDA.LINK_FUEL_LOG', 'bi-fuel-pump', () =>
        this.mapList(this.fuelLogService.getAll(), (f: any) => ({ id: f.id, label: f.gasStation })),
      ),
    ];

    for (const config of this.linkConfigs) {
      this.form.addControl(config.labelField, this.formBuilder.control(''));
      config.filtered$ = this.form
        .get(config.labelField)!
        .valueChanges.pipe(
          startWith(''),
          combineLatestWith(config.items$),
          map(([value, items]) => {
            const filterValue = (typeof value === 'string' ? value : '').toLowerCase();
            if (!filterValue) {
              return [];
            }
            return items.filter((item) => item.label?.toLowerCase().includes(filterValue));
          }),
        );
    }
  }

  private buildConfig(
    key: string,
    idField: string,
    translationKey: string,
    icon: string,
    itemsFactory: () => Observable<LinkOption[]>,
  ): LinkConfig {
    const activate$ = new Subject<void>();
    return {
      key,
      idField,
      labelField: `${key}Label`,
      translationKey,
      icon,
      // take(1): only the first activate() call actually fetches - later focus events on the
      // same field instance are no-ops, and shareReplay(1) keeps the resolved list around for
      // this form's lifetime so re-focusing (or typing again) doesn't refetch.
      items$: activate$.pipe(
        take(1),
        switchMap(() => itemsFactory()),
        shareReplay(1),
      ),
      activate: () => activate$.next(),
    };
  }

  private mapList<T>(
    source$: Observable<WebApiResponse<T[]>>,
    toOption: (item: T) => LinkOption,
  ): Observable<LinkOption[]> {
    return source$.pipe(map((response) => (response.data ?? []).map(toOption)));
  }

  private mergeResponses<T>(
    a$: Observable<WebApiResponse<T[]>>,
    b$: Observable<WebApiResponse<T[]>>,
  ): Observable<T[]> {
    return forkJoin([a$, b$]).pipe(
      map(([a, b]) => [...(a.data ?? []), ...(b.data ?? [])]),
    );
  }

  private setupUserAutoComplete(): void {
    this.userService
      .getAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe((response) => (this.users = response.data ?? []));

    this.filteredUsers$ = this.form.get('participantSearch')!.valueChanges.pipe(
      startWith(''),
      map((value) => {
        const filterValue = (typeof value === 'string' ? value : '').toLowerCase();
        if (!filterValue) {
          return [];
        }
        return this.users.filter((user) =>
          `${user.firstName} ${user.lastName}`.toLowerCase().includes(filterValue),
        );
      }),
    );
  }

  private loadEventTypes(): void {
    this.selectableOptionService
      .getByGroup(SelectableOptionGroup.EventType)
      .pipe(takeUntil(this._destroy$))
      .subscribe((response) => {
        this.eventTypeOptions = response.data ?? [];
        this.cdr.markForCheck();
      });
  }

  private patchFormWithData(): void {
    if (this.data && this.form) {
      const start = this.data.startDate ? new Date(this.data.startDate) : null;
      const end = this.data.endDate ? new Date(this.data.endDate) : null;

      this.form.patchValue({
        title: this.data.title,
        description: this.data.description,
        startDate: start,
        startTime: start ? this.toTimeString(start) : '09:00',
        endDate: end,
        endTime: end ? this.toTimeString(end) : '10:00',
        eventTypeOptionId: this.data.eventTypeOptionId,
      });

      this.participants = [...(this.data.participants ?? [])];

      for (const config of this.linkConfigs) {
        const id = (this.data as any)[config.idField];
        if (id) {
          this._linkValues[config.key] = id;
        }
      }
    } else if (this.form) {
      if (this.prefillStart) {
        this.form.patchValue({
          startDate: this.prefillStart,
          startTime: this.toTimeString(this.prefillStart),
        });
      }
      if (this.prefillEnd) {
        this.form.patchValue({
          endDate: this.prefillEnd,
          endTime: this.toTimeString(this.prefillEnd),
        });
      }
      if (this.lockedLinkField && this.lockedLinkId) {
        this._linkValues[this.lockedLinkField.replace(/Id$/, '')] = this.lockedLinkId;
      }
    }
  }

  private toTimeString(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private combineDateTime(dateOnly: any, time: string): Date {
    const base = this.toDate(dateOnly);
    const [hours, minutes] = (time || '00:00').split(':').map((n) => Number(n));
    base.setHours(hours || 0, minutes || 0, 0, 0);
    return base;
  }

  private toDate(dateOnly: any): Date {
    if (!dateOnly) {
      return new Date();
    }
    if (typeof dateOnly === 'object' && typeof dateOnly.toDate === 'function') {
      return dateOnly.toDate();
    }
    if (dateOnly instanceof Date) {
      return new Date(dateOnly.getTime());
    }
    const str = String(dateOnly);
    if (str.includes('/')) {
      const [day, month, year] = str.split('/').map((part) => Number(part));
      return new Date(year, (month || 1) - 1, day || 1);
    }
    return new Date(str);
  }

  private savePage(response: WebApiResponse<AgendaEvent>): void {
    this.notificationService.showMessage(response.status, response.message);
    if (this.isEdit) {
      this.data = response.data;
      this.cdr.markForCheck();
    } else {
      this.routerService.navigateByUrl('/agenda');
    }
  }

  private saveModal(response: WebApiResponse<AgendaEvent>): void {
    this.dialogRef?.close(response);
    this.notificationService.showMessage(response.status, response.message);
  }
}
