import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiType, ResponseStatus } from '../../enums';
import { QuoteProduct } from '../../models';
import { ApiService, TranslationService, WebApiResponse } from '@nexus/core';
import { Observable, Subject, map, of, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class QuoteProductService {
  private _baseEndPoint = ApiType.QuoteProducts;
  // See event.service.ts for why this is a tick counter rather than a BehaviorSubject<void>.
  private readonly _changedTick = signal(0);
  // See order-product.service.ts for why this stays a Subject (one-shot event, not state).
  private _quoteProductAdded$ = new Subject<QuoteProduct>();

  readonly quoteProductChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));
  quoteProductAdded$ = this._quoteProductAdded$.asObservable();

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  constructor(
    private apiService: ApiService,
    private translationService: TranslationService,
  ) {}

  getAll(): Observable<WebApiResponse<QuoteProduct[]>> {
    return this.apiService.get<WebApiResponse<QuoteProduct[]>>(`${this._baseEndPoint}/getAll`);
  }

  getByEntityId(
    id: string,
    entity: string,
  ): Observable<WebApiResponse<QuoteProduct[]>> {
    return this.apiService.get<
      WebApiResponse<QuoteProduct[]>
    >(`${this._baseEndPoint}/getBy${entity}Id/${id}`);
  }

  getById(quoteProductId: string): Observable<WebApiResponse<QuoteProduct>> {
    return this.apiService.get<WebApiResponse<QuoteProduct>>(
      `${this._baseEndPoint}/getById/${quoteProductId}`,
    );
  }

  getDelayed(): Observable<WebApiResponse<QuoteProduct[]>> {
    return this.apiService.get<WebApiResponse<QuoteProduct[]>>(
      `${this._baseEndPoint}/getDelayed`,
    );
  }

  add(quoteProduct: QuoteProduct): Observable<WebApiResponse<QuoteProduct>> {
    return this.apiService
      .post<
        WebApiResponse<QuoteProduct>
      >(`${this._baseEndPoint}/add`, quoteProduct)
      .pipe(tap(() => this.notifyChanged()));
  }

  addTemporary(
    quoteProduct: QuoteProduct,
  ): Observable<WebApiResponse<QuoteProduct>> {
    this._quoteProductAdded$.next(quoteProduct);
    return of({
      data: quoteProduct,
      message: this.translationService.instant('QUOTES.ITEM_ADDED_TEMPORARILY'),
      status: ResponseStatus.Success,
    });
  }

  update(quoteProduct: QuoteProduct): Observable<WebApiResponse<QuoteProduct>> {
    return this.apiService
      .put<
        WebApiResponse<QuoteProduct>
      >(`${this._baseEndPoint}/update`, quoteProduct)
      .pipe(tap(() => this.notifyChanged()));
  }

  delete(quoteProduct: QuoteProduct): Observable<WebApiResponse<QuoteProduct>> {
    return this.apiService
      .delete<
        WebApiResponse<QuoteProduct>
      >(`${this._baseEndPoint}/remove`, quoteProduct)
      .pipe(tap(() => this.notifyChanged()));
  }
}
