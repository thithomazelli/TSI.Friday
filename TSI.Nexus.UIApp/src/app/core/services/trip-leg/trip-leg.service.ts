import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiService, ApiType, WebApiResponse } from '@nexus/core';
import { TripLeg } from '@nexus/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class TripLegService {
  private _baseEndPoint = ApiType.TripLegs;
  // See event.service.ts for why this is a tick counter rather than a BehaviorSubject<void>.
  private readonly _changedTick = signal(0);

  readonly tripLegChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  constructor(private apiService: ApiService) {}

  getByTrip(tripId: string): Observable<WebApiResponse<TripLeg[]>> {
    return this.apiService.get<WebApiResponse<TripLeg[]>>(
      `${this._baseEndPoint}/getByTrip/${tripId}`,
    );
  }

  add(tripLeg: TripLeg): Observable<WebApiResponse<TripLeg>> {
    return this.apiService
      .post<WebApiResponse<TripLeg>>(`${this._baseEndPoint}/add`, tripLeg)
      .pipe(tap(() => this.notifyChanged()));
  }

  update(tripLeg: TripLeg): Observable<WebApiResponse<TripLeg>> {
    return this.apiService
      .put<WebApiResponse<TripLeg>>(`${this._baseEndPoint}/update`, tripLeg)
      .pipe(tap(() => this.notifyChanged()));
  }

  delete(tripLeg: TripLeg): Observable<WebApiResponse<TripLeg>> {
    return this.apiService
      .delete<WebApiResponse<TripLeg>>(`${this._baseEndPoint}/remove`, tripLeg)
      .pipe(tap(() => this.notifyChanged()));
  }
}
