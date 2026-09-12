import { of, throwError } from 'rxjs';
import { AlertConfig, AlertConfigService, NotificationService, ResponseStatus, TranslationService } from '@nexus/core';
import { AlertConfigsComponent } from './alert-configs.component';

describe('AlertConfigsComponent', () => {
  let alertConfigServiceMock: {
    getAll: ReturnType<typeof vi.fn>;
    setEnabled: ReturnType<typeof vi.fn>;
    setThresholdDays: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };

  function createComponent() {
    alertConfigServiceMock = {
      getAll: vi.fn().mockReturnValue(of({ data: [] })),
      setEnabled: vi.fn(),
      setThresholdDays: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };

    return new AlertConfigsComponent(
      alertConfigServiceMock as unknown as AlertConfigService,
      notificationServiceMock as unknown as NotificationService,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('loads all alert configs on init', () => {
    const alerts = [{ key: 'a1' }] as AlertConfig[];
    const component = createComponent();
    alertConfigServiceMock.getAll.mockReturnValue(of({ data: alerts }));

    component.ngOnInit();

    expect(component.alerts).toBe(alerts);
    expect(component.loading).toBe(false);
  });

  it('defaults to an empty list and stops loading when the response has no data', () => {
    const component = createComponent();
    alertConfigServiceMock.getAll.mockReturnValue(of({ data: null }));

    component.ngOnInit();

    expect(component.alerts).toEqual([]);
    expect(component.loading).toBe(false);
  });

  it('stops loading when the load request errors out', () => {
    const component = createComponent();
    alertConfigServiceMock.getAll.mockReturnValue(throwError(() => new Error('boom')));

    component.ngOnInit();

    expect(component.loading).toBe(false);
  });

  describe('toggle', () => {
    it('does nothing when the alert has no key', () => {
      const component = createComponent();

      component.toggle({ key: '' } as AlertConfig);

      expect(alertConfigServiceMock.setEnabled).not.toHaveBeenCalled();
    });

    it('does nothing while another save is already in flight', () => {
      const component = createComponent();
      component.savingKey = 'other';

      component.toggle({ key: 'a1', enabled: false } as AlertConfig);

      expect(alertConfigServiceMock.setEnabled).not.toHaveBeenCalled();
    });

    it('flips enabled, calls the service, and applies the confirmed value on success', () => {
      const alert = { key: 'a1', enabled: false } as AlertConfig;
      const response = { status: ResponseStatus.Success, message: 'ok', data: { enabled: true } };
      const component = createComponent();
      alertConfigServiceMock.setEnabled.mockReturnValue(of(response));

      component.toggle(alert);

      expect(alertConfigServiceMock.setEnabled).toHaveBeenCalledWith('a1', true);
      expect(alert.enabled).toBe(true);
      expect(component.savingKey).toBeNull();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(response.status, response.message);
    });

    it('does not apply the response value when the backend reports a non-success status', () => {
      const alert = { key: 'a1', enabled: false } as AlertConfig;
      const response = { status: ResponseStatus.Error, message: 'falhou', data: { enabled: true } };
      const component = createComponent();
      alertConfigServiceMock.setEnabled.mockReturnValue(of(response));

      component.toggle(alert);

      expect(alert.enabled).toBe(false);
    });

    it('shows a translated error notification and clears savingKey when the request errors out', () => {
      const alert = { key: 'a1', enabled: false } as AlertConfig;
      const component = createComponent();
      alertConfigServiceMock.setEnabled.mockReturnValue(throwError(() => new Error('boom')));

      component.toggle(alert);

      expect(component.savingKey).toBeNull();
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'ALERT_CONFIGS.UPDATE_ERROR');
    });
  });

  describe('saveThreshold', () => {
    it('does nothing when the alert has no key', () => {
      const component = createComponent();

      component.saveThreshold({ key: '', thresholdDays: 5 } as AlertConfig);

      expect(alertConfigServiceMock.setThresholdDays).not.toHaveBeenCalled();
    });

    it('does nothing when thresholdDays is missing or below 1', () => {
      const component = createComponent();

      component.saveThreshold({ key: 'a1', thresholdDays: null } as unknown as AlertConfig);
      component.saveThreshold({ key: 'a1', thresholdDays: 0 } as AlertConfig);

      expect(alertConfigServiceMock.setThresholdDays).not.toHaveBeenCalled();
    });

    it('does nothing while another save is already in flight', () => {
      const component = createComponent();
      component.savingKey = 'other';

      component.saveThreshold({ key: 'a1', thresholdDays: 5 } as AlertConfig);

      expect(alertConfigServiceMock.setThresholdDays).not.toHaveBeenCalled();
    });

    it('saves the threshold and applies the confirmed value on success', () => {
      const alert = { key: 'a1', thresholdDays: 5 } as AlertConfig;
      const response = { status: ResponseStatus.Success, message: 'ok', data: { thresholdDays: 7 } };
      const component = createComponent();
      alertConfigServiceMock.setThresholdDays.mockReturnValue(of(response));

      component.saveThreshold(alert);

      expect(alertConfigServiceMock.setThresholdDays).toHaveBeenCalledWith('a1', 5);
      expect(alert.thresholdDays).toBe(7);
      expect(component.savingKey).toBeNull();
    });

    it('shows a translated error notification when the request errors out', () => {
      const alert = { key: 'a1', thresholdDays: 5 } as AlertConfig;
      const component = createComponent();
      alertConfigServiceMock.setThresholdDays.mockReturnValue(throwError(() => new Error('boom')));

      component.saveThreshold(alert);

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'Error',
        'ALERT_CONFIGS.UPDATE_THRESHOLD_ERROR',
      );
    });

    it('does not apply the response value when the backend reports a non-success status', () => {
      const alert = { key: 'a1', thresholdDays: 5 } as AlertConfig;
      const response = { status: ResponseStatus.Error, message: 'falhou', data: { thresholdDays: 7 } };
      const component = createComponent();
      alertConfigServiceMock.setThresholdDays.mockReturnValue(of(response));

      component.saveThreshold(alert);

      expect(alert.thresholdDays).toBe(5);
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(response.status, response.message);
    });
  });
});
