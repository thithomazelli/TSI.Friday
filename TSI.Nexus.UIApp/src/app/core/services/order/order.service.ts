import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService, ApiType, WebApiResponse, Order } from '@nexus/core';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private _baseEndPoint = ApiType.Orders;
  private _orders$ = new BehaviorSubject<Order[]>([]);
  private _orderChangedSubject = new BehaviorSubject<void>(undefined);
  orderChanged$ = this._orderChangedSubject.asObservable();

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<Order[]>> {
    return this.apiService
      .get<WebApiResponse<Order[]>>(`${this._baseEndPoint}/getAll`)
      .pipe(
        tap((response) => {
          this._orders$.next(response.data);
        }),
      );
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
    return this.apiService
      .get<
        WebApiResponse<Order[]>
      >(`${this._baseEndPoint}/getByBusinessPartnerId/${businessPartnerId}`)
      .pipe(
        tap((response) => {
          this._orders$.next(response.data);
        }),
      );
  }

  refreshOrders(): Observable<WebApiResponse<Order[]>> {
    return this.getAll();
  }

  add(order: Order): Observable<WebApiResponse<Order>> {
    return this.apiService
      .post<WebApiResponse<Order>>(`${this._baseEndPoint}/add`, order)
      .pipe(tap(() => this._orderChangedSubject.next()));
  }

  update(order: Order): Observable<WebApiResponse<Order>> {
    return this.apiService
      .put<WebApiResponse<Order>>(`${this._baseEndPoint}/update`, order)
      .pipe(tap(() => this._orderChangedSubject.next()));
  }

  delete(order: Order): Observable<WebApiResponse<Order>> {
    return this.apiService
      .delete<WebApiResponse<Order>>(`${this._baseEndPoint}/remove`, order)
      .pipe(tap(() => this._orderChangedSubject.next()));
  }
}
