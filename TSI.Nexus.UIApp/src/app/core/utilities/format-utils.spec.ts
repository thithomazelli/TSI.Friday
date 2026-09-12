import {
  formatCPF,
  formatCNPJ,
  formatDocument,
  formatCurrencyBRL,
  formatDateBR,
  formatDateTimeBR,
} from './format-utils';

describe('formatCPF', () => {
  it('formats an 11-digit unformatted CPF', () => {
    expect(formatCPF('12345678901')).toBe('123.456.789-01');
  });

  it('strips existing punctuation before formatting', () => {
    expect(formatCPF('123.456.789-01')).toBe('123.456.789-01');
  });

  it('returns the cleaned digits unformatted when length is not 11', () => {
    expect(formatCPF('123')).toBe('123');
  });

  it('returns empty string for null/undefined/empty input', () => {
    expect(formatCPF(null)).toBe('');
    expect(formatCPF(undefined)).toBe('');
    expect(formatCPF('')).toBe('');
  });
});

describe('formatCNPJ', () => {
  it('formats a 14-digit unformatted CNPJ', () => {
    expect(formatCNPJ('12345678000199')).toBe('12.345.678/0001-99');
  });

  it('strips existing punctuation before formatting', () => {
    expect(formatCNPJ('12.345.678/0001-99')).toBe('12.345.678/0001-99');
  });

  it('returns the cleaned digits unformatted when length is not 14', () => {
    expect(formatCNPJ('123')).toBe('123');
  });

  it('returns empty string for null/undefined/empty input', () => {
    expect(formatCNPJ(null)).toBe('');
    expect(formatCNPJ(undefined)).toBe('');
    expect(formatCNPJ('')).toBe('');
  });
});

describe('formatDocument', () => {
  it('formats as CPF when clean length is 11', () => {
    expect(formatDocument('12345678901')).toBe('123.456.789-01');
  });

  it('formats as CNPJ when clean length is 14', () => {
    expect(formatDocument('12345678000199')).toBe('12.345.678/0001-99');
  });

  it('returns the original value when length matches neither CPF nor CNPJ', () => {
    expect(formatDocument('123')).toBe('123');
  });

  it('returns empty string for null/undefined/empty input', () => {
    expect(formatDocument(null)).toBe('');
    expect(formatDocument(undefined)).toBe('');
    expect(formatDocument('')).toBe('');
  });
});

describe('formatCurrencyBRL', () => {
  it('formats a numeric value as BRL currency', () => {
    expect(formatCurrencyBRL(1234.5)).toBe(
      (1234.5).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    );
  });

  it('formats a numeric string value as BRL currency', () => {
    expect(formatCurrencyBRL('1234.5')).toBe(
      (1234.5).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    );
  });

  it('returns empty string for null/undefined/empty value', () => {
    expect(formatCurrencyBRL(null)).toBe('');
    expect(formatCurrencyBRL(undefined)).toBe('');
    expect(formatCurrencyBRL('')).toBe('');
  });

  it('returns the original value stringified when not numeric', () => {
    expect(formatCurrencyBRL('abc')).toBe('abc');
  });
});

describe('formatDateBR', () => {
  it('formats a Date object as dd/MM/yyyy', () => {
    expect(formatDateBR(new Date(2024, 0, 5))).toBe('05/01/2024');
  });

  it('formats an ISO date string as dd/MM/yyyy', () => {
    expect(formatDateBR('2024-03-15T00:00:00')).toBe('15/03/2024');
  });

  it('returns empty string for null/undefined value', () => {
    expect(formatDateBR(null)).toBe('');
    expect(formatDateBR(undefined)).toBe('');
  });

  it('returns empty string for an invalid date', () => {
    expect(formatDateBR('not-a-date')).toBe('');
  });
});

describe('formatDateTimeBR', () => {
  it('formats a Date object as dd/MM/yyyy HH:mm', () => {
    const date = new Date(2024, 0, 5, 8, 7);
    expect(formatDateTimeBR(date)).toBe('05/01/2024 08:07');
  });

  it('returns empty string for null/undefined value', () => {
    expect(formatDateTimeBR(null)).toBe('');
    expect(formatDateTimeBR(undefined)).toBe('');
  });

  it('returns empty string for an invalid date', () => {
    expect(formatDateTimeBR('not-a-date')).toBe('');
  });
});
