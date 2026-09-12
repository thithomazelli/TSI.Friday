import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, OrderProduct, ResponseStatus, WebApiResponse } from '@nexus/core';
import { OrderProductService } from './order-product.service';

describe('OrderProductService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): OrderProductService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(OrderProductService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getAll/getByEntityId hit the expected endpoints', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getAll();
    expect(apiServiceMock.get).toHaveBeenCalledWith('orderproducts/getAll');

    service.getByEntityId('o1', 'Order');
    expect(apiServiceMock.get).toHaveBeenCalledWith('orderproducts/getByOrderId/o1');
  });

  it('orderProductChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.orderProductChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each notify orderProductChanged$ after the request completes', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<OrderProduct>>();
    const updateResponse$ = new Subject<WebApiResponse<OrderProduct>>();
    const deleteResponse$ = new Subject<WebApiResponse<OrderProduct>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);

    let emissions = 0;
    service.orderProductChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as OrderProduct).subscribe();
    addResponse$.next({} as WebApiResponse<OrderProduct>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.update({} as OrderProduct).subscribe();
    updateResponse$.next({} as WebApiResponse<OrderProduct>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as OrderProduct).subscribe();
    deleteResponse$.next({} as WebApiResponse<OrderProduct>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);
  });

  describe('addTemporary', () => {
    it('emits the item on orderProductAdded$ and returns a synthetic success response', () => {
      const service = createService();
      const orderProduct = { id: 'op1' } as OrderProduct;
      let added: OrderProduct | undefined;
      service.orderProductAdded$.subscribe((v) => (added = v));

      let response: WebApiResponse<OrderProduct> | undefined;
      service.addTemporary(orderProduct).subscribe((v) => (response = v));

      expect(added).toBe(orderProduct);
      expect(response?.status).toBe(ResponseStatus.Success);
      expect(response?.data).toBe(orderProduct);
      expect(apiServiceMock.post).not.toHaveBeenCalled();
    });

    it('does not notify orderProductChanged$ (it is not a persisted change)', () => {
      const service = createService();
      let emissions = 0;
      service.orderProductChanged$.subscribe(() => emissions++);
      TestBed.flushEffects();
      expect(emissions).toBe(1);

      service.addTemporary({} as OrderProduct).subscribe();
      TestBed.flushEffects();

      expect(emissions).toBe(1);
    });
  });
});
