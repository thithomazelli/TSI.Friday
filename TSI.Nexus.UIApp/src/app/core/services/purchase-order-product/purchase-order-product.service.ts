import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiType, ResponseStatus } from '../../enums';
import { PurchaseOrderProduct } from '../../models';
import { ApiService, WebApiResponse } from '@nexus/core';
import { Observable, Subject, map, of, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PurchaseOrderProductService {
  private _baseEndPoint = ApiType.PurchaseOrderProducts;
  // See event.service.ts for why this is a tick counter rather than a BehaviorSubject<void>.
  private readonly _changedTick = signal(0);
  // See order-product.service.ts for why this stays a Subject (one-shot event, not state).
  private _purchaseOrderProductAdded$ = new Subject<PurchaseOrderProduct>();

  readonly purchaseOrderProductChanged$: Observable<void> = toObservable(this._changedTick).pipe(
    map(() => undefined),
  );
  purchaseOrderProductAdded$ = this._purchaseOrderProductAdded$.asObservable();

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<PurchaseOrderProduct[]>> {
    return this.apiService.get<WebApiResponse<PurchaseOrderProduct[]>>(`${this._baseEndPoint}/getAll`);
  }

  getByEntityId(
    id: string,
    entity: string,
  ): Observable<WebApiResponse<PurchaseOrderProduct[]>> {
    return this.apiService.get<
      WebApiResponse<PurchaseOrderProduct[]>
    >(`${this._baseEndPoint}/getBy${entity}Id/${id}`);
  }

  add(
    purchaseOrderProduct: PurchaseOrderProduct,
  ): Observable<WebApiResponse<PurchaseOrderProduct>> {
    return this.apiService
      .post<
        WebApiResponse<PurchaseOrderProduct>
      >(`${this._baseEndPoint}/add`, purchaseOrderProduct)
      .pipe(tap(() => this.notifyChanged()));
  }

  addTemporary(
    purchaseOrderProduct: PurchaseOrderProduct,
  ): Observable<WebApiResponse<PurchaseOrderProduct>> {
    this._purchaseOrderProductAdded$.next(purchaseOrderProduct);
    return of({
      data: purchaseOrderProduct,
      message: 'Item de pedido adicionado temporariamente',
      status: ResponseStatus.Success,
    });
  }

  update(
    purchaseOrderProduct: PurchaseOrderProduct,
  ): Observable<WebApiResponse<PurchaseOrderProduct>> {
    return this.apiService
      .put<
        WebApiResponse<PurchaseOrderProduct>
      >(`${this._baseEndPoint}/update`, purchaseOrderProduct)
      .pipe(tap(() => this.notifyChanged()));
  }

  delete(
    purchaseOrderProduct: PurchaseOrderProduct,
  ): Observable<WebApiResponse<PurchaseOrderProduct>> {
    return this.apiService
      .delete<
        WebApiResponse<PurchaseOrderProduct>
      >(`${this._baseEndPoint}/remove`, purchaseOrderProduct)
      .pipe(tap(() => this.notifyChanged()));
  }
}
