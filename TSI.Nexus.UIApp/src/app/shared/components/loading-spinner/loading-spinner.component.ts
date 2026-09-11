import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-loading-spinner',
    templateUrl: './loading-spinner.component.html',
    styleUrl: './loading-spinner.component.scss',
    imports: [TranslatePipe],
})
export class LoadingSpinnerComponent {}
