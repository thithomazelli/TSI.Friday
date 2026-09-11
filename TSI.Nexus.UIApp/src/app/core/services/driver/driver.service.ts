import { Injectable } from '@angular/core';
import { ApiService, ApiType, PagedRequest, PagedResult, WebApiResponse } from '@nexus/core';
import { Driver } from '@nexus/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { map, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';
import { toPagedQueryString } from '../../utilities/paged-request.utils';

@Injectable({ providedIn: 'root' })
export class DriverService {
  private _baseEndPoint = ApiType.Drivers;
  private _refresh$ = new Subject<void>();
  private _driverChangedSubject = new BehaviorSubject<void>(undefined);
  driverChanged$ = this._driverChangedSubject.asObservable();

  // Shared stream behind getAll(): several forms/pickers/alerts across the app each want "the
  // driver list" at roughly the same time, and previously fired one independent HTTP GET apiece.
  // shareReplay(1) means the first subscriber triggers the fetch and every other consumer just
  // replays that same in-flight/cached response - the same pattern already used by
  // FeatureFlagService/ProductService for the same reason.
  readonly drivers$: Observable<WebApiResponse<Driver[]>> = this._refresh$.pipe(
    startWith(undefined),
    switchMap(() =>
      this.apiService.get<WebApiResponse<Driver[]>>(`${this._baseEndPoint}/getAll`),
    ),
    shareReplay(1),
  );

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<Driver[]>> {
    return this.drivers$;
  }

  // Server-side paged/sorted/filtered listing for the Drivers grid - unlike getAll() above,
  // used only by the main listing screen, never by pickers/forms that need every driver.
  getAllPaged(request: PagedRequest): Observable<PagedResult<Driver>> {
    return this.apiService
      .get<
        WebApiResponse<PagedResult<Driver>>
      >(`${this._baseEndPoint}/getAllPaged?${toPagedQueryString(request)}`)
      .pipe(map((response) => response.data!));
  }

  getById(id: string): Observable<WebApiResponse<Driver>> {
    return this.apiService.get<WebApiResponse<Driver>>(
      `${this._baseEndPoint}/getById/${id}`,
    );
  }

  getActive(): Observable<WebApiResponse<Driver[]>> {
    return this.apiService.get<WebApiResponse<Driver[]>>(
      `${this._baseEndPoint}/getActive`,
    );
  }

  /**
   * When daysAhead is omitted, the backend uses the lead time configured for the
   * "DriverLicenseExpiry" alert (see Configuração > Alertas), 60 days by default.
   */
  getExpiringLicenses(daysAhead?: number): Observable<WebApiResponse<Driver[]>> {
    const query = daysAhead != null ? `?daysAhead=${daysAhead}` : '';
    return this.apiService.get<WebApiResponse<Driver[]>>(
      `${this._baseEndPoint}/getExpiringLicenses${query}`,
    );
  }

  // Distinct from the internal _refresh$ trigger: a caller here wants the freshly-fetched list
  // back directly (e.g. a manual "refresh" button updating its own grid + showing a toast), so
  // this always does its own live GET rather than replaying the shared cache. It also invalidates
  // the shared stream so the next getAll() call elsewhere doesn't serve stale cached data either.
  refresh(): Observable<WebApiResponse<Driver[]>> {
    return this.apiService
      .get<WebApiResponse<Driver[]>>(`${this._baseEndPoint}/getAll`)
      .pipe(tap(() => this._refresh$.next()));
  }

  add(driver: Driver): Observable<WebApiResponse<Driver>> {
    return this.apiService
      .post<WebApiResponse<Driver>>(`${this._baseEndPoint}/add`, driver)
      .pipe(
        tap(() => {
          this._refresh$.next();
          this._driverChangedSubject.next();
        }),
      );
  }

  update(driver: Driver): Observable<WebApiResponse<Driver>> {
    return this.apiService
      .put<WebApiResponse<Driver>>(`${this._baseEndPoint}/update`, driver)
      .pipe(
        tap(() => {
          this._refresh$.next();
          this._driverChangedSubject.next();
        }),
      );
  }

  delete(driver: Driver): Observable<WebApiResponse<Driver>> {
    return this.apiService
      .delete<WebApiResponse<Driver>>(`${this._baseEndPoint}/remove`, driver)
      .pipe(
        tap(() => {
          this._refresh$.next();
          this._driverChangedSubject.next();
        }),
      );
  }
}
