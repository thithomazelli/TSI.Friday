import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiService, ApiType, WebApiResponse } from '@nexus/core';
import { Passenger } from '@nexus/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PassengerService {
  private _baseEndPoint = ApiType.Passengers;
  // See event.service.ts for why this is a tick counter rather than a BehaviorSubject<void>.
  private readonly _changedTick = signal(0);

  readonly passengerChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  constructor(private apiService: ApiService) {}

  getByTrip(tripId: string): Observable<WebApiResponse<Passenger[]>> {
    return this.apiService.get<WebApiResponse<Passenger[]>>(
      `${this._baseEndPoint}/getByTrip/${tripId}`,
    );
  }

  add(passenger: Passenger): Observable<WebApiResponse<Passenger>> {
    return this.apiService
      .post<WebApiResponse<Passenger>>(`${this._baseEndPoint}/add`, passenger)
      .pipe(tap(() => this.notifyChanged()));
  }

  addRange(
    passengers: Passenger[],
  ): Observable<WebApiResponse<Passenger[]>> {
    return this.apiService
      .post<WebApiResponse<Passenger[]>>(`${this._baseEndPoint}/addRange`, passengers)
      .pipe(tap(() => this.notifyChanged()));
  }

  update(passenger: Passenger): Observable<WebApiResponse<Passenger>> {
    return this.apiService
      .put<WebApiResponse<Passenger>>(`${this._baseEndPoint}/update`, passenger)
      .pipe(tap(() => this.notifyChanged()));
  }

  delete(passenger: Passenger): Observable<WebApiResponse<Passenger>> {
    return this.apiService
      .delete<WebApiResponse<Passenger>>(`${this._baseEndPoint}/remove`, passenger)
      .pipe(tap(() => this.notifyChanged()));
  }
}
