import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, QuoteProduct, ResponseStatus, WebApiResponse } from '@nexus/core';
import { QuoteProductService } from './quote-product.service';

describe('QuoteProductService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): QuoteProductService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(QuoteProductService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getAll/getByEntityId/getById/getDelayed hit the expected endpoints', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getAll();
    expect(apiServiceMock.get).toHaveBeenCalledWith('quoteproducts/getAll');

    service.getByEntityId('q1', 'Quote');
    expect(apiServiceMock.get).toHaveBeenCalledWith('quoteproducts/getByQuoteId/q1');

    service.getById('qp1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('quoteproducts/getById/qp1');

    service.getDelayed();
    expect(apiServiceMock.get).toHaveBeenCalledWith('quoteproducts/getDelayed');
  });

  it('quoteProductChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.quoteProductChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each notify quoteProductChanged$ after the request completes', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<QuoteProduct>>();
    const updateResponse$ = new Subject<WebApiResponse<QuoteProduct>>();
    const deleteResponse$ = new Subject<WebApiResponse<QuoteProduct>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);

    let emissions = 0;
    service.quoteProductChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as QuoteProduct).subscribe();
    addResponse$.next({} as WebApiResponse<QuoteProduct>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.update({} as QuoteProduct).subscribe();
    updateResponse$.next({} as WebApiResponse<QuoteProduct>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as QuoteProduct).subscribe();
    deleteResponse$.next({} as WebApiResponse<QuoteProduct>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);
  });

  describe('addTemporary', () => {
    it('emits the item on quoteProductAdded$ and returns a synthetic success response', () => {
      const service = createService();
      const item = { id: 'qp1' } as QuoteProduct;
      let added: QuoteProduct | undefined;
      service.quoteProductAdded$.subscribe((v) => (added = v));

      let response: WebApiResponse<QuoteProduct> | undefined;
      service.addTemporary(item).subscribe((v) => (response = v));

      expect(added).toBe(item);
      expect(response?.status).toBe(ResponseStatus.Success);
      expect(response?.data).toBe(item);
      expect(apiServiceMock.post).not.toHaveBeenCalled();
    });

    it('does not notify quoteProductChanged$ (it is not a persisted change)', () => {
      const service = createService();
      let emissions = 0;
      service.quoteProductChanged$.subscribe(() => emissions++);
      TestBed.flushEffects();
      expect(emissions).toBe(1);

      service.addTemporary({} as QuoteProduct).subscribe();
      TestBed.flushEffects();

      expect(emissions).toBe(1);
    });
  });
});
