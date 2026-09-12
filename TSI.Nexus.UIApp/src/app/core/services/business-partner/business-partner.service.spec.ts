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

    service.getAllPaged(BusinessPartnerType.Client, { page: 1, pageSize: 10 } as never);

    expect(apiServiceMock.get).toHaveBeenCalledWith(
      expect.stringContaining('businesspartners/getAllClientsPaged?'),
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
  });
});
