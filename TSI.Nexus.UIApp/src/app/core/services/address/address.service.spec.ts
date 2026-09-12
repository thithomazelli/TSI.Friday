import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { Address, ApiService, WebApiResponse } from '@nexus/core';
import { AddressService } from './address.service';

describe('AddressService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): AddressService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(AddressService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getAllByBusinessPartnerId hits the expected endpoint', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getAllByBusinessPartnerId('bp1');

    expect(apiServiceMock.get).toHaveBeenCalledWith('addresses/getAllByBusinessPartnerId/bp1');
  });

  it('refresh delegates to getAllByBusinessPartnerId', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.refresh('bp1');

    expect(apiServiceMock.get).toHaveBeenCalledWith('addresses/getAllByBusinessPartnerId/bp1');
  });

  it('addressChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.addressChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each notify addressChanged$ after the request completes', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<Address>>();
    const updateResponse$ = new Subject<WebApiResponse<Address>>();
    const deleteResponse$ = new Subject<WebApiResponse<Address>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);

    let emissions = 0;
    service.addressChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as Address).subscribe();
    addResponse$.next({} as WebApiResponse<Address>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.update({} as Address).subscribe();
    updateResponse$.next({} as WebApiResponse<Address>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as Address).subscribe();
    deleteResponse$.next({} as WebApiResponse<Address>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);
  });
});
