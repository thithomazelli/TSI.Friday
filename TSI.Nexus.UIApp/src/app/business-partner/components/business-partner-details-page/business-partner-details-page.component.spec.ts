import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import {
  BusinessPartnerService,
  Company,
  Individual,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { BusinessPartnerDetailsPageComponent } from './business-partner-details-page.component';

describe('BusinessPartnerDetailsPageComponent', () => {
  let activatedRouteMock: { snapshot: { paramMap: { get: ReturnType<typeof vi.fn> } } };
  let businessPartnerServiceMock: { getById: ReturnType<typeof vi.fn> };
  let routerMock: { url: string; navigateByUrl: ReturnType<typeof vi.fn> };
  let translationServiceMock: { language$: Subject<string>; instant: ReturnType<typeof vi.fn> };
  let featureFlagServiceMock: { isEnabled: ReturnType<typeof vi.fn> };

  function createComponent(id: string | null): BusinessPartnerDetailsPageComponent {
    activatedRouteMock = { snapshot: { paramMap: { get: vi.fn().mockReturnValue(id) } } };
    businessPartnerServiceMock = { getById: vi.fn().mockReturnValue(new Subject()) };
    routerMock = { url: '/clients', navigateByUrl: vi.fn() };
    translationServiceMock = { language$: new Subject(), instant: vi.fn((key: string) => key) };
    featureFlagServiceMock = { isEnabled: vi.fn().mockReturnValue(of(true)) };

    TestBed.configureTestingModule({});
    return TestBed.runInInjectionContext(
      () =>
        new BusinessPartnerDetailsPageComponent(
          activatedRouteMock as unknown as ActivatedRoute,
          businessPartnerServiceMock as unknown as BusinessPartnerService,
          routerMock as unknown as Router,
          translationServiceMock as unknown as TranslationService,
          featureFlagServiceMock as unknown as FeatureFlagService,
        ),
    );
  }

  it('should create', () => {
    expect(createComponent(null)).toBeTruthy();
  });

  it('isAgendaEnabled combines the group and entity flags', () => {
    const component = createComponent(null);
    expect(component.isAgendaEnabled()).toBe(true);
    expect(featureFlagServiceMock.isEnabled).toHaveBeenCalledWith('AgendaModule');
    expect(featureFlagServiceMock.isEnabled).toHaveBeenCalledWith('Event');
  });

  it('isAgendaEnabled is false when either flag is disabled', () => {
    featureFlagServiceMock = { isEnabled: vi.fn((key: string) => of(key === 'AgendaModule')) };
    activatedRouteMock = { snapshot: { paramMap: { get: vi.fn().mockReturnValue(null) } } };
    businessPartnerServiceMock = { getById: vi.fn().mockReturnValue(new Subject()) };
    routerMock = { url: '/clients', navigateByUrl: vi.fn() };
    translationServiceMock = { language$: new Subject(), instant: vi.fn((key: string) => key) };
    TestBed.configureTestingModule({});
    const component = TestBed.runInInjectionContext(
      () =>
        new BusinessPartnerDetailsPageComponent(
          activatedRouteMock as unknown as ActivatedRoute,
          businessPartnerServiceMock as unknown as BusinessPartnerService,
          routerMock as unknown as Router,
          translationServiceMock as unknown as TranslationService,
          featureFlagServiceMock as unknown as FeatureFlagService,
        ),
    );

    expect(component.isAgendaEnabled()).toBe(false);
  });

  describe('ngOnInit', () => {
    it('sets up for a new business partner (no id param)', () => {
      const component = createComponent(null);

      component.ngOnInit();

      expect(component.isEdit).toBe(false);
      expect(component.data).toEqual({ type: 'Client' });
    });

    it('loads an existing business partner by id', () => {
      const component = createComponent('bp1');
      const response$ = new Subject<WebApiResponse<Company | Individual>>();
      businessPartnerServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      expect(component.loading).toBe(true);
      expect(businessPartnerServiceMock.getById).toHaveBeenCalledWith('bp1');

      const data = { id: 'bp1' } as Individual;
      response$.next({ data } as WebApiResponse<Individual>);

      expect(component.loading).toBe(false);
      expect(component.data).toBe(data);
    });

    it('navigates to not-found when the business partner does not exist', () => {
      const component = createComponent('missing');
      const response$ = new Subject<WebApiResponse<Company | Individual>>();
      businessPartnerServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      response$.next({ data: null } as unknown as WebApiResponse<Individual>);

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });
  });

  it('ngOnDestroy does not throw', () => {
    const component = createComponent(null);
    expect(() => component.ngOnDestroy()).not.toThrow();
  });
});
