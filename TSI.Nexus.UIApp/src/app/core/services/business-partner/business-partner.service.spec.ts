import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import {
  ApiService,
  BusinessPartner,
  BusinessPartnerType,
  Company,
  Individual,
  WebApiResponse,
} from '@nexus/core';
import { BusinessPartnerService } from './business-partner.service';

describe('BusinessPartnerService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): BusinessPartnerService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(BusinessPartnerService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getClients hits getAllClients and caches per type', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getClients();
    service.getClients();

    expect(apiServiceMock.get).toHaveBeenCalledWith('businesspartners/getAllClients');
    expect(apiServiceMock.get).toHaveBeenCalledTimes(1);
  });

  it('getSuppliers hits getAllSuppliers and caches separately from getClients', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getSuppliers();
    service.getClients();

    expect(apiServiceMock.get).toHaveBeenCalledWith('businesspartners/getAllSuppliers');
    expect(apiServiceMock.get).toHaveBeenCalledWith('businesspartners/getAllClients');
    expect(apiServiceMock.get).toHaveBeenCalledTimes(2);
  });

  it('getClients$ emits the loaded response once the request resolves', () => {
    const load$ = new Subject<WebApiResponse<BusinessPartner[]>>();
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    apiServiceMock.get.mockReturnValue(load$);
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    const service = TestBed.inject(BusinessPartnerService);

    let response: WebApiResponse<BusinessPartner[]> | undefined;
    service.getClients().subscribe((v) => (response = v));
    TestBed.flushEffects();
    expect(response).toBeUndefined();

    const loaded = { data: [{ id: 'bp1' } as BusinessPartner] } as WebApiResponse<BusinessPartner[]>;
    load$.next(loaded);
    TestBed.flushEffects();

    expect(response).toBe(loaded);
  });

  it('getClients()/getSuppliers() complete after their single emission (forkJoin compatibility)', () => {
    const load$ = new Subject<WebApiResponse<BusinessPartner[]>>();
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    apiServiceMock.get.mockReturnValue(load$);
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    const service = TestBed.inject(BusinessPartnerService);

    let completed = false;
    service.getClients().subscribe({ complete: () => (completed = true) });
    TestBed.flushEffects();
    expect(completed).toBe(false);

    load$.next({ data: [] } as unknown as WebApiResponse<BusinessPartner[]>);
    TestBed.flushEffects();

    expect(completed).toBe(true);
  });

  it('refresh clears the cache for that type and re-fetches', () => {
    const service = createService();
    const second$ = new Subject<WebApiResponse<BusinessPartner[]>>();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getClients();
    apiServiceMock.get.mockReturnValue(second$);
    service.refresh(BusinessPartnerType.Client);

    expect(apiServiceMock.get).toHaveBeenCalledTimes(2);
  });

  it('getAllPaged builds the query string and unwraps response.data', () => {
    const service = createService();
    const paged$ = new Subject<WebApiResponse<unknown>>();
    apiServiceMock.get.mockReturnValue(paged$);

    let result: unknown;
    service.getAllPaged(BusinessPartnerType.Client, { page: 1, pageSize: 10 } as never)
      .subscribe((r) => (result = r));
    paged$.next({ data: { items: [] } } as unknown as WebApiResponse<unknown>);

    expect(apiServiceMock.get).toHaveBeenCalledWith(
      expect.stringContaining('businesspartners/getAllClientsPaged?'),
    );
    expect(result).toEqual({ items: [] });
  });

  it('getAllPaged hits getAllSuppliersPaged for supplier type', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getAllPaged(BusinessPartnerType.Supplier, { page: 1, pageSize: 10 } as never);

    expect(apiServiceMock.get).toHaveBeenCalledWith(
      expect.stringContaining('businesspartners/getAllSuppliersPaged?'),
    );
  });

  it('getById hits the expected endpoint', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getById('bp1');

    expect(apiServiceMock.get).toHaveBeenCalledWith('businesspartners/getById/bp1');
  });

  it('businessPartnerChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.businessPartnerChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each clear the per-type cache and notify businessPartnerChanged$', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<Company | Individual>>();
    const updateResponse$ = new Subject<WebApiResponse<Company | Individual>>();
    const deleteResponse$ = new Subject<WebApiResponse<BusinessPartner>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);
    apiServiceMock.get.mockReturnValue(new Subject());

    let emissions = 0;
    service.businessPartnerChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.getClients();
    const getCallsAfterFirstFetch = apiServiceMock.get.mock.calls.length;

    service.add({ documentType: 'Física' } as Individual).subscribe();
    addResponse$.next({} as WebApiResponse<Individual>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.getClients();
    expect(apiServiceMock.get.mock.calls.length).toBe(getCallsAfterFirstFetch + 1);

    service.update({ documentType: 'Jurídica' } as Company).subscribe();
    updateResponse$.next({} as WebApiResponse<Company>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as BusinessPartner).subscribe();
    deleteResponse$.next({} as WebApiResponse<BusinessPartner>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);
  });

  it('add posts to the Companies endpoint for a non-Física documentType', () => {
    const service = createService();
    apiServiceMock.post.mockReturnValue(new Subject());

    service.add({ documentType: 'Jurídica' } as Company).subscribe();

    expect(apiServiceMock.post).toHaveBeenCalledWith('companies/add', expect.anything());
  });

  it('update puts to the Individuals endpoint for a Física documentType', () => {
    const service = createService();
    apiServiceMock.put.mockReturnValue(new Subject());

    service.update({ documentType: 'Física' } as Individual).subscribe();

    expect(apiServiceMock.put).toHaveBeenCalledWith('individuals/update', expect.anything());
  });

  it('falls back to an empty array when the loaded response carries no data', () => {
    const service = createService();
    const load$ = new Subject<WebApiResponse<BusinessPartner[]>>();
    apiServiceMock.get.mockReturnValue(load$);

    service.getClients();
    expect(() => load$.next({} as WebApiResponse<BusinessPartner[]>)).not.toThrow();
  });

  describe('addOrUpdateBusinessPartner', () => {
    it('does not throw and can be called for a new or existing id', () => {
      const service = createService();

      expect(() => {
        service.addOrUpdateBusinessPartner({ id: 'bp1', name: 'A' } as BusinessPartner);
        service.addOrUpdateBusinessPartner({ id: 'bp1', name: 'A updated' } as BusinessPartner);
        service.addOrUpdateBusinessPartner({ id: 'bp2', name: 'B' } as BusinessPartner);
      }).not.toThrow();
    });
  });

  describe('cpfValidator', () => {
    it('accepts an empty value', () => {
      const service = createService();
      const validator = service.cpfValidator();
      expect(validator({ value: '' } as never)).toBeNull();
    });

    it('accepts a valid CPF', () => {
      const service = createService();
      const validator = service.cpfValidator();
      expect(validator({ value: '52998224725' } as never)).toBeNull();
    });

    it('rejects an invalid CPF', () => {
      const service = createService();
      const validator = service.cpfValidator();
      expect(validator({ value: '11111111111' } as never)).toEqual({ cpfInvalido: true });
      expect(validator({ value: '12345678900' } as never)).toEqual({ cpfInvalido: true });
    });

    it('rejects a CPF with the wrong number of digits', () => {
      const service = createService();
      const validator = service.cpfValidator();
      expect(validator({ value: '123' } as never)).toEqual({ cpfInvalido: true });
    });

    it("rejects a CPF whose first check digit doesn't match", () => {
      const service = createService();
      const validator = service.cpfValidator();
      expect(validator({ value: '52998224700' } as never)).toEqual({ cpfInvalido: true });
    });

    it('accepts a valid CPF whose second check digit needed the 10/11 reset rule', () => {
      const service = createService();
      const validator = service.cpfValidator();
      expect(validator({ value: '10000002810' } as never)).toBeNull();
    });
  });

  describe('cnpjValidator', () => {
    it('accepts an empty value', () => {
      const service = createService();
      const validator = service.cnpjValidator();
      expect(validator({ value: '' } as never)).toBeNull();
    });

    it('accepts a valid CNPJ', () => {
      const service = createService();
      const validator = service.cnpjValidator();
      expect(validator({ value: '11222333000181' } as never)).toBeNull();
    });

    it('rejects an invalid CNPJ', () => {
      const service = createService();
      const validator = service.cnpjValidator();
      expect(validator({ value: '11111111111111' } as never)).toEqual({ cnpjInvalido: true });
      expect(validator({ value: '11222333000199' } as never)).toEqual({ cnpjInvalido: true });
    });

    it('rejects a CNPJ with the wrong number of digits', () => {
      const service = createService();
      const validator = service.cnpjValidator();
      expect(validator({ value: '123' } as never)).toEqual({ cnpjInvalido: true });
    });

    it('accepts a valid CNPJ whose first check digit needed the 0/1 reset rule', () => {
      const service = createService();
      const validator = service.cnpjValidator();
      expect(validator({ value: '10000000000307' } as never)).toBeNull();
    });

    it('accepts a valid CNPJ whose second check digit needed the 0/1 reset rule', () => {
      const service = createService();
      const validator = service.cnpjValidator();
      expect(validator({ value: '10000000000650' } as never)).toBeNull();
    });

    it("rejects a CNPJ with a correct first digit but a wrong second check digit", () => {
      const service = createService();
      const validator = service.cnpjValidator();
      expect(validator({ value: '10000000000308' } as never)).toEqual({ cnpjInvalido: true });
    });
  });
});
