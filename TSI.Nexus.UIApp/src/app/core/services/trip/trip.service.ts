import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  AgendaEvent,
  ApiService,
  ApiType,
  PagedRequest,
  PagedResult,
  WebApiResponse,
  Trip,
  TripLeg,
} from '@nexus/core';
import { toPagedQueryString } from '../../utilities/paged-request.utils';

@Injectable({
  providedIn: 'root',
})
export class TripService {
  private _baseEndPoint = ApiType.Trips;
  private _trips$ = new BehaviorSubject<Trip[]>([]);
  private _tripChangedSubject = new BehaviorSubject<void>(undefined);
  tripChanged$ = this._tripChangedSubject.asObservable();

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<Trip[]>> {
    return this.apiService
      .get<WebApiResponse<Trip[]>>(`${this._baseEndPoint}/getAll`)
      .pipe(
        tap((response) => {
          this._trips$.next(response.data);
        }),
      );
  }

  getAllPaged(request: PagedRequest): Observable<PagedResult<Trip>> {
    return this.apiService
      .get<
        WebApiResponse<PagedResult<Trip>>
      >(`${this._baseEndPoint}/getAllPaged?${toPagedQueryString(request)}`)
      .pipe(map((response) => response.data));
  }

  getById(tripId: string): Observable<WebApiResponse<Trip>> {
    return this.apiService.get<WebApiResponse<Trip>>(
      `${this._baseEndPoint}/getById/${tripId}`,
    );
  }

  getContractPdf(tripId: string): Observable<Blob> {
    return this.apiService.getBlob(`${this._baseEndPoint}/${tripId}/ContractPdf`);
  }

  getServiceOrderPdf(tripId: string): Observable<Blob> {
    return this.apiService.getBlob(`${this._baseEndPoint}/${tripId}/ServiceOrderPdf`);
  }

  getByBusinessPartnerId(
    businessPartnerId: string,
  ): Observable<WebApiResponse<Trip[]>> {
    return this.apiService
      .get<
        WebApiResponse<Trip[]>
      >(`${this._baseEndPoint}/getByBusinessPartnerId/${businessPartnerId}`)
      .pipe(
        tap((response) => {
          this._trips$.next(response.data);
        }),
      );
  }

  getByDriverId(driverId: string): Observable<WebApiResponse<Trip[]>> {
    return this.apiService
      .get<
        WebApiResponse<Trip[]>
      >(`${this._baseEndPoint}/getByDriverId/${driverId}`)
      .pipe(
        tap((response) => {
          this._trips$.next(response.data);
        }),
      );
  }

  getByVehicleId(vehicleId: string): Observable<WebApiResponse<Trip[]>> {
    return this.apiService
      .get<
        WebApiResponse<Trip[]>
      >(`${this._baseEndPoint}/getByVehicleId/${vehicleId}`)
      .pipe(
        tap((response) => {
          this._trips$.next(response.data);
        }),
      );
  }

  refreshTrips(): Observable<WebApiResponse<Trip[]>> {
    return this.getAll();
  }

  // Builds a read-only calendar card straight from the Trip's own dates - departure of the
  // first leg (by sequence) through arrival of the last one - instead of a separate Event row,
  // the same way other entities' own dates (birthday, quote date, order date, ...) are meant to
  // surface on a calendar without duplicating them into the Event table.
  buildAgendaEvent(trip: Trip, legs: TripLeg[]): AgendaEvent {
    const sortedLegs = [...legs].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    const departures = sortedLegs
      .map((leg) => new Date(leg.departureDate))
      .filter((d) => !isNaN(d.getTime()));
    const arrivals = sortedLegs
      .map((leg) => new Date(leg.arrivalDate ?? leg.departureDate))
      .filter((d) => !isNaN(d.getTime()));

    const fallback = trip.date ? new Date(trip.date) : new Date();
    const startDate = departures.length
      ? new Date(Math.min(...departures.map((d) => d.getTime())))
      : fallback;
    let endDate = arrivals.length
      ? new Date(Math.max(...arrivals.map((d) => d.getTime())))
      : startDate;
    if (endDate < startDate) {
      endDate = startDate;
    }

    return {
      id: `trip-${trip.id}`,
      title: trip.route ? `${trip.tripNumber} - ${trip.route}` : trip.tripNumber,
      startDate,
      endDate,
      eventTypeColor: '#0d6efd',
      tripId: trip.id,
      linkedEntityType: 'Trip',
      linkedEntityLabel: trip.tripNumber,
      readOnly: true,
    } as AgendaEvent;
  }

  add(trip: Trip): Observable<WebApiResponse<Trip>> {
    return this.apiService
      .post<WebApiResponse<Trip>>(`${this._baseEndPoint}/add`, trip)
      .pipe(tap(() => this._tripChangedSubject.next()));
  }

  update(trip: Trip): Observable<WebApiResponse<Trip>> {
    return this.apiService
      .put<WebApiResponse<Trip>>(`${this._baseEndPoint}/update`, trip)
      .pipe(tap(() => this._tripChangedSubject.next()));
  }

  delete(trip: Trip): Observable<WebApiResponse<Trip>> {
    return this.apiService
      .delete<WebApiResponse<Trip>>(`${this._baseEndPoint}/remove`, trip)
      .pipe(tap(() => this._tripChangedSubject.next()));
  }
}
