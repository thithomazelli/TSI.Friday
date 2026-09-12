import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AccountService, FeatureFlagService, ModalService } from '../services';
import { TranslationService } from '../services/translation/translation.service';
import { AuthorizationGuard } from './authorization.guard';
import { User } from '../models/account/user';

describe('AuthorizationGuard', () => {
  let guard: AuthorizationGuard;
  let accountServiceMock: { user$: Observable<User | null> };
  let featureFlagServiceMock: { isEnabled: ReturnType<typeof vi.fn> };
  let modalServiceMock: { hideModal: ReturnType<typeof vi.fn>; showNotification: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  function makeGuard(user: User | null) {
    accountServiceMock = { user$: of(user) };
    featureFlagServiceMock = { isEnabled: vi.fn().mockReturnValue(of(true)) };
    modalServiceMock = { hideModal: vi.fn(), showNotification: vi.fn() };
    routerMock = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AuthorizationGuard,
        { provide: AccountService, useValue: accountServiceMock },
        { provide: FeatureFlagService, useValue: featureFlagServiceMock },
        { provide: ModalService, useValue: modalServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: TranslationService, useValue: { instant: (key: string) => key } },
      ],
    });
    return TestBed.inject(AuthorizationGuard);
  }

  function route(data: Record<string, unknown> = {}): ActivatedRouteSnapshot {
    return { data } as unknown as ActivatedRouteSnapshot;
  }

  function state(url = '/vehicles'): RouterStateSnapshot {
    return { url } as unknown as RouterStateSnapshot;
  }

  // Every dependency here resolves synchronously (of(...)), so canActivate()'s Observable emits
  // within the subscribe() call itself - no need for Vitest's async-completion machinery.
  function activate(r: ActivatedRouteSnapshot, s: RouterStateSnapshot): boolean {
    let result: boolean | undefined;
    guard.canActivate(r, s).subscribe((allowed) => (result = allowed));
    return result!;
  }

  it('should be created', () => {
    guard = makeGuard(null);
    expect(guard).toBeTruthy();
  });

  it('redirects to login and denies access when there is no logged-in user', () => {
    guard = makeGuard(null);

    const allowed = activate(route(), state('/vehicles'));

    expect(allowed).toBe(false);
    expect(routerMock.navigate).toHaveBeenCalledWith(['account/login'], {
      queryParams: { returnUrl: '/vehicles' },
    });
    expect(modalServiceMock.hideModal).toHaveBeenCalled();
  });

  it('does not hide the modal when redirecting from an /account route', () => {
    guard = makeGuard(null);

    activate(route(), state('/account/login'));

    expect(modalServiceMock.hideModal).not.toHaveBeenCalled();
  });

  it('denies access and shows a notification when the user lacks a required role', () => {
    guard = makeGuard({ roles: ['User'] } as User);

    const allowed = activate(route({ roles: ['Admin'] }), state());

    expect(allowed).toBe(false);
    expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
      false,
      'ACCOUNT.ACCESS_DENIED',
      'ACCOUNT.ACCESS_DENIED_MESSAGE',
    );
    expect(routerMock.navigate).toHaveBeenCalledWith(['']);
  });

  it('allows access when the user has one of the required roles', () => {
    guard = makeGuard({ roles: ['Admin'] } as User);

    expect(activate(route({ roles: ['Admin', 'Master'] }), state())).toBe(true);
  });

  it('redirects to not-found when a required feature flag is disabled', () => {
    guard = makeGuard({ roles: ['Admin'] } as User);
    featureFlagServiceMock.isEnabled.mockReturnValue(of(false));

    const allowed = activate(route({ featureFlag: 'FleetModule' }), state());

    expect(allowed).toBe(false);
    expect(routerMock.navigate).toHaveBeenCalledWith(['not-found']);
  });

  it('requires every flag in an array to be enabled', () => {
    guard = makeGuard({ roles: ['Admin'] } as User);
    featureFlagServiceMock.isEnabled.mockImplementation((flag: string) =>
      of(flag === 'FleetModule'),
    );

    const allowed = activate(route({ featureFlag: ['FleetModule', 'Vehicles'] }), state());

    expect(allowed).toBe(false);
  });

  it('allows access when every flag in an array is enabled', () => {
    guard = makeGuard({ roles: ['Admin'] } as User);
    featureFlagServiceMock.isEnabled.mockReturnValue(of(true));

    const allowed = activate(route({ featureFlag: ['FleetModule', 'Vehicles'] }), state());

    expect(allowed).toBe(true);
    expect(routerMock.navigate).not.toHaveBeenCalledWith(['not-found']);
  });

  it('allows access when there are no role or feature flag restrictions', () => {
    guard = makeGuard({ roles: [] } as unknown as User);

    expect(activate(route(), state())).toBe(true);
  });

  it('canActivateChild delegates to canActivate', () => {
    guard = makeGuard({ roles: ['Admin'] } as User);

    let result: boolean | undefined;
    guard.canActivateChild(route(), state()).subscribe((allowed) => (result = allowed));

    expect(result).toBe(true);
  });
});
