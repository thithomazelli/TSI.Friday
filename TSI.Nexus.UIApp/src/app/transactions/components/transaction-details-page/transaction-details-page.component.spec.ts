import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import {
  PaymentService,
  PaymentStatus,
  PaymentType,
  Transaction,
  TransactionService,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { TransactionDetailsPageComponent } from './transaction-details-page.component';

describe('TransactionDetailsPageComponent', () => {
  let activatedRouteMock: { snapshot: { paramMap: { get: ReturnType<typeof vi.fn> } } };
  let paymentServiceMock: { paymentChanged$: Subject<void> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let transactionServiceMock: { getById: ReturnType<typeof vi.fn>; transactionChanged$: Subject<void> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let featureFlagServiceMock: { isEnabled: ReturnType<typeof vi.fn> };

  function createComponent(id: string | null): TransactionDetailsPageComponent {
    activatedRouteMock = { snapshot: { paramMap: { get: vi.fn().mockReturnValue(id) } } };
    paymentServiceMock = { paymentChanged$: new Subject() };
    routerMock = { navigateByUrl: vi.fn() };
    transactionServiceMock = { getById: vi.fn().mockReturnValue(new Subject()), transactionChanged$: new Subject() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    featureFlagServiceMock = { isEnabled: vi.fn().mockReturnValue(of(true)) };

    TestBed.configureTestingModule({});
    return TestBed.runInInjectionContext(
      () =>
        new TransactionDetailsPageComponent(
          activatedRouteMock as unknown as ActivatedRoute,
          paymentServiceMock as unknown as PaymentService,
          routerMock as unknown as Router,
          transactionServiceMock as unknown as TransactionService,
          translationServiceMock as unknown as TranslationService,
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
    it('sets isEdit=false for a new transaction', () => {
      const component = createComponent(null);
      component.ngOnInit();

      expect(component.isEdit).toBe(false);
      expect(component.data).toBeNull();
    });

    it('loads an existing transaction by id', () => {
      const component = createComponent('t1');
      const response$ = new Subject<WebApiResponse<Transaction>>();
      transactionServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      expect(component.loading).toBe(true);
      expect(transactionServiceMock.getById).toHaveBeenCalledWith('t1');

      const data = { id: 't1' } as Transaction;
      response$.next({ data } as WebApiResponse<Transaction>);

      expect(component.loading).toBe(false);
      expect(component.data).toBe(data);
    });

    it('navigates to not-found when the transaction does not exist', () => {
      const component = createComponent('missing');
      const response$ = new Subject<WebApiResponse<Transaction>>();
      transactionServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      response$.next({ data: null } as unknown as WebApiResponse<Transaction>);

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });

    it('navigates to not-found and stops loading when the request errors', () => {
      const component = createComponent('t1');
      const response$ = new Subject<WebApiResponse<Transaction>>();
      transactionServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      response$.error(new Error('fail'));

      expect(component.loading).toBe(false);
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });

    it('re-fetches on a real paymentChanged$ event, but not on the skip(1)-dropped first one', () => {
      const component = createComponent('t1');
      const firstResponse$ = new Subject<WebApiResponse<Transaction>>();
      const secondResponse$ = new Subject<WebApiResponse<Transaction>>();
      transactionServiceMock.getById
        .mockReturnValueOnce(firstResponse$)
        .mockReturnValueOnce(secondResponse$);

      component.ngOnInit();
      firstResponse$.next({ data: { id: 't1' } } as WebApiResponse<Transaction>);
      expect(transactionServiceMock.getById).toHaveBeenCalledTimes(1);

      paymentServiceMock.paymentChanged$.next();
      expect(transactionServiceMock.getById).toHaveBeenCalledTimes(1);

      paymentServiceMock.paymentChanged$.next();
      expect(transactionServiceMock.getById).toHaveBeenCalledTimes(2);

      secondResponse$.next({ data: { id: 't1' } } as WebApiResponse<Transaction>);
      expect(component.data).toEqual({ id: 't1' });
    });
  });

  describe('getTransactionStatusLabel/getPaymentTypeLabel', () => {
    it('return an empty string when there is no data', () => {
      const component = createComponent(null);
      expect(component.getTransactionStatusLabel()).toBe('');
      expect(component.getPaymentTypeLabel()).toBe('');
    });

    it('resolve translated labels once data is set', () => {
      const component = createComponent(null);
      component.data = { status: PaymentStatus.Approved, type: PaymentType.Incoming } as Transaction;

      expect(component.getTransactionStatusLabel()).toBe('TRANSACTIONS.STATUS_APPROVED');
      expect(component.getPaymentTypeLabel()).toBe('REPORTS.INCOMING');
    });
  });

  it('ngOnDestroy does not throw', () => {
    const component = createComponent(null);
    component.ngOnInit();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });

  it('ngOnDestroy also unsubscribes from transactionChanged$/paymentChanged$ when editing an existing transaction', () => {
    const component = createComponent('t1');
    transactionServiceMock.getById.mockReturnValue(new Subject());
    component.ngOnInit();

    component.ngOnDestroy();
    transactionServiceMock.getById.mockClear();
    transactionServiceMock.transactionChanged$.next();
    transactionServiceMock.transactionChanged$.next();

    expect(transactionServiceMock.getById).not.toHaveBeenCalled();
  });
});
