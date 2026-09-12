import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import {
  ModalService,
  Order,
  OrderProductService,
  OrderService,
  PaymentService,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { OrderDetailsPageComponent } from './order-details-page.component';

describe('OrderDetailsPageComponent', () => {
  let activatedRouteMock: { snapshot: { paramMap: { get: ReturnType<typeof vi.fn> } } };
  let orderServiceMock: {
    getById: ReturnType<typeof vi.fn>;
    getPdf: ReturnType<typeof vi.fn>;
    orderChanged$: Subject<void>;
  };
  let orderProductServiceMock: { orderProductChanged$: Subject<void> };
  let paymentServiceMock: { paymentChanged$: Subject<void> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let featureFlagServiceMock: { isEnabled: ReturnType<typeof vi.fn> };
  let modalServiceMock: { showPdfProgress: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let progressHandle: { setIndeterminate: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  function createComponent(id: string | null): OrderDetailsPageComponent {
    activatedRouteMock = { snapshot: { paramMap: { get: vi.fn().mockReturnValue(id) } } };
    orderServiceMock = {
      getById: vi.fn().mockReturnValue(new Subject()),
      getPdf: vi.fn(),
      orderChanged$: new Subject(),
    };
    orderProductServiceMock = { orderProductChanged$: new Subject() };
    paymentServiceMock = { paymentChanged$: new Subject() };
    routerMock = { navigateByUrl: vi.fn() };
    featureFlagServiceMock = { isEnabled: vi.fn().mockReturnValue(of(true)) };
    progressHandle = { setIndeterminate: vi.fn(), success: vi.fn(), error: vi.fn() };
    modalServiceMock = { showPdfProgress: vi.fn().mockReturnValue(progressHandle) };
    translationServiceMock = { instant: vi.fn((key: string) => key) };

    TestBed.configureTestingModule({});
    return TestBed.runInInjectionContext(
      () =>
        new OrderDetailsPageComponent(
          activatedRouteMock as unknown as ActivatedRoute,
          orderServiceMock as unknown as OrderService,
          orderProductServiceMock as unknown as OrderProductService,
          paymentServiceMock as unknown as PaymentService,
          routerMock as unknown as Router,
          featureFlagServiceMock as unknown as FeatureFlagService,
          modalServiceMock as unknown as ModalService,
          translationServiceMock as unknown as TranslationService,
        ),
    );
  }

  it('should create', () => {
    expect(createComponent(null)).toBeTruthy();
  });

  it('isAgendaEnabled combines the group and entity flags', () => {
    const component = createComponent(null);
    expect(component.isAgendaEnabled()).toBe(true);
  });

  describe('ngOnInit', () => {
    it('sets isEdit=false for a new order', () => {
      const component = createComponent(null);
      component.ngOnInit();

      expect(component.isEdit).toBe(false);
      expect(component.data).toBeNull();
    });

    it('loads an existing order by id', () => {
      const component = createComponent('o1');
      const response$ = new Subject<WebApiResponse<Order>>();
      orderServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      expect(component.loading).toBe(true);
      expect(orderServiceMock.getById).toHaveBeenCalledWith('o1');

      const data = { id: 'o1' } as Order;
      response$.next({ data } as WebApiResponse<Order>);

      expect(component.loading).toBe(false);
      expect(component.data).toBe(data);
    });

    it('navigates to not-found when the order does not exist', () => {
      const component = createComponent('missing');
      const response$ = new Subject<WebApiResponse<Order>>();
      orderServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      response$.next({ data: null } as unknown as WebApiResponse<Order>);

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });

    it('navigates to not-found and stops loading when the request errors', () => {
      const component = createComponent('o1');
      const response$ = new Subject<WebApiResponse<Order>>();
      orderServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      response$.error(new Error('fail'));

      expect(component.loading).toBe(false);
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });

    it('re-fetches on a real orderProductChanged$ event, but not on the skip(1)-dropped first one', () => {
      const component = createComponent('o1');
      const firstResponse$ = new Subject<WebApiResponse<Order>>();
      const secondResponse$ = new Subject<WebApiResponse<Order>>();
      orderServiceMock.getById
        .mockReturnValueOnce(firstResponse$)
        .mockReturnValueOnce(secondResponse$);

      component.ngOnInit();
      firstResponse$.next({ data: { id: 'o1' } } as WebApiResponse<Order>);
      expect(orderServiceMock.getById).toHaveBeenCalledTimes(1);

      // skip(1) is per-source (mirrors a BehaviorSubject's replay-on-subscribe), so the first
      // .next() on any one of the three merged sources is dropped - this one alone must not
      // trigger a re-fetch.
      orderProductServiceMock.orderProductChanged$.next();
      expect(orderServiceMock.getById).toHaveBeenCalledTimes(1);

      // A second, real change on that same source does trigger a re-fetch.
      orderProductServiceMock.orderProductChanged$.next();
      expect(orderServiceMock.getById).toHaveBeenCalledTimes(2);

      secondResponse$.next({ data: { id: 'o1' } } as WebApiResponse<Order>);
      expect(component.data).toEqual({ id: 'o1' });
    });
  });

  describe('getStatusLabel', () => {
    it('returns an empty string when there is no data', () => {
      const component = createComponent(null);
      expect(component.getStatusLabel()).toBe('');
    });

    it('returns an empty string when data has no status', () => {
      const component = createComponent(null);
      component.data = { id: 'o1', status: null } as unknown as Order;
      expect(component.getStatusLabel()).toBe('');
    });

    it('resolves the mapped status label', () => {
      const component = createComponent(null);
      component.data = { id: 'o1', status: 'Open' } as unknown as Order;
      expect(component.getStatusLabel()).toBe('Em aberto');
    });

    it('falls back to an empty string for a status with no mapped label', () => {
      const component = createComponent(null);
      component.data = { id: 'o1', status: 'Unknown' } as unknown as Order;
      expect(component.getStatusLabel()).toBe('');
    });
  });

  describe('emitSalesOrder', () => {
    it('does nothing without data', () => {
      const component = createComponent(null);
      component.emitSalesOrder();
      expect(modalServiceMock.showPdfProgress).not.toHaveBeenCalled();
    });

    it('shows progress and reports success on a resolved PDF', () => {
      const component = createComponent(null);
      component.data = { id: 'o1', orderNumber: '123' } as Order;
      const blob = new Blob(['x']);
      orderServiceMock.getPdf.mockReturnValue(of(blob));

      component.emitSalesOrder();

      expect(progressHandle.setIndeterminate).toHaveBeenCalled();
      expect(progressHandle.success).toHaveBeenCalled();
      expect(component.emittingSalesOrder).toBe(false);
    });

    it('reports an error when PDF generation fails', () => {
      const component = createComponent(null);
      component.data = { id: 'o1', orderNumber: '123' } as Order;
      const error$ = new Subject<Blob>();
      orderServiceMock.getPdf.mockReturnValue(error$);

      component.emitSalesOrder();
      error$.error(new Error('boom'));

      expect(progressHandle.error).toHaveBeenCalled();
      expect(component.emittingSalesOrder).toBe(false);
    });

    it('does nothing while a previous emission is still in flight', () => {
      const component = createComponent(null);
      component.data = { id: 'o1', orderNumber: '123' } as Order;
      component.emittingSalesOrder = true;

      component.emitSalesOrder();

      expect(modalServiceMock.showPdfProgress).not.toHaveBeenCalled();
    });
  });

  it('ngOnDestroy does not throw', () => {
    const component = createComponent(null);
    component.ngOnInit();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });

  it('ngOnDestroy also unsubscribes from orderChanged$/orderProductChanged$/paymentChanged$ when editing an existing order', () => {
    const component = createComponent('o1');
    orderServiceMock.getById.mockReturnValue(new Subject());
    component.ngOnInit();

    component.ngOnDestroy();
    orderServiceMock.getById.mockClear();
    orderServiceMock.orderChanged$.next();
    orderServiceMock.orderChanged$.next();

    expect(orderServiceMock.getById).not.toHaveBeenCalled();
  });
});
