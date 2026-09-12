import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, Order, WebApiResponse } from '@nexus/core';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getBlob: ReturnType<typeof vi.fn>;
  };

  function createService(): OrderService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), getBlob: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(OrderService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getAll/getById/getByBusinessPartnerId hit the expected endpoints', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getAll();
    expect(apiServiceMock.get).toHaveBeenCalledWith('orders/getAll');

    service.getById('o1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('orders/getById/o1');

    service.getByBusinessPartnerId('bp1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('orders/getByBusinessPartnerId/bp1');
  });

  it('getAllPaged builds the query string and unwraps response.data', () => {
    const service = createService();
    const paged$ = new Subject<WebApiResponse<{ items: Order[] }>>();
    apiServiceMock.get.mockReturnValue(paged$);

    let result: unknown;
    service.getAllPaged({ page: 1, pageSize: 20 }).subscribe((v) => (result = v));
    paged$.next({ data: { items: [] } } as unknown as WebApiResponse<{ items: Order[] }>);

    expect(apiServiceMock.get).toHaveBeenCalledWith('orders/getAllPaged?page=1&pageSize=20');
    expect(result).toEqual({ items: [] });
  });

  it('getPdf fetches a blob from the expected endpoint', () => {
    const service = createService();
    apiServiceMock.getBlob.mockReturnValue(new Subject());

    service.getPdf('o1');

    expect(apiServiceMock.getBlob).toHaveBeenCalledWith('orders/o1/Pdf');
  });

  it('refreshOrders delegates to getAll', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.refreshOrders();

    expect(apiServiceMock.get).toHaveBeenCalledWith('orders/getAll');
  });

  it('orderChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.orderChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each notify orderChanged$ after the request completes', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<Order>>();
    const updateResponse$ = new Subject<WebApiResponse<Order>>();
    const deleteResponse$ = new Subject<WebApiResponse<Order>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);

    let emissions = 0;
    service.orderChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as Order).subscribe();
    addResponse$.next({} as WebApiResponse<Order>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.update({} as Order).subscribe();
    updateResponse$.next({} as WebApiResponse<Order>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as Order).subscribe();
    deleteResponse$.next({} as WebApiResponse<Order>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);
  });
});
