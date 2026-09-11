import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ModalService } from '@nexus/core';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-link-field',
    templateUrl: './link-field.component.html',
    styleUrl: './link-field.component.scss',
})
export class LinkFieldComponent {
  @Input()
  placeHolder: string = '';

  @Input()
  text: string = '';

  @Input()
  linkUrl: string[] = [];

  constructor(
    private router: Router,
    private modalService: ModalService,
  ) {}

  onClick() {
    if (!this.linkUrl || this.linkUrl.length <= 0) {
      return;
    }

    this.router.navigate(this.linkUrl);
    this.modalService.hideModal();
  }
}
