import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Address, ApiService, ApiType, WebApiResponse } from '@nexus/core';
import { Observable, map, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AddressService {
  private _baseEndPoint = ApiType.Addresses;
  // See event.service.ts for why this is a tick counter rather than a BehaviorSubject<void>.
  private readonly _changedTick = signal(0);

  readonly addressChanged$: Observable<void> = toObservable(this._changedTick).pipe(map(() => undefined));

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  constructor(private apiService: ApiService) {}

  getAllByBusinessPartnerId(
    businessPartnerId: string,
  ): Observable<WebApiResponse<Address[]>> {
    return this.apiService.get<
      WebApiResponse<Address[]>
    >(`${this._baseEndPoint}/getAllByBusinessPartnerId/${businessPartnerId}`);
  }

  refresh(parentId: string): Observable<WebApiResponse<Address[]>> {
    return this.getAllByBusinessPartnerId(parentId);
  }

  add(address: Address): Observable<WebApiResponse<Address>> {
    return this.apiService
      .post<WebApiResponse<Address>>(`${this._baseEndPoint}/add`, address)
      .pipe(tap(() => this.notifyChanged()));
  }

  update(address: Address): Observable<WebApiResponse<Address>> {
    return this.apiService
      .put<WebApiResponse<Address>>(`${this._baseEndPoint}/update`, address)
      .pipe(tap(() => this.notifyChanged()));
  }

  delete(address: Address): Observable<WebApiResponse<Address>> {
    return this.apiService
      .delete<WebApiResponse<Address>>(`${this._baseEndPoint}/remove`, address)
      .pipe(tap(() => this.notifyChanged()));
  }
}
