import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrl: './footer.component.scss',
    imports: [TranslatePipe]
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
}
