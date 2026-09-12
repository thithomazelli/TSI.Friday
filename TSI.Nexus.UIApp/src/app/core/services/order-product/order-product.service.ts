import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiType, ResponseStatus } from '../../enums';
import { OrderProduct } from '../../models';
import { ApiService, WebApiResponse } from '@nexus/core';
import { Observable, Subject, map, of, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class OrderProductService {
  private _baseEndPoint = ApiType.OrderProducts;
  // See event.service.ts for why this is a tick counter rather than a BehaviorSubject<void>.
  private readonly _changedTick = signal(0);
  // A genuine one-shot event bus (order-form.component.ts reacts to each temporary add exactly
  // once) rather than state - a Signal always has a "current value" every consumer sees, which
  // would either replay stale additions to a late subscriber or need extra bookkeeping to avoid
  // it. RxJS Subject is the right tool here, kept as intentional per spec-12 section 4.2.
  private _orderProductAdded$ = new Subject<OrderProduct>();

  readonly orderProductChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));
  orderProductAdded$ = this._orderProductAdded$.asObservable();

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<OrderProduct[]>> {
    return this.apiService.get<WebApiResponse<OrderProduct[]>>(`${this._baseEndPoint}/getAll`);
  }

  getByEntityId(
    id: string,
    entity: string,
  ): Observable<WebApiResponse<OrderProduct[]>> {
    return this.apiService.get<
      WebApiResponse<OrderProduct[]>
    >(`${this._baseEndPoint}/getBy${entity}Id/${id}`);
  }

  add(orderProduct: OrderProduct): Observable<WebApiResponse<OrderProduct>> {
    return this.apiService
      .post<
        WebApiResponse<OrderProduct>
      >(`${this._baseEndPoint}/add`, orderProduct)
      .pipe(tap(() => this.notifyChanged()));
  }

  addTemporary(
    orderProduct: OrderProduct,
  ): Observable<WebApiResponse<OrderProduct>> {
    this._orderProductAdded$.next(orderProduct);
    return of({
      data: orderProduct,
      message: 'Item de pedido adicionado temporariamente',
      status: ResponseStatus.Success,
    });
  }

  update(orderProduct: OrderProduct): Observable<WebApiResponse<OrderProduct>> {
    return this.apiService
      .put<
        WebApiResponse<OrderProduct>
      >(`${this._baseEndPoint}/update`, orderProduct)
      .pipe(tap(() => this.notifyChanged()));
  }

  delete(orderProduct: OrderProduct): Observable<WebApiResponse<OrderProduct>> {
    return this.apiService
      .delete<
        WebApiResponse<OrderProduct>
      >(`${this._baseEndPoint}/remove`, orderProduct)
      .pipe(tap(() => this.notifyChanged()));
  }
}
