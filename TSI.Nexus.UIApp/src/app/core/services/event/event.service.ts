import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiType } from '../../enums';
import { AgendaEvent } from '../../models';
import { ApiService, WebApiResponse } from '@nexus/core';
import { Observable, map, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class EventService {
  private _baseEndPoint = ApiType.Events;
  // A tick counter rather than the changed entity itself: consumers only ever react by
  // reloading their own list (see event-list/upcoming-event-notification), never read a payload
  // off this stream. toObservable() replays the current tick to every new subscriber exactly like
  // the BehaviorSubject<void> this replaces did, so a fresh subscriber still gets one immediate
  // emission before any real change happens.
  private readonly _changedTick = signal(0);

  readonly eventChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<AgendaEvent[]>> {
    return this.apiService.get<WebApiResponse<AgendaEvent[]>>(`${this._baseEndPoint}/getAll`);
  }

  getById(id: string): Observable<WebApiResponse<AgendaEvent>> {
    return this.apiService.get<WebApiResponse<AgendaEvent>>(`${this._baseEndPoint}/getById/${id}`);
  }

  getByUserId(userId: string): Observable<WebApiResponse<AgendaEvent[]>> {
    return this.apiService.get<
      WebApiResponse<AgendaEvent[]>
    >(`${this._baseEndPoint}/getByUserId/${userId}`);
  }

  // entity: one of BusinessPartner/Quote/Order/PurchaseOrder/Trip/Transaction/Payment/Vehicle/
  // Driver/VehicleMaintenance/FuelLog - matches the backend's GetBy{entity}Id endpoints.
  getByEntityId(id: string, entity: string): Observable<WebApiResponse<AgendaEvent[]>> {
    return this.apiService.get<
      WebApiResponse<AgendaEvent[]>
    >(`${this._baseEndPoint}/getBy${entity}Id/${id}`);
  }

  add(event: AgendaEvent): Observable<WebApiResponse<AgendaEvent>> {
    return this.apiService
      .post<WebApiResponse<AgendaEvent>>(`${this._baseEndPoint}/add`, event)
      .pipe(tap(() => this.notifyChanged()));
  }

  update(event: AgendaEvent): Observable<WebApiResponse<AgendaEvent>> {
    return this.apiService
      .put<WebApiResponse<AgendaEvent>>(`${this._baseEndPoint}/update`, event)
      .pipe(tap(() => this.notifyChanged()));
  }

  delete(event: AgendaEvent): Observable<WebApiResponse<AgendaEvent>> {
    return this.apiService
      .delete<WebApiResponse<AgendaEvent>>(`${this._baseEndPoint}/remove`, event)
      .pipe(tap(() => this.notifyChanged()));
  }
}
