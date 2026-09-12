import { of, throwError } from 'rxjs';
import { FeatureFlagService, FeatureToggle, NotificationService, ResponseStatus, TranslationService } from '@nexus/core';
import { FeatureTogglesComponent } from './feature-toggles.component';

describe('FeatureTogglesComponent', () => {
  let featureFlagServiceMock: { getAll: ReturnType<typeof vi.fn>; setEnabled: ReturnType<typeof vi.fn> };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };

  function createComponent() {
    featureFlagServiceMock = { getAll: vi.fn().mockReturnValue(of({ data: [] })), setEnabled: vi.fn() };
    notificationServiceMock = { showMessage: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };

    return new FeatureTogglesComponent(
      featureFlagServiceMock as unknown as FeatureFlagService,
      notificationServiceMock as unknown as NotificationService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('loads all toggles on init', () => {
    const toggles = [{ key: 'FleetModule' }] as FeatureToggle[];
    const component = createComponent();
    featureFlagServiceMock.getAll.mockReturnValue(of({ data: toggles }));

    component.ngOnInit();

    expect(component.toggles).toBe(toggles);
    expect(component.loading).toBe(false);
  });

  it('stops loading when the load request errors out', () => {
    const component = createComponent();
    featureFlagServiceMock.getAll.mockReturnValue(throwError(() => new Error('boom')));

    component.ngOnInit();

    expect(component.loading).toBe(false);
  });

  describe('groupToggles / detailedGroups', () => {
    it('groupToggles returns only the top-level (no groupKey) toggles', () => {
      const component = createComponent();
      component.toggles = [
        { key: 'FleetModule' } as FeatureToggle,
        { key: 'Vehicles', groupKey: 'FleetModule' } as FeatureToggle,
        { key: 'FinanceModule' } as FeatureToggle,
      ];

      expect(component.groupToggles.map((t) => t.key)).toEqual(['FleetModule', 'FinanceModule']);
    });

    it('detailedGroups nests each group with only its own entity toggles', () => {
      const component = createComponent();
      const fleetGroup = { key: 'FleetModule' } as FeatureToggle;
      const financeGroup = { key: 'FinanceModule' } as FeatureToggle;
      const vehicles = { key: 'Vehicles', groupKey: 'FleetModule' } as FeatureToggle;
      const drivers = { key: 'Drivers', groupKey: 'FleetModule' } as FeatureToggle;
      component.toggles = [fleetGroup, financeGroup, vehicles, drivers];

      const groups = component.detailedGroups;

      expect(groups).toHaveLength(1);
      expect(groups[0].group).toBe(fleetGroup);
      expect(groups[0].entities).toEqual([vehicles, drivers]);
    });

    it('omits a group from detailedGroups when it has no entity toggles', () => {
      const component = createComponent();
      component.toggles = [{ key: 'FleetModule' } as FeatureToggle];

      expect(component.detailedGroups).toEqual([]);
    });
  });

  describe('trackBy helpers', () => {
    it('trackByGroupKey returns the nested group key', () => {
      const component = createComponent();
      const groupView = { group: { key: 'FleetModule' } as FeatureToggle, entities: [] };

      expect(component.trackByGroupKey(0, groupView)).toBe('FleetModule');
    });

    it('trackByToggleKey returns the toggle key', () => {
      const component = createComponent();
      expect(component.trackByToggleKey(0, { key: 'Vehicles' } as FeatureToggle)).toBe('Vehicles');
    });
  });

  describe('toggle', () => {
    it('does nothing when the toggle has no key', () => {
      const component = createComponent();

      component.toggle({ key: '' } as FeatureToggle);

      expect(featureFlagServiceMock.setEnabled).not.toHaveBeenCalled();
    });

    it('does nothing while another save is already in flight', () => {
      const component = createComponent();
      component.savingKey = 'other';

      component.toggle({ key: 'FleetModule', enabled: false } as FeatureToggle);

      expect(featureFlagServiceMock.setEnabled).not.toHaveBeenCalled();
    });

    it('flips enabled, calls the service, and applies the confirmed value on success', () => {
      const toggle = { key: 'FleetModule', enabled: false } as FeatureToggle;
      const response = { status: ResponseStatus.Success, message: 'ok', data: { enabled: true } };
      const component = createComponent();
      featureFlagServiceMock.setEnabled.mockReturnValue(of(response));

      component.toggle(toggle);

      expect(featureFlagServiceMock.setEnabled).toHaveBeenCalledWith('FleetModule', true);
      expect(toggle.enabled).toBe(true);
      expect(component.savingKey).toBeNull();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(response.status, response.message);
    });

    it('does not apply the response value when the backend reports a non-success status', () => {
      const toggle = { key: 'FleetModule', enabled: false } as FeatureToggle;
      const response = { status: ResponseStatus.Error, message: 'falhou', data: { enabled: true } };
      const component = createComponent();
      featureFlagServiceMock.setEnabled.mockReturnValue(of(response));

      component.toggle(toggle);

      expect(toggle.enabled).toBe(false);
    });

    it('shows a translated error notification and clears savingKey when the request errors out', () => {
      const toggle = { key: 'FleetModule', enabled: false } as FeatureToggle;
      const component = createComponent();
      featureFlagServiceMock.setEnabled.mockReturnValue(throwError(() => new Error('boom')));

      component.toggle(toggle);

      expect(component.savingKey).toBeNull();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'FEATURE_TOGGLES.UPDATE_ERROR');
    });
  });
});
