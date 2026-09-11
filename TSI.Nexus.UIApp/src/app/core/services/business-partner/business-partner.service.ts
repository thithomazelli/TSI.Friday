import { Injectable } from '@angular/core';
import { AbstractControl, ValidatorFn } from '@angular/forms';

import {
  ApiService,
  ApiType,
  BusinessPartner,
  BusinessPartnerType,
  Company,
  Individual,
  WebApiResponse,
} from '@nexus/core';

import { BehaviorSubject, Observable } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class BusinessPartnerService {
  private _baseEndPoint = ApiType.BusinessPartners;
  private _businessPartners$ = new BehaviorSubject<BusinessPartner[]>([]);
  private _businessPartnerChangedSubject = new BehaviorSubject<void>(undefined);
  businessPartnerChanged$ = this._businessPartnerChangedSubject.asObservable();

  // Several forms across the app (viagem, transação, orçamento, pedido, evento, ...) each ask for
  // the client/supplier list independently, previously firing one HTTP GET apiece. Cached per
  // type with shareReplay(1) - same pattern used by FeatureFlagService/ProductService - and
  // cleared on any write via addOrUpdateBusinessPartner()/add()/update()/delete().
  private _byTypeCache = new Map<
    BusinessPartnerType,
    Observable<WebApiResponse<BusinessPartner[]>>
  >();

  constructor(private apiService: ApiService) {}

  getClients(): Observable<WebApiResponse<BusinessPartner[]>> {
    return this.getAllBusinessPartnersByType(BusinessPartnerType.Client);
  }

  getSuppliers(): Observable<WebApiResponse<BusinessPartner[]>> {
    return this.getAllBusinessPartnersByType(BusinessPartnerType.Supplier);
  }

  getById(id: string): Observable<WebApiResponse<BusinessPartner>> {
    return this.apiService.get<WebApiResponse<BusinessPartner>>(
      `${this._baseEndPoint}/getById/${id}`,
    );
  }

  refresh(
    type: BusinessPartnerType,
  ): Observable<WebApiResponse<BusinessPartner[]>> {
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
          this._byTypeCache.clear();
          this._businessPartnerChangedSubject.next();
        }),
      );
  }

  addOrUpdateBusinessPartner(businessPartner: BusinessPartner): void {
    const current = this._businessPartners$.value;
    const idx = current.findIndex((c) => c.id === businessPartner.id);
    if (idx > -1) {
      current[idx] = businessPartner;
    } else {
      current.push(businessPartner);
    }
    this._businessPartners$.next([...current]);
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
          this._byTypeCache.clear();
          this._businessPartnerChangedSubject.next();
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
          this._byTypeCache.clear();
          this._businessPartnerChangedSubject.next();
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
      cached = this.apiService
        .get<
          WebApiResponse<BusinessPartner[]>
        >(`${this._baseEndPoint}/getAll${type === BusinessPartnerType.Client ? 'Clients' : 'Suppliers'}`)
        .pipe(
          tap((response) => {
            this._businessPartners$.next(response.data);
          }),
          shareReplay(1),
        );
      this._byTypeCache.set(type, cached);
    }
    return cached;
  }
}
