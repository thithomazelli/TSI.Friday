import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiService, ApiType, PagedRequest, PagedResult, WebApiResponse } from '@nexus/core';
import { Vehicle } from '@nexus/core';
import { Observable } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { toPagedQueryString } from '../../utilities/paged-request.utils';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private _baseEndPoint = ApiType.Vehicles;
  // See feature-flag.service.ts/product.service.ts/driver.service.ts for the full rationale:
  // several forms/pickers/alerts across the app each want "the vehicle list" at roughly the same
  // time - null means "not loaded yet" and is filtered out of vehicles$ below; the first consumer
  // triggers the fetch (constructor), every later one reads the cached value, load()/add()/
  // update()/delete() invalidate it by re-fetching.
  private readonly _vehicles = signal<WebApiResponse<Vehicle[]> | null>(null);
  private readonly _changedTick = signal(0);

  readonly vehicles$: Observable<WebApiResponse<Vehicle[]>> = toObservable(this._vehicles).pipe(
    filter((v): v is WebApiResponse<Vehicle[]> => v !== null),
  );
  readonly vehicleChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));

  constructor(private apiService: ApiService) {
    this.load();
  }

  private load(): void {
    this.apiService
      .get<WebApiResponse<Vehicle[]>>(`${this._baseEndPoint}/getAll`)
      .subscribe((response) => this._vehicles.set(response));
  }

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  getAll(): Observable<WebApiResponse<Vehicle[]>> {
    return this.vehicles$;
  }

  // Server-side paged/sorted/filtered listing for the Vehicles grid - unlike getAll() above,
  // used only by the main listing screen, never by pickers/forms that need the whole fleet.
  getAllPaged(request: PagedRequest): Observable<PagedResult<Vehicle>> {
    return this.apiService
      .get<
        WebApiResponse<PagedResult<Vehicle>>
      >(`${this._baseEndPoint}/getAllPaged?${toPagedQueryString(request)}`)
      .pipe(map((response) => response.data!));
  }

  getById(id: string): Observable<WebApiResponse<Vehicle>> {
    return this.apiService.get<WebApiResponse<Vehicle>>(
      `${this._baseEndPoint}/getById/${id}`,
    );
  }

  getAvailable(): Observable<WebApiResponse<Vehicle[]>> {
    return this.apiService.get<WebApiResponse<Vehicle[]>>(
      `${this._baseEndPoint}/getAvailable`,
    );
  }

  // Distinct from the internal load() trigger: a caller here wants the freshly-fetched list
  // back directly (e.g. a manual "refresh" button updating its own grid + showing a toast), so
  // this always does its own live GET rather than replaying the shared cache. It also invalidates
  // the shared vehicles$ cache so the next getAll() call elsewhere doesn't serve stale data either.
  refresh(): Observable<WebApiResponse<Vehicle[]>> {
    return this.apiService
      .get<WebApiResponse<Vehicle[]>>(`${this._baseEndPoint}/getAll`)
      .pipe(tap(() => this.load()));
  }

  add(vehicle: Vehicle): Observable<WebApiResponse<Vehicle>> {
    return this.apiService
      .post<WebApiResponse<Vehicle>>(`${this._baseEndPoint}/add`, vehicle)
      .pipe(
        tap(() => {
          this.load();
          this.notifyChanged();
        }),
      );
  }

  update(vehicle: Vehicle): Observable<WebApiResponse<Vehicle>> {
    return this.apiService
      .put<WebApiResponse<Vehicle>>(`${this._baseEndPoint}/update`, vehicle)
      .pipe(
        tap(() => {
          this.load();
          this.notifyChanged();
        }),
      );
  }

  delete(vehicle: Vehicle): Observable<WebApiResponse<Vehicle>> {
    return this.apiService
      .delete<WebApiResponse<Vehicle>>(`${this._baseEndPoint}/remove`, vehicle)
      .pipe(
        tap(() => {
          this.load();
          this.notifyChanged();
        }),
      );
  }
}
