import { ChangeDetectionStrategy, Component, Input, ViewChild, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { Bind } from 'primeng/bind';

let dateFieldIdCounter = 0;

const ALLOWED_CONTROL_KEYS = [
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Tab',
  'Home',
  'End',
  'Enter',
  'Escape',
];

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-date-field',
    templateUrl: 'date-field.component.html',
    styleUrls: ['date-field.component.scss'],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => DateFieldComponent),
            multi: true,
        },
    ],
    imports: [
        Bind,
        DatePicker,
        ReactiveFormsModule,
        FormsModule,
    ],
})
export class DateFieldComponent implements ControlValueAccessor {
  @Input()
  formControlName: string = '';

  @Input()
  label: string = 'Data';

  @Input()
  placeholder: string = 'DD/MM/AAAA';

  @Input()
  isDisabled: boolean = false;

  // Angular's forms machinery calls setDisabledState(control.disabled) as soon as a
  // formControlName/ngModel is set up, regardless of whether anything ever actually
  // disables that control - with a plain `this.isDisabled = isDisabled` there, that
  // unconditional setDisabledState(false) call was clobbering an explicit
  // [isDisabled]="true" binding (e.g. audit-tab's read-only date fields) back to enabled.
  // Keeping the two flags separate and OR-ing them means either source can disable the
  // field, but neither can silently re-enable what the other disabled.
  private formDisabled = false;

  get effectiveDisabled(): boolean {
    return this.isDisabled || this.formDisabled;
  }

  @ViewChild('picker')
  picker?: DatePicker;

  readonly fieldId = `date-field-${++dateFieldIdCounter}`;

  value: Date | null = null;

  onChange: (value: Date | null) => void = () => {};
  onTouched = () => {};

  // Accepts whatever the form is patched with - a real Date (calendar-picked, or already a Date
  // coming back from the API) or an ISO/parsable date string - and always ends up with a Date
  // object or null, which p-datepicker (and the DD/MM/AAAA display it renders) both expect.
  writeValue(val: unknown): void {
    if (!val) {
      this.value = null;
      return;
    }
    this.value = val instanceof Date ? val : new Date(val as string);
  }

  registerOnChange(fn: (value: Date | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled = isDisabled;
  }

  onModelChange(value: Date | null): void {
    this.value = value;
    this.onChange(value);
  }

  toggleCalendar(): void {
    this.picker?.toggle();
  }

  // The calendar panel renders inline (see the template comment on why appendTo="body" was
  // dropped), so PrimeNG positions it with `position: absolute` and small top/left offsets
  // relative to the field. That absolute box still counts toward a scrollable ancestor's
  // (.modal-scrollable-area) scroll size even though it's out of normal flow, so on a short
  // modal opening the calendar clipped it and popped up a scrollbar. Re-pinning the panel to
  // `position: fixed` with coordinates computed from the input's own viewport rect keeps it
  // correctly placed under the field while removing it from the ancestor's scrollable content.
  //
  // Fixed positioning alone isn't enough when the field itself sits near the bottom of a tall
  // modal (e.g. "Data de admissão" as the last field before the footer): pinning the panel below
  // the field then runs it past the bottom of the viewport with no way to scroll to the clipped
  // rows, since it's no longer part of any scrollable flow. Flip it above the field whenever
  // there isn't enough room below (the standard dropdown-collision fix), and clamp both axes to
  // the viewport as a last resort so the whole panel is always reachable.
  onCalendarShow(overlay: HTMLElement): void {
    const inputEl = this.picker?.inputfieldViewChild?.nativeElement as
      | HTMLElement
      | undefined;
    if (!overlay || !inputEl) {
      return;
    }
    const rect = inputEl.getBoundingClientRect();
    const margin = 8;
    const overlayHeight = overlay.offsetHeight;
    const overlayWidth = overlay.offsetWidth;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;
    if (spaceBelow >= overlayHeight || spaceBelow >= spaceAbove) {
      top = Math.min(rect.bottom, window.innerHeight - overlayHeight - margin);
    } else {
      top = rect.top - overlayHeight;
    }
    top = Math.max(margin, top);

    const left = Math.max(
      margin,
      Math.min(rect.left, window.innerWidth - overlayWidth - margin),
    );

    overlay.style.position = 'fixed';
    overlay.style.top = `${top}px`;
    overlay.style.insetInlineStart = `${left}px`;
  }

  // Restricts typing to digits, "/" and the usual editing/navigation keys - nothing else reaches
  // the input, so the field can never end up holding letters or stray punctuation.
  onInputKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (ALLOWED_CONTROL_KEYS.includes(event.key)) {
      return;
    }
    if (!/^[0-9/]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  // Reformats whatever digits are present into DD/MM/YYYY as the user types (or deletes), auto-
  // inserting the "/" separators, then - once all 8 digits are in - parses a real Date and pushes
  // it through the CVA so the form control updates without waiting for blur.
  onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 8);

    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }

    input.value = formatted;
    input.setSelectionRange(formatted.length, formatted.length);

    if (digits.length === 8) {
      const day = parseInt(digits.slice(0, 2), 10);
      const month = parseInt(digits.slice(2, 4), 10);
      const year = parseInt(digits.slice(4, 8), 10);
      const parsed = new Date(year, month - 1, day);
      const isValid =
        parsed.getFullYear() === year &&
        parsed.getMonth() === month - 1 &&
        parsed.getDate() === day;
      if (isValid) {
        this.onModelChange(parsed);
      }
    }
  }
}
