import { ChangeDetectorRef } from '@angular/core';
import { ApiService, TranslationService, WebApiResponse } from '@nexus/core';
import { of } from 'rxjs';
import { AreaChartComponent } from './area-chart.component';

describe('AreaChartComponent', () => {
  let apiServiceMock: { get: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  const responseData = {
    incoming: [100, 200],
    outgoing: [50, 75],
    categories: ['Jan', 'Fev'],
    monthsData: [
      { full: 'Janeiro', yyyy: 2024 },
      { full: 'Fevereiro', yyyy: 2024 },
    ],
  };

  function createComponent(): AreaChartComponent {
    apiServiceMock = {
      get: vi.fn().mockReturnValue(of({ data: responseData } as unknown as WebApiResponse<any>)),
    };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };

    return new AreaChartComponent(
      apiServiceMock as unknown as ApiService,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('loadChart (via ngOnInit)', () => {
    it('builds the chart series, categories and translated legend names', () => {
      const component = createComponent();

      component.ngOnInit();

      expect(component.chartOptions.series).toEqual([
        { name: 'REPORTS.INCOMING', data: [100, 200] },
        { name: 'REPORTS.OUTGOING', data: [50, 75] },
      ]);
      expect(component.chartOptions.xaxis.categories).toEqual(['Jan', 'Fev']);
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('reloads the chart on ngOnChanges', () => {
      const component = createComponent();
      component.ngOnInit();

      component.ngOnChanges();

      expect(apiServiceMock.get).toHaveBeenCalledTimes(2);
    });

    describe('yaxis.labels.formatter', () => {
      it('formats a numeric value as BRL currency', () => {
        const component = createComponent();
        component.ngOnInit();

        const formatted = component.chartOptions.yaxis.labels.formatter(1234.5);

        expect(formatted).toContain('R$');
      });

      it('returns a non-numeric value unchanged', () => {
        const component = createComponent();
        component.ngOnInit();

        expect(component.chartOptions.yaxis.labels.formatter('n/a')).toBe('n/a');
      });
    });

    describe('tooltip.x.formatter', () => {
      it('returns the month name and year for a known data point index', () => {
        const component = createComponent();
        component.ngOnInit();

        const label = component.chartOptions.tooltip.x.formatter('ignored', { dataPointIndex: 0 });

        expect(label).toBe('Janeiro 2024');
      });

      it('falls back to the raw value when the data point index is negative', () => {
        const component = createComponent();
        component.ngOnInit();

        const label = component.chartOptions.tooltip.x.formatter('raw', { dataPointIndex: -1 });

        expect(label).toBe('raw');
      });

      it('falls back to the raw value when there is no monthsData entry at that index', () => {
        const component = createComponent();
        component.ngOnInit();

        const label = component.chartOptions.tooltip.x.formatter('raw', { dataPointIndex: 99 });

        expect(label).toBe('raw');
      });
    });

    describe('tooltip.y.formatter', () => {
      it('formats a numeric value as BRL currency', () => {
        const component = createComponent();
        component.ngOnInit();

        const formatted = component.chartOptions.tooltip.y.formatter(1234.5);

        expect(formatted).toContain('R$');
      });

      it('returns a non-numeric value unchanged', () => {
        const component = createComponent();
        component.ngOnInit();

        expect(component.chartOptions.tooltip.y.formatter('n/a')).toBe('n/a');
      });
    });
  });

  describe('toggleCollapse', () => {
    it('flips isCardCollapsed', () => {
      const component = createComponent();

      expect(component.isCardCollapsed).toBe(false);
      component.toggleCollapse();
      expect(component.isCardCollapsed).toBe(true);
      component.toggleCollapse();
      expect(component.isCardCollapsed).toBe(false);
    });
  });

  describe('getEndPoint (via loadChart)', () => {
    it('uses the base endpoint when no date range is set', () => {
      const component = createComponent();

      component.ngOnInit();

      expect(apiServiceMock.get).toHaveBeenCalledWith('payments/GetPaymentsHistory');
    });

    it('appends only start when only startDate is set', () => {
      const component = createComponent();
      component.startDate = new Date('2024-01-01T00:00:00.000Z');

      component.ngOnInit();

      expect(apiServiceMock.get).toHaveBeenCalledWith(
        `payments/GetPaymentsHistory?start=${encodeURIComponent('2024-01-01T00:00:00.000Z')}`,
      );
    });

    it('appends only end when only endDate is set', () => {
      const component = createComponent();
      component.endDate = new Date('2024-01-31T00:00:00.000Z');

      component.ngOnInit();

      expect(apiServiceMock.get).toHaveBeenCalledWith(
        `payments/GetPaymentsHistory?end=${encodeURIComponent('2024-01-31T00:00:00.000Z')}`,
      );
    });

    it('appends both start and end when both dates are set', () => {
      const component = createComponent();
      component.startDate = new Date('2024-01-01T00:00:00.000Z');
      component.endDate = new Date('2024-01-31T00:00:00.000Z');

      component.ngOnInit();

      expect(apiServiceMock.get).toHaveBeenCalledWith(
        `payments/GetPaymentsHistory?start=${encodeURIComponent('2024-01-01T00:00:00.000Z')}&end=${encodeURIComponent('2024-01-31T00:00:00.000Z')}`,
      );
    });
  });
});
