import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiService, ApiType, WebApiResponse } from '@nexus/core';
import { QuoteTripLeg } from '@nexus/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class QuoteTripLegService {
  private _baseEndPoint = ApiType.QuoteTripLegs;
  // See event.service.ts for why this is a tick counter rather than a BehaviorSubject<void>.
  private readonly _changedTick = signal(0);

  readonly quoteTripLegChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  constructor(private apiService: ApiService) {}

  getByQuoteTrip(quoteTripId: string): Observable<WebApiResponse<QuoteTripLeg[]>> {
    return this.apiService.get<WebApiResponse<QuoteTripLeg[]>>(
      `${this._baseEndPoint}/getByQuoteTrip/${quoteTripId}`,
    );
  }

  add(quoteTripLeg: QuoteTripLeg): Observable<WebApiResponse<QuoteTripLeg>> {
    return this.apiService
      .post<WebApiResponse<QuoteTripLeg>>(`${this._baseEndPoint}/add`, quoteTripLeg)
      .pipe(tap(() => this.notifyChanged()));
  }

  update(quoteTripLeg: QuoteTripLeg): Observable<WebApiResponse<QuoteTripLeg>> {
    return this.apiService
      .put<WebApiResponse<QuoteTripLeg>>(`${this._baseEndPoint}/update`, quoteTripLeg)
      .pipe(tap(() => this.notifyChanged()));
  }

  delete(quoteTripLeg: QuoteTripLeg): Observable<WebApiResponse<QuoteTripLeg>> {
    return this.apiService
      .delete<WebApiResponse<QuoteTripLeg>>(`${this._baseEndPoint}/remove`, quoteTripLeg)
      .pipe(tap(() => this.notifyChanged()));
  }
}
