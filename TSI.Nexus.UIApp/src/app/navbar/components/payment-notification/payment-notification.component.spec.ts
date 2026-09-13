import { ModalService, Payment, PaymentService, PaymentStatus, TranslationService } from '@nexus/core';
import { Subject, of, throwError } from 'rxjs';
import { PaymentNotificationComponent } from './payment-notification.component';

describe('PaymentNotificationComponent', () => {
  let paymentChanged$: Subject<void>;
  let paymentServiceMock: {
    paymentChanged$: Subject<void>;
    getDelayed: ReturnType<typeof vi.fn>;
  };
  let modalServiceMock: { showTemplateModal: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };

  function createComponent(): PaymentNotificationComponent {
    paymentChanged$ = new Subject();
    paymentServiceMock = {
      paymentChanged$,
      getDelayed: vi.fn(),
    };
    modalServiceMock = { showTemplateModal: vi.fn() };
    routerMock = { navigate: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };

    return new PaymentNotificationComponent(
      modalServiceMock as unknown as ModalService,
      paymentServiceMock as unknown as PaymentService,
      routerMock as unknown as any,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit / paymentChanged$', () => {
    it('loads the delayed payments whenever paymentChanged$ emits', () => {
      const component = createComponent();
      paymentServiceMock.getDelayed.mockReturnValue(
        of({ data: [{ id: 'p1' } as Payment, { id: 'p2' } as Payment] }),
      );

      component.ngOnInit();
      paymentChanged$.next();

      expect(paymentServiceMock.getDelayed).toHaveBeenCalled();
      expect(component.payments).toEqual([{ id: 'p1' }, { id: 'p2' }]);
      expect(component.total).toBe(2);
    });

    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      paymentServiceMock.getDelayed.mockReturnValue(of({}));

      component.ngOnInit();
      paymentChanged$.next();

      expect(component.payments).toEqual([]);
      expect(component.total).toBe(0);
    });

    it('stops reloading after ngOnDestroy', () => {
      const component = createComponent();
      paymentServiceMock.getDelayed.mockReturnValue(of({ data: [{ id: 'p1' } as Payment] }));
      component.ngOnInit();
      component.ngOnDestroy();

      paymentChanged$.next();

      expect(paymentServiceMock.getDelayed).not.toHaveBeenCalled();
    });

    it('does not throw when destroyed before ngOnInit ever subscribed', () => {
      const component = createComponent();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('displayPayments', () => {
    it('returns at most the first 10 payments', () => {
      const component = createComponent();
      component.payments = Array.from({ length: 15 }, (_, i) => ({ id: `p${i}` }) as Payment);

      expect(component.displayPayments).toHaveLength(10);
      expect(component.displayPayments[0].id).toBe('p0');
    });
  });

  describe('showBadge', () => {
    it('is true when there are payments', () => {
      const component = createComponent();
      component.total = 1;

      expect(component.showBadge).toBe(true);
    });

    it('is false when there are no payments', () => {
      const component = createComponent();
      component.total = 0;

      expect(component.showBadge).toBe(false);
    });
  });

  describe('showSeeMore', () => {
    it('is true when there are more than 10 payments', () => {
      const component = createComponent();
      component.total = 11;

      expect(component.showSeeMore).toBe(true);
    });

    it('is false when there are 10 or fewer payments', () => {
      const component = createComponent();
      component.total = 10;

      expect(component.showSeeMore).toBe(false);
    });
  });

  describe('getStatusIcon', () => {
    it.each([
      [PaymentStatus.Delayed, 'bi bi-exclamation-triangle-fill text-danger'],
      [PaymentStatus.Pending, 'bi bi-hourglass-split text-info'],
      [PaymentStatus.Approved, 'bi bi-check-circle-fill text-success'],
    ])('resolves the icon for status %s', (status, expected) => {
      const component = createComponent();

      expect(component.getStatusIcon({ status } as Payment)).toBe(expected);
    });

    it('falls back to a question-circle icon for an unknown status', () => {
      const component = createComponent();

      expect(component.getStatusIcon({ status: undefined } as Payment)).toBe(
        'bi bi-question-circle',
      );
    });
  });

  describe('getStatusText', () => {
    it.each([
      [PaymentStatus.Delayed, 'NAVBAR.PAYMENT_DELAYED'],
      [PaymentStatus.Pending, 'NAVBAR.PAYMENT_PENDING'],
      [PaymentStatus.Approved, 'NAVBAR.PAYMENT_APPROVED'],
    ])('resolves the translated text for status %s', (status, expectedKey) => {
      const component = createComponent();

      expect(component.getStatusText({ status } as Payment)).toBe(expectedKey);
    });

    it('falls back to an unknown-status translation when the status is not mapped', () => {
      const component = createComponent();

      expect(component.getStatusText({ status: undefined } as Payment)).toBe(
        'NAVBAR.UNKNOWN_STATUS',
      );
    });
  });

  describe('getRelativeDate', () => {
    it('returns an empty string when there is no date', () => {
      const component = createComponent();

      expect(component.getRelativeDate(undefined)).toBe('');
    });

    it('returns the today translation when the date is today', () => {
      const component = createComponent();

      expect(component.getRelativeDate(new Date())).toBe('NAVBAR.TODAY');
    });

    it('returns the yesterday translation when the date is yesterday', () => {
      const component = createComponent();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      expect(component.getRelativeDate(yesterday)).toBe('NAVBAR.YESTERDAY');
    });

    it('returns a days-ago translation for older dates', () => {
      const component = createComponent();
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      component.getRelativeDate(fiveDaysAgo);

      expect(translationServiceMock.instant).toHaveBeenCalledWith('NAVBAR.DAYS_AGO', {
        days: '5',
      });
    });
  });

  describe('openModal', () => {
    it('shows the payment details modal with the payment data', () => {
      const component = createComponent();
      const payment = { id: 'p1', transactionId: 't1' } as Payment;

      component.openModal(payment);

      expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(expect.anything(), {
        isEdit: true,
        id: 'p1',
        data: payment,
        parentId: 't1',
      });
    });
  });

  describe('onSeeMore', () => {
    it('navigates to payments filtered by pending/delayed status and today as end date', () => {
      const component = createComponent();
      const now = new Date(2024, 2, 5);
      vi.useFakeTimers();
      vi.setSystemTime(now);

      component.onSeeMore();

      expect(routerMock.navigate).toHaveBeenCalledWith(['/payments'], {
        queryParams: {
          status: 'Pending,Delayed',
          endDate: '2024-03-05',
        },
      });
      vi.useRealTimers();
    });
  });
});
