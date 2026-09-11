import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLinkActive, RouterLink } from '@angular/router';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrl: './header.component.scss',
    imports: [RouterLinkActive, RouterLink],
})
export class HeaderComponent {
  @Input() title: string = 'Nexus App';
  @Input() navigationMenus: { label: string; link: string }[] = [];
}
