import { Injectable } from '@angular/core';
import { ApiService, ApiType, PagedRequest, PagedResult, WebApiResponse } from '@nexus/core';
import { Vehicle } from '@nexus/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { map, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';
import { toPagedQueryString } from '../../utilities/paged-request.utils';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private _baseEndPoint = ApiType.Vehicles;
  private _refresh$ = new Subject<void>();
  private _vehicleChangedSubject = new BehaviorSubject<void>(undefined);
  vehicleChanged$ = this._vehicleChangedSubject.asObservable();

  // Shared stream behind getAll(): several forms/pickers/alerts across the app each want "the
  // vehicle list" at roughly the same time, and previously fired one independent HTTP GET apiece.
  // shareReplay(1) means the first subscriber triggers the fetch and every other consumer just
  // replays that same in-flight/cached response - the same pattern already used by
  // FeatureFlagService/ProductService for the same reason.
  readonly vehicles$: Observable<WebApiResponse<Vehicle[]>> = this._refresh$.pipe(
    startWith(undefined),
    switchMap(() =>
      this.apiService.get<WebApiResponse<Vehicle[]>>(`${this._baseEndPoint}/getAll`),
    ),
    shareReplay(1),
  );

  constructor(private apiService: ApiService) {}

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

  // Distinct from the internal _refresh$ trigger: a caller here wants the freshly-fetched list
  // back directly (e.g. a manual "refresh" button updating its own grid + showing a toast), so
  // this always does its own live GET rather than replaying the shared cache. It also invalidates
  // the shared stream so the next getAll() call elsewhere doesn't serve stale cached data either.
  refresh(): Observable<WebApiResponse<Vehicle[]>> {
    return this.apiService
      .get<WebApiResponse<Vehicle[]>>(`${this._baseEndPoint}/getAll`)
      .pipe(tap(() => this._refresh$.next()));
  }

  add(vehicle: Vehicle): Observable<WebApiResponse<Vehicle>> {
    return this.apiService
      .post<WebApiResponse<Vehicle>>(`${this._baseEndPoint}/add`, vehicle)
      .pipe(
        tap(() => {
          this._refresh$.next();
          this._vehicleChangedSubject.next();
        }),
      );
  }

  update(vehicle: Vehicle): Observable<WebApiResponse<Vehicle>> {
    return this.apiService
      .put<WebApiResponse<Vehicle>>(`${this._baseEndPoint}/update`, vehicle)
      .pipe(
        tap(() => {
          this._refresh$.next();
          this._vehicleChangedSubject.next();
        }),
      );
  }

  delete(vehicle: Vehicle): Observable<WebApiResponse<Vehicle>> {
    return this.apiService
      .delete<WebApiResponse<Vehicle>>(`${this._baseEndPoint}/remove`, vehicle)
      .pipe(
        tap(() => {
          this._refresh$.next();
          this._vehicleChangedSubject.next();
        }),
      );
  }
}
