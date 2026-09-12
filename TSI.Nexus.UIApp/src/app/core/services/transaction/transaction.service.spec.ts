import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, Transaction, WebApiResponse } from '@nexus/core';
import { TransactionService } from './transaction.service';

describe('TransactionService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): TransactionService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(TransactionService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getAll/getById/getByBusinessPartnerId hit the expected endpoints', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getAll();
    expect(apiServiceMock.get).toHaveBeenCalledWith('transactions/getAll');

    service.getById('t1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('transactions/getById/t1');

    service.getByBusinessPartnerId('bp1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('transactions/getByBusinessPartnerId/bp1');
  });

  it('getAllPaged builds the query string and unwraps response.data', () => {
    const service = createService();
    const paged$ = new Subject<WebApiResponse<{ items: Transaction[] }>>();
    apiServiceMock.get.mockReturnValue(paged$);

    let result: unknown;
    service.getAllPaged({ page: 1, pageSize: 20 }).subscribe((v) => (result = v));
    paged$.next({ data: { items: [] } } as unknown as WebApiResponse<{ items: Transaction[] }>);

    expect(apiServiceMock.get).toHaveBeenCalledWith('transactions/getAllPaged?page=1&pageSize=20');
    expect(result).toEqual({ items: [] });
  });

  it('refreshTransactions delegates to getAll', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.refreshTransactions();

    expect(apiServiceMock.get).toHaveBeenCalledWith('transactions/getAll');
  });

  it('transactionChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.transactionChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each notify transactionChanged$ after the request completes', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<Transaction>>();
    const updateResponse$ = new Subject<WebApiResponse<Transaction>>();
    const deleteResponse$ = new Subject<WebApiResponse<Transaction>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);

    let emissions = 0;
    service.transactionChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as Transaction).subscribe();
    addResponse$.next({} as WebApiResponse<Transaction>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.update({} as Transaction).subscribe();
    updateResponse$.next({} as WebApiResponse<Transaction>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as Transaction).subscribe();
    deleteResponse$.next({} as WebApiResponse<Transaction>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);
  });
});
