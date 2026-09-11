import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslationService } from '@nexus/core';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-confirmation',
    templateUrl: './confirmation.component.html',
    styleUrl: './confirmation.component.scss',
})
export class ConfirmationComponent<T> {
  title: string;
  message: string;
  cancelButtonText: string;
  confirmButtonText: string;
  data: T | undefined;

  constructor(
    public dialogRef: MatDialogRef<ConfirmationComponent<T>>,
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
    translationService: TranslationService,
  ) {
    this.title = dialogData.title || translationService.instant('CONFIRMATION.DEFAULT_TITLE');
    this.message =
      dialogData.message || translationService.instant('CONFIRMATION.DEFAULT_MESSAGE');
    this.data = dialogData.data;
    this.cancelButtonText = dialogData.cancelButtonText || translationService.instant('COMMON.CANCEL');
    this.confirmButtonText = dialogData.confirmButtonText || translationService.instant('CONFIRMATION.DELETE');
  }
}
