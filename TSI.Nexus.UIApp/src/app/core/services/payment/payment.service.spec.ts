import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, Payment, WebApiResponse } from '@nexus/core';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): PaymentService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(PaymentService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getAll/getByEntityId/getDelayed hit the expected endpoints', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getAll();
    expect(apiServiceMock.get).toHaveBeenCalledWith('payments/getAll');

    service.getByEntityId('o1', 'Order');
    expect(apiServiceMock.get).toHaveBeenCalledWith('payments/getByOrderId/o1');

    service.getDelayed();
    expect(apiServiceMock.get).toHaveBeenCalledWith('payments/getDelayed');
  });

  it('getAllPaged builds the query string and unwraps response.data', () => {
    const service = createService();
    const paged$ = new Subject<WebApiResponse<{ items: Payment[] }>>();
    apiServiceMock.get.mockReturnValue(paged$);

    let result: unknown;
    service.getAllPaged({ page: 1, pageSize: 20 }).subscribe((v) => (result = v));
    paged$.next({ data: { items: [] } } as unknown as WebApiResponse<{ items: Payment[] }>);

    expect(apiServiceMock.get).toHaveBeenCalledWith('payments/getAllPaged?page=1&pageSize=20');
    expect(result).toEqual({ items: [] });
  });

  it('paymentChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.paymentChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each notify paymentChanged$ after the request completes', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<Payment>>();
    const updateResponse$ = new Subject<WebApiResponse<Payment>>();
    const deleteResponse$ = new Subject<WebApiResponse<Payment>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);

    let emissions = 0;
    service.paymentChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as Payment).subscribe();
    addResponse$.next({} as WebApiResponse<Payment>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.update({} as Payment).subscribe();
    updateResponse$.next({} as WebApiResponse<Payment>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as Payment).subscribe();
    deleteResponse$.next({} as WebApiResponse<Payment>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);
  });
});
