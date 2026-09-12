import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import {
  PaymentService,
  PurchaseOrder,
  PurchaseOrderProductService,
  PurchaseOrderService,
  WebApiResponse,
} from '@nexus/core';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { PurchaseOrderDetailsPageComponent } from './purchase-order-details-page.component';

describe('PurchaseOrderDetailsPageComponent', () => {
  let activatedRouteMock: { snapshot: { paramMap: { get: ReturnType<typeof vi.fn> } } };
  let purchaseOrderServiceMock: {
    getById: ReturnType<typeof vi.fn>;
    purchaseOrderChanged$: Subject<void>;
  };
  let purchaseOrderProductServiceMock: { purchaseOrderProductChanged$: Subject<void> };
  let paymentServiceMock: { paymentChanged$: Subject<void> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let featureFlagServiceMock: { isEnabled: ReturnType<typeof vi.fn> };

  function createComponent(id: string | null): PurchaseOrderDetailsPageComponent {
    activatedRouteMock = { snapshot: { paramMap: { get: vi.fn().mockReturnValue(id) } } };
    purchaseOrderServiceMock = {
      getById: vi.fn().mockReturnValue(new Subject()),
      purchaseOrderChanged$: new Subject(),
    };
    purchaseOrderProductServiceMock = { purchaseOrderProductChanged$: new Subject() };
    paymentServiceMock = { paymentChanged$: new Subject() };
    routerMock = { navigateByUrl: vi.fn() };
    featureFlagServiceMock = { isEnabled: vi.fn().mockReturnValue(of(true)) };

    TestBed.configureTestingModule({});
    return TestBed.runInInjectionContext(
      () =>
        new PurchaseOrderDetailsPageComponent(
          activatedRouteMock as unknown as ActivatedRoute,
          purchaseOrderServiceMock as unknown as PurchaseOrderService,
          purchaseOrderProductServiceMock as unknown as PurchaseOrderProductService,
          paymentServiceMock as unknown as PaymentService,
          routerMock as unknown as Router,
          featureFlagServiceMock as unknown as FeatureFlagService,
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
    it('sets isEdit=false for a new purchase order', () => {
      const component = createComponent(null);
      component.ngOnInit();

      expect(component.isEdit).toBe(false);
      expect(component.data).toBeNull();
    });

    it('loads an existing purchase order by id', () => {
      const component = createComponent('po1');
      const response$ = new Subject<WebApiResponse<PurchaseOrder>>();
      purchaseOrderServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      expect(component.loading).toBe(true);
      expect(purchaseOrderServiceMock.getById).toHaveBeenCalledWith('po1');

      const data = { id: 'po1' } as PurchaseOrder;
      response$.next({ data } as WebApiResponse<PurchaseOrder>);

      expect(component.loading).toBe(false);
      expect(component.data).toBe(data);
    });

    it('navigates to not-found when the purchase order does not exist', () => {
      const component = createComponent('missing');
      const response$ = new Subject<WebApiResponse<PurchaseOrder>>();
      purchaseOrderServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      response$.next({ data: null } as unknown as WebApiResponse<PurchaseOrder>);

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });

    it('navigates to not-found and stops loading when the request errors', () => {
      const component = createComponent('po1');
      const response$ = new Subject<WebApiResponse<PurchaseOrder>>();
      purchaseOrderServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      response$.error(new Error('fail'));

      expect(component.loading).toBe(false);
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });

    it('re-fetches on a real purchaseOrderProductChanged$ event, but not on the skip(1)-dropped first one', () => {
      const component = createComponent('po1');
      const firstResponse$ = new Subject<WebApiResponse<PurchaseOrder>>();
      const secondResponse$ = new Subject<WebApiResponse<PurchaseOrder>>();
      purchaseOrderServiceMock.getById
        .mockReturnValueOnce(firstResponse$)
        .mockReturnValueOnce(secondResponse$);

      component.ngOnInit();
      firstResponse$.next({ data: { id: 'po1' } } as WebApiResponse<PurchaseOrder>);
      expect(purchaseOrderServiceMock.getById).toHaveBeenCalledTimes(1);

      purchaseOrderProductServiceMock.purchaseOrderProductChanged$.next();
      expect(purchaseOrderServiceMock.getById).toHaveBeenCalledTimes(1);

      purchaseOrderProductServiceMock.purchaseOrderProductChanged$.next();
      expect(purchaseOrderServiceMock.getById).toHaveBeenCalledTimes(2);

      secondResponse$.next({ data: { id: 'po1' } } as WebApiResponse<PurchaseOrder>);
      expect(component.data).toEqual({ id: 'po1' });
    });
  });

  describe('getStatusLabel', () => {
    it('returns an empty string when there is no data', () => {
      const component = createComponent(null);
      expect(component.getStatusLabel()).toBe('');
    });

    it('returns an empty string when data has no status', () => {
      const component = createComponent(null);
      component.data = { id: 'po1', status: null } as unknown as PurchaseOrder;
      expect(component.getStatusLabel()).toBe('');
    });

    it('resolves the mapped status label', () => {
      const component = createComponent(null);
      component.data = { id: 'po1', status: 'Open' } as unknown as PurchaseOrder;
      expect(component.getStatusLabel()).toBe('Em aberto');
    });

    it('falls back to an empty string for a status with no mapped label', () => {
      const component = createComponent(null);
      component.data = { id: 'po1', status: 'Unknown' } as unknown as PurchaseOrder;
      expect(component.getStatusLabel()).toBe('');
    });
  });

  it('ngOnDestroy does not throw', () => {
    const component = createComponent(null);
    component.ngOnInit();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });

  it('ngOnDestroy also unsubscribes from purchaseOrderChanged$/purchaseOrderProductChanged$/paymentChanged$ when editing', () => {
    const component = createComponent('po1');
    purchaseOrderServiceMock.getById.mockReturnValue(new Subject());
    component.ngOnInit();

    component.ngOnDestroy();
    purchaseOrderServiceMock.getById.mockClear();
    purchaseOrderServiceMock.purchaseOrderChanged$.next();
    purchaseOrderServiceMock.purchaseOrderChanged$.next();

    expect(purchaseOrderServiceMock.getById).not.toHaveBeenCalled();
  });
});
