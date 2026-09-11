import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import {
  AlertConfig,
  AlertConfigService,
  NotificationService,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';
import { finalize } from 'rxjs/operators';
import { HeaderComponent } from '../shared/header/header.component';
import { NgIf, NgFor } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TranslatePipe } from '../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-alert-configs',
    templateUrl: './alert-configs.component.html',
    styleUrl: './alert-configs.component.scss',
    imports: [
        HeaderComponent,
        NgIf,
        NgFor,
        ReactiveFormsModule,
        FormsModule,
        TranslatePipe,
    ],
})
export class AlertConfigsComponent implements OnInit {
  alerts: AlertConfig[] = [];
  loading = false;
  savingKey: string | null = null;

  constructor(
    private alertConfigService: AlertConfigService,
    private notificationService: NotificationService,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  toggle(alertConfig: AlertConfig): void {
    if (!alertConfig.key || this.savingKey) {
      return;
    }
    const nextEnabled = !alertConfig.enabled;
    this.savingKey = alertConfig.key;

    this.alertConfigService
      .setEnabled(alertConfig.key, nextEnabled)
      .pipe(finalize(() => (this.savingKey = null)))
      .subscribe({
        next: (response) => {
          if (response.status === ResponseStatus.Success && response.data) {
            alertConfig.enabled = response.data.enabled;
          }
          this.notificationService.showMessage(
            response.status,
            response.message,
          );
        },
        error: () => {
          this.notificationService.showMessage(
            'Error',
            this.translationService.instant('ALERT_CONFIGS.UPDATE_ERROR'),
          );
        },
      });
  }

  saveThreshold(alertConfig: AlertConfig): void {
    if (
      !alertConfig.key ||
      this.savingKey ||
      alertConfig.thresholdDays == null ||
      alertConfig.thresholdDays < 1
    ) {
      return;
    }
    this.savingKey = alertConfig.key;

    this.alertConfigService
      .setThresholdDays(alertConfig.key, alertConfig.thresholdDays)
      .pipe(finalize(() => (this.savingKey = null)))
      .subscribe({
        next: (response) => {
          if (response.status === ResponseStatus.Success && response.data) {
            alertConfig.thresholdDays = response.data.thresholdDays;
          }
          this.notificationService.showMessage(
            response.status,
            response.message,
          );
        },
        error: () => {
          this.notificationService.showMessage(
            'Error',
            this.translationService.instant('ALERT_CONFIGS.UPDATE_THRESHOLD_ERROR'),
          );
        },
      });
  }

  private load(): void {
    this.loading = true;
    this.alertConfigService.getAll().subscribe({
      next: (response) => {
        this.alerts = response.data ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
