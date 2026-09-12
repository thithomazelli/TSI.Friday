import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiService, ApiType, PagedRequest, PagedResult, WebApiResponse, Order } from '@nexus/core';
import { toPagedQueryString } from '../../utilities/paged-request.utils';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private _baseEndPoint = ApiType.Orders;
  // See event.service.ts for why this is a tick counter rather than a BehaviorSubject<void>.
  private readonly _changedTick = signal(0);

  readonly orderChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<Order[]>> {
    return this.apiService.get<WebApiResponse<Order[]>>(`${this._baseEndPoint}/getAll`);
  }

  getAllPaged(request: PagedRequest): Observable<PagedResult<Order>> {
    return this.apiService
      .get<
        WebApiResponse<PagedResult<Order>>
      >(`${this._baseEndPoint}/getAllPaged?${toPagedQueryString(request)}`)
      .pipe(map((response) => response.data));
  }

  getById(orderId: string): Observable<WebApiResponse<Order>> {
    return this.apiService.get<WebApiResponse<Order>>(
      `${ApiType.Orders}/getById/${orderId}`,
    );
  }

  getPdf(orderId: string): Observable<Blob> {
    return this.apiService.getBlob(`${this._baseEndPoint}/${orderId}/Pdf`);
  }

  getByBusinessPartnerId(
    businessPartnerId: string,
  ): Observable<WebApiResponse<Order[]>> {
    return this.apiService.get<
      WebApiResponse<Order[]>
    >(`${this._baseEndPoint}/getByBusinessPartnerId/${businessPartnerId}`);
  }

  refreshOrders(): Observable<WebApiResponse<Order[]>> {
    return this.getAll();
  }

  add(order: Order): Observable<WebApiResponse<Order>> {
    return this.apiService
      .post<WebApiResponse<Order>>(`${this._baseEndPoint}/add`, order)
      .pipe(tap(() => this.notifyChanged()));
  }

  update(order: Order): Observable<WebApiResponse<Order>> {
    return this.apiService
      .put<WebApiResponse<Order>>(`${this._baseEndPoint}/update`, order)
      .pipe(tap(() => this.notifyChanged()));
  }

  delete(order: Order): Observable<WebApiResponse<Order>> {
    return this.apiService
      .delete<WebApiResponse<Order>>(`${this._baseEndPoint}/remove`, order)
      .pipe(tap(() => this.notifyChanged()));
  }
}
