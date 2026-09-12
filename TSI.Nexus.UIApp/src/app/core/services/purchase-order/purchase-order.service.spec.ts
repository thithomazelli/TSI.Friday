import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, PurchaseOrder, WebApiResponse } from '@nexus/core';
import { PurchaseOrderService } from './purchase-order.service';

describe('PurchaseOrderService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): PurchaseOrderService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(PurchaseOrderService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getAll/getById/getByBusinessPartnerId hit the expected endpoints', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getAll();
    expect(apiServiceMock.get).toHaveBeenCalledWith('purchaseorders/getAll');

    service.getById('po1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('purchaseorders/getById/po1');

    service.getByBusinessPartnerId('bp1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('purchaseorders/getByBusinessPartnerId/bp1');
  });

  it('getAllPaged builds the query string and unwraps response.data', () => {
    const service = createService();
    const paged$ = new Subject<WebApiResponse<{ items: PurchaseOrder[] }>>();
    apiServiceMock.get.mockReturnValue(paged$);

    let result: unknown;
    service.getAllPaged({ page: 1, pageSize: 20 }).subscribe((v) => (result = v));
    paged$.next({ data: { items: [] } } as unknown as WebApiResponse<{ items: PurchaseOrder[] }>);

    expect(apiServiceMock.get).toHaveBeenCalledWith('purchaseorders/getAllPaged?page=1&pageSize=20');
    expect(result).toEqual({ items: [] });
  });

  it('refreshPurchaseOrders delegates to getAll', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.refreshPurchaseOrders();

    expect(apiServiceMock.get).toHaveBeenCalledWith('purchaseorders/getAll');
  });

  it('purchaseOrderChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.purchaseOrderChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each notify purchaseOrderChanged$ after the request completes', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<PurchaseOrder>>();
    const updateResponse$ = new Subject<WebApiResponse<PurchaseOrder>>();
    const deleteResponse$ = new Subject<WebApiResponse<PurchaseOrder>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);

    let emissions = 0;
    service.purchaseOrderChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as PurchaseOrder).subscribe();
    addResponse$.next({} as WebApiResponse<PurchaseOrder>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.update({} as PurchaseOrder).subscribe();
    updateResponse$.next({} as WebApiResponse<PurchaseOrder>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as PurchaseOrder).subscribe();
    deleteResponse$.next({} as WebApiResponse<PurchaseOrder>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);
  });
});
