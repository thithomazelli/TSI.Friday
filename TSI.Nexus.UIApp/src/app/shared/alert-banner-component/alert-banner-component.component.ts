import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { TranslationService } from '@nexus/core';
import { NgClass } from '@angular/common';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-alert-banner-component',
    templateUrl: './alert-banner-component.component.html',
    styleUrl: './alert-banner-component.component.scss',
    imports: [NgClass],
})
export class AlertBannerComponentComponent implements OnInit {
  @Input()
  status: string | undefined = '';

  @Input()
  entity: string = '';

  constructor(private translationService: TranslationService) {}

  private _statusIconMap: { [key: string]: string } = {
    Pending: 'info',
    Open: 'info',
    WaitingPayment: 'info',
    InProgress: 'info',
    Approved: 'check',
    Converted: 'check',
    Closed: 'check',
    Returned: 'check',
    Delayed: 'exclamation',
    MissingPayments: 'exclamation',
    default: 'info',
  };

  private _statusMessageMap: { [key: string]: string } = {};

  private _statusColorMap: { [key: string]: string } = {
    Pending: 'info',
    Open: 'info',
    InProgress: 'info',
    Approved: 'success',
    Converted: 'success',
    Closed: 'success',
    Returned: 'success',
    Delayed: 'danger',
    MissingPayments: 'danger',
    WaitingPayment: 'warning',
    default: 'secondary',
  };

  ngOnInit(): void {
    this.initializeMessages();
    this.translationService.language$.subscribe(() => this.initializeMessages());
  }

  get statusIcon(): string {
    return (
      this._statusIconMap[this.status || ''] || this._statusIconMap['default']
    );
  }

  get statusColor(): string {
    return (
      this._statusColorMap[this.status || ''] || this._statusColorMap['default']
    );
  }

  get statusMessage(): string {
    return this._statusMessageMap[this.status || ''] || this.status || '';
  }

  private initializeMessages(): void {
    const t = (key: string) =>
      this.translationService.instant(key, { entity: this.entity });

    this._statusMessageMap = {
      Approved: t('ALERT_BANNER.COMPLETED_MASC'),
      Converted: t('ALERT_BANNER.COMPLETED_MASC'),
      Closed: t('ALERT_BANNER.COMPLETED_MASC'),
      Returned: t('ALERT_BANNER.COMPLETED_MASC'),
      Pending: t('ALERT_BANNER.OPEN_STATUS'),
      Open: t('ALERT_BANNER.OPEN_STATUS'),
      WaitingPayment: t('ALERT_BANNER.WAITING_PAYMENT'),
      InProgress: t('ALERT_BANNER.IN_PROGRESS_STATUS'),
      Delayed: t('ALERT_BANNER.DELAYED_MASC'),
      MissingPayments: t('ALERT_BANNER.MISSING_PAYMENTS'),
    };

    if (this.entity === this.translationService.instant('TRANSACTIONS.SINGULAR')) {
      this._statusMessageMap = {
        ...this._statusMessageMap,
        Approved: t('ALERT_BANNER.COMPLETED_FEM'),
        Closed: t('ALERT_BANNER.COMPLETED_FEM'),
        Converted: t('ALERT_BANNER.COMPLETED_FEM'),
        Returned: t('ALERT_BANNER.COMPLETED_FEM'),
        Delayed: t('ALERT_BANNER.DELAYED_FEM'),
      };
    }
  }
}
