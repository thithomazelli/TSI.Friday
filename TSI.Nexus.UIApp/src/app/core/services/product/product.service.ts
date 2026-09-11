import { Injectable } from '@angular/core';
import { ApiService, ApiType, PagedRequest, PagedResult, WebApiResponse } from '@nexus/core';
import { Product } from '@nexus/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { map, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';
import { toPagedQueryString } from '../../utilities/paged-request.utils';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private _baseEndPoint = ApiType.Products;
  private _refresh$ = new Subject<void>();
  private _productChangedSubject = new BehaviorSubject<void>(undefined);
  productChanged$ = this._productChangedSubject.asObservable();

  // Shared stream behind getAll(): several forms/pickers/alerts across the app each want "the
  // product list" at roughly the same time, and previously fired one independent HTTP GET apiece.
  // shareReplay(1) means the first subscriber triggers the fetch and every other consumer just
  // replays that same in-flight/cached response - the same pattern already used by
  // FeatureFlagService for the same reason.
  readonly products$: Observable<WebApiResponse<Product[]>> = this._refresh$.pipe(
    startWith(undefined),
    switchMap(() =>
      this.apiService.get<WebApiResponse<Product[]>>(`${this._baseEndPoint}/getAll`),
    ),
    shareReplay(1),
  );

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<Product[]>> {
    return this.products$;
  }

  // Server-side paged/sorted/filtered listing for the Products grid - unlike getAll() above,
  // used only by the main listing screen, never by pickers/forms that need the whole catalog.
  getAllPaged(request: PagedRequest): Observable<PagedResult<Product>> {
    return this.apiService
      .get<
        WebApiResponse<PagedResult<Product>>
      >(`${this._baseEndPoint}/getAllPaged?${toPagedQueryString(request)}`)
      .pipe(map((response) => response.data!));
  }

  getById(id: string): Observable<WebApiResponse<Product>> {
    return this.apiService.get<WebApiResponse<Product>>(
      `${this._baseEndPoint}/getById/${id}`,
    );
  }

  refresh(): void {
    this._refresh$.next();
  }

  add(product: Product): Observable<WebApiResponse<Product>> {
    return this.apiService
      .post<WebApiResponse<Product>>(`${this._baseEndPoint}/add`, product)
      .pipe(
        tap(() => {
          this.refresh();
          this._productChangedSubject.next();
        }),
      );
  }

  update(product: Product): Observable<WebApiResponse<Product>> {
    return this.apiService
      .put<WebApiResponse<Product>>(`${this._baseEndPoint}/update`, product)
      .pipe(
        tap(() => {
          this.refresh();
          this._productChangedSubject.next();
        }),
      );
  }

  delete(product: Product): Observable<WebApiResponse<Product>> {
    return this.apiService
      .delete<WebApiResponse<Product>>(`${this._baseEndPoint}/remove`, product)
      .pipe(
        tap(() => {
          this.refresh();
          this._productChangedSubject.next();
        }),
      );
  }
}
