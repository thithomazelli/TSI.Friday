import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiService, ApiType, PagedRequest, PagedResult, WebApiResponse, Quote } from '@nexus/core';
import { toPagedQueryString } from '../../utilities/paged-request.utils';

@Injectable({
  providedIn: 'root',
})
export class QuoteService {
  private _baseEndPoint = ApiType.Quotes;
  private _quotes$ = new BehaviorSubject<Quote[]>([]);
  private _quoteChangedSubject = new BehaviorSubject<void>(undefined);
  quoteChanged$ = this._quoteChangedSubject.asObservable();

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<Quote[]>> {
    return this.apiService
      .get<WebApiResponse<Quote[]>>(`${this._baseEndPoint}/getAll`)
      .pipe(
        tap((response) => {
          this._quotes$.next(response.data);
        }),
      );
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
    return this.apiService
      .get<
        WebApiResponse<Quote[]>
      >(`${this._baseEndPoint}/getByBusinessPartnerId/${businessPartnerId}`)
      .pipe(
        tap((response) => {
          this._quotes$.next(response.data);
        }),
      );
  }

  getByProductId(productId: string): Observable<WebApiResponse<Quote[]>> {
    return this.apiService
      .get<
        WebApiResponse<Quote[]>
      >(`${this._baseEndPoint}/getByProductId/${productId}`)
      .pipe(
        tap((response) => {
          this._quotes$.next(response.data);
        }),
      );
  }

  refreshQuotes(): Observable<WebApiResponse<Quote[]>> {
    return this.getAll();
  }

  add(quote: Quote): Observable<WebApiResponse<Quote>> {
    return this.apiService
      .post<WebApiResponse<Quote>>(`${this._baseEndPoint}/add`, quote)
      .pipe(tap(() => this._quoteChangedSubject.next()));
  }

  update(quote: Quote): Observable<WebApiResponse<Quote>> {
    return this.apiService
      .put<WebApiResponse<Quote>>(`${this._baseEndPoint}/update`, quote)
      .pipe(tap(() => this._quoteChangedSubject.next()));
  }

  delete(quote: Quote): Observable<WebApiResponse<Quote>> {
    return this.apiService
      .delete<WebApiResponse<Quote>>(`${this._baseEndPoint}/remove`, quote)
      .pipe(tap(() => this._quoteChangedSubject.next()));
  }

  convertToOrder(quote: Quote): Observable<WebApiResponse<any>> {
    return this.apiService
      .post<WebApiResponse<any>>(`${this._baseEndPoint}/convertToOrder`, quote)
      .pipe(tap(() => this._quoteChangedSubject.next()));
  }

  convertToTrip(quote: Quote): Observable<WebApiResponse<any>> {
    return this.apiService
      .post<WebApiResponse<any>>(`${this._baseEndPoint}/convertToTrip`, quote)
      .pipe(tap(() => this._quoteChangedSubject.next()));
  }
}
