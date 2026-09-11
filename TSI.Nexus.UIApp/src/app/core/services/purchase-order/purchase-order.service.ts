import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  ApiService,
  ApiType,
  PagedRequest,
  PagedResult,
  WebApiResponse,
  PurchaseOrder,
} from '@nexus/core';
import { toPagedQueryString } from '../../utilities/paged-request.utils';

@Injectable({
  providedIn: 'root',
})
export class PurchaseOrderService {
  private _baseEndPoint = ApiType.PurchaseOrders;
  private _purchaseOrders$ = new BehaviorSubject<PurchaseOrder[]>([]);
  private _purchaseOrderChangedSubject = new BehaviorSubject<void>(undefined);
  purchaseOrderChanged$ = this._purchaseOrderChangedSubject.asObservable();

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<PurchaseOrder[]>> {
    return this.apiService
      .get<WebApiResponse<PurchaseOrder[]>>(`${this._baseEndPoint}/getAll`)
      .pipe(
        tap((response) => {
          this._purchaseOrders$.next(response.data);
        }),
      );
  }

  // Server-side paged/sorted/filtered listing for the top-level Purchase Orders grid - the tab
  // embedded inside a Supplier's details page keeps using getByBusinessPartnerId() instead.
  getAllPaged(request: PagedRequest): Observable<PagedResult<PurchaseOrder>> {
    return this.apiService
      .get<
        WebApiResponse<PagedResult<PurchaseOrder>>
      >(`${this._baseEndPoint}/getAllPaged?${toPagedQueryString(request)}`)
      .pipe(map((response) => response.data!));
  }

  getById(purchaseOrderId: string): Observable<WebApiResponse<PurchaseOrder>> {
    return this.apiService.get<WebApiResponse<PurchaseOrder>>(
      `${this._baseEndPoint}/getById/${purchaseOrderId}`,
    );
  }

  getByBusinessPartnerId(
    businessPartnerId: string,
  ): Observable<WebApiResponse<PurchaseOrder[]>> {
    return this.apiService
      .get<
        WebApiResponse<PurchaseOrder[]>
      >(`${this._baseEndPoint}/getByBusinessPartnerId/${businessPartnerId}`)
      .pipe(
        tap((response) => {
          this._purchaseOrders$.next(response.data);
        }),
      );
  }

  refreshPurchaseOrders(): Observable<WebApiResponse<PurchaseOrder[]>> {
    return this.getAll();
  }

  add(purchaseOrder: PurchaseOrder): Observable<WebApiResponse<PurchaseOrder>> {
    return this.apiService
      .post<
        WebApiResponse<PurchaseOrder>
      >(`${this._baseEndPoint}/add`, purchaseOrder)
      .pipe(tap(() => this._purchaseOrderChangedSubject.next()));
  }

  update(purchaseOrder: PurchaseOrder): Observable<WebApiResponse<PurchaseOrder>> {
    return this.apiService
      .put<
        WebApiResponse<PurchaseOrder>
      >(`${this._baseEndPoint}/update`, purchaseOrder)
      .pipe(tap(() => this._purchaseOrderChangedSubject.next()));
  }

  delete(purchaseOrder: PurchaseOrder): Observable<WebApiResponse<PurchaseOrder>> {
    return this.apiService
      .delete<
        WebApiResponse<PurchaseOrder>
      >(`${this._baseEndPoint}/remove`, purchaseOrder)
      .pipe(tap(() => this._purchaseOrderChangedSubject.next()));
  }
}
