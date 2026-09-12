import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { AccountService, PhotoService, User, UserService, WebApiResponse } from '@nexus/core';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { UserDetailsPageComponent } from './user-details-page.component';

describe('UserDetailsPageComponent', () => {
  let paramMap$: Subject<{ get: (key: string) => string | null }>;
  let activatedRouteMock: { paramMap: Subject<{ get: (key: string) => string | null }> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let photoServiceMock: { photo$: Subject<{ photoPath: string; userId?: string }> };
  let userServiceMock: { getById: ReturnType<typeof vi.fn> };
  let accountServiceMock: { user$: Subject<User | null> };
  let featureFlagServiceMock: { isEnabled: ReturnType<typeof vi.fn> };

  function createComponent(): UserDetailsPageComponent {
    paramMap$ = new Subject();
    activatedRouteMock = { paramMap: paramMap$ };
    routerMock = { navigateByUrl: vi.fn() };
    photoServiceMock = { photo$: new Subject() };
    userServiceMock = { getById: vi.fn().mockReturnValue(new Subject()) };
    accountServiceMock = { user$: new Subject() };
    featureFlagServiceMock = { isEnabled: vi.fn().mockReturnValue(of(true)) };

    TestBed.configureTestingModule({});
    return TestBed.runInInjectionContext(
      () =>
        new UserDetailsPageComponent(
          activatedRouteMock as unknown as ActivatedRoute,
          routerMock as unknown as Router,
          photoServiceMock as unknown as PhotoService,
          userServiceMock as unknown as UserService,
          accountServiceMock as unknown as AccountService,
          featureFlagServiceMock as unknown as FeatureFlagService,
        ),
    );
  }

  function paramMap(id: string | null) {
    return { get: (key: string) => (key === 'id' ? id : null) };
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('isAgendaEnabled combines the group and entity flags', () => {
    const component = createComponent();
    expect(component.isAgendaEnabled()).toBe(true);
  });

  describe('ngOnInit', () => {
    it('sets isEdit=false for a new user', () => {
      const component = createComponent();
      component.ngOnInit();

      paramMap$.next(paramMap('new'));

      expect(component.isEdit).toBe(false);
      expect(component.data).toBeNull();
    });

    it('loads an existing user by id', () => {
      const component = createComponent();
      const response$ = new Subject<WebApiResponse<User>>();
      userServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      paramMap$.next(paramMap('u1'));

      expect(component.isEdit).toBe(true);
      expect(component.loading).toBe(true);
      expect(userServiceMock.getById).toHaveBeenCalledWith('u1');

      const data = { id: 'u1' } as User;
      response$.next({ data } as WebApiResponse<User>);

      expect(component.loading).toBe(false);
      expect(component.data).toBe(data);
    });

    it('navigates to not-found when the user does not exist', () => {
      const component = createComponent();
      const response$ = new Subject<WebApiResponse<User>>();
      userServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      paramMap$.next(paramMap('missing'));
      response$.next({ data: null } as unknown as WebApiResponse<User>);

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });

    it('updates the loaded user photo from photo$', () => {
      const component = createComponent();
      const response$ = new Subject<WebApiResponse<User>>();
      userServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      paramMap$.next(paramMap('u1'));
      response$.next({ data: { id: 'u1' } as User } as WebApiResponse<User>);

      photoServiceMock.photo$.next({ photoPath: 'photos/u1.jpg', userId: 'u1' });

      expect(component.data?.photo).toBe('photos/u1.jpg');
    });

    it('sets isOwnProfile when the current account matches the viewed user', () => {
      const component = createComponent();
      component.ngOnInit();
      paramMap$.next(paramMap('u1'));

      accountServiceMock.user$.next({ id: 'u1' } as User);
      expect(component.isOwnProfile).toBe(true);

      accountServiceMock.user$.next({ id: 'other' } as User);
      expect(component.isOwnProfile).toBe(false);
    });
  });

  it('ngOnDestroy does not throw', () => {
    const component = createComponent();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });

  describe('subscription teardown', () => {
    it('stops reacting to paramMap/photo$/user$ after ngOnDestroy', () => {
      const component = createComponent();
      const response$ = new Subject<WebApiResponse<User>>();
      userServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      paramMap$.next(paramMap('u1'));
      response$.next({ data: { id: 'u1' } as User } as WebApiResponse<User>);
      component.ngOnDestroy();

      // None of these should throw (no live subscribers) and none should mutate state anymore.
      paramMap$.next(paramMap('u2'));
      photoServiceMock.photo$.next({ photoPath: 'photos/u2.jpg', userId: 'u2' });
      accountServiceMock.user$.next({ id: 'u1' } as User);

      expect(component.id).toBe('u1');
      expect(component.data?.photo).toBeUndefined();
      expect(component.isOwnProfile).toBe(false);
    });
  });
});
