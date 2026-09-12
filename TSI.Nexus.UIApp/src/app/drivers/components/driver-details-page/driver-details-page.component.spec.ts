import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { Driver, DriverService, TranslationService, WebApiResponse } from '@nexus/core';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { DriverDetailsPageComponent } from './driver-details-page.component';

describe('DriverDetailsPageComponent', () => {
  let paramMap$: Subject<{ get: (key: string) => string | null }>;
  let activatedRouteMock: { paramMap: Subject<{ get: (key: string) => string | null } > };
  let driverServiceMock: { getById: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let featureFlagServiceMock: { isEnabled: ReturnType<typeof vi.fn> };

  function createComponent(): DriverDetailsPageComponent {
    paramMap$ = new Subject();
    activatedRouteMock = { paramMap: paramMap$ };
    driverServiceMock = { getById: vi.fn().mockReturnValue(new Subject()) };
    routerMock = { navigateByUrl: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    featureFlagServiceMock = { isEnabled: vi.fn().mockReturnValue(of(true)) };

    TestBed.configureTestingModule({});
    return TestBed.runInInjectionContext(
      () =>
        new DriverDetailsPageComponent(
          activatedRouteMock as unknown as ActivatedRoute,
          translationServiceMock as unknown as TranslationService,
          driverServiceMock as unknown as DriverService,
          routerMock as unknown as Router,
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

  it('isAgendaEnabled is false when either flag is disabled', () => {
    paramMap$ = new Subject();
    activatedRouteMock = { paramMap: paramMap$ };
    driverServiceMock = { getById: vi.fn().mockReturnValue(new Subject()) };
    routerMock = { navigateByUrl: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    featureFlagServiceMock = { isEnabled: vi.fn((key: string) => of(key === 'AgendaModule')) };
    TestBed.configureTestingModule({});
    const component = TestBed.runInInjectionContext(
      () =>
        new DriverDetailsPageComponent(
          activatedRouteMock as unknown as ActivatedRoute,
          translationServiceMock as unknown as TranslationService,
          driverServiceMock as unknown as DriverService,
          routerMock as unknown as Router,
          featureFlagServiceMock as unknown as FeatureFlagService,
        ),
    );

    expect(component.isAgendaEnabled()).toBe(false);
  });

  describe('ngOnInit', () => {
    it('sets isEdit=false and clears data for a new driver', () => {
      const component = createComponent();
      component.ngOnInit();

      paramMap$.next(paramMap('new'));

      expect(component.isEdit).toBe(false);
      expect(component.data).toBeNull();
    });

    it('loads an existing driver by id', () => {
      const component = createComponent();
      const response$ = new Subject<WebApiResponse<Driver>>();
      driverServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      paramMap$.next(paramMap('d1'));

      expect(component.isEdit).toBe(true);
      expect(component.loading).toBe(true);
      expect(driverServiceMock.getById).toHaveBeenCalledWith('d1');

      const data = { id: 'd1' } as Driver;
      response$.next({ data } as WebApiResponse<Driver>);

      expect(component.loading).toBe(false);
      expect(component.data).toBe(data);
    });

    it('navigates to not-found when the driver does not exist', () => {
      const component = createComponent();
      const response$ = new Subject<WebApiResponse<Driver>>();
      driverServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      paramMap$.next(paramMap('missing'));
      response$.next({ data: null } as unknown as WebApiResponse<Driver>);

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });
  });

  describe('getStatusLabel', () => {
    it('returns an empty string when there is no data', () => {
      const component = createComponent();
      expect(component.getStatusLabel()).toBe('');
    });

    it('resolves the translated status label', () => {
      const component = createComponent();
      component.data = { status: 'Active' } as Driver;

      expect(component.getStatusLabel()).toBe('DRIVERS.STATUS_ACTIVE');
    });
  });

  it('ngOnDestroy does not throw', () => {
    const component = createComponent();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });
});
