import { of, throwError } from 'rxjs';
import {
  NotificationService,
  PreferencesService,
  ThemeService,
  TranslationService,
} from '@nexus/core';
import { UserPreferencesComponent } from './user-preferences.component';

describe('UserPreferencesComponent', () => {
  let themeServiceMock: { current: string; apply: ReturnType<typeof vi.fn> };
  let translationServiceMock: { current: string; use: ReturnType<typeof vi.fn>; instant: ReturnType<typeof vi.fn> };
  let preferencesServiceMock: { update: ReturnType<typeof vi.fn> };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };

  function createComponent() {
    themeServiceMock = { current: 'light', apply: vi.fn() };
    translationServiceMock = { current: 'pt-BR', use: vi.fn(), instant: vi.fn((key: string) => key) };
    preferencesServiceMock = { update: vi.fn().mockReturnValue(of({})) };
    notificationServiceMock = { showMessage: vi.fn() };

    return new UserPreferencesComponent(
      themeServiceMock as unknown as ThemeService,
      translationServiceMock as unknown as TranslationService,
      preferencesServiceMock as unknown as PreferencesService,
      notificationServiceMock as unknown as NotificationService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('onThemeSelect', () => {
    it('does nothing when selecting the theme already active', () => {
      const component = createComponent();

      component.onThemeSelect('light' as never);

      expect(themeServiceMock.apply).not.toHaveBeenCalled();
      expect(preferencesServiceMock.update).not.toHaveBeenCalled();
    });

    it('applies the new theme and persists the preference', () => {
      const component = createComponent();

      component.onThemeSelect('dark' as never);

      expect(themeServiceMock.apply).toHaveBeenCalledWith('dark');
      expect(preferencesServiceMock.update).toHaveBeenCalledWith({ theme: 'light', language: 'pt-BR' });
    });
  });

  describe('onLanguageChange', () => {
    it('does nothing when selecting the language already active', () => {
      const component = createComponent();

      component.onLanguageChange('pt-BR' as never);

      expect(translationServiceMock.use).not.toHaveBeenCalled();
      expect(preferencesServiceMock.update).not.toHaveBeenCalled();
    });

    it('switches the language and persists the preference', () => {
      const component = createComponent();

      component.onLanguageChange('en' as never);

      expect(translationServiceMock.use).toHaveBeenCalledWith('en');
      expect(preferencesServiceMock.update).toHaveBeenCalled();
    });
  });

  describe('persist', () => {
    it('tracks saving state around a successful update', () => {
      const component = createComponent();

      component.onThemeSelect('dark' as never);

      expect(component.saving).toBe(false);
    });

    it('shows a translated error notification and still resets saving when the update fails', () => {
      const component = createComponent();
      preferencesServiceMock.update.mockReturnValue(throwError(() => new Error('boom')));

      component.onThemeSelect('dark' as never);

      expect(component.saving).toBe(false);
      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith('Error', 'PREFERENCES.ERROR');
    });
  });
});
