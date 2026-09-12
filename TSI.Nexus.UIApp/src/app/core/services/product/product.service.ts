import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiService, ApiType, PagedRequest, PagedResult, WebApiResponse } from '@nexus/core';
import { Product } from '@nexus/core';
import { Observable } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { toPagedQueryString } from '../../utilities/paged-request.utils';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private _baseEndPoint = ApiType.Products;
  // See feature-flag.service.ts for the full rationale: null means "not loaded yet" and is
  // filtered out of products$ below, and the tick pattern (see event.service.ts) drives
  // productChanged$. Together they replace the old refresh$ Subject + switchMap + shareReplay(1)
  // chain with the same effective behavior (first consumer triggers the fetch, every later one
  // reads the cached value, refresh()/add()/update()/delete() invalidate it) without RxJS state.
  private readonly _products = signal<WebApiResponse<Product[]> | null>(null);
  private readonly _changedTick = signal(0);

  readonly products$: Observable<WebApiResponse<Product[]>> = toObservable(this._products).pipe(
    filter((v): v is WebApiResponse<Product[]> => v !== null),
  );
  readonly productChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));

  constructor(private apiService: ApiService) {
    this.load();
  }

  private load(): void {
    this.apiService
      .get<WebApiResponse<Product[]>>(`${this._baseEndPoint}/getAll`)
      .subscribe((response) => this._products.set(response));
  }

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
    this.load();
  }

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  add(product: Product): Observable<WebApiResponse<Product>> {
    return this.apiService
      .post<WebApiResponse<Product>>(`${this._baseEndPoint}/add`, product)
      .pipe(
        tap(() => {
          this.refresh();
          this.notifyChanged();
        }),
      );
  }

  update(product: Product): Observable<WebApiResponse<Product>> {
    return this.apiService
      .put<WebApiResponse<Product>>(`${this._baseEndPoint}/update`, product)
      .pipe(
        tap(() => {
          this.refresh();
          this.notifyChanged();
        }),
      );
  }

  delete(product: Product): Observable<WebApiResponse<Product>> {
    return this.apiService
      .delete<WebApiResponse<Product>>(`${this._baseEndPoint}/remove`, product)
      .pipe(
        tap(() => {
          this.refresh();
          this.notifyChanged();
        }),
      );
  }
}
