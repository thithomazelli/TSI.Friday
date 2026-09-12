import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiService, ApiType, PagedRequest, PagedResult, WebApiResponse } from '@nexus/core';
import { FuelLog } from '@nexus/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { toPagedQueryString } from '../../utilities/paged-request.utils';

@Injectable({ providedIn: 'root' })
export class FuelLogService {
  private _baseEndPoint = ApiType.FuelLogs;
  // See event.service.ts for why this is a tick counter rather than a BehaviorSubject<void>.
  private readonly _changedTick = signal(0);

  readonly fuelLogChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<FuelLog[]>> {
    return this.apiService.get<WebApiResponse<FuelLog[]>>(
      `${this._baseEndPoint}/getAll`,
    );
  }

  getByVehicle(vehicleId: string): Observable<WebApiResponse<FuelLog[]>> {
    return this.apiService.get<WebApiResponse<FuelLog[]>>(
      `${this._baseEndPoint}/getByVehicle/${vehicleId}`,
    );
  }

  // Server-side paged/sorted/filtered listing for the top-level Fuel Logs grid - the tab
  // embedded inside a Vehicle's details page keeps using getByVehicle() above instead.
  getAllPaged(request: PagedRequest): Observable<PagedResult<FuelLog>> {
    return this.apiService
      .get<
        WebApiResponse<PagedResult<FuelLog>>
      >(`${this._baseEndPoint}/getAllPaged?${toPagedQueryString(request)}`)
      .pipe(map((response) => response.data!));
  }

  add(fuelLog: FuelLog): Observable<WebApiResponse<FuelLog>> {
    return this.apiService
      .post<WebApiResponse<FuelLog>>(`${this._baseEndPoint}/add`, fuelLog)
      .pipe(tap(() => this.notifyChanged()));
  }

  update(fuelLog: FuelLog): Observable<WebApiResponse<FuelLog>> {
    return this.apiService
      .put<WebApiResponse<FuelLog>>(`${this._baseEndPoint}/update`, fuelLog)
      .pipe(tap(() => this.notifyChanged()));
  }

  delete(fuelLog: FuelLog): Observable<WebApiResponse<FuelLog>> {
    return this.apiService
      .delete<WebApiResponse<FuelLog>>(`${this._baseEndPoint}/remove`, fuelLog)
      .pipe(tap(() => this.notifyChanged()));
  }
}
