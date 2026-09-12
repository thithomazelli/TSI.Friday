import { TranslationService } from '@nexus/core';
import { Subject } from 'rxjs';
import { AlertBannerComponentComponent } from './alert-banner-component.component';

describe('AlertBannerComponentComponent', () => {
  let language$: Subject<string>;
  let translationServiceMock: { instant: ReturnType<typeof vi.fn>; language$: Subject<string> };

  function createComponent(): AlertBannerComponentComponent {
    language$ = new Subject();
    translationServiceMock = {
      instant: vi.fn((key: string) => key),
      language$,
    };

    return new AlertBannerComponentComponent(
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds the status messages and rebuilds them when the language changes', () => {
      const component = createComponent();
      component.status = 'Pending';
      component.ngOnInit();

      expect(component.statusMessage).toBe('ALERT_BANNER.OPEN_STATUS');

      translationServiceMock.instant.mockImplementation((key: string) =>
        key === 'ALERT_BANNER.OPEN_STATUS' ? 'traduzido' : key,
      );
      language$.next('en');

      expect(component.statusMessage).toBe('traduzido');
    });

    it('uses the feminine wording when the entity is a transaction', () => {
      const component = createComponent();
      translationServiceMock.instant.mockImplementation((key: string) =>
        key === 'TRANSACTIONS.SINGULAR' ? 'Transação' : key,
      );
      component.entity = 'Transação';
      component.status = 'Approved';

      component.ngOnInit();

      expect(component.statusMessage).toBe('ALERT_BANNER.COMPLETED_FEM');
    });

    it('uses the masculine wording for any other entity', () => {
      const component = createComponent();
      translationServiceMock.instant.mockImplementation((key: string) =>
        key === 'TRANSACTIONS.SINGULAR' ? 'Transação' : key,
      );
      component.entity = 'Pedido';
      component.status = 'Approved';

      component.ngOnInit();

      expect(component.statusMessage).toBe('ALERT_BANNER.COMPLETED_MASC');
    });
  });

  describe('statusIcon', () => {
    it('maps a known status to its icon', () => {
      const component = createComponent();
      component.status = 'Delayed';

      expect(component.statusIcon).toBe('exclamation');
    });

    it('falls back to the default icon for an unknown or missing status', () => {
      const component = createComponent();
      component.status = 'SomethingUnknown';

      expect(component.statusIcon).toBe('info');

      component.status = undefined;
      expect(component.statusIcon).toBe('info');
    });
  });

  describe('statusColor', () => {
    it('maps a known status to its color', () => {
      const component = createComponent();
      component.status = 'MissingPayments';

      expect(component.statusColor).toBe('danger');
    });

    it('falls back to the default color for an unknown or missing status', () => {
      const component = createComponent();
      component.status = 'SomethingUnknown';

      expect(component.statusColor).toBe('secondary');

      component.status = undefined;
      expect(component.statusColor).toBe('secondary');
    });
  });

  describe('statusMessage', () => {
    it('falls back to the raw status when there is no mapped message', () => {
      const component = createComponent();
      component.ngOnInit();
      component.status = 'SomethingUnknown';

      expect(component.statusMessage).toBe('SomethingUnknown');
    });

    it('falls back to an empty string when there is no status at all', () => {
      const component = createComponent();
      component.ngOnInit();
      component.status = undefined;

      expect(component.statusMessage).toBe('');
    });
  });
});
