import { Injectable } from '@angular/core';
import { ApiType } from '../../enums';
import { ApiService } from '../api/api.service';
import { WebApiResponse } from '../../utilities';
import { Payment, PagedRequest, PagedResult } from '../../models';
import { toPagedQueryString } from '../../utilities/paged-request.utils';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private _baseEndPoint = ApiType.Payments;
  private _payments$ = new BehaviorSubject<Payment[]>([]);
  private _paymentChangedSubject = new BehaviorSubject<void>(undefined);

  paymentChanged$ = this._paymentChangedSubject.asObservable();

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<Payment[]>> {
    return this.apiService
      .get<WebApiResponse<Payment[]>>(`${this._baseEndPoint}/getAll`)
      .pipe(
        tap((response) => {
          this._payments$.next(response.data);
        }),
      );
  }

  getAllPaged(request: PagedRequest): Observable<PagedResult<Payment>> {
    return this.apiService
      .get<
        WebApiResponse<PagedResult<Payment>>
      >(`${this._baseEndPoint}/getAllPaged?${toPagedQueryString(request)}`)
      .pipe(map((response) => response.data));
  }

  getByEntityId(
    id: string,
    entity: string,
  ): Observable<WebApiResponse<Payment[]>> {
    return this.apiService
      .get<
        WebApiResponse<Payment[]>
      >(`${this._baseEndPoint}/getBy${entity}Id/${id}`)
      .pipe(
        tap((response) => {
          this._payments$.next(response.data);
        }),
      );
  }

  getDelayed(): Observable<WebApiResponse<Payment[]>> {
    return this.apiService.get<WebApiResponse<Payment[]>>(
      `${this._baseEndPoint}/getDelayed`,
    );
  }

  add(payment: Payment): Observable<WebApiResponse<Payment>> {
    return this.apiService
      .post<WebApiResponse<Payment>>(`${this._baseEndPoint}/add`, payment)
      .pipe(tap(() => this._paymentChangedSubject.next()));
  }

  update(payment: Payment): Observable<WebApiResponse<Payment>> {
    return this.apiService
      .put<WebApiResponse<Payment>>(`${this._baseEndPoint}/update`, payment)
      .pipe(tap(() => this._paymentChangedSubject.next()));
  }

  delete(payment: Payment): Observable<WebApiResponse<Payment>> {
    return this.apiService
      .delete<WebApiResponse<Payment>>(`${this._baseEndPoint}/remove`, payment)
      .pipe(tap(() => this._paymentChangedSubject.next()));
  }
}
