import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiService, ApiType, PagedRequest, PagedResult, WebApiResponse, Quote } from '@nexus/core';
import { toPagedQueryString } from '../../utilities/paged-request.utils';

@Injectable({
  providedIn: 'root',
})
export class QuoteService {
  private _baseEndPoint = ApiType.Quotes;
  // See event.service.ts for why this is a tick counter rather than a BehaviorSubject<void>.
  private readonly _changedTick = signal(0);

  readonly quoteChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<Quote[]>> {
    return this.apiService.get<WebApiResponse<Quote[]>>(`${this._baseEndPoint}/getAll`);
  }

  getAllPaged(request: PagedRequest): Observable<PagedResult<Quote>> {
    return this.apiService
      .get<
        WebApiResponse<PagedResult<Quote>>
      >(`${this._baseEndPoint}/getAllPaged?${toPagedQueryString(request)}`)
      .pipe(map((response) => response.data));
  }

  getById(quoteId: string): Observable<WebApiResponse<Quote>> {
    return this.apiService.get<WebApiResponse<Quote>>(
      `${this._baseEndPoint}/getById/${quoteId}`,
    );
  }

  getByQuoteNumber(quoteNumber: string): Observable<WebApiResponse<Quote>> {
    return this.apiService.get<WebApiResponse<Quote>>(
      `${this._baseEndPoint}/getByQuoteNumber/${quoteNumber}`,
    );
  }

  getPdf(quoteId: string): Observable<Blob> {
    return this.apiService.getBlob(`${this._baseEndPoint}/${quoteId}/Pdf`);
  }

  getByBusinessPartnerId(
    businessPartnerId: string,
  ): Observable<WebApiResponse<Quote[]>> {
    return this.apiService.get<
      WebApiResponse<Quote[]>
    >(`${this._baseEndPoint}/getByBusinessPartnerId/${businessPartnerId}`);
  }

  getByProductId(productId: string): Observable<WebApiResponse<Quote[]>> {
    return this.apiService.get<
      WebApiResponse<Quote[]>
    >(`${this._baseEndPoint}/getByProductId/${productId}`);
  }

  refreshQuotes(): Observable<WebApiResponse<Quote[]>> {
    return this.getAll();
  }

  add(quote: Quote): Observable<WebApiResponse<Quote>> {
    return this.apiService
      .post<WebApiResponse<Quote>>(`${this._baseEndPoint}/add`, quote)
      .pipe(tap(() => this.notifyChanged()));
  }

  update(quote: Quote): Observable<WebApiResponse<Quote>> {
    return this.apiService
      .put<WebApiResponse<Quote>>(`${this._baseEndPoint}/update`, quote)
      .pipe(tap(() => this.notifyChanged()));
  }

  delete(quote: Quote): Observable<WebApiResponse<Quote>> {
    return this.apiService
      .delete<WebApiResponse<Quote>>(`${this._baseEndPoint}/remove`, quote)
      .pipe(tap(() => this.notifyChanged()));
  }

  convertToOrder(quote: Quote): Observable<WebApiResponse<any>> {
    return this.apiService
      .post<WebApiResponse<any>>(`${this._baseEndPoint}/convertToOrder`, quote)
      .pipe(tap(() => this.notifyChanged()));
  }

  convertToTrip(quote: Quote): Observable<WebApiResponse<any>> {
    return this.apiService
      .post<WebApiResponse<any>>(`${this._baseEndPoint}/convertToTrip`, quote)
      .pipe(tap(() => this.notifyChanged()));
  }
}
