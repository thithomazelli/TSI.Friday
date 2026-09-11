import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import {
  FeatureFlagService,
  FeatureToggle,
  NotificationService,
  ResponseStatus,
  TranslationService,
} from '@nexus/core';
import { finalize } from 'rxjs/operators';
import { HeaderComponent } from '../shared/header/header.component';
import { NgIf, NgFor } from '@angular/common';
import { TranslatePipe } from '../core/pipes/translate.pipe';

export interface FeatureToggleGroupView {
  group: FeatureToggle;
  entities: FeatureToggle[];
}

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-feature-toggles',
    templateUrl: './feature-toggles.component.html',
    styleUrl: './feature-toggles.component.scss',
    imports: [
        HeaderComponent,
        NgIf,
        NgFor,
        TranslatePipe,
    ],
})
export class FeatureTogglesComponent implements OnInit {
  toggles: FeatureToggle[] = [];
  loading = false;
  savingKey: string | null = null;
  activeTab: 'grouped' | 'detailed' = 'grouped';

  constructor(
    private featureFlagService: FeatureFlagService,
    private notificationService: NotificationService,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get groupToggles(): FeatureToggle[] {
    return this.toggles.filter((t) => !t.groupKey);
  }

  get detailedGroups(): FeatureToggleGroupView[] {
    return this.groupToggles
      .map((group) => ({
        group,
        entities: this.toggles.filter((t) => t.groupKey === group.key),
      }))
      .filter((g) => g.entities.length > 0);
  }

  // detailedGroups is a getter that wraps each group in a brand new object literal on every
  // change-detection pass, so *ngFor's default identity-based tracking keeps destroying/
  // recreating the DOM for it - the same NG0103-prone pattern fixed elsewhere this session.
  trackByGroupKey(_index: number, groupView: FeatureToggleGroupView): string | undefined {
    return groupView.group.key;
  }

  trackByToggleKey(_index: number, featureToggle: FeatureToggle): string | undefined {
    return featureToggle.key;
  }

  toggle(featureToggle: FeatureToggle): void {
    if (!featureToggle.key || this.savingKey) {
      return;
    }
    const nextEnabled = !featureToggle.enabled;
    this.savingKey = featureToggle.key;

    this.featureFlagService
      .setEnabled(featureToggle.key, nextEnabled)
      .pipe(finalize(() => (this.savingKey = null)))
      .subscribe({
        next: (response) => {
          if (response.status === ResponseStatus.Success && response.data) {
            featureToggle.enabled = response.data.enabled;
          }
          this.notificationService.showMessage(
            response.status,
            response.message,
          );
        },
        error: () => {
          this.notificationService.showMessage(
            'Error',
            this.translationService.instant('FEATURE_TOGGLES.UPDATE_ERROR'),
          );
        },
      });
  }

  private load(): void {
    this.loading = true;
    this.featureFlagService.getAll().subscribe({
      next: (response) => {
        this.toggles = response.data ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
