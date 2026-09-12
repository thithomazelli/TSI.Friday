import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, Quote, WebApiResponse } from '@nexus/core';
import { QuoteService } from './quote.service';

describe('QuoteService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getBlob: ReturnType<typeof vi.fn>;
  };

  function createService(): QuoteService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), getBlob: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(QuoteService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getAll/getById/getByQuoteNumber/getByBusinessPartnerId/getByProductId hit the expected endpoints', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getAll();
    expect(apiServiceMock.get).toHaveBeenCalledWith('quotes/getAll');

    service.getById('q1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('quotes/getById/q1');

    service.getByQuoteNumber('Q-001');
    expect(apiServiceMock.get).toHaveBeenCalledWith('quotes/getByQuoteNumber/Q-001');

    service.getByBusinessPartnerId('bp1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('quotes/getByBusinessPartnerId/bp1');

    service.getByProductId('p1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('quotes/getByProductId/p1');
  });

  it('getAllPaged builds the query string and unwraps response.data', () => {
    const service = createService();
    const paged$ = new Subject<WebApiResponse<{ items: Quote[] }>>();
    apiServiceMock.get.mockReturnValue(paged$);

    let result: unknown;
    service.getAllPaged({ page: 1, pageSize: 20 }).subscribe((v) => (result = v));
    paged$.next({ data: { items: [] } } as unknown as WebApiResponse<{ items: Quote[] }>);

    expect(apiServiceMock.get).toHaveBeenCalledWith('quotes/getAllPaged?page=1&pageSize=20');
    expect(result).toEqual({ items: [] });
  });

  it('getPdf fetches a blob from the expected endpoint', () => {
    const service = createService();
    apiServiceMock.getBlob.mockReturnValue(new Subject());

    service.getPdf('q1');

    expect(apiServiceMock.getBlob).toHaveBeenCalledWith('quotes/q1/Pdf');
  });

  it('refreshQuotes delegates to getAll', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.refreshQuotes();

    expect(apiServiceMock.get).toHaveBeenCalledWith('quotes/getAll');
  });

  it('quoteChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.quoteChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete/convertToOrder/convertToTrip each notify quoteChanged$ after the request completes', () => {
    const service = createService();
    const responses = Array.from({ length: 5 }, () => new Subject<WebApiResponse<Quote>>());
    apiServiceMock.post.mockReturnValueOnce(responses[0]).mockReturnValueOnce(responses[3]).mockReturnValueOnce(responses[4]);
    apiServiceMock.put.mockReturnValue(responses[1]);
    apiServiceMock.delete.mockReturnValue(responses[2]);

    let emissions = 0;
    service.quoteChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as Quote).subscribe();
    responses[0].next({} as WebApiResponse<Quote>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.update({} as Quote).subscribe();
    responses[1].next({} as WebApiResponse<Quote>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as Quote).subscribe();
    responses[2].next({} as WebApiResponse<Quote>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);

    service.convertToOrder({} as Quote).subscribe();
    responses[3].next({} as WebApiResponse<Quote>);
    TestBed.flushEffects();
    expect(emissions).toBe(5);

    service.convertToTrip({} as Quote).subscribe();
    responses[4].next({} as WebApiResponse<Quote>);
    TestBed.flushEffects();
    expect(emissions).toBe(6);
  });
});
