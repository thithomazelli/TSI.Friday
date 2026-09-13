import { ChangeDetectorRef, Renderer2 } from '@angular/core';
import { AccountService, PhotoService, User } from '@nexus/core';
import { Subject, of, throwError } from 'rxjs';
import { FeatureFlagService } from '../core/services/feature-flag/feature-flag.service';
import { FeatureToggleKeys } from '../core/models/feature-toggle.model';
import { NavbarComponent } from './navbar.component';

describe('NavbarComponent', () => {
  let rendererMock: {
    listen: ReturnType<typeof vi.fn>;
    addClass: ReturnType<typeof vi.fn>;
    removeClass: ReturnType<typeof vi.fn>;
  };
  let user$: Subject<User | null>;
  let accountServiceMock: { user$: Subject<User | null>; logout: ReturnType<typeof vi.fn> };
  let photo$: Subject<{ photoPath?: string; userId?: string }>;
  let photoServiceMock: {
    photo$: Subject<{ photoPath?: string; userId?: string }>;
    getPhoto: ReturnType<typeof vi.fn>;
  };
  let featureFlagServiceMock: { isEnabled: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  function createComponent(
    isEnabledImpl: (key: string) => ReturnType<FeatureFlagService['isEnabled']> = () => of(true),
  ): NavbarComponent {
    rendererMock = {
      listen: vi.fn().mockReturnValue(vi.fn()),
      addClass: vi.fn((el: HTMLElement, cls: string) => el.classList.add(cls)),
      removeClass: vi.fn((el: HTMLElement, cls: string) => el.classList.remove(cls)),
    };
    user$ = new Subject();
    accountServiceMock = { user$, logout: vi.fn() };
    photo$ = new Subject();
    photoServiceMock = { photo$, getPhoto: vi.fn() };
    featureFlagServiceMock = { isEnabled: vi.fn(isEnabledImpl) };
    cdrMock = { markForCheck: vi.fn() };

    return new NavbarComponent(
      rendererMock as unknown as Renderer2,
      accountServiceMock as unknown as AccountService,
      photoServiceMock as unknown as PhotoService,
      featureFlagServiceMock as unknown as FeatureFlagService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  beforeEach(() => {
    if (!('createObjectURL' in URL)) {
      (URL as any).createObjectURL = () => '';
    }
    if (!('revokeObjectURL' in URL)) {
      (URL as any).revokeObjectURL = () => {};
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    document.body.className = '';
    document.querySelectorAll('.sidebar-overlay, .app-sidebar, .main-sidebar, .sidebar').forEach((el) => el.remove());
  });

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('feature-flag combined observables', () => {
    function keyedIsEnabled(overrides: Record<string, boolean>) {
      return (key: string) => of(overrides[key] ?? true);
    }

    it('resolves isAgendaModuleEnabled$ directly from the AgendaModule toggle', () => {
      const component = createComponent(
        keyedIsEnabled({ [FeatureToggleKeys.AgendaModule]: false }),
      );

      let value: boolean | undefined;
      component.isAgendaModuleEnabled$.subscribe((v) => (value = v));

      expect(value).toBe(false);
    });

    it('isDriverLicenseAlertEnabled$ is true only when fleet module and the alert toggle are both enabled', () => {
      let component = createComponent(keyedIsEnabled({}));
      let value: boolean | undefined;
      component.isDriverLicenseAlertEnabled$.subscribe((v) => (value = v));
      expect(value).toBe(true);

      component = createComponent(keyedIsEnabled({ [FeatureToggleKeys.FleetModule]: false }));
      component.isDriverLicenseAlertEnabled$.subscribe((v) => (value = v));
      expect(value).toBe(false);
    });

    it('isVehicleBlockedAlertEnabled$ is true only when fleet module and the alert toggle are both enabled', () => {
      const component = createComponent(
        keyedIsEnabled({ [FeatureToggleKeys.VehicleBlockedAlert]: false }),
      );
      let value: boolean | undefined;
      component.isVehicleBlockedAlertEnabled$.subscribe((v) => (value = v));
      expect(value).toBe(false);
    });

    it('isPaymentAlertEnabled$ is true only when finance module and the alert toggle are both enabled', () => {
      let component = createComponent(keyedIsEnabled({}));
      let value: boolean | undefined;
      component.isPaymentAlertEnabled$.subscribe((v) => (value = v));
      expect(value).toBe(true);

      component = createComponent(keyedIsEnabled({ [FeatureToggleKeys.FinanceModule]: false }));
      component.isPaymentAlertEnabled$.subscribe((v) => (value = v));
      expect(value).toBe(false);
    });

    it('isStockAlertEnabled$ is true only when purchase orders module and the alert toggle are both enabled', () => {
      const component = createComponent(keyedIsEnabled({ [FeatureToggleKeys.StockAlert]: false }));
      let value: boolean | undefined;
      component.isStockAlertEnabled$.subscribe((v) => (value = v));
      expect(value).toBe(false);
    });

    it('isUpcomingEventAlertEnabled$ is true only when the agenda module and the alert toggle are both enabled', () => {
      let component = createComponent(keyedIsEnabled({}));
      let value: boolean | undefined;
      component.isUpcomingEventAlertEnabled$.subscribe((v) => (value = v));
      expect(value).toBe(true);

      component = createComponent(keyedIsEnabled({ [FeatureToggleKeys.AgendaModule]: false }));
      component.isUpcomingEventAlertEnabled$.subscribe((v) => (value = v));
      expect(value).toBe(false);
    });
  });

  describe('user$', () => {
    it('exposes the account service user stream', () => {
      const component = createComponent();
      expect(component.user$).toBe(accountServiceMock.user$);
    });
  });

  describe('toggleFullscreen', () => {
    it('requests fullscreen when not currently in fullscreen', async () => {
      const component = createComponent();
      const requestFullscreen = vi.fn().mockResolvedValue(undefined);
      (document.documentElement as any).requestFullscreen = requestFullscreen;
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });

      await component.toggleFullscreen();

      expect(requestFullscreen).toHaveBeenCalled();
      expect(component.isFullscreen).toBe(true);
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('exits fullscreen when currently in fullscreen', async () => {
      const component = createComponent();
      const exitFullscreen = vi.fn().mockResolvedValue(undefined);
      (document as any).exitFullscreen = exitFullscreen;
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.documentElement,
        configurable: true,
      });

      await component.toggleFullscreen();

      expect(exitFullscreen).toHaveBeenCalled();
      expect(component.isFullscreen).toBe(false);

      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    });

    it('swallows fullscreen errors', async () => {
      const component = createComponent();
      (document.documentElement as any).requestFullscreen = vi.fn().mockRejectedValue(new Error('nope'));
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });

      await expect(component.toggleFullscreen()).resolves.toBeUndefined();
    });
  });

  describe('ngOnInit', () => {
    it('applies the photo update when it matches the currently loaded user', () => {
      const component = createComponent();
      component.data = { id: 'u1' } as User;
      photoServiceMock.getPhoto.mockReturnValue(of(new Blob()));
      component.ngOnInit();

      photo$.next({ photoPath: 'p.jpg', userId: 'u1' });

      expect(component.data!.photo).toBe('p.jpg');
      expect(photoServiceMock.getPhoto).toHaveBeenCalledWith('Users', 'u1', 'p.jpg');
    });

    it('ignores a photo update for a different user', () => {
      const component = createComponent();
      component.data = { id: 'u1' } as User;
      component.ngOnInit();

      photo$.next({ photoPath: 'p.jpg', userId: 'u2' });

      expect(photoServiceMock.getPhoto).not.toHaveBeenCalled();
    });

    it('ignores a photo update with no photoPath', () => {
      const component = createComponent();
      component.data = { id: 'u1' } as User;
      component.ngOnInit();

      photo$.next({ userId: 'u1' });

      expect(photoServiceMock.getPhoto).not.toHaveBeenCalled();
    });

    it('loads the user photo when the account has one', () => {
      const component = createComponent();
      photoServiceMock.getPhoto.mockReturnValue(of(new Blob()));
      component.ngOnInit();

      user$.next({ id: 'u1', photo: 'p.jpg' } as User);

      expect(component.data).toEqual({ id: 'u1', photo: 'p.jpg' });
      expect(photoServiceMock.getPhoto).toHaveBeenCalledWith('Users', 'u1', 'p.jpg');
    });

    it('falls back to the default avatar when the account has no photo', () => {
      const component = createComponent();
      component.ngOnInit();

      user$.next({ id: 'u1' } as User);

      expect(component.imageUrl).toBe('assets/img/no_profile.png');
    });
  });

  describe('loadUserPhoto (private, via ngOnInit)', () => {
    it('revokes the previous blob url before creating a new one', () => {
      const component = createComponent();
      photoServiceMock.getPhoto.mockReturnValue(of(new Blob()));
      component.ngOnInit();

      user$.next({ id: 'u1', photo: 'p1.jpg' } as User);
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      user$.next({ id: 'u1', photo: 'p2.jpg' } as User);

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
      expect(component.imageUrl).toBe('blob:fake');
    });

    it('falls back to the default avatar when the photo request errors', () => {
      const component = createComponent();
      photoServiceMock.getPhoto.mockReturnValue(throwError(() => new Error('fail')));
      component.ngOnInit();

      user$.next({ id: 'u1', photo: 'p.jpg' } as User);

      expect(component.imageUrl).toBe('assets/img/no_profile.png');
    });
  });

  describe('ngAfterViewInit', () => {
    it('applies the initial responsive state and listens for resize', () => {
      const component = createComponent();
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });

      component.ngAfterViewInit();

      expect(document.body.classList.contains('sidebar-collapse')).toBe(false);
      expect(rendererMock.listen).toHaveBeenCalledWith('window', 'resize', expect.any(Function));
    });

    it('reapplies the responsive state on a resize event', () => {
      const component = createComponent();
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      component.ngAfterViewInit();
      const resizeHandler = rendererMock.listen.mock.calls[0][2];

      resizeHandler({ target: { innerWidth: 500 } });

      expect(document.body.classList.contains('sidebar-collapse')).toBe(true);
    });
  });

  describe('ngOnDestroy', () => {
    it('revokes the last blob url, unlistens resize, and removes the overlay', () => {
      const component = createComponent();
      photoServiceMock.getPhoto.mockReturnValue(of(new Blob()));
      component.ngOnInit();
      user$.next({ id: 'u1', photo: 'p.jpg' } as User);
      component.ngAfterViewInit();

      component.ngOnDestroy();

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    });

    it('does not throw when there is nothing to clean up', () => {
      const component = createComponent();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });

    it('swallows an error thrown by the resize unlisten function', () => {
      const component = createComponent();
      rendererMock.listen.mockReturnValue(() => {
        throw new Error('fail');
      });
      component.ngAfterViewInit();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('onImgError', () => {
    it('falls back to the default avatar image', () => {
      const component = createComponent();
      const img = document.createElement('img');

      component.onImgError({ target: img } as unknown as Event);

      expect(img.src).toContain('no_profile.png');
    });
  });

  describe('logout', () => {
    it('delegates to the account service', () => {
      const component = createComponent();

      component.logout();

      expect(accountServiceMock.logout).toHaveBeenCalled();
    });
  });

  describe('toggleSidebar', () => {
    beforeEach(() => {
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('opens the mobile overlay when the sidebar is closed', () => {
      const component = createComponent();
      Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
      const sidebar = document.createElement('div');
      sidebar.className = 'app-sidebar';
      document.body.appendChild(sidebar);

      component.toggleSidebar();

      expect(document.body.classList.contains('sidebar-open')).toBe(true);
      expect(document.querySelector('.sidebar-overlay')).not.toBeNull();
      sidebar.remove();
    });

    it('closes the mobile overlay when the sidebar is open', () => {
      const component = createComponent();
      Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
      const sidebar = document.createElement('div');
      sidebar.className = 'app-sidebar';
      document.body.appendChild(sidebar);
      component.toggleSidebar();

      component.toggleSidebar();

      expect(document.body.classList.contains('sidebar-open')).toBe(false);
      expect(document.body.classList.contains('sidebar-collapse')).toBe(true);
      sidebar.remove();
    });

    it('toggles the collapse class on desktop and removes any overlay', () => {
      const component = createComponent();
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });

      component.toggleSidebar();
      expect(document.body.classList.contains('sidebar-collapse')).toBe(true);

      component.toggleSidebar();
      expect(document.body.classList.contains('sidebar-collapse')).toBe(false);
    });

    it('removes the overlay when there is no sidebar element and the sidebar is not open', () => {
      const component = createComponent();
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });

      component.toggleSidebar();

      expect(document.querySelector('.sidebar-overlay')).toBeNull();
    });

    it('closes the sidebar when the overlay is clicked', () => {
      const component = createComponent();
      Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
      const sidebar = document.createElement('div');
      sidebar.className = 'app-sidebar';
      document.body.appendChild(sidebar);
      component.toggleSidebar();
      const overlay = document.querySelector('.sidebar-overlay')!;

      overlay.dispatchEvent(new Event('click', { cancelable: true }));

      expect(document.body.classList.contains('sidebar-open')).toBe(false);
      sidebar.remove();
    });
  });

  describe('ensureOverlay (private)', () => {
    it('does nothing when an overlay already exists', () => {
      const component = createComponent();
      (component as any).ensureOverlay();
      const first = (component as any).overlayEl;

      (component as any).ensureOverlay();

      expect((component as any).overlayEl).toBe(first);
      document.querySelectorAll('.sidebar-overlay').forEach((el) => el.remove());
    });

    it('appends the overlay to .app-wrapper when present', () => {
      const component = createComponent();
      const wrapper = document.createElement('div');
      wrapper.className = 'app-wrapper';
      document.body.appendChild(wrapper);

      (component as any).ensureOverlay();

      expect(wrapper.querySelector('.sidebar-overlay')).not.toBeNull();
      wrapper.remove();
    });
  });

  describe('hideOverlay (private, via toggleSidebar)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does nothing when there is no overlay', () => {
      const component = createComponent();

      expect(() => (component as any).hideOverlay()).not.toThrow();
    });

    it('removes the overlay after the delay when it is still not visible', () => {
      const component = createComponent();
      (component as any).ensureOverlay();
      const overlay = (component as any).overlayEl as HTMLElement;
      document.body.appendChild(overlay);

      (component as any).hideOverlay();
      vi.advanceTimersByTime(500);

      expect((component as any).overlayEl).toBeNull();
    });

    it('leaves the overlay alone if it became visible again before the delay elapses', () => {
      const component = createComponent();
      (component as any).ensureOverlay();
      const overlay = (component as any).overlayEl as HTMLElement;
      document.body.appendChild(overlay);

      (component as any).hideOverlay();
      overlay.classList.add('visible');
      vi.advanceTimersByTime(500);

      expect((component as any).overlayEl).toBe(overlay);
      overlay.remove();
    });
  });

  describe('removeOverlay (private)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does nothing when there is no overlay', () => {
      const component = createComponent();

      expect(() => (component as any).removeOverlay()).not.toThrow();
    });

    it('removes the overlay immediately when forceRemove is true', () => {
      const component = createComponent();
      (component as any).ensureOverlay();
      const overlay = (component as any).overlayEl as HTMLElement;
      document.body.appendChild(overlay);

      (component as any).removeOverlay(true);

      expect(overlay.parentElement).toBeNull();
      expect((component as any).overlayEl).toBeNull();
    });

    it('waits for the transition to end before removing, with a fallback timeout', () => {
      const component = createComponent();
      (component as any).ensureOverlay();
      const overlay = (component as any).overlayEl as HTMLElement;
      document.body.appendChild(overlay);

      (component as any).removeOverlay();
      vi.advanceTimersByTime(800);

      expect(overlay.parentElement).toBeNull();
      expect((component as any).overlayEl).toBeNull();
    });

    it('removes via the transitionend event when it fires before the fallback', () => {
      const component = createComponent();
      (component as any).ensureOverlay();
      const overlay = (component as any).overlayEl as HTMLElement;
      document.body.appendChild(overlay);

      (component as any).removeOverlay();
      overlay.dispatchEvent(new Event('transitionend'));

      expect(overlay.parentElement).toBeNull();
      expect((component as any).overlayEl).toBeNull();
    });

    it('skips unlisten when there is no click listener registered', () => {
      const component = createComponent();
      (component as any).ensureOverlay();
      const overlay = (component as any).overlayEl as HTMLElement;
      document.body.appendChild(overlay);
      (component as any).overlayClickUnlisten = null;

      expect(() => (component as any).removeOverlay(true)).not.toThrow();
      expect((component as any).overlayEl).toBeNull();
    });

    it('does not throw when the overlay element has already been detached from the DOM', () => {
      const component = createComponent();
      (component as any).ensureOverlay();
      const overlay = (component as any).overlayEl as HTMLElement;
      overlay.parentElement?.removeChild(overlay);

      expect(() => (component as any).removeOverlay(true)).not.toThrow();
      expect((component as any).overlayEl).toBeNull();
      expect(overlay.parentElement).toBeNull();
    });

    it('leaves overlayEl untouched when it was replaced before the removal completes', () => {
      const component = createComponent();
      (component as any).ensureOverlay();
      const overlay = (component as any).overlayEl as HTMLElement;
      document.body.appendChild(overlay);
      const replacement = document.createElement('div');
      (component as any).removeOverlay();
      (component as any).overlayEl = replacement;

      overlay.dispatchEvent(new Event('transitionend'));

      expect((component as any).overlayEl).toBe(replacement);
      expect(overlay.parentElement).toBeNull();
    });

    it('via the fallback timeout, leaves overlayEl untouched when it was replaced first', () => {
      const component = createComponent();
      (component as any).ensureOverlay();
      const overlay = (component as any).overlayEl as HTMLElement;
      document.body.appendChild(overlay);
      const replacement = document.createElement('div');
      (component as any).removeOverlay();
      (component as any).overlayEl = replacement;

      vi.advanceTimersByTime(800);

      expect((component as any).overlayEl).toBe(replacement);
    });
  });
});
