import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiType } from '../../enums';
import { VehicleMaintenanceProduct } from '../../models';
import { ApiService, WebApiResponse } from '@nexus/core';
import { Observable, map, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class VehicleMaintenanceProductService {
  private _baseEndPoint = ApiType.VehicleMaintenanceProducts;
  // See event.service.ts for why this is a tick counter rather than a BehaviorSubject<void>.
  private readonly _changedTick = signal(0);

  readonly vehicleMaintenanceProductChanged$: Observable<void> = toObservable(this._changedTick).pipe(
    map(() => undefined),
  );

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  constructor(private apiService: ApiService) {}

  getByEntityId(
    id: string,
    entity: string,
  ): Observable<WebApiResponse<VehicleMaintenanceProduct[]>> {
    return this.apiService.get<
      WebApiResponse<VehicleMaintenanceProduct[]>
    >(`${this._baseEndPoint}/getBy${entity}Id/${id}`);
  }

  add(
    vehicleMaintenanceProduct: VehicleMaintenanceProduct,
  ): Observable<WebApiResponse<VehicleMaintenanceProduct>> {
    return this.apiService
      .post<
        WebApiResponse<VehicleMaintenanceProduct>
      >(`${this._baseEndPoint}/add`, vehicleMaintenanceProduct)
      .pipe(tap(() => this.notifyChanged()));
  }

  update(
    vehicleMaintenanceProduct: VehicleMaintenanceProduct,
  ): Observable<WebApiResponse<VehicleMaintenanceProduct>> {
    return this.apiService
      .put<
        WebApiResponse<VehicleMaintenanceProduct>
      >(`${this._baseEndPoint}/update`, vehicleMaintenanceProduct)
      .pipe(tap(() => this.notifyChanged()));
  }

  delete(
    vehicleMaintenanceProduct: VehicleMaintenanceProduct,
  ): Observable<WebApiResponse<VehicleMaintenanceProduct>> {
    return this.apiService
      .delete<
        WebApiResponse<VehicleMaintenanceProduct>
      >(`${this._baseEndPoint}/remove`, vehicleMaintenanceProduct)
      .pipe(tap(() => this.notifyChanged()));
  }
}
