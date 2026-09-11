import { ChangeDetectionStrategy, Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CurrencyService } from '@nexus/core';
import { NgClass } from '@angular/common';

let currencyFieldIdCounter = 0;

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-currency-field',
    templateUrl: './currency-field.component.html',
    styleUrl: './currency-field.component.scss',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => CurrencyFieldComponent),
            multi: true,
        },
    ],
    imports: [NgClass],
})
export class CurrencyFieldComponent implements ControlValueAccessor {
  @Input()
  label = 'Valor';

  @Input()
  placeholder = '';

  @Input()
  isDisabled = false;

  @Input()
  icon = 'bi-cash-coin';

  // Bare-input rendering for inline grid rows (e.g. trip-form's staged-driver table), which style
  // their own plain .grid-input inputs and have no room for the form-floating + icon wrapper below.
  @Input()
  compact = false;

  readonly fieldId = `currency-field-${++currencyFieldIdCounter}`;

  displayValue = '';

  onChange: (value: number) => void = () => {};
  onTouched: () => void = () => {};

  constructor(private currencyService: CurrencyService) {}

  // Same shape as DateFieldComponent.writeValue: accepts whatever the form is patched with (a
  // number, a numeric string, null/undefined) and always ends up with a formatted "R$ 0,00"
  // string for display, while the value pushed back out through the CVA (see onBlur) stays a
  // plain number - callers keep binding formControlName to a numeric control exactly like today.
  writeValue(value: unknown): void {
    const numeric = value == null || value === '' ? 0 : Number(value);
    this.displayValue = this.currencyService.formatCurrencyBRL(
      isNaN(numeric) ? 0 : numeric,
    );
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  onInputChange(value: string): void {
    this.displayValue = value;
  }

  // Reformats on blur and propagates the parsed number through the CVA - mirrors the
  // onCurrencyBlur()/onPriceBlur() pattern this component replaces (type, then blur to see the
  // formatted "R$ x,xx" and have the underlying numeric control updated).
  onBlur(): void {
    const parsed = this.currencyService.parseCurrencyBRL(this.displayValue);
    this.displayValue = this.currencyService.formatCurrencyBRL(parsed);
    this.onChange(parsed);
    this.onTouched();
  }
}
