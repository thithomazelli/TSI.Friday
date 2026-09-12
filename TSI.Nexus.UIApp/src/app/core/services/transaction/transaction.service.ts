import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiType } from '../../enums';
import { Observable, map, tap } from 'rxjs';
import { PagedRequest, PagedResult, Transaction } from '../../models';
import { toPagedQueryString } from '../../utilities/paged-request.utils';
import { ApiService, WebApiResponse } from '@nexus/core';

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  private _baseEndPoint = ApiType.Transactions;
  // See event.service.ts for why this is a tick counter rather than a BehaviorSubject<void>.
  private readonly _changedTick = signal(0);

  readonly transactionChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<Transaction[]>> {
    return this.apiService.get<WebApiResponse<Transaction[]>>(`${this._baseEndPoint}/getAll`);
  }

  getAllPaged(request: PagedRequest): Observable<PagedResult<Transaction>> {
    return this.apiService
      .get<
        WebApiResponse<PagedResult<Transaction>>
      >(`${this._baseEndPoint}/getAllPaged?${toPagedQueryString(request)}`)
      .pipe(map((response) => response.data));
  }

  getById(transactionId: string): Observable<WebApiResponse<Transaction>> {
    return this.apiService.get<WebApiResponse<Transaction>>(
      `${this._baseEndPoint}/getById/${transactionId}`,
    );
  }

  getByBusinessPartnerId(
    businessPartnerId: string,
  ): Observable<WebApiResponse<Transaction[]>> {
    return this.apiService.get<
      WebApiResponse<Transaction[]>
    >(`${this._baseEndPoint}/getByBusinessPartnerId/${businessPartnerId}`);
  }

  refreshTransactions(): Observable<WebApiResponse<Transaction[]>> {
    return this.getAll();
  }

  add(transaction: Transaction): Observable<WebApiResponse<Transaction>> {
    return this.apiService
      .post<
        WebApiResponse<Transaction>
      >(`${this._baseEndPoint}/add`, transaction)
      .pipe(tap(() => this.notifyChanged()));
  }

  update(transaction: Transaction): Observable<WebApiResponse<Transaction>> {
    return this.apiService
      .put<
        WebApiResponse<Transaction>
      >(`${this._baseEndPoint}/update`, transaction)
      .pipe(tap(() => this.notifyChanged()));
  }

  delete(transaction: Transaction): Observable<WebApiResponse<Transaction>> {
    return this.apiService
      .delete<
        WebApiResponse<Transaction>
      >(`${this._baseEndPoint}/remove`, transaction)
      .pipe(tap(() => this.notifyChanged()));
  }
}
