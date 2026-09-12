import { ElementRef } from '@angular/core';
import { NgControl } from '@angular/forms';
import { CurrencyFormatDirective } from './currency-format.directive';

describe('CurrencyFormatDirective', () => {
  let input: HTMLInputElement;
  let controlMock: { control: { value: unknown; setValue: ReturnType<typeof vi.fn> } };

  function createDirective(initialValue: unknown): CurrencyFormatDirective {
    input = document.createElement('input');
    controlMock = { control: { value: initialValue, setValue: vi.fn() } };
    return new CurrencyFormatDirective(
      new ElementRef(input),
      controlMock as unknown as NgControl,
    );
  }

  it('should create', () => {
    expect(createDirective(null)).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('formats the initial control value into the input', () => {
      const directive = createDirective(1234.5);
      directive.ngOnInit();

      expect(input.value).toBe('1.234,50');
    });

    it('leaves the input empty when there is no initial value', () => {
      const directive = createDirective(null);
      directive.ngOnInit();

      expect(input.value).toBe('');
    });
  });

  describe('onFocus', () => {
    it('converts the formatted value to a plain comma-decimal string for editing', () => {
      const directive = createDirective(null);
      input.value = '1.234,50';

      directive.onFocus();

      expect(input.value).toBe('1234,5');
    });

    it('clears the input when there is nothing to convert', () => {
      const directive = createDirective(null);
      input.value = '';

      directive.onFocus();

      expect(input.value).toBe('');
    });
  });

  describe('onInput', () => {
    it('strips characters other than digits, dot, and comma while typing', () => {
      const directive = createDirective(null);
      input.value = 'R$ 1a2b,3c';

      directive.onInput();

      expect(input.value).toBe('12,3');
    });
  });

  describe('onBlur', () => {
    it('formats a typed value and pushes the numeric value to the form control', () => {
      const directive = createDirective(null);
      input.value = '1234,5';

      directive.onBlur();

      expect(controlMock.control.setValue).toHaveBeenCalledWith(1234.5);
      expect(input.value).toBe('1.234,50');
    });

    it('parses a value with a thousands separator correctly', () => {
      const directive = createDirective(null);
      input.value = '1.234,56';

      directive.onBlur();

      expect(controlMock.control.setValue).toHaveBeenCalledWith(1234.56);
    });

    it('clears the control and input when the typed value is not a number', () => {
      const directive = createDirective(null);
      input.value = '';

      directive.onBlur();

      expect(controlMock.control.setValue).toHaveBeenCalledWith(null);
      expect(input.value).toBe('');
    });
  });
});
