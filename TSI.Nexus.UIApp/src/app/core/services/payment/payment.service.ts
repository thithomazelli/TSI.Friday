import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiType } from '../../enums';
import { ApiService } from '../api/api.service';
import { WebApiResponse } from '../../utilities';
import { Payment, PagedRequest, PagedResult } from '../../models';
import { toPagedQueryString } from '../../utilities/paged-request.utils';
import { Observable, map, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private _baseEndPoint = ApiType.Payments;
  // See event.service.ts for why this is a tick counter rather than a BehaviorSubject<void>.
  private readonly _changedTick = signal(0);

  readonly paymentChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<Payment[]>> {
    return this.apiService.get<WebApiResponse<Payment[]>>(`${this._baseEndPoint}/getAll`);
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
    return this.apiService.get<
      WebApiResponse<Payment[]>
    >(`${this._baseEndPoint}/getBy${entity}Id/${id}`);
  }

  getDelayed(): Observable<WebApiResponse<Payment[]>> {
    return this.apiService.get<WebApiResponse<Payment[]>>(
      `${this._baseEndPoint}/getDelayed`,
    );
  }

  add(payment: Payment): Observable<WebApiResponse<Payment>> {
    return this.apiService
      .post<WebApiResponse<Payment>>(`${this._baseEndPoint}/add`, payment)
      .pipe(tap(() => this.notifyChanged()));
  }

  update(payment: Payment): Observable<WebApiResponse<Payment>> {
    return this.apiService
      .put<WebApiResponse<Payment>>(`${this._baseEndPoint}/update`, payment)
      .pipe(tap(() => this.notifyChanged()));
  }

  delete(payment: Payment): Observable<WebApiResponse<Payment>> {
    return this.apiService
      .delete<WebApiResponse<Payment>>(`${this._baseEndPoint}/remove`, payment)
      .pipe(tap(() => this.notifyChanged()));
  }
}
