import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiType } from '../../enums';
import { Observable } from 'rxjs';
import { User } from '../../models';
import { WebApiResponse } from '../../utilities';
import { ApiService, PagedRequest, PagedResult } from '@nexus/core';
import { filter, map, tap } from 'rxjs/operators';
import { toPagedQueryString } from '../../utilities/paged-request.utils';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private _baseEndPoint = ApiType.Users;
  // See feature-flag.service.ts/product.service.ts for the full rationale: null means "not
  // loaded yet" and is filtered out of users$ below; the first consumer triggers the fetch
  // (constructor), every later one reads the cached value, refresh()/add()/update()/delete()
  // invalidate it by re-fetching.
  private readonly _users = signal<WebApiResponse<User[]> | null>(null);
  private readonly _changedTick = signal(0);

  readonly users$: Observable<WebApiResponse<User[]>> = toObservable(this._users).pipe(
    filter((v): v is WebApiResponse<User[]> => v !== null),
  );
  readonly userChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));

  constructor(private apiService: ApiService) {
    this.load();
  }

  private load(): void {
    this.apiService
      .get<WebApiResponse<User[]>>(`${this._baseEndPoint}/getAll`)
      .subscribe((response) => this._users.set(response));
  }

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  getAll(): Observable<WebApiResponse<User[]>> {
    return this.users$;
  }

  // Server-side paged/sorted/filtered listing for the Users grid - unlike getAll() above, used
  // only by the main listing screen, never by pickers/forms that need every user.
  getAllPaged(request: PagedRequest): Observable<PagedResult<User>> {
    return this.apiService
      .get<
        WebApiResponse<PagedResult<User>>
      >(`${this._baseEndPoint}/getAllPaged?${toPagedQueryString(request)}`)
      .pipe(map((response) => response.data!));
  }

  getById(id: string): Observable<WebApiResponse<User>> {
    return this.apiService.get<WebApiResponse<User>>(
      `${this._baseEndPoint}/getById/${id}`,
    );
  }

  refresh(): void {
    this.load();
  }

  add(user: User): Observable<WebApiResponse<User>> {
    return this.apiService
      .post<WebApiResponse<User>>(`${this._baseEndPoint}/add`, user)
      .pipe(
        tap(() => {
          this.refresh();
          this.notifyChanged();
        }),
      );
  }

  update(user: User): Observable<WebApiResponse<User>> {
    return this.apiService
      .put<WebApiResponse<User>>(`${this._baseEndPoint}/update`, user)
      .pipe(
        tap(() => {
          this.refresh();
          this.notifyChanged();
        }),
      );
  }

  delete(user: User): Observable<WebApiResponse<User>> {
    return this.apiService
      .delete<WebApiResponse<User>>(`${this._baseEndPoint}/remove`, user)
      .pipe(
        tap(() => {
          this.refresh();
          this.notifyChanged();
        }),
      );
  }
}
