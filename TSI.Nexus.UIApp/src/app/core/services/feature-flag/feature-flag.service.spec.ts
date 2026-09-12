import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, FeatureToggle, FeatureToggleKeys, WebApiResponse } from '@nexus/core';
import { FeatureFlagService } from './feature-flag.service';

describe('FeatureFlagService', () => {
  let apiServiceMock: { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };
  let getResponse$: Subject<WebApiResponse<FeatureToggle[]>>;

  function createService(): FeatureFlagService {
    getResponse$ = new Subject();
    apiServiceMock = {
      get: vi.fn().mockReturnValue(getResponse$),
      put: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(FeatureFlagService);
  }

  function subscribeLatest<T>(obs: { subscribe: (fn: (v: T) => void) => void }): { value?: T } {
    const box: { value?: T } = {};
    obs.subscribe((v) => (box.value = v));
    return box;
  }

  it('should create, firing the initial load immediately', () => {
    const service = createService();

    expect(service).toBeTruthy();
    expect(apiServiceMock.get).toHaveBeenCalledWith('featuretoggles/getAll');
  });

  it('isEnabled() does not emit before the initial load resolves', () => {
    const service = createService();
    const box = subscribeLatest(service.isEnabled(FeatureToggleKeys.FleetModule));

    expect(box.value).toBeUndefined();
  });

  it('isEnabled() emits true for a toggle explicitly enabled', () => {
    const service = createService();
    const box = subscribeLatest(service.isEnabled(FeatureToggleKeys.FleetModule));

    getResponse$.next({ data: [{ key: FeatureToggleKeys.FleetModule, enabled: true } as FeatureToggle] } as unknown as WebApiResponse<FeatureToggle[]>);
    TestBed.flushEffects();

    expect(box.value).toBe(true);
  });

  it('isEnabled() emits false for a toggle explicitly disabled', () => {
    const service = createService();
    const box = subscribeLatest(service.isEnabled(FeatureToggleKeys.FleetModule));

    getResponse$.next({ data: [{ key: FeatureToggleKeys.FleetModule, enabled: false } as FeatureToggle] } as unknown as WebApiResponse<FeatureToggle[]>);
    TestBed.flushEffects();

    expect(box.value).toBe(false);
  });

  it('isEnabled() fails open (true) for a key that is not registered', () => {
    const service = createService();
    const box = subscribeLatest(service.isEnabled('SomeUnregisteredKey'));

    getResponse$.next({ data: [{ key: FeatureToggleKeys.FleetModule, enabled: false } as FeatureToggle] } as unknown as WebApiResponse<FeatureToggle[]>);
    TestBed.flushEffects();

    expect(box.value).toBe(true);
  });

  it('treats a missing response.data as an empty toggle set rather than throwing', () => {
    const service = createService();
    const box = subscribeLatest(service.isEnabled(FeatureToggleKeys.FleetModule));

    getResponse$.next({ data: undefined } as unknown as WebApiResponse<FeatureToggle[]>);
    TestBed.flushEffects();

    expect(box.value).toBe(true);
  });

  it('isFleetModuleEnabled() delegates to isEnabled(FleetModule)', () => {
    const service = createService();
    const box = subscribeLatest(service.isFleetModuleEnabled());

    getResponse$.next({ data: [{ key: FeatureToggleKeys.FleetModule, enabled: true } as FeatureToggle] } as unknown as WebApiResponse<FeatureToggle[]>);
    TestBed.flushEffects();

    expect(box.value).toBe(true);
  });

  it('refresh() re-fetches and isEnabled() reflects the updated set', () => {
    const service = createService();
    getResponse$.next({ data: [{ key: FeatureToggleKeys.FleetModule, enabled: true } as FeatureToggle] } as unknown as WebApiResponse<FeatureToggle[]>);
    TestBed.flushEffects();

    const secondResponse$ = new Subject<WebApiResponse<FeatureToggle[]>>();
    apiServiceMock.get.mockReturnValue(secondResponse$);
    service.refresh();

    const box = subscribeLatest(service.isEnabled(FeatureToggleKeys.FleetModule));
    expect(box.value).toBe(true); // still reflects the pre-refresh value until the new response lands

    secondResponse$.next({ data: [{ key: FeatureToggleKeys.FleetModule, enabled: false } as FeatureToggle] } as unknown as WebApiResponse<FeatureToggle[]>);
    TestBed.flushEffects();
    expect(box.value).toBe(false);
  });

  it('setEnabled() PUTs to the expected URL and triggers a refresh', () => {
    const service = createService();
    const putResponse$ = new Subject<WebApiResponse<FeatureToggle>>();
    apiServiceMock.put.mockReturnValue(putResponse$);
    apiServiceMock.get.mockClear();

    service.setEnabled(FeatureToggleKeys.FleetModule, false).subscribe();
    putResponse$.next({ data: { key: FeatureToggleKeys.FleetModule, enabled: false } } as unknown as WebApiResponse<FeatureToggle>);

    expect(apiServiceMock.put).toHaveBeenCalledWith('featuretoggles/setEnabled/FleetModule/false', null);
    expect(apiServiceMock.get).toHaveBeenCalledTimes(1);
  });

  it('getAll() passes straight through to ApiService without touching the cached signal', () => {
    const service = createService();
    const allResponse$ = new Subject<WebApiResponse<FeatureToggle[]>>();
    apiServiceMock.get.mockReturnValue(allResponse$);

    const box = subscribeLatest(service.getAll());
    allResponse$.next({ data: [] } as unknown as WebApiResponse<FeatureToggle[]>);

    expect(box.value).toEqual({ data: [] });
  });
});
