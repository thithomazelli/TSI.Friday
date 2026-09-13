import { ChangeDetectorRef } from '@angular/core';
import { ApiService, ApiType, TranslationService } from '@nexus/core';
import { of } from 'rxjs';
import { AreaChartTrendingComponent } from './area-chart-trending.component';

describe('AreaChartTrendingComponent', () => {
  let apiServiceMock: { get: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  function createComponent(): AreaChartTrendingComponent {
    apiServiceMock = { get: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };

    return new AreaChartTrendingComponent(
      apiServiceMock as unknown as ApiService,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  function mockResponse(overrides: Partial<any> = {}) {
    return {
      data: {
        incoming: [10, 20, 30],
        outgoing: [5, 15, 25],
        categories: ['Jan', 'Fev', 'Mar'],
        monthsData: [
          { full: 'Janeiro', yyyy: '2024' },
          { full: 'Fevereiro', yyyy: '2024' },
          { full: 'Março', yyyy: '2024' },
        ],
        ...overrides,
      },
    };
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit / ngOnChanges', () => {
    it('loads the chart on init', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of(mockResponse()));

      component.ngOnInit();

      expect(apiServiceMock.get).toHaveBeenCalled();
      expect(component.chartOptions.series[0].data).toEqual([10, 20, 30]);
    });

    it('reloads the chart on changes', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of(mockResponse()));

      component.ngOnChanges();

      expect(apiServiceMock.get).toHaveBeenCalled();
    });
  });

  describe('loadChart', () => {
    it('builds the incoming/outgoing series and their trend lines', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of(mockResponse()));

      component.loadChart();

      const series = component.chartOptions.series;
      expect(series).toHaveLength(4);
      expect(series[0].name).toBe('REPORTS.INCOMING');
      expect(series[0].data).toEqual([10, 20, 30]);
      expect(series[1].name).toBe('REPORTS.OUTGOING');
      expect(series[1].data).toEqual([5, 15, 25]);
      expect(series[2].name).toBe('DASHBOARD.TREND_INCOMING');
      expect(series[2].data).toHaveLength(3);
      expect(series[3].name).toBe('DASHBOARD.TREND_OUTGOING');
      expect(series[3].data).toHaveLength(3);
      expect(component.chartOptions.xaxis.categories).toEqual(['Jan', 'Fev', 'Mar']);
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('formats the yaxis label as BRL currency for numeric values', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of(mockResponse()));

      component.loadChart();

      const formatted = component.chartOptions.yaxis.labels.formatter(1234.5);
      expect(formatted).toContain('1.234,50');
    });

    it('returns the raw value from the yaxis formatter when it is not a number', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of(mockResponse()));

      component.loadChart();

      expect(component.chartOptions.yaxis.labels.formatter('n/a' as any)).toBe('n/a');
    });

    it('resolves the tooltip x label from the matching monthsData entry', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of(mockResponse()));

      component.loadChart();

      const formatted = component.chartOptions.tooltip.x.formatter('Jan', { dataPointIndex: 0 });
      expect(formatted).toBe('Janeiro 2024');
    });

    it('falls back to the raw value in the tooltip x formatter when the index is negative', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of(mockResponse()));

      component.loadChart();

      const formatted = component.chartOptions.tooltip.x.formatter('Jan', { dataPointIndex: -1 });
      expect(formatted).toBe('Jan');
    });

    it('falls back to the raw value in the tooltip x formatter when there is no matching month', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of(mockResponse()));

      component.loadChart();

      const formatted = component.chartOptions.tooltip.x.formatter('Jan', { dataPointIndex: 10 });
      expect(formatted).toBe('Jan');
    });

    it('formats the tooltip y value as BRL currency for numeric values', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of(mockResponse()));

      component.loadChart();

      const formatted = component.chartOptions.tooltip.y.formatter(500);
      expect(formatted).toContain('500,00');
    });

    it('returns the raw value from the tooltip y formatter when it is not a number', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of(mockResponse()));

      component.loadChart();

      expect(component.chartOptions.tooltip.y.formatter('n/a' as any)).toBe('n/a');
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
    it('requests the base payments history endpoint when there is no date filter', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of(mockResponse()));

      component.loadChart();

      expect(apiServiceMock.get).toHaveBeenCalledWith(`${ApiType.Payments}/GetPaymentsHistory`);
    });

    it('appends only the start date when just startDate is set', () => {
      const component = createComponent();
      component.startDate = new Date('2024-01-01T00:00:00.000Z');
      apiServiceMock.get.mockReturnValue(of(mockResponse()));

      component.loadChart();

      expect(apiServiceMock.get).toHaveBeenCalledWith(
        `${ApiType.Payments}/GetPaymentsHistory?start=${encodeURIComponent('2024-01-01T00:00:00.000Z')}`,
      );
    });

    it('appends only the end date when just endDate is set', () => {
      const component = createComponent();
      component.endDate = new Date('2024-01-31T00:00:00.000Z');
      apiServiceMock.get.mockReturnValue(of(mockResponse()));

      component.loadChart();

      expect(apiServiceMock.get).toHaveBeenCalledWith(
        `${ApiType.Payments}/GetPaymentsHistory?end=${encodeURIComponent('2024-01-31T00:00:00.000Z')}`,
      );
    });

    it('appends both dates when startDate and endDate are set', () => {
      const component = createComponent();
      component.startDate = new Date('2024-01-01T00:00:00.000Z');
      component.endDate = new Date('2024-01-31T00:00:00.000Z');
      apiServiceMock.get.mockReturnValue(of(mockResponse()));

      component.loadChart();

      expect(apiServiceMock.get).toHaveBeenCalledWith(
        `${ApiType.Payments}/GetPaymentsHistory?start=${encodeURIComponent('2024-01-01T00:00:00.000Z')}&end=${encodeURIComponent('2024-01-31T00:00:00.000Z')}`,
      );
    });
  });
});
