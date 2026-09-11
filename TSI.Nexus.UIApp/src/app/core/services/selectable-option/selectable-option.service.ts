import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
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
  // Cached per group with shareReplay(1) - same pattern used by FeatureFlagService/ProductService
  // - and cleared on any write, since these options change rarely (admin-only screen) compared to
  // how often forms mount and ask for them.
  private _byGroupCache = new Map<
    SelectableOptionGroup,
    Observable<WebApiResponse<SelectableOption[]>>
  >();

  constructor(private apiService: ApiService) {}

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
      cached = this.apiService
        .get<
          WebApiResponse<SelectableOption[]>
        >(`${this._baseEndPoint}/getByGroup/${group}`)
        .pipe(shareReplay(1));
      this._byGroupCache.set(group, cached);
    }
    return cached;
  }

  add(option: SelectableOption): Observable<WebApiResponse<SelectableOption>> {
    return this.apiService
      .post<
        WebApiResponse<SelectableOption>
      >(`${this._baseEndPoint}/add`, option)
      .pipe(tap(() => this._byGroupCache.clear()));
  }

  update(
    option: SelectableOption,
  ): Observable<WebApiResponse<SelectableOption>> {
    return this.apiService
      .put<
        WebApiResponse<SelectableOption>
      >(`${this._baseEndPoint}/update`, option)
      .pipe(tap(() => this._byGroupCache.clear()));
  }

  remove(
    option: SelectableOption,
  ): Observable<WebApiResponse<SelectableOption>> {
    return this.apiService
      .delete<
        WebApiResponse<SelectableOption>
      >(`${this._baseEndPoint}/remove`, option)
      .pipe(tap(() => this._byGroupCache.clear()));
  }
}
