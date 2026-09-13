import { ChangeDetectorRef } from '@angular/core';
import { ApiService, ApiType, PaymentType } from '@nexus/core';
import { of } from 'rxjs';
import { PieChartComponent } from './pie-chart.component';

describe('PieChartComponent', () => {
  let apiServiceMock: { get: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  function createComponent(): PieChartComponent {
    apiServiceMock = { get: vi.fn() };
    cdrMock = { markForCheck: vi.fn() };

    return new PieChartComponent(
      apiServiceMock as unknown as ApiService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit / ngOnChanges', () => {
    it('loads the chart on init', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of({ data: { Combustível: 100 } }));

      component.ngOnInit();

      expect(apiServiceMock.get).toHaveBeenCalled();
      expect(component.chartOptions.series).toEqual([100]);
    });

    it('reloads the chart on changes', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of({ data: {} }));

      component.ngOnChanges();

      expect(apiServiceMock.get).toHaveBeenCalled();
    });
  });

  describe('loadChart', () => {
    it('builds the series/labels from the response categories', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(
        of({ data: { Combustível: 100, Manutenção: 50 } }),
      );

      component.loadChart();

      expect(component.chartOptions.series).toEqual([100, 50]);
      expect(component.chartOptions.labels).toEqual(['Combustível', 'Manutenção']);
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('falls back to an empty payload when the response has no data', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of({}));

      component.loadChart();

      expect(component.chartOptions.series).toEqual([]);
      expect(component.chartOptions.labels).toEqual([]);
    });

    it('labels a blank category as "Sem categoria"', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of({ data: { '': 10, '   ': 20 } }));

      component.loadChart();

      expect(component.chartOptions.labels).toEqual(['Sem categoria', 'Sem categoria']);
    });

    it('treats a missing/null total as zero', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of({ data: { Combustível: null } }));

      component.loadChart();

      expect(component.chartOptions.series).toEqual([0]);
    });

    it('formats the dataLabels formatter as a percentage', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of({ data: {} }));

      component.loadChart();

      expect(component.chartOptions.dataLabels.formatter(12.345)).toBe('12.3%');
    });

    describe('tooltip.y.formatter', () => {
      it('resolves the real value and label from the series/labels config at the data point index', () => {
        const component = createComponent();
        apiServiceMock.get.mockReturnValue(of({ data: {} }));
        component.loadChart();

        const formatted = component.chartOptions.tooltip.y.formatter(0, {
          w: { config: { series: [250], labels: ['Combustível'] } },
          dataPointIndex: 0,
        });

        expect(formatted).toContain('Combustível');
        expect(formatted).toContain('250,00');
      });

      it('falls back to an empty label when the labels config is not an array', () => {
        const component = createComponent();
        apiServiceMock.get.mockReturnValue(of({ data: {} }));
        component.loadChart();

        const formatted = component.chartOptions.tooltip.y.formatter(250, {
          w: { config: { series: [250], labels: undefined } },
          dataPointIndex: 0,
        });

        expect(formatted).toContain('250,00');
      });

      it('falls back to an empty label when the labels array has no entry at the index', () => {
        const component = createComponent();
        apiServiceMock.get.mockReturnValue(of({ data: {} }));
        component.loadChart();

        const formatted = component.chartOptions.tooltip.y.formatter(250, {
          w: { config: { series: [250], labels: [] } },
          dataPointIndex: 0,
        });

        expect(formatted).not.toMatch(/^undefined/);
        expect(formatted).toContain('250,00');
      });

      it('uses the raw value when opts/config is missing', () => {
        const component = createComponent();
        apiServiceMock.get.mockReturnValue(of({ data: {} }));
        component.loadChart();

        const formatted = component.chartOptions.tooltip.y.formatter(99, undefined);

        expect(formatted).toContain('99,00');
      });

      it('uses the raw value when dataPointIndex is not a number', () => {
        const component = createComponent();
        apiServiceMock.get.mockReturnValue(of({ data: {} }));
        component.loadChart();

        const formatted = component.chartOptions.tooltip.y.formatter(42, {
          w: { config: { series: [1, 2, 3], labels: ['a', 'b', 'c'] } },
          dataPointIndex: 'x',
        });

        expect(formatted).toContain('42,00');
      });

      it('falls back to a raw value when the series config is not an array', () => {
        const component = createComponent();
        apiServiceMock.get.mockReturnValue(of({ data: {} }));
        component.loadChart();

        const formatted = component.chartOptions.tooltip.y.formatter(77, {
          w: { config: { series: undefined, labels: ['a'] } },
          dataPointIndex: 0,
        });

        expect(formatted).toContain('77,00');
      });
    });
  });

  describe('toggleCollapse', () => {
    it('flips isCardCollapsed', () => {
      const component = createComponent();

      component.toggleCollapse();
      expect(component.isCardCollapsed).toBe(true);

      component.toggleCollapse();
      expect(component.isCardCollapsed).toBe(false);
    });
  });

  describe('getEndPoint (via loadChart)', () => {
    it('requests the base category endpoint when there is no filter', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of({ data: {} }));

      component.loadChart();

      expect(apiServiceMock.get).toHaveBeenCalledWith(
        `${ApiType.Payments}/GetPaymentsGroupByCategory`,
      );
    });

    it('appends only the payment type when just paymentType is set', () => {
      const component = createComponent();
      component.paymentType = PaymentType.Incoming;
      apiServiceMock.get.mockReturnValue(of({ data: {} }));

      component.loadChart();

      expect(apiServiceMock.get).toHaveBeenCalledWith(
        `${ApiType.Payments}/GetPaymentsGroupByCategory?type=${encodeURIComponent(PaymentType.Incoming)}`,
      );
    });

    it('appends only the start date when just startDate is set', () => {
      const component = createComponent();
      component.startDate = new Date('2024-01-01T00:00:00.000Z');
      apiServiceMock.get.mockReturnValue(of({ data: {} }));

      component.loadChart();

      expect(apiServiceMock.get).toHaveBeenCalledWith(
        `${ApiType.Payments}/GetPaymentsGroupByCategory?start=${encodeURIComponent('2024-01-01T00:00:00.000Z')}`,
      );
    });

    it('appends only the end date when just endDate is set', () => {
      const component = createComponent();
      component.endDate = new Date('2024-01-31T00:00:00.000Z');
      apiServiceMock.get.mockReturnValue(of({ data: {} }));

      component.loadChart();

      expect(apiServiceMock.get).toHaveBeenCalledWith(
        `${ApiType.Payments}/GetPaymentsGroupByCategory?end=${encodeURIComponent('2024-01-31T00:00:00.000Z')}`,
      );
    });

    it('appends type and both dates when all filters are set', () => {
      const component = createComponent();
      component.paymentType = PaymentType.Outgoing;
      component.startDate = new Date('2024-01-01T00:00:00.000Z');
      component.endDate = new Date('2024-01-31T00:00:00.000Z');
      apiServiceMock.get.mockReturnValue(of({ data: {} }));

      component.loadChart();

      expect(apiServiceMock.get).toHaveBeenCalledWith(
        `${ApiType.Payments}/GetPaymentsGroupByCategory?type=${encodeURIComponent(PaymentType.Outgoing)}&start=${encodeURIComponent('2024-01-01T00:00:00.000Z')}&end=${encodeURIComponent('2024-01-31T00:00:00.000Z')}`,
      );
    });
  });
});
