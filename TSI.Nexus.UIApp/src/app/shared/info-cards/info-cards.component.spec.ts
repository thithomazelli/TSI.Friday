import { ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { ApiService, DashboardCard } from '@nexus/core';
import { of, throwError } from 'rxjs';
import { InfoCardsComponent } from './info-cards.component';

describe('InfoCardsComponent', () => {
  let apiServiceMock: { get: ReturnType<typeof vi.fn> };
  let sanitizerMock: { bypassSecurityTrustHtml: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };
  let cdrMock: { detectChanges: ReturnType<typeof vi.fn>; markForCheck: ReturnType<typeof vi.fn> };

  function createComponent(): InfoCardsComponent {
    apiServiceMock = { get: vi.fn().mockReturnValue(of({ data: [] })) };
    sanitizerMock = { bypassSecurityTrustHtml: vi.fn((html: string) => html as any) };
    routerMock = { navigate: vi.fn() };
    cdrMock = { detectChanges: vi.fn(), markForCheck: vi.fn() };

    return new InfoCardsComponent(
      apiServiceMock as unknown as ApiService,
      sanitizerMock as unknown as DomSanitizer,
      routerMock as unknown as Router,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('loads the cards for the default period', () => {
      const component = createComponent();

      component.ngOnInit();

      expect(apiServiceMock.get).toHaveBeenCalledWith('dashboard/getInfoCards/30');
    });
  });

  describe('onPeriodChange', () => {
    it('reloads the cards when the period actually changes', () => {
      const component = createComponent();

      component.onPeriodChange({ target: { value: '60' } } as unknown as Event);

      expect(component.selectedPeriod).toBe(60);
      expect(cdrMock.detectChanges).toHaveBeenCalled();
      expect(apiServiceMock.get).toHaveBeenCalledWith('dashboard/getInfoCards/60');
    });

    it('does nothing when the period is unchanged', () => {
      const component = createComponent();

      component.onPeriodChange({ target: { value: '30' } } as unknown as Event);

      expect(cdrMock.detectChanges).not.toHaveBeenCalled();
      expect(apiServiceMock.get).not.toHaveBeenCalled();
    });
  });

  describe('toggleFilters', () => {
    it('flips showFilters', () => {
      const component = createComponent();

      component.toggleFilters();
      expect(component.showFilters).toBe(true);

      component.toggleFilters();
      expect(component.showFilters).toBe(false);
    });
  });

  describe('getCardLink', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.UTC(2024, 2, 31)));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('links "Novos Pedidos" to /orders with the date range', () => {
      const component = createComponent();
      component.selectedPeriod = 30;

      const link = component.getCardLink({ title: 'Novos Pedidos' } as DashboardCard);

      expect(link.route).toEqual(['/orders']);
      expect(link.queryParams).toEqual({ startDate: '2024-03-01', endDate: '2024-03-31' });
    });

    it('links "Recebidos (%)" to /payments filtered by approved incoming', () => {
      const component = createComponent();

      const link = component.getCardLink({ title: 'Recebidos (%)' } as DashboardCard);

      expect(link.route).toEqual(['/payments']);
      expect(link.queryParams).toEqual(
        expect.objectContaining({ status: 'Approved', type: 'Incoming' }),
      );
    });

    it('links "Aguardando (%)" to /payments filtered by pending/delayed', () => {
      const component = createComponent();

      const link = component.getCardLink({ title: 'Aguardando (%)' } as DashboardCard);

      expect(link.route).toEqual(['/payments']);
      expect(link.queryParams).toEqual(
        expect.objectContaining({ status: 'Pending,Delayed' }),
      );
    });

    it('links "Em Breve" to the home route with no query params', () => {
      const component = createComponent();

      const link = component.getCardLink({ title: 'Em Breve' } as DashboardCard);

      expect(link.route).toEqual(['/']);
      expect(link.queryParams).toBeUndefined();
    });

    it('falls back to the home route for an unknown title', () => {
      const component = createComponent();

      const link = component.getCardLink({ title: 'Something Else' } as DashboardCard);

      expect(link.route).toEqual(['/']);
    });
  });

  describe('loadCards', () => {
    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(of({}));

      component.loadCards();

      expect(component.cards).toEqual([]);
      expect(component.loading).toBe(false);
    });

    it('clears the cards and marks for check when the request errors', () => {
      const component = createComponent();
      apiServiceMock.get.mockReturnValue(throwError(() => new Error('fail')));

      component.loadCards();

      expect(component.cards).toEqual([]);
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });
  });

  describe('trackByInfoCard', () => {
    it('returns the card title', () => {
      const component = createComponent();

      expect(component.trackByInfoCard(0, { title: 'X' } as DashboardCard)).toBe('X');
    });
  });

  describe('getCardColor', () => {
    it('colors a "pedido" card as primary', () => {
      const component = createComponent();
      expect(component.getCardColor({ title: 'Novos Pedidos' } as DashboardCard)).toBe(
        'text-bg-primary',
      );
    });

    it.each([
      [90, 'text-bg-success'],
      [60, 'text-bg-warning'],
      [10, 'text-bg-danger'],
    ])('colors a "recebido" card at %i%% as %s', (percent, expected) => {
      const component = createComponent();
      expect(
        component.getCardColor({ title: 'Recebidos (%)', value: `${percent}%` } as DashboardCard),
      ).toBe(expected);
    });

    it('colors an "aguardando" card as warning', () => {
      const component = createComponent();
      expect(component.getCardColor({ title: 'Aguardando (%)' } as DashboardCard)).toBe(
        'text-bg-warning',
      );
    });

    it('colors an "atraso" card with zero as success, and non-zero as danger', () => {
      const component = createComponent();
      expect(component.getCardColor({ title: 'Em Atraso', value: '0' } as DashboardCard)).toBe(
        'text-bg-success',
      );
      expect(component.getCardColor({ title: 'Em Atraso', value: '3' } as DashboardCard)).toBe(
        'text-bg-danger',
      );
    });

    it('treats a missing value as zero for a "recebido" card', () => {
      const component = createComponent();
      expect(component.getCardColor({ title: 'Recebidos (%)' } as DashboardCard)).toBe(
        'text-bg-danger',
      );
    });

    it('treats a missing value as zero (success) for an "atraso" card', () => {
      const component = createComponent();
      expect(component.getCardColor({ title: 'Em Atraso' } as DashboardCard)).toBe(
        'text-bg-success',
      );
    });

    it('falls back to primary for an unrecognized title', () => {
      const component = createComponent();
      expect(component.getCardColor({ title: 'Outro' } as DashboardCard)).toBe(
        'text-bg-primary',
      );
    });

    it('treats a missing title/value as empty when computing the color', () => {
      const component = createComponent();
      expect(component.getCardColor({} as DashboardCard)).toBe('text-bg-primary');
    });
  });

  describe('getCardIcon', () => {
    it('resolves a known icon by exact title', () => {
      const component = createComponent();

      component.getCardIcon({ title: 'Novos Pedidos' } as DashboardCard);

      expect(sanitizerMock.bypassSecurityTrustHtml).toHaveBeenCalledWith(
        expect.stringContaining('<svg'),
      );
    });

    it('falls back to a generic icon for an unknown title', () => {
      const component = createComponent();

      component.getCardIcon({ title: 'Unknown' } as DashboardCard);

      expect(sanitizerMock.bypassSecurityTrustHtml).toHaveBeenCalledWith(
        expect.stringContaining('<circle cx="12" cy="12" r="10"/>'),
      );
    });

    it('treats a missing title as empty when resolving the icon', () => {
      const component = createComponent();

      expect(() => component.getCardIcon({} as DashboardCard)).not.toThrow();
    });
  });

  describe('onViewDetails', () => {
    it('navigates using the resolved card link', () => {
      const component = createComponent();

      component.onViewDetails({ title: 'Em Breve' } as DashboardCard);

      expect(routerMock.navigate).toHaveBeenCalledWith(['/'], { queryParams: undefined });
    });
  });
});
