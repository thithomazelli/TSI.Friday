import { Component, ElementRef, Renderer2 } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { ClickDirective } from './click.directive';

describe('ClickDirective', () => {
  // A minimal Renderer2 stand-in that operates on real DOM nodes directly, so the directive's
  // property/class/element manipulation can be asserted the same way it would render in a browser
  // without needing a full TestBed host-component render.
  function fakeRenderer(): Renderer2 {
    return {
      setProperty: (el: Element, name: string, value: unknown) => {
        (el as unknown as Record<string, unknown>)[name] = value;
      },
      addClass: (el: Element | null, name: string) => el?.classList.add(name),
      removeClass: (el: Element, name: string) => el.classList.remove(name),
      createElement: (name: string) => document.createElement(name),
      appendChild: (parent: Element, child: Element | null) => child && parent.appendChild(child),
      removeChild: (parent: Element, child: Element) => parent.removeChild(child),
    } as unknown as Renderer2;
  }

  function clickEvent(): Event {
    return { preventDefault: vi.fn() } as unknown as Event;
  }

  it('does nothing when no action is bound', () => {
    const button = document.createElement('button');
    const directive = new ClickDirective(new ElementRef(button), fakeRenderer());

    expect(() => directive.onClick(clickEvent())).not.toThrow();
  });

  it('does nothing when the bound action is not a function', () => {
    const button = document.createElement('button');
    const directive = new ClickDirective(new ElementRef(button), fakeRenderer());
    directive.action$ = 'not-a-function' as never;

    expect(() => directive.onClick(clickEvent())).not.toThrow();
  });

  describe('while the action is running', () => {
    function setup(buttonType = 'button') {
      const button = document.createElement('button');
      button.type = buttonType as 'button' | 'submit';
      const directive = new ClickDirective(new ElementRef(button), fakeRenderer());
      const action$ = new Subject<null>();
      directive.action$ = () => action$;
      return { button, directive, action$ };
    }

    it('disables the button and shows the loading spinner', () => {
      const { button, directive } = setup();

      directive.onClick(clickEvent());

      expect(button.disabled).toBe(true);
      expect(button.classList.contains('app-click-loading')).toBe(true);
      expect(button.querySelector('.app-click-spinner')).toBeTruthy();
    });

    it('restores the button and removes the spinner once the action completes', () => {
      const { button, directive, action$ } = setup();

      directive.onClick(clickEvent());
      action$.next(null);
      action$.complete();

      expect(button.disabled).toBe(false);
      expect(button.classList.contains('app-click-loading')).toBe(false);
      expect(button.querySelector('.app-click-spinner')).toBeNull();
    });

    it('restores the button even when the action errors', () => {
      const { button, directive, action$ } = setup();

      directive.onClick(clickEvent());
      action$.error(new Error('fail'));

      expect(button.disabled).toBe(false);
      expect(button.classList.contains('app-click-loading')).toBe(false);
    });

    it('prevents the default action for a submit button, to avoid double-firing a wrapping ngSubmit', () => {
      const { directive } = setup('submit');
      const event = clickEvent();

      directive.onClick(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('does not call preventDefault for a plain button', () => {
      const { directive } = setup('button');
      const event = clickEvent();

      directive.onClick(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('disables the other controls inside the same form and restores them afterwards', () => {
      const form = document.createElement('form');
      const button = document.createElement('button');
      const otherInput = document.createElement('input');
      const otherLink = document.createElement('a');
      form.appendChild(button);
      form.appendChild(otherInput);
      form.appendChild(otherLink);

      const directive = new ClickDirective(new ElementRef(button), fakeRenderer());
      const action$ = new Subject<null>();
      directive.action$ = () => action$;

      directive.onClick(clickEvent());

      expect(otherInput.disabled).toBe(true);
      expect(otherLink.getAttribute('aria-disabled')).toBe('true');
      expect(otherLink.classList.contains('disabled')).toBe(true);

      action$.next(null);
      action$.complete();

      expect(otherInput.disabled).toBe(false);
      expect(otherLink.hasAttribute('aria-disabled')).toBe(false);
      expect(otherLink.classList.contains('disabled')).toBe(false);
    });

    it('blocks clicks on a disabled sibling link while the action is running', () => {
      const form = document.createElement('form');
      const button = document.createElement('button');
      const otherLink = document.createElement('a');
      form.appendChild(button);
      form.appendChild(otherLink);

      const directive = new ClickDirective(new ElementRef(button), fakeRenderer());
      const action$ = new Subject<null>();
      directive.action$ = () => action$;

      directive.onClick(clickEvent());

      const linkClick = new MouseEvent('click', { cancelable: true });
      otherLink.dispatchEvent(linkClick);

      expect(linkClick.defaultPrevented).toBe(true);
    });

    it('does not add a second spinner on a re-entrant click while one is already showing', () => {
      const { button, directive } = setup();

      directive.onClick(clickEvent());
      directive.onClick(clickEvent());

      expect(button.querySelectorAll('.app-click-spinner').length).toBe(1);
    });

    it('re-applies the disabled state to a sibling link that was already disabled before the click', () => {
      const form = document.createElement('form');
      const button = document.createElement('button');
      const otherLink = document.createElement('a');
      otherLink.setAttribute('aria-disabled', 'true');
      otherLink.setAttribute('tabindex', '-1');
      otherLink.classList.add('disabled');
      form.appendChild(button);
      form.appendChild(otherLink);

      const directive = new ClickDirective(new ElementRef(button), fakeRenderer());
      const action$ = new Subject<null>();
      directive.action$ = () => action$;

      directive.onClick(clickEvent());
      action$.next(null);
      action$.complete();

      expect(otherLink.getAttribute('aria-disabled')).toBe('true');
      expect(otherLink.getAttribute('tabindex')).toBe('-1');
      expect(otherLink.classList.contains('disabled')).toBe(true);
    });

    it('does not re-attach the blocking click handler to a sibling link on a re-entrant click', () => {
      const form = document.createElement('form');
      const button = document.createElement('button');
      const otherLink = document.createElement('a');
      form.appendChild(button);
      form.appendChild(otherLink);
      const addEventListenerSpy = vi.spyOn(otherLink, 'addEventListener');

      const directive = new ClickDirective(new ElementRef(button), fakeRenderer());
      directive.action$ = () => new Subject<null>();

      directive.onClick(clickEvent());
      directive.onClick(clickEvent());

      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
    });

    it('skips renderer.setProperty on the host element itself when it is an anchor', () => {
      const link = document.createElement('a');
      const renderer = fakeRenderer();
      const setPropertySpy = vi.spyOn(renderer, 'setProperty');
      const directive = new ClickDirective(new ElementRef(link), renderer);
      directive.action$ = () => new Subject<null>();

      directive.onClick(clickEvent());

      expect(setPropertySpy).not.toHaveBeenCalledWith(link, 'disabled', true);
    });
  });

  describe('setDisabled(false) (re-enabling siblings, direct call)', () => {
    it('removes aria-disabled/tabindex/class and detaches the blocking handler from a re-enabled link', () => {
      const form = document.createElement('form');
      const button = document.createElement('button');
      const otherLink = document.createElement('a');
      form.appendChild(button);
      form.appendChild(otherLink);
      const directive = new ClickDirective(new ElementRef(button), fakeRenderer());

      (directive as unknown as { setDisabled: (d: boolean) => void }).setDisabled(true);
      (directive as unknown as { setDisabled: (d: boolean) => void }).setDisabled(false);

      expect(otherLink.hasAttribute('aria-disabled')).toBe(false);
      expect(otherLink.hasAttribute('tabindex')).toBe(false);
      expect(otherLink.classList.contains('disabled')).toBe(false);

      const linkClick = new MouseEvent('click', { cancelable: true });
      otherLink.dispatchEvent(linkClick);
      expect(linkClick.defaultPrevented).toBe(false);
    });

    it('does not throw when re-enabling a link that was never disabled', () => {
      const form = document.createElement('form');
      const button = document.createElement('button');
      const otherLink = document.createElement('a');
      form.appendChild(button);
      form.appendChild(otherLink);
      const directive = new ClickDirective(new ElementRef(button), fakeRenderer());

      expect(() =>
        (directive as unknown as { setDisabled: (d: boolean) => void }).setDisabled(false),
      ).not.toThrow();
    });
  });

  describe('addSpinner/removeSpinner edge cases', () => {
    it('does not throw when the renderer fails to create the spinner element', () => {
      const button = document.createElement('button');
      const renderer = fakeRenderer();
      vi.spyOn(renderer, 'createElement').mockReturnValueOnce(null as unknown as Element);
      const directive = new ClickDirective(new ElementRef(button), renderer);
      directive.action$ = () => new Subject<null>();

      expect(() => directive.onClick(clickEvent())).not.toThrow();
    });

    it('removeSpinner does nothing when no spinner was ever added', () => {
      const button = document.createElement('button');
      const directive = new ClickDirective(new ElementRef(button), fakeRenderer());

      expect(() =>
        (directive as unknown as { removeSpinner: () => void }).removeSpinner(),
      ).not.toThrow();
    });
  });

  // The @HostListener('click') decorator makes Angular's Ivy compiler generate a dispatch wrapper
  // (ClickDirective_click_HostBindingHandler) around onClick() - only a real DOM click through
  // TestBed exercises it, the same reasoning as currency-format.directive.spec.ts.
  describe('real DOM click event (Ivy host-binding dispatch)', () => {
    @Component({
      standalone: true,
      imports: [ClickDirective],
      template: `<button type="button" [appClick]="action">Go</button>`,
    })
    class HostComponent {
      action = () => of(null);
    }

    it('runs onClick through the compiled host-listener binding', () => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();
      const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

      button.click();

      expect(button.querySelector('.app-click-spinner')).toBeFalsy();
    });
  });
});
