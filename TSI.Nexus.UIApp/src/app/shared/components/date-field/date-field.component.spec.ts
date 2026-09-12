import { DateFieldComponent } from './date-field.component';

describe('DateFieldComponent', () => {
  let component: DateFieldComponent;

  beforeEach(() => {
    component = new DateFieldComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('assigns each instance a unique fieldId', () => {
    const other = new DateFieldComponent();
    expect(component.fieldId).not.toBe(other.fieldId);
  });

  describe('writeValue', () => {
    it('sets value to null for a falsy input', () => {
      component.writeValue(null);
      expect(component.value).toBeNull();

      component.writeValue(undefined);
      expect(component.value).toBeNull();

      component.writeValue('');
      expect(component.value).toBeNull();
    });

    it('keeps a real Date instance as-is', () => {
      const date = new Date(2024, 0, 5);
      component.writeValue(date);
      expect(component.value).toBe(date);
    });

    it('parses a date string into a Date', () => {
      component.writeValue('2024-01-05T00:00:00');
      expect(component.value).toBeInstanceOf(Date);
      expect(component.value?.getFullYear()).toBe(2024);
    });
  });

  describe('CVA plumbing', () => {
    it('propagates value changes through the registered onChange', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);

      const date = new Date(2024, 5, 1);
      component.onModelChange(date);

      expect(component.value).toBe(date);
      expect(onChange).toHaveBeenCalledWith(date);
    });

    it('combines isDisabled input and form-driven disabled state with OR', () => {
      expect(component.effectiveDisabled).toBe(false);

      component.setDisabledState(true);
      expect(component.effectiveDisabled).toBe(true);

      component.setDisabledState(false);
      component.isDisabled = true;
      expect(component.effectiveDisabled).toBe(true);
    });

    it('does not let setDisabledState(false) override an explicit isDisabled input', () => {
      component.isDisabled = true;
      component.setDisabledState(false);

      expect(component.effectiveDisabled).toBe(true);
    });
  });

  describe('toggleCalendar', () => {
    it('does nothing when no picker is attached', () => {
      expect(() => component.toggleCalendar()).not.toThrow();
    });

    it('delegates to the picker view child when present', () => {
      const toggle = vi.fn();
      component.picker = { toggle } as unknown as DateFieldComponent['picker'];

      component.toggleCalendar();

      expect(toggle).toHaveBeenCalled();
    });
  });

  describe('onInputKeydown', () => {
    function keyEvent(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
      return { key, preventDefault: vi.fn(), ...modifiers } as unknown as KeyboardEvent;
    }

    it('allows digits and the "/" separator', () => {
      const event = keyEvent('5');
      component.onInputKeydown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('allows navigation/editing control keys', () => {
      const event = keyEvent('Backspace');
      component.onInputKeydown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('blocks a letter key', () => {
      const event = keyEvent('a');
      component.onInputKeydown(event);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('allows any key combined with a modifier (e.g. Ctrl+C)', () => {
      const event = keyEvent('c', { ctrlKey: true });
      component.onInputKeydown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('onInputChange', () => {
    function inputEvent(value: string): Event {
      const input = { value, setSelectionRange: vi.fn() } as unknown as HTMLInputElement;
      return { target: input } as unknown as Event;
    }

    it('auto-inserts separators as digits are typed', () => {
      const event = inputEvent('01012024');
      component.onInputChange(event);

      expect((event.target as HTMLInputElement).value).toBe('01/01/2024');
    });

    it('strips non-digit characters before formatting', () => {
      const event = inputEvent('01/01/2024');
      component.onInputChange(event);

      expect((event.target as HTMLInputElement).value).toBe('01/01/2024');
    });

    it('parses and propagates a valid complete date', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);

      component.onInputChange(inputEvent('05012024'));

      expect(onChange).toHaveBeenCalled();
      const emitted = onChange.mock.calls[0][0] as Date;
      expect(emitted.getFullYear()).toBe(2024);
      expect(emitted.getMonth()).toBe(0);
      expect(emitted.getDate()).toBe(5);
    });

    it('does not propagate an impossible date (e.g. Feb 30th)', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);

      component.onInputChange(inputEvent('30022024'));

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not propagate while fewer than 8 digits have been entered', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);

      component.onInputChange(inputEvent('0501'));

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('onCalendarShow', () => {
    it('does nothing when the overlay or input element is missing', () => {
      expect(() => component.onCalendarShow(null as unknown as HTMLElement)).not.toThrow();
    });

    it('positions the overlay below the field when there is room', () => {
      const inputEl = {
        getBoundingClientRect: () => ({ top: 100, bottom: 130, left: 20 }),
      } as unknown as HTMLElement;
      component.picker = {
        inputfieldViewChild: { nativeElement: inputEl },
      } as unknown as DateFieldComponent['picker'];

      Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });

      const overlay = {
        offsetHeight: 200,
        offsetWidth: 250,
        style: {} as CSSStyleDeclaration,
      } as unknown as HTMLElement;

      component.onCalendarShow(overlay);

      expect(overlay.style.position).toBe('fixed');
      expect(overlay.style.top).toBe('130px');
    });

    it('flips the overlay above the field when there is not enough room below', () => {
      const inputEl = {
        getBoundingClientRect: () => ({ top: 700, bottom: 730, left: 20 }),
      } as unknown as HTMLElement;
      component.picker = {
        inputfieldViewChild: { nativeElement: inputEl },
      } as unknown as DateFieldComponent['picker'];

      Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });

      const overlay = {
        offsetHeight: 200,
        offsetWidth: 250,
        style: {} as CSSStyleDeclaration,
      } as unknown as HTMLElement;

      component.onCalendarShow(overlay);

      expect(overlay.style.position).toBe('fixed');
      expect(overlay.style.top).toBe('500px');
    });
  });
});
