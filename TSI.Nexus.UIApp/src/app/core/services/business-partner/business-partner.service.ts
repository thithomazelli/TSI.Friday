import { Injectable, Injector, signal, WritableSignal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { AbstractControl, ValidatorFn } from '@angular/forms';

import {
  ApiService,
  ApiType,
  BusinessPartner,
  BusinessPartnerType,
  Company,
  Individual,
  PagedRequest,
  PagedResult,
  WebApiResponse,
} from '@nexus/core';

import { Observable } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { toPagedQueryString } from '../../utilities/paged-request.utils';

@Injectable({ providedIn: 'root' })
export class BusinessPartnerService {
  private _baseEndPoint = ApiType.BusinessPartners;
  // Never exposed as an Observable anywhere in the app (no getter, no .subscribe()) -
  // addOrUpdateBusinessPartner()'s only reader is itself, so a plain signal is enough here;
  // no toObservable() needed for state nobody outside this class ever reads.
  private readonly _businessPartners: WritableSignal<BusinessPartner[]> = signal([]);
  // See event.service.ts for why this is a tick counter rather than a BehaviorSubject<void>.
  private readonly _changedTick = signal(0);
  readonly businessPartnerChanged$: Observable<void> = toObservable(this._changedTick).pipe(
    map(() => undefined),
  );

  // Several forms across the app (viagem, transação, orçamento, pedido, evento, ...) each ask for
  // the client/supplier list independently, previously firing one HTTP GET apiece. Cached per
  // type - same recipe as FeatureFlagService/ProductService, now keyed by type - and cleared on
  // any write via addOrUpdateBusinessPartner()/add()/update()/delete(). toObservable() needs an
  // injection context; since these Observables are built lazily (first call to
  // getClients()/getSuppliers()/refresh(), not at field-init time), the injected Injector is
  // passed explicitly instead of relying on an implicit one.
  private readonly _byTypeState = new Map<
    BusinessPartnerType,
    WritableSignal<WebApiResponse<BusinessPartner[]> | null>
  >();
  private readonly _byTypeCache = new Map<
    BusinessPartnerType,
    Observable<WebApiResponse<BusinessPartner[]>>
  >();

  constructor(
    private apiService: ApiService,
    private injector: Injector,
  ) {}

  private notifyChanged(): void {
    this._changedTick.update((v) => v + 1);
  }

  getClients(): Observable<WebApiResponse<BusinessPartner[]>> {
    return this.getAllBusinessPartnersByType(BusinessPartnerType.Client);
  }

  getSuppliers(): Observable<WebApiResponse<BusinessPartner[]>> {
    return this.getAllBusinessPartnersByType(BusinessPartnerType.Supplier);
  }

  // Server-side paged/sorted/filtered listing for the Clients/Suppliers grid - unlike
  // getClients()/getSuppliers() above, used only by the main listing screens, never by
  // pickers/forms that need the whole list for a type.
  getAllPaged(
    type: BusinessPartnerType,
    request: PagedRequest,
  ): Observable<PagedResult<BusinessPartner>> {
    const route =
      type === BusinessPartnerType.Client ? 'getAllClientsPaged' : 'getAllSuppliersPaged';
    return this.apiService
      .get<
        WebApiResponse<PagedResult<BusinessPartner>>
      >(`${this._baseEndPoint}/${route}?${toPagedQueryString(request)}`)
      .pipe(map((response) => response.data!));
  }

  getById(id: string): Observable<WebApiResponse<BusinessPartner>> {
    return this.apiService.get<WebApiResponse<BusinessPartner>>(
      `${this._baseEndPoint}/getById/${id}`,
    );
  }

  refresh(
    type: BusinessPartnerType,
  ): Observable<WebApiResponse<BusinessPartner[]>> {
    this._byTypeState.delete(type);
    this._byTypeCache.delete(type);
    return this.getAllBusinessPartnersByType(type);
  }

  add(
    businessPartner: Company | Individual,
  ): Observable<WebApiResponse<Company | Individual>> {
    const endPointUrl =
      businessPartner.documentType === 'Física'
        ? ApiType.Individuals
        : ApiType.Companies;

    return this.apiService
      .post<
        WebApiResponse<Company | Individual>
      >(`${endPointUrl}/add`, businessPartner)
      .pipe(
        tap(() => {
          this._byTypeState.clear();
          this._byTypeCache.clear();
          this.notifyChanged();
        }),
      );
  }

  addOrUpdateBusinessPartner(businessPartner: BusinessPartner): void {
    const current = this._businessPartners();
    const idx = current.findIndex((c) => c.id === businessPartner.id);
    const updated = [...current];
    if (idx > -1) {
      updated[idx] = businessPartner;
    } else {
      updated.push(businessPartner);
    }
    this._businessPartners.set(updated);
  }

  update(
    businessPartner: Company | Individual,
  ): Observable<WebApiResponse<Company | Individual>> {
    const endPointUrl =
      businessPartner.documentType === 'Física'
        ? ApiType.Individuals
        : ApiType.Companies;

    return this.apiService
      .put<
        WebApiResponse<Company | Individual>
      >(`${endPointUrl}/update`, businessPartner)
      .pipe(
        tap(() => {
          this._byTypeState.clear();
          this._byTypeCache.clear();
          this.notifyChanged();
        }),
      );
  }

  delete(
    businessPartner: BusinessPartner,
  ): Observable<WebApiResponse<BusinessPartner>> {
    return this.apiService
      .delete<
        WebApiResponse<BusinessPartner>
      >(`${this._baseEndPoint}/remove`, businessPartner)
      .pipe(
        tap(() => {
          this._byTypeState.clear();
          this._byTypeCache.clear();
          this.notifyChanged();
        }),
      );
  }

  cpfValidator(): ValidatorFn {
    return (control: AbstractControl) => {
      const value = (control.value || '').replace(/\D/g, '');
      if (!value) return null;
      if (value.length !== 11) return { cpfInvalido: true };
      let sum = 0;
      let remainder;
      if (/^(\d)\1+$/.test(value)) return { cpfInvalido: true };
      for (let i = 1; i <= 9; i++)
        sum += parseInt(value.charAt(i - 1)) * (11 - i);
      remainder = (sum * 10) % 11;
      if (remainder === 10 || remainder === 11) remainder = 0;
      if (remainder !== parseInt(value.charAt(9))) return { cpfInvalido: true };
      sum = 0;
      for (let i = 1; i <= 10; i++)
        sum += parseInt(value.charAt(i - 1)) * (12 - i);
      remainder = (sum * 10) % 11;
      if (remainder === 10 || remainder === 11) remainder = 0;
      if (remainder !== parseInt(value.charAt(10)))
        return { cpfInvalido: true };
      return null;
    };
  }

  cnpjValidator(): ValidatorFn {
    return (control: AbstractControl) => {
      const value = (control.value || '').replace(/\D/g, '');
      if (!value) return null;
      if (value.length !== 14) return { cnpjInvalido: true };
      if (/^(\d)\1+$/.test(value)) return { cnpjInvalido: true };
      let length = value.length - 2;
      let numbers = value.substring(0, length);
      let digits = value.substring(length);
      let sum = 0;
      let pos = length - 7;
      for (let i = length; i >= 1; i--) {
        sum += parseInt(numbers.charAt(length - i)) * pos--;
        if (pos < 2) pos = 9;
      }
      let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
      if (result !== parseInt(digits.charAt(0))) return { cnpjInvalido: true };
      length = length + 1;
      numbers = value.substring(0, length);
      sum = 0;
      pos = length - 7;
      for (let i = length; i >= 1; i--) {
        sum += parseInt(numbers.charAt(length - i)) * pos--;
        if (pos < 2) pos = 9;
      }
      result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
      if (result !== parseInt(digits.charAt(1))) return { cnpjInvalido: true };
      return null;
    };
  }

  private getAllBusinessPartnersByType(
    type: BusinessPartnerType,
  ): Observable<WebApiResponse<BusinessPartner[]>> {
    let cached = this._byTypeCache.get(type);
    if (!cached) {
      const state = signal<WebApiResponse<BusinessPartner[]> | null>(null);
      this._byTypeState.set(type, state);
      this.loadByType(type, state);

      cached = toObservable(state, { injector: this.injector }).pipe(
        filter((v): v is WebApiResponse<BusinessPartner[]> => v !== null),
      );
      this._byTypeCache.set(type, cached);
    }
    return cached;
  }

  private loadByType(
    type: BusinessPartnerType,
    state: WritableSignal<WebApiResponse<BusinessPartner[]> | null>,
  ): void {
    const route = type === BusinessPartnerType.Client ? 'getAllClients' : 'getAllSuppliers';
    this.apiService
      .get<WebApiResponse<BusinessPartner[]>>(`${this._baseEndPoint}/${route}`)
      .subscribe((response) => {
        this._businessPartners.set(response.data ?? []);
        state.set(response);
      });
  }
}
