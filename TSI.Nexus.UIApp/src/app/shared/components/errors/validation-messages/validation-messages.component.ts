import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-validation-messages',
    templateUrl: './validation-messages.component.html',
    styleUrl: './validation-messages.component.scss',
})
export class ValidationMessagesComponent {
  @Input()
  errorMessages: string[] | undefined;
}
