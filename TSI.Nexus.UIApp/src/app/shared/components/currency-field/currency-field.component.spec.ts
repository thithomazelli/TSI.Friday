import { CurrencyService } from '@nexus/core';
import { CurrencyFieldComponent } from './currency-field.component';

describe('CurrencyFieldComponent', () => {
  let currencyServiceMock: { formatCurrencyBRL: ReturnType<typeof vi.fn>; parseCurrencyBRL: ReturnType<typeof vi.fn> };
  let component: CurrencyFieldComponent;

  beforeEach(() => {
    currencyServiceMock = {
      formatCurrencyBRL: vi.fn((value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`),
      parseCurrencyBRL: vi.fn((value: string) => Number(value.replace(/\D/g, '')) / 100),
    };
    component = new CurrencyFieldComponent(currencyServiceMock as unknown as CurrencyService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('assigns each instance a unique fieldId', () => {
    const other = new CurrencyFieldComponent(currencyServiceMock as unknown as CurrencyService);
    expect(component.fieldId).not.toBe(other.fieldId);
  });

  it('formats null/undefined/empty values as zero on writeValue', () => {
    component.writeValue(null);
    expect(currencyServiceMock.formatCurrencyBRL).toHaveBeenCalledWith(0);

    component.writeValue(undefined);
    expect(currencyServiceMock.formatCurrencyBRL).toHaveBeenCalledWith(0);

    component.writeValue('');
    expect(currencyServiceMock.formatCurrencyBRL).toHaveBeenCalledWith(0);
  });

  it('formats a non-numeric value as zero on writeValue', () => {
    component.writeValue('abc');
    expect(currencyServiceMock.formatCurrencyBRL).toHaveBeenCalledWith(0);
  });

  it('formats a numeric value on writeValue and stores the display string', () => {
    component.writeValue(1234.5);
    expect(currencyServiceMock.formatCurrencyBRL).toHaveBeenCalledWith(1234.5);
    expect(component.displayValue).toBe('R$ 1234,50');
  });

  it('accepts a numeric string on writeValue', () => {
    component.writeValue('99.9');
    expect(currencyServiceMock.formatCurrencyBRL).toHaveBeenCalledWith(99.9);
  });

  it('registers the onChange/onTouched callbacks', () => {
    const onChange = vi.fn();
    const onTouched = vi.fn();
    component.registerOnChange(onChange);
    component.registerOnTouched(onTouched);

    component.onBlur();

    expect(onChange).toHaveBeenCalled();
    expect(onTouched).toHaveBeenCalled();
  });

  it('does nothing when onBlur runs before onChange/onTouched are registered', () => {
    component.displayValue = '1.234,50';

    expect(() => component.onBlur()).not.toThrow();
  });

  it('sets isDisabled via setDisabledState', () => {
    component.setDisabledState(true);
    expect(component.isDisabled).toBe(true);

    component.setDisabledState(false);
    expect(component.isDisabled).toBe(false);
  });

  it('updates displayValue as the user types, without reformatting', () => {
    component.onInputChange('12,3');
    expect(component.displayValue).toBe('12,3');
    expect(currencyServiceMock.formatCurrencyBRL).not.toHaveBeenCalled();
  });

  it('reformats the display value and propagates the parsed number on blur', () => {
    const onChange = vi.fn();
    component.registerOnChange(onChange);
    component.displayValue = '1.234,50';

    component.onBlur();

    expect(currencyServiceMock.parseCurrencyBRL).toHaveBeenCalledWith('1.234,50');
    expect(onChange).toHaveBeenCalledWith(1234.5);
    expect(component.displayValue).toBe('R$ 1234,50');
  });
});
