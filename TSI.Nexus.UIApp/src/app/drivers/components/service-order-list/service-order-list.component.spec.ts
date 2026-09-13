import {
  Commission,
  CommissionService,
  CommissionStatus,
  NotificationService,
  ServiceOrder,
  ServiceOrderService,
  TranslationService,
} from '@nexus/core';
import { Subject, of, throwError } from 'rxjs';
import { ServiceOrderListComponent } from './service-order-list.component';

describe('ServiceOrderListComponent', () => {
  let commissionServiceMock: { update: ReturnType<typeof vi.fn> };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let serviceOrderServiceMock: { getByDriver: ReturnType<typeof vi.fn> };
  let language$: Subject<string>;
  let translationServiceMock: {
    instant: ReturnType<typeof vi.fn>;
    language$: Subject<string>;
  };

  function createComponent(): ServiceOrderListComponent {
    commissionServiceMock = { update: vi.fn() };
    notificationServiceMock = { showMessage: vi.fn() };
    serviceOrderServiceMock = { getByDriver: vi.fn().mockReturnValue(of({ data: [] })) };
    language$ = new Subject();
    translationServiceMock = { instant: vi.fn((key: string) => key), language$ };

    return new ServiceOrderListComponent(
      commissionServiceMock as unknown as CommissionService,
      notificationServiceMock as unknown as NotificationService,
      serviceOrderServiceMock as unknown as ServiceOrderService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds the column defs and loads the service orders', () => {
      const component = createComponent();
      component.driverId = 'd1';

      component.ngOnInit();

      expect(component.columnDefs.length).toBeGreaterThan(0);
      expect(serviceOrderServiceMock.getByDriver).toHaveBeenCalledWith('d1');
    });

    it('rebuilds the column defs on language change', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.columnDefs;

      language$.next('en');

      expect(component.columnDefs).not.toBe(before);
    });
  });

  describe('ngOnChanges', () => {
    it('reloads when driverId changes after the first change', () => {
      const component = createComponent();
      component.driverId = 'd2';

      component.ngOnChanges({ driverId: { firstChange: false } as any });

      expect(serviceOrderServiceMock.getByDriver).toHaveBeenCalledWith('d2');
    });

    it('does not reload on the first change', () => {
      const component = createComponent();
      component.driverId = 'd2';

      component.ngOnChanges({ driverId: { firstChange: true } as any });

      expect(serviceOrderServiceMock.getByDriver).not.toHaveBeenCalled();
    });

    it('does nothing when driverId is not part of the change set', () => {
      const component = createComponent();

      expect(() => component.ngOnChanges({})).not.toThrow();
      expect(serviceOrderServiceMock.getByDriver).not.toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('stops reacting to language changes', () => {
      const component = createComponent();
      component.ngOnInit();
      component.ngOnDestroy();
      const before = component.columnDefs;

      language$.next('en');

      expect(component.columnDefs).toBe(before);
    });
  });

  describe('refresh', () => {
    it('reloads and shows the response notification', () => {
      const component = createComponent();
      component.driverId = 'd1';
      serviceOrderServiceMock.getByDriver.mockReturnValue(
        of({ status: 'Success', message: 'Atualizado', data: [] }),
      );

      component.refresh();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Success', 'Atualizado');
    });
  });

  describe('noop', () => {
    it('does nothing', () => {
      const component = createComponent();
      expect(() => component.noop()).not.toThrow();
    });
  });

  describe('markAsPaid', () => {
    it('does nothing when the service order has no commission', () => {
      const component = createComponent();

      component.markAsPaid({ id: 'so1' } as ServiceOrder);

      expect(commissionServiceMock.update).not.toHaveBeenCalled();
    });

    it('updates the commission to Paid and reloads', () => {
      const component = createComponent();
      component.driverId = 'd1';
      const serviceOrder = {
        id: 'so1',
        commission: { id: 'c1', status: CommissionStatus.Pending } as Commission,
      } as ServiceOrder;
      commissionServiceMock.update.mockReturnValue(
        of({ status: 'Success', message: 'Pago' }),
      );

      component.markAsPaid(serviceOrder);

      expect(commissionServiceMock.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'c1', status: CommissionStatus.Paid }),
      );
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Success', 'Pago');
      expect(serviceOrderServiceMock.getByDriver).toHaveBeenCalledWith('d1');
    });
  });

  describe('load (private, via ngOnInit)', () => {
    it('does nothing when there is no driverId', () => {
      const component = createComponent();
      component.driverId = '' as any;

      component.ngOnInit();

      expect(serviceOrderServiceMock.getByDriver).not.toHaveBeenCalled();
      expect(component.loading).toBe(false);
    });

    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      component.driverId = 'd1';
      serviceOrderServiceMock.getByDriver.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.rowData).toEqual([]);
      expect(component.loading).toBe(false);
    });

    it('stops loading without throwing when the request errors', () => {
      const component = createComponent();
      component.driverId = 'd1';
      serviceOrderServiceMock.getByDriver.mockReturnValue(throwError(() => new Error('fail')));

      component.ngOnInit();

      expect(component.loading).toBe(false);
    });
  });

  describe('column defs cell renderers', () => {
    it('formats issueDate as a BR date', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'issueDate')!;

      expect((column.valueFormatter as (p: any) => string)({ value: '2024-01-15' } as any)).toContain(
        '/',
      );
    });

    it('formats commission.baseAmount and commission.amount as BRL currency', () => {
      const component = createComponent();
      component.ngOnInit();
      const baseColumn = component.columnDefs.find((c) => c.field === 'commission.baseAmount')!;
      const amountColumn = component.columnDefs.find((c) => c.field === 'commission.amount')!;

      expect((baseColumn.valueFormatter as (p: any) => string)({ value: 100 } as any)).toContain('R$');
      expect((amountColumn.valueFormatter as (p: any) => string)({ value: 50 } as any)).toContain('R$');
    });

    it('formats commission.percentage with a % suffix, falling back to an empty string', () => {
      const component = createComponent();
      component.ngOnInit();
      const column = component.columnDefs.find((c) => c.field === 'commission.percentage')!;

      expect((column.valueFormatter as (p: any) => string)({ value: 10 } as any)).toBe('10%');
      expect((column.valueFormatter as (p: any) => string)({ value: null } as any)).toBe('');
    });

    describe('commission.status column', () => {
      it('renders an empty string when there is no status', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.find((c) => c.field === 'commission.status')!;

        expect((column.cellRenderer as (p: any) => string)({ value: null })).toBe('');
      });

      it.each([
        ['Pending', 'warning', 'DRIVERS.COMMISSION_STATUS_PENDING'],
        ['Paid', 'success', 'DRIVERS.COMMISSION_STATUS_PAID'],
        ['Cancelled', 'secondary', 'DRIVERS.COMMISSION_STATUS_CANCELLED'],
      ])('renders status %s with the %s color and translated label', (status, color, label) => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.find((c) => c.field === 'commission.status')!;

        const html = (column.cellRenderer as (p: any) => string)({ value: status });

        expect(html).toContain(`bg-${color}`);
        expect(html).toContain(label);
      });

      it('falls back to a secondary badge with the raw value for an unknown status', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs.find((c) => c.field === 'commission.status')!;

        const html = (column.cellRenderer as (p: any) => string)({ value: 'Unknown' });

        expect(html).toContain('bg-secondary');
        expect(html).toContain('Unknown');
      });
    });

    describe('actions column', () => {
      it('renders nothing when the commission is not Pending', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs[component.columnDefs.length - 1];

        const html = (column.cellRenderer as (p: any) => string)({
          data: { commission: { status: CommissionStatus.Paid } },
        });

        expect(html).toBe('');
      });

      it('renders nothing when there is no commission at all', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs[component.columnDefs.length - 1];

        const html = (column.cellRenderer as (p: any) => string)({ data: {} });

        expect(html).toBe('');
      });

      it('renders the pay button when the commission is Pending', () => {
        const component = createComponent();
        component.ngOnInit();
        const column = component.columnDefs[component.columnDefs.length - 1];

        const html = (column.cellRenderer as (p: any) => string)({
          data: { commission: { status: CommissionStatus.Pending } },
        });

        expect(html).toContain('data-action="update"');
        expect(html).toContain('DRIVERS.PAY_BUTTON');
      });
    });
  });
});
