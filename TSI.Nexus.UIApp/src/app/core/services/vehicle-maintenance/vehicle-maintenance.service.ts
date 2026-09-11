import { Injectable } from '@angular/core';
import { ApiService, ApiType, PagedRequest, PagedResult, WebApiResponse } from '@nexus/core';
import { VehicleMaintenance } from '@nexus/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { toPagedQueryString } from '../../utilities/paged-request.utils';

@Injectable({ providedIn: 'root' })
export class VehicleMaintenanceService {
  private _baseEndPoint = ApiType.VehicleMaintenances;
  private _maintenanceChangedSubject = new BehaviorSubject<void>(undefined);
  maintenanceChanged$ = this._maintenanceChangedSubject.asObservable();

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<VehicleMaintenance[]>> {
    return this.apiService.get<WebApiResponse<VehicleMaintenance[]>>(
      `${this._baseEndPoint}/getAll`,
    );
  }

  getById(id: string): Observable<WebApiResponse<VehicleMaintenance>> {
    return this.apiService.get<WebApiResponse<VehicleMaintenance>>(
      `${this._baseEndPoint}/getById/${id}`,
    );
  }

  getByVehicle(
    vehicleId: string,
  ): Observable<WebApiResponse<VehicleMaintenance[]>> {
    return this.apiService.get<WebApiResponse<VehicleMaintenance[]>>(
      `${this._baseEndPoint}/getByVehicle/${vehicleId}`,
    );
  }

  // Server-side paged/sorted/filtered listing for the top-level Vehicle Maintenances grid - the
  // tab embedded inside a Vehicle's details page keeps using getByVehicle() above instead.
  getAllPaged(request: PagedRequest): Observable<PagedResult<VehicleMaintenance>> {
    return this.apiService
      .get<
        WebApiResponse<PagedResult<VehicleMaintenance>>
      >(`${this._baseEndPoint}/getAllPaged?${toPagedQueryString(request)}`)
      .pipe(map((response) => response.data!));
  }

  add(
    maintenance: VehicleMaintenance,
  ): Observable<WebApiResponse<VehicleMaintenance>> {
    return this.apiService
      .post<WebApiResponse<VehicleMaintenance>>(
        `${this._baseEndPoint}/add`,
        maintenance,
      )
      .pipe(tap(() => this._maintenanceChangedSubject.next()));
  }

  update(
    maintenance: VehicleMaintenance,
  ): Observable<WebApiResponse<VehicleMaintenance>> {
    return this.apiService
      .put<WebApiResponse<VehicleMaintenance>>(
        `${this._baseEndPoint}/update`,
        maintenance,
      )
      .pipe(tap(() => this._maintenanceChangedSubject.next()));
  }

  delete(
    maintenance: VehicleMaintenance,
  ): Observable<WebApiResponse<VehicleMaintenance>> {
    return this.apiService
      .delete<WebApiResponse<VehicleMaintenance>>(
        `${this._baseEndPoint}/remove`,
        maintenance,
      )
      .pipe(tap(() => this._maintenanceChangedSubject.next()));
  }
}
