import { Component, ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, NgControl, ReactiveFormsModule } from '@angular/forms';
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

    it('parses a plain value with no thousands or decimal separator', () => {
      const directive = createDirective(null);
      input.value = '1234';

      directive.onBlur();

      expect(controlMock.control.setValue).toHaveBeenCalledWith(1234);
    });

    it('clears the control when the cleaned value has no digits left to parse', () => {
      const directive = createDirective(null);
      input.value = '.';

      directive.onBlur();

      expect(controlMock.control.setValue).toHaveBeenCalledWith(null);
      expect(input.value).toBe('');
    });

    it('clears the control and input when the typed value is not a number', () => {
      const directive = createDirective(null);
      input.value = '';

      directive.onBlur();

      expect(controlMock.control.setValue).toHaveBeenCalledWith(null);
      expect(input.value).toBe('');
    });
  });

  // The @HostListener('focus') decorator makes Angular's Ivy compiler generate a dispatch
  // wrapper (CurrencyFormatDirective_focus_HostBindingHandler) around onFocus() - that wrapper
  // only runs from a real DOM event through change detection, never from calling onFocus()
  // directly as the tests above do, so it needs one real TestBed render to be exercised.
  describe('real DOM focus event (Ivy host-binding dispatch)', () => {
    @Component({
      standalone: true,
      imports: [ReactiveFormsModule, CurrencyFormatDirective],
      template: `<input appCurrencyFormat [formControl]="control" />`,
    })
    class HostComponent {
      control = new FormControl(1234.5);
    }

    it('runs onFocus through the compiled host-listener binding', () => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();
      const hostInput: HTMLInputElement = fixture.nativeElement.querySelector('input');

      hostInput.dispatchEvent(new Event('focus'));

      expect(hostInput.value).toBe('1234,5');
    });
  });
});
