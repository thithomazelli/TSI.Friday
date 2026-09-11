import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HeaderComponent } from '../../../header/header.component';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-not-found',
    templateUrl: './not-found.component.html',
    styleUrl: './not-found.component.scss',
    imports: [HeaderComponent, RouterLink, TranslatePipe]
})
export class NotFoundComponent {

}
