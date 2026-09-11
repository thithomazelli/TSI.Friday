import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-logout',
    templateUrl: './logout.component.html',
    styleUrl: './logout.component.scss'
})
export class LogoutComponent {

}
