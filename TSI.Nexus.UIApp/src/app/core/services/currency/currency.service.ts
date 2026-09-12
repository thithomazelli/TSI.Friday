import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  constructor() {}

  formatCurrencyBRL(value?: any): string {
    const number = Number(value);
    if (isNaN(number) || value === undefined || value === null) {
      return 'R$ 0,00';
    }
    return number.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  parseCurrencyBRL(value: string | number | undefined | null): number {
    if (typeof value === 'number') {
      return value;
    }

    if (!value) {
      return 0;
    }

    let clean = String(value).replace(/[^0-9,.-]+/g, '');
    const lastComma = clean.lastIndexOf(',');

    if (lastComma !== -1) {
      // pt-BR uses '.' as the thousands separator and ',' as the decimal one - strip any dots
      // from the integer part (they're never a decimal point here) before swapping the decimal
      // comma for the dot parseFloat expects.
      clean =
        clean.slice(0, lastComma).replace(/\./g, '') +
        '.' +
        clean.slice(lastComma + 1);
    } else {
      // No decimal comma at all - any dots present can only be thousands separators (pt-BR
      // input never uses '.' as a decimal point), so they're stripped rather than left in place
      // for parseFloat to misread as a decimal point.
      clean = clean.replace(/\./g, '');
    }

    clean = clean.replace(/(?!^)-/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }
}
