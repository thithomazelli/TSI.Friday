import { TestBed } from '@angular/core/testing';
import { TranslationService } from './translation.service';

describe('TranslationService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
    TestBed.configureTestingModule({});
  });

  function createService(): TranslationService {
    return TestBed.inject(TranslationService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('defaults to pt-BR when nothing is stored', () => {
    const service = createService();

    expect(service.current).toBe('pt-BR');
    expect(document.documentElement.getAttribute('lang')).toBe('pt-BR');
  });

  it('reads the stored language on construction', () => {
    localStorage.setItem('app-language', 'en');

    const service = createService();

    expect(service.current).toBe('en');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });

  it('ignores an invalid stored value and falls back to pt-BR', () => {
    localStorage.setItem('app-language', 'fr');

    const service = createService();

    expect(service.current).toBe('pt-BR');
  });

  it('use() sets the DOM lang attribute, persists to localStorage, and updates current/language$', () => {
    const service = createService();
    let latest: string | undefined;
    service.language$.subscribe((l) => (latest = l));
    TestBed.flushEffects();

    service.use('es');
    TestBed.flushEffects();

    expect(service.current).toBe('es');
    expect(document.documentElement.getAttribute('lang')).toBe('es');
    expect(localStorage.getItem('app-language')).toBe('es');
    expect(latest).toBe('es');
  });

  describe('instant', () => {
    it('resolves a nested key from the current language dictionary', () => {
      const service = createService();

      expect(service.instant('SIDEBAR.HOME')).toBe('Home');
    });

    it('resolves from the newly selected language after use()', () => {
      const service = createService();
      service.use('en');

      expect(service.instant('APP_TITLE')).not.toBe('Nexus | Gestão Empresarial');
    });

    it('returns the key itself when it cannot be resolved', () => {
      const service = createService();

      expect(service.instant('NOT.A.REAL.KEY')).toBe('NOT.A.REAL.KEY');
    });

    it('substitutes {name} placeholders from params', () => {
      const service = createService();

      expect(service.instant('{greeting}, {name}!', { greeting: 'Oi', name: 'Ana' })).toBe(
        'Oi, Ana!',
      );
    });
  });
});
