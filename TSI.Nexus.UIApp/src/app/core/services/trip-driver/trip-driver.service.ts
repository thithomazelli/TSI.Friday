import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiType, ResponseStatus } from '../../enums';
import { TripDriver } from '../../models';
import { ApiService, WebApiResponse } from '@nexus/core';
import { Observable, Subject, map, of, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TripDriverService {
  private _baseEndPoint = ApiType.TripDrivers;
  // See event.service.ts for why this is a tick counter rather than a BehaviorSubject<void>.
  private readonly _changedTick = signal(0);
  // See order-product.service.ts for why this stays a Subject (one-shot event, not state).
  private _tripDriverAdded$ = new Subject<TripDriver>();

  readonly tripDriverChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));
  tripDriverAdded$ = this._tripDriverAdded$.asObservable();

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  constructor(private apiService: ApiService) {}

  getByTripId(tripId: string): Observable<WebApiResponse<TripDriver[]>> {
    return this.apiService.get<WebApiResponse<TripDriver[]>>(
      `${this._baseEndPoint}/getByTripId/${tripId}`,
    );
  }

  getByDriverId(driverId: string): Observable<WebApiResponse<TripDriver[]>> {
    return this.apiService.get<WebApiResponse<TripDriver[]>>(
      `${this._baseEndPoint}/getByDriverId/${driverId}`,
    );
  }

  add(tripDriver: TripDriver): Observable<WebApiResponse<TripDriver>> {
    return this.apiService
      .post<
        WebApiResponse<TripDriver>
      >(`${this._baseEndPoint}/add`, tripDriver)
      .pipe(tap(() => this.notifyChanged()));
  }

  addTemporary(tripDriver: TripDriver): Observable<WebApiResponse<TripDriver>> {
    this._tripDriverAdded$.next(tripDriver);
    return of({
      data: tripDriver,
      message: 'Motorista adicionado temporariamente',
      status: ResponseStatus.Success,
    });
  }

  update(tripDriver: TripDriver): Observable<WebApiResponse<TripDriver>> {
    return this.apiService
      .put<
        WebApiResponse<TripDriver>
      >(`${this._baseEndPoint}/update`, tripDriver)
      .pipe(tap(() => this.notifyChanged()));
  }

  delete(tripDriver: TripDriver): Observable<WebApiResponse<TripDriver>> {
    return this.apiService
      .delete<
        WebApiResponse<TripDriver>
      >(`${this._baseEndPoint}/remove`, tripDriver)
      .pipe(tap(() => this.notifyChanged()));
  }
}
