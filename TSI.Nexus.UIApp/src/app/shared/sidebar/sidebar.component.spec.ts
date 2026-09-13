import { ElementRef, Renderer2 } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { User } from '@nexus/core';
import { AccountService } from '../../core/services/account/account.service';
import { FeatureFlagService } from '../../core/services/feature-flag/feature-flag.service';
import { FeatureToggleKeys } from '../../core/models/feature-toggle.model';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let user$: Subject<User | null>;
  let featureFlagServiceMock: { isEnabled: ReturnType<typeof vi.fn> };
  let accountServiceMock: { user$: Subject<User | null> };
  let rendererMock: {
    setStyle: ReturnType<typeof vi.fn>;
    removeStyle: ReturnType<typeof vi.fn>;
    setAttribute: ReturnType<typeof vi.fn>;
    addClass: ReturnType<typeof vi.fn>;
    removeClass: ReturnType<typeof vi.fn>;
    listen: ReturnType<typeof vi.fn>;
  };

  function createComponent(
    enabledKeys: Set<string> = new Set([
      FeatureToggleKeys.FleetModule,
      FeatureToggleKeys.QuotesModule,
      FeatureToggleKeys.SalesOrdersModule,
      FeatureToggleKeys.PurchaseOrdersModule,
      FeatureToggleKeys.VehicleMaintenance,
      FeatureToggleKeys.FuelLog,
      FeatureToggleKeys.AgendaModule,
      FeatureToggleKeys.Event,
    ]),
    nativeElement: HTMLElement = document.createElement('div'),
  ): SidebarComponent {
    user$ = new Subject();
    featureFlagServiceMock = { isEnabled: vi.fn((key: string) => of(enabledKeys.has(key))) };
    accountServiceMock = { user$ };
    rendererMock = {
      setStyle: vi.fn(),
      removeStyle: vi.fn(),
      setAttribute: vi.fn(),
      addClass: vi.fn(),
      removeClass: vi.fn(),
      listen: vi.fn().mockReturnValue(vi.fn()),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.runInInjectionContext(
      () =>
        new SidebarComponent(
          { nativeElement } as ElementRef,
          rendererMock as unknown as Renderer2,
          accountServiceMock as unknown as AccountService,
          featureFlagServiceMock as unknown as FeatureFlagService,
        ),
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('resolves simple module flags directly from FeatureFlagService.isEnabled()', () => {
    const component = createComponent();
    expect(component.isFleetModuleEnabled()).toBe(true);
    expect(component.isQuotesModuleEnabled()).toBe(true);
    expect(component.isSalesOrdersModuleEnabled()).toBe(true);
    expect(component.isPurchaseOrdersModuleEnabled()).toBe(true);
  });

  it('combines group + entity flags for VehicleMaintenance/FuelLog/Agenda', () => {
    const component = createComponent();
    expect(component.isVehicleMaintenanceEnabled()).toBe(true);
    expect(component.isFuelLogEnabled()).toBe(true);
    expect(component.isAgendaModuleEnabled()).toBe(true);
  });

  it('disables VehicleMaintenance/FuelLog when the Fleet group is off, even if the entity is on', () => {
    const component = createComponent(
      new Set([FeatureToggleKeys.VehicleMaintenance, FeatureToggleKeys.FuelLog]),
    );
    expect(component.isVehicleMaintenanceEnabled()).toBe(false);
    expect(component.isFuelLogEnabled()).toBe(false);
  });

  it('disables Agenda when only one of the group/entity flags is on', () => {
    const groupOnly = createComponent(new Set([FeatureToggleKeys.AgendaModule]));
    expect(groupOnly.isAgendaModuleEnabled()).toBe(false);

    const entityOnly = createComponent(new Set([FeatureToggleKeys.Event]));
    expect(entityOnly.isAgendaModuleEnabled()).toBe(false);
  });

  it('isAdmin/isMaster reflect the current user roles once user$ emits', () => {
    const component = createComponent();
    expect(component.isAdmin()).toBe(false);
    expect(component.isMaster()).toBe(false);

    user$.next({ roles: ['Admin'] } as unknown as User);
    expect(component.isAdmin()).toBe(true);
    expect(component.isMaster()).toBe(false);

    user$.next({ roles: ['Master'] } as unknown as User);
    expect(component.isAdmin()).toBe(false);
    expect(component.isMaster()).toBe(true);
  });

  it('isAdmin/isMaster are false when there is no user', () => {
    const component = createComponent();
    user$.next(null);

    expect(component.isAdmin()).toBe(false);
    expect(component.isMaster()).toBe(false);
  });

  it('isAdmin/isMaster are false when the user has no roles array', () => {
    const component = createComponent();
    user$.next({} as User);

    expect(component.isAdmin()).toBe(false);
    expect(component.isMaster()).toBe(false);
  });

  describe('onSidebarMenuClick', () => {
    it('closes the mobile sidebar when a nav-link is clicked', () => {
      const component = createComponent();
      Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
      document.body.classList.add('sidebar-open');
      const link = document.createElement('a');
      link.classList.add('nav-link');
      document.body.appendChild(link);

      component.onSidebarMenuClick({ target: link } as unknown as MouseEvent);

      expect(document.body.classList.contains('sidebar-open')).toBe(false);
      document.body.removeChild(link);
    });

    it('does nothing on desktop widths', () => {
      const component = createComponent();
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      document.body.classList.add('sidebar-open');
      const link = document.createElement('a');
      link.classList.add('nav-link');
      document.body.appendChild(link);

      component.onSidebarMenuClick({ target: link } as unknown as MouseEvent);

      expect(document.body.classList.contains('sidebar-open')).toBe(true);
      document.body.removeChild(link);
      document.body.classList.remove('sidebar-open');
    });

    it('does nothing when the click target is not inside a nav-link', () => {
      const component = createComponent();
      Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
      document.body.classList.add('sidebar-open');
      const span = document.createElement('span');
      document.body.appendChild(span);

      component.onSidebarMenuClick({ target: span } as unknown as MouseEvent);

      expect(document.body.classList.contains('sidebar-open')).toBe(true);
      document.body.removeChild(span);
      document.body.classList.remove('sidebar-open');
    });
  });

  describe('ngAfterViewInit', () => {
    function buildNavItem(withTreeview: boolean, menuOpen: boolean): { root: HTMLElement; link: HTMLElement; submenu: HTMLElement | null } {
      const root = document.createElement('div');
      const navItem = document.createElement('li');
      navItem.classList.add('nav-item');
      if (menuOpen) navItem.classList.add('menu-open');
      const link = document.createElement('a');
      navItem.appendChild(link);
      let submenu: HTMLElement | null = null;
      if (withTreeview) {
        submenu = document.createElement('ul');
        submenu.classList.add('nav-treeview');
        navItem.appendChild(submenu);
      } else {
        const notTreeview = document.createElement('span');
        navItem.appendChild(notTreeview);
      }
      root.appendChild(navItem);
      return { root, link, submenu };
    }

    it('does nothing when a nav-item link has no sibling element at all', () => {
      const root = document.createElement('div');
      const navItem = document.createElement('li');
      navItem.classList.add('nav-item');
      const link = document.createElement('a');
      navItem.appendChild(link);
      root.appendChild(navItem);
      const component = createComponent(undefined, root);

      expect(() => component.ngAfterViewInit()).not.toThrow();
      expect(rendererMock.listen).not.toHaveBeenCalled();
    });

    it('does nothing when the sibling element is not a nav-treeview', () => {
      const { root } = buildNavItem(false, false);
      const component = createComponent(undefined, root);

      component.ngAfterViewInit();

      expect(rendererMock.listen).not.toHaveBeenCalled();
    });

    it('sets the initial expanded style when the parent already has menu-open', () => {
      const { root, submenu } = buildNavItem(true, true);
      const component = createComponent(undefined, root);

      component.ngAfterViewInit();

      expect(rendererMock.setStyle).toHaveBeenCalledWith(submenu, 'display', 'block');
      expect(rendererMock.setStyle).toHaveBeenCalledWith(submenu, 'opacity', '1');
    });

    it('sets the initial collapsed style when the parent has no menu-open', () => {
      const { root, submenu } = buildNavItem(true, false);
      const component = createComponent(undefined, root);

      component.ngAfterViewInit();

      expect(rendererMock.setStyle).toHaveBeenCalledWith(submenu, 'display', 'none');
      expect(rendererMock.setStyle).toHaveBeenCalledWith(submenu, 'opacity', '0');
    });

    it('registers a click listener on the link and tracks it for cleanup', () => {
      const { root, link } = buildNavItem(true, false);
      const component = createComponent(undefined, root);

      component.ngAfterViewInit();

      expect(rendererMock.listen).toHaveBeenCalledWith(link, 'click', expect.any(Function));
      expect((component as any).listeners.length).toBe(1);
    });

    describe('click handler - closing an open submenu', () => {
      function setup() {
        vi.useFakeTimers();
        const raf = vi.fn((cb: FrameRequestCallback) => {
          cb(0);
          return 0;
        });
        vi.stubGlobal('requestAnimationFrame', raf);
        const { root, link, submenu } = buildNavItem(true, true);
        Object.defineProperty(submenu, 'scrollHeight', { value: 120, configurable: true });
        const component = createComponent(undefined, root);
        let clickHandler: (e: Event) => void = () => {};
        let transitionHandler: (e: TransitionEvent) => void = () => {};
        rendererMock.listen.mockImplementation((_target: any, event: string, handler: any) => {
          if (event === 'click') clickHandler = handler;
          if (event === 'transitionend') transitionHandler = handler;
          return vi.fn();
        });
        component.ngAfterViewInit();
        return { component, link, submenu, getClickHandler: () => clickHandler, getTransitionHandler: () => transitionHandler };
      }

      afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
      });

      it('collapses via the transitionend event', () => {
        const { link, submenu, getClickHandler, getTransitionHandler } = setup();
        const preventDefault = vi.fn();

        getClickHandler()({ preventDefault, target: link } as unknown as Event);

        expect(preventDefault).toHaveBeenCalled();
        expect(rendererMock.setStyle).toHaveBeenCalledWith(submenu, 'height', '120px');

        getTransitionHandler()({ target: submenu, propertyName: 'height' } as unknown as TransitionEvent);

        expect(rendererMock.removeClass).toHaveBeenCalledWith(expect.anything(), 'menu-open');
        expect(rendererMock.setStyle).toHaveBeenCalledWith(submenu, 'display', 'none');
      });

      it('ignores a transitionend for a different element or property', () => {
        const { link, submenu, getClickHandler, getTransitionHandler } = setup();
        getClickHandler()({ preventDefault: vi.fn(), target: link } as unknown as Event);
        rendererMock.removeClass.mockClear();

        getTransitionHandler()({ target: submenu, propertyName: 'opacity' } as unknown as TransitionEvent);
        expect(rendererMock.removeClass).not.toHaveBeenCalled();

        getTransitionHandler()({ target: document.createElement('div'), propertyName: 'height' } as unknown as TransitionEvent);
        expect(rendererMock.removeClass).not.toHaveBeenCalled();
      });

      it('collapses via the fallback timeout when no transitionend arrives', () => {
        const { link, submenu, getClickHandler } = setup();
        getClickHandler()({ preventDefault: vi.fn(), target: link } as unknown as Event);

        vi.advanceTimersByTime(400);

        expect(rendererMock.removeClass).toHaveBeenCalledWith(expect.anything(), 'menu-open');
        expect(rendererMock.setStyle).toHaveBeenCalledWith(submenu, 'display', 'none');
      });

      it('does not finish twice when both the transitionend and the fallback fire', () => {
        const { link, submenu, getClickHandler, getTransitionHandler } = setup();
        getClickHandler()({ preventDefault: vi.fn(), target: link } as unknown as Event);

        getTransitionHandler()({ target: submenu, propertyName: 'height' } as unknown as TransitionEvent);
        rendererMock.removeClass.mockClear();
        vi.advanceTimersByTime(400);

        expect(rendererMock.removeClass).not.toHaveBeenCalled();
      });

      it('clears previous transition cleanups when clicked again', () => {
        const { component, link, getClickHandler } = setup();
        getClickHandler()({ preventDefault: vi.fn(), target: link } as unknown as Event);
        expect((component as any).transitionCleanups.length).toBe(1);
        const firstCleanup = (component as any).transitionCleanups[0];

        getClickHandler()({ preventDefault: vi.fn(), target: link } as unknown as Event);

        expect(firstCleanup).not.toBe((component as any).transitionCleanups[0]);
      });
    });

    describe('click handler - opening a closed submenu', () => {
      function setup() {
        vi.useFakeTimers();
        const raf = vi.fn((cb: FrameRequestCallback) => {
          cb(0);
          return 0;
        });
        vi.stubGlobal('requestAnimationFrame', raf);
        const { root, link, submenu } = buildNavItem(true, false);
        Object.defineProperty(submenu, 'scrollHeight', { value: 200, configurable: true });
        const component = createComponent(undefined, root);
        let clickHandler: (e: Event) => void = () => {};
        let transitionHandler: (e: TransitionEvent) => void = () => {};
        rendererMock.listen.mockImplementation((_target: any, event: string, handler: any) => {
          if (event === 'click') clickHandler = handler;
          if (event === 'transitionend') transitionHandler = handler;
          return vi.fn();
        });
        component.ngAfterViewInit();
        return { component, link, submenu, getClickHandler: () => clickHandler, getTransitionHandler: () => transitionHandler };
      }

      afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
      });

      it('expands via the transitionend event', () => {
        const { link, submenu, getClickHandler, getTransitionHandler } = setup();

        getClickHandler()({ preventDefault: vi.fn(), target: link } as unknown as Event);

        expect(rendererMock.addClass).toHaveBeenCalledWith(expect.anything(), 'menu-open');
        expect(rendererMock.setStyle).toHaveBeenCalledWith(submenu, 'height', '200px');

        getTransitionHandler()({ target: submenu, propertyName: 'height' } as unknown as TransitionEvent);

        expect(rendererMock.removeStyle).toHaveBeenCalledWith(submenu, 'height');
        expect(rendererMock.removeStyle).toHaveBeenCalledWith(submenu, 'transform');
      });

      it('ignores a transitionend for a different element or property', () => {
        const { link, submenu, getClickHandler, getTransitionHandler } = setup();
        getClickHandler()({ preventDefault: vi.fn(), target: link } as unknown as Event);
        rendererMock.removeStyle.mockClear();

        getTransitionHandler()({ target: submenu, propertyName: 'opacity' } as unknown as TransitionEvent);
        expect(rendererMock.removeStyle).not.toHaveBeenCalled();

        getTransitionHandler()({ target: document.createElement('div'), propertyName: 'height' } as unknown as TransitionEvent);
        expect(rendererMock.removeStyle).not.toHaveBeenCalled();
      });

      it('expands via the fallback timeout when no transitionend arrives', () => {
        const { link, submenu, getClickHandler } = setup();
        getClickHandler()({ preventDefault: vi.fn(), target: link } as unknown as Event);
        rendererMock.removeStyle.mockClear();

        vi.advanceTimersByTime(400);

        expect(rendererMock.removeStyle).toHaveBeenCalledWith(submenu, 'height');
      });

      it('does not finish twice when both the transitionend and the fallback fire', () => {
        const { link, submenu, getClickHandler, getTransitionHandler } = setup();
        getClickHandler()({ preventDefault: vi.fn(), target: link } as unknown as Event);

        getTransitionHandler()({ target: submenu, propertyName: 'height' } as unknown as TransitionEvent);
        rendererMock.removeStyle.mockClear();
        vi.advanceTimersByTime(400);

        expect(rendererMock.removeStyle).not.toHaveBeenCalled();
      });

      it('runs the pending open cleanup (unlisten + clearTimeout) when clicked again before it settles', () => {
        const { component, link, getClickHandler } = setup();
        getClickHandler()({ preventDefault: vi.fn(), target: link } as unknown as Event);
        expect((component as any).transitionCleanups.length).toBe(1);

        // parentElement now has menu-open (added synchronously by the first click), so this
        // second click takes the CLOSE branch, whose handler starts by invoking every pending
        // transitionCleanups entry - including the still-unresolved OPEN cleanup above.
        getClickHandler()({ preventDefault: vi.fn(), target: link } as unknown as Event);

        expect(rendererMock.listen).toHaveBeenCalled();
      });
    });
  });

  describe('ngOnDestroy', () => {
    it('cleans up registered listeners and transition cleanups without throwing', () => {
      const component = createComponent();
      const listenerUnsub = vi.fn();
      const transitionCleanup = vi.fn();
      (component as any).listeners = [listenerUnsub];
      (component as any).transitionCleanups = [transitionCleanup];

      component.ngOnDestroy();

      expect(listenerUnsub).toHaveBeenCalled();
      expect(transitionCleanup).toHaveBeenCalled();
      expect((component as any).listeners).toEqual([]);
      expect((component as any).transitionCleanups).toEqual([]);
    });

    it('does not throw when there is nothing registered', () => {
      const component = createComponent();
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});
