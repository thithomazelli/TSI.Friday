import { Injectable, Injector, signal, WritableSignal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { filter, take, tap } from 'rxjs/operators';
import { ApiService, ApiType, WebApiResponse } from '@nexus/core';
import { SelectableOption } from '../../models/selectable-option.model';
import { SelectableOptionGroup } from '../../enums/selectable-option-group.enum';

@Injectable({
  providedIn: 'root',
})
export class SelectableOptionService {
  private _baseEndPoint = ApiType.SelectableOptions;

  // Several forms across the app (endereço, produto, transação, pagamento, evento, ...) each ask
  // for the same group's dropdown options independently, previously firing one HTTP GET apiece.
  // Cached per group - same recipe as BusinessPartnerService's per-type cache - and cleared on any
  // write, since these options change rarely (admin-only screen) compared to how often forms mount
  // and ask for them. The ORIGINAL cache was a plain http.get(...).pipe(shareReplay(1)) - a single
  // completing GET - so, like BusinessPartnerService, take(1) is needed after the filter() to
  // preserve that completion (toObservable() alone never completes); toObservable() needs an
  // injection context, so it's created here via the injected Injector rather than at field-init
  // time, since these Observables are built lazily on the first getByGroup() call.
  private readonly _byGroupState = new Map<
    SelectableOptionGroup,
    WritableSignal<WebApiResponse<SelectableOption[]> | null>
  >();
  private readonly _byGroupCache = new Map<
    SelectableOptionGroup,
    Observable<WebApiResponse<SelectableOption[]>>
  >();

  constructor(
    private apiService: ApiService,
    private injector: Injector,
  ) {}

  getAll(): Observable<WebApiResponse<SelectableOption[]>> {
    return this.apiService.get<WebApiResponse<SelectableOption[]>>(
      `${this._baseEndPoint}/getAll`,
    );
  }

  getByGroup(
    group: SelectableOptionGroup,
  ): Observable<WebApiResponse<SelectableOption[]>> {
    let cached = this._byGroupCache.get(group);
    if (!cached) {
      const state = signal<WebApiResponse<SelectableOption[]> | null>(null);
      this._byGroupState.set(group, state);
      this.apiService
        .get<WebApiResponse<SelectableOption[]>>(`${this._baseEndPoint}/getByGroup/${group}`)
        .subscribe((response) => state.set(response));

      cached = toObservable(state, { injector: this.injector }).pipe(
        filter((v): v is WebApiResponse<SelectableOption[]> => v !== null),
        take(1),
      );
      this._byGroupCache.set(group, cached);
    }
    return cached;
  }

  private clearCache(): void {
    this._byGroupState.clear();
    this._byGroupCache.clear();
  }

  add(option: SelectableOption): Observable<WebApiResponse<SelectableOption>> {
    return this.apiService
      .post<
        WebApiResponse<SelectableOption>
      >(`${this._baseEndPoint}/add`, option)
      .pipe(tap(() => this.clearCache()));
  }

  update(
    option: SelectableOption,
  ): Observable<WebApiResponse<SelectableOption>> {
    return this.apiService
      .put<
        WebApiResponse<SelectableOption>
      >(`${this._baseEndPoint}/update`, option)
      .pipe(tap(() => this.clearCache()));
  }

  remove(
    option: SelectableOption,
  ): Observable<WebApiResponse<SelectableOption>> {
    return this.apiService
      .delete<
        WebApiResponse<SelectableOption>
      >(`${this._baseEndPoint}/remove`, option)
      .pipe(tap(() => this.clearCache()));
  }
}
