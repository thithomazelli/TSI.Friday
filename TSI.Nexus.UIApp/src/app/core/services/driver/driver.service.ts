import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiService, ApiType, PagedRequest, PagedResult, WebApiResponse } from '@nexus/core';
import { Driver } from '@nexus/core';
import { Observable } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { toPagedQueryString } from '../../utilities/paged-request.utils';

@Injectable({ providedIn: 'root' })
export class DriverService {
  private _baseEndPoint = ApiType.Drivers;
  // See feature-flag.service.ts/product.service.ts for the full rationale: several
  // forms/pickers/alerts across the app each want "the driver list" at roughly the same time -
  // null means "not loaded yet" and is filtered out of drivers$ below; the first consumer
  // triggers the fetch (constructor), every later one reads the cached value, load()/add()/
  // update()/delete() invalidate it by re-fetching.
  private readonly _drivers = signal<WebApiResponse<Driver[]> | null>(null);
  private readonly _changedTick = signal(0);

  readonly drivers$: Observable<WebApiResponse<Driver[]>> = toObservable(this._drivers).pipe(
    filter((v): v is WebApiResponse<Driver[]> => v !== null),
  );
  readonly driverChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));

  constructor(private apiService: ApiService) {
    this.load();
  }

  private load(): void {
    this.apiService
      .get<WebApiResponse<Driver[]>>(`${this._baseEndPoint}/getAll`)
      .subscribe((response) => this._drivers.set(response));
  }

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

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

  // Distinct from the internal load() trigger: a caller here wants the freshly-fetched list
  // back directly (e.g. a manual "refresh" button updating its own grid + showing a toast), so
  // this always does its own live GET rather than replaying the shared cache. It also invalidates
  // the shared drivers$ cache so the next getAll() call elsewhere doesn't serve stale data either.
  refresh(): Observable<WebApiResponse<Driver[]>> {
    return this.apiService
      .get<WebApiResponse<Driver[]>>(`${this._baseEndPoint}/getAll`)
      .pipe(tap(() => this.load()));
  }

  add(driver: Driver): Observable<WebApiResponse<Driver>> {
    return this.apiService
      .post<WebApiResponse<Driver>>(`${this._baseEndPoint}/add`, driver)
      .pipe(
        tap(() => {
          this.load();
          this.notifyChanged();
        }),
      );
  }

  update(driver: Driver): Observable<WebApiResponse<Driver>> {
    return this.apiService
      .put<WebApiResponse<Driver>>(`${this._baseEndPoint}/update`, driver)
      .pipe(
        tap(() => {
          this.load();
          this.notifyChanged();
        }),
      );
  }

  delete(driver: Driver): Observable<WebApiResponse<Driver>> {
    return this.apiService
      .delete<WebApiResponse<Driver>>(`${this._baseEndPoint}/remove`, driver)
      .pipe(
        tap(() => {
          this.load();
          this.notifyChanged();
        }),
      );
  }
}
