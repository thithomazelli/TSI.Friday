import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, PurchaseOrderProduct, ResponseStatus, WebApiResponse } from '@nexus/core';
import { PurchaseOrderProductService } from './purchase-order-product.service';

describe('PurchaseOrderProductService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): PurchaseOrderProductService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(PurchaseOrderProductService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getAll/getByEntityId hit the expected endpoints', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getAll();
    expect(apiServiceMock.get).toHaveBeenCalledWith('purchaseorderproducts/getAll');

    service.getByEntityId('po1', 'PurchaseOrder');
    expect(apiServiceMock.get).toHaveBeenCalledWith('purchaseorderproducts/getByPurchaseOrderId/po1');
  });

  it('purchaseOrderProductChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.purchaseOrderProductChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each notify purchaseOrderProductChanged$ after the request completes', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<PurchaseOrderProduct>>();
    const updateResponse$ = new Subject<WebApiResponse<PurchaseOrderProduct>>();
    const deleteResponse$ = new Subject<WebApiResponse<PurchaseOrderProduct>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);

    let emissions = 0;
    service.purchaseOrderProductChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as PurchaseOrderProduct).subscribe();
    addResponse$.next({} as WebApiResponse<PurchaseOrderProduct>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.update({} as PurchaseOrderProduct).subscribe();
    updateResponse$.next({} as WebApiResponse<PurchaseOrderProduct>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as PurchaseOrderProduct).subscribe();
    deleteResponse$.next({} as WebApiResponse<PurchaseOrderProduct>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);
  });

  describe('addTemporary', () => {
    it('emits the item on purchaseOrderProductAdded$ and returns a synthetic success response', () => {
      const service = createService();
      const item = { id: 'pop1' } as PurchaseOrderProduct;
      let added: PurchaseOrderProduct | undefined;
      service.purchaseOrderProductAdded$.subscribe((v) => (added = v));

      let response: WebApiResponse<PurchaseOrderProduct> | undefined;
      service.addTemporary(item).subscribe((v) => (response = v));

      expect(added).toBe(item);
      expect(response?.status).toBe(ResponseStatus.Success);
      expect(response?.data).toBe(item);
      expect(apiServiceMock.post).not.toHaveBeenCalled();
    });

    it('does not notify purchaseOrderProductChanged$ (it is not a persisted change)', () => {
      const service = createService();
      let emissions = 0;
      service.purchaseOrderProductChanged$.subscribe(() => emissions++);
      TestBed.flushEffects();
      expect(emissions).toBe(1);

      service.addTemporary({} as PurchaseOrderProduct).subscribe();
      TestBed.flushEffects();

      expect(emissions).toBe(1);
    });
  });
});
