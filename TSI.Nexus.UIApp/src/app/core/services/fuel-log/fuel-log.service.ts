import { Injectable } from '@angular/core';
import { ApiService, ApiType, PagedRequest, PagedResult, WebApiResponse } from '@nexus/core';
import { FuelLog } from '@nexus/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { toPagedQueryString } from '../../utilities/paged-request.utils';

@Injectable({ providedIn: 'root' })
export class FuelLogService {
  private _baseEndPoint = ApiType.FuelLogs;
  private _fuelLogChangedSubject = new BehaviorSubject<void>(undefined);
  fuelLogChanged$ = this._fuelLogChangedSubject.asObservable();

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
      .pipe(tap(() => this._fuelLogChangedSubject.next()));
  }

  update(fuelLog: FuelLog): Observable<WebApiResponse<FuelLog>> {
    return this.apiService
      .put<WebApiResponse<FuelLog>>(`${this._baseEndPoint}/update`, fuelLog)
      .pipe(tap(() => this._fuelLogChangedSubject.next()));
  }

  delete(fuelLog: FuelLog): Observable<WebApiResponse<FuelLog>> {
    return this.apiService
      .delete<WebApiResponse<FuelLog>>(`${this._baseEndPoint}/remove`, fuelLog)
      .pipe(tap(() => this._fuelLogChangedSubject.next()));
  }
}
