import { CurrencyService } from './currency.service';

describe('CurrencyService', () => {
  function createService(): CurrencyService {
    return new CurrencyService();
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  describe('formatCurrencyBRL', () => {
    it('formats a positive number as BRL currency', () => {
      const service = createService();
      expect(service.formatCurrencyBRL(1234.5)).toBe(
        (1234.5).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      );
    });

    it('returns R$ 0,00 for undefined', () => {
      const service = createService();
      expect(service.formatCurrencyBRL(undefined)).toBe('R$ 0,00');
    });

    it('returns R$ 0,00 for null', () => {
      const service = createService();
      expect(service.formatCurrencyBRL(null)).toBe('R$ 0,00');
    });

    it('returns R$ 0,00 for a non-numeric value', () => {
      const service = createService();
      expect(service.formatCurrencyBRL('not a number')).toBe('R$ 0,00');
    });
  });

  describe('parseCurrencyBRL', () => {
    it('returns a plain number unchanged', () => {
      const service = createService();
      expect(service.parseCurrencyBRL(42)).toBe(42);
    });

    it('returns 0 for null/undefined/empty', () => {
      const service = createService();
      expect(service.parseCurrencyBRL(null)).toBe(0);
      expect(service.parseCurrencyBRL(undefined)).toBe(0);
      expect(service.parseCurrencyBRL('')).toBe(0);
    });

    it('parses a pt-BR formatted string (thousands dot, decimal comma)', () => {
      const service = createService();
      expect(service.parseCurrencyBRL('1.234,56')).toBe(1234.56);
    });

    it('parses a large value with multiple thousands separators', () => {
      const service = createService();
      expect(service.parseCurrencyBRL('1.234.567,89')).toBe(1234567.89);
    });

    it('parses a plain string with just a decimal comma', () => {
      const service = createService();
      expect(service.parseCurrencyBRL('42,5')).toBe(42.5);
    });

    it('parses a whole-number string with a thousands dot and no decimal comma', () => {
      const service = createService();
      expect(service.parseCurrencyBRL('1.500')).toBe(1500);
    });

    it('strips a currency symbol and spaces', () => {
      const service = createService();
      expect(service.parseCurrencyBRL('R$ 100,00')).toBe(100);
    });

    it('strips a currency symbol from a thousands-separated amount', () => {
      const service = createService();
      expect(service.parseCurrencyBRL('R$ 1.234,56')).toBe(1234.56);
    });

    it('returns 0 for an unparseable string', () => {
      const service = createService();
      expect(service.parseCurrencyBRL('abc')).toBe(0);
    });
  });
});
