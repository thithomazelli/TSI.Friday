import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Attachment } from '@nexus/core';
import { NgIf } from '@angular/common';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-attachment-details-modal',
    templateUrl: './attachment-details-modal.component.html',
    styleUrl: './attachment-details-modal.component.scss',
    imports: [NgIf, TranslatePipe],
})
export class AttachmentDetailsModalComponent {
  @Input()
  attachment!: Attachment;

  @Input()
  currentPath = '';

  @Output() remove = new EventEmitter<Attachment>();
  @Output() download = new EventEmitter<Attachment>();

  isImage(): boolean {
    const ext =
      this.attachment?.fileName?.split('.').pop()?.toLowerCase() ?? '';
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  }
}
