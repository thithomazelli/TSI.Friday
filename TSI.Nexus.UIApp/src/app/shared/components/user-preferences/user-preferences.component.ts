import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  AppLanguage,
  AppTheme,
  NotificationService,
  PreferencesService,
  ThemeService,
  TranslationService,
} from '@nexus/core';
import { finalize } from 'rxjs/operators';
import { NgIf, AsyncPipe } from '@angular/common';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-user-preferences',
    templateUrl: './user-preferences.component.html',
    styleUrl: './user-preferences.component.scss',
    imports: [
        NgIf,
        TranslatePipe,
        AsyncPipe,
    ],
})
export class UserPreferencesComponent {
  /** Compact mode drops the title/description, used inside the navbar dropdown. */
  @Input() compact = false;

  saving = false;

  constructor(
    public themeService: ThemeService,
    public translationService: TranslationService,
    private preferencesService: PreferencesService,
    private notificationService: NotificationService,
  ) {}

  onThemeSelect(theme: AppTheme): void {
    if (theme === this.themeService.current) {
      return;
    }
    this.themeService.apply(theme);
    this.persist();
  }

  onLanguageChange(language: AppLanguage): void {
    if (language === this.translationService.current) {
      return;
    }
    this.translationService.use(language);
    this.persist();
  }

  private persist(): void {
    this.saving = true;
    this.preferencesService
      .update({
        theme: this.themeService.current,
        language: this.translationService.current,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        error: () => {
          this.notificationService.showMessage(
            'Error',
            this.translationService.instant('PREFERENCES.ERROR'),
          );
        },
      });
  }
}
