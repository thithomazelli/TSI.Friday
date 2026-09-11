import { ChangeDetectionStrategy, Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  Individual,
  Company,
  BusinessPartner,
  BusinessPartnerType,
  TranslationService,
} from '@nexus/core';
import { BusinessPartnerFormComponent } from '../business-partner-form/business-partner-form.component';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-business-partner-details-modal',
    templateUrl: './business-partner-details-modal.component.html',
    styleUrl: './business-partner-details-modal.component.scss',
    imports: [BusinessPartnerFormComponent],
})
export class BusinessPartnerDetailsModalComponent implements OnInit {
  isEdit = false;
  data?: Individual | Company | null = <BusinessPartner>{};
  id: string | null = null;

  title: string = '';

  constructor(
    public dialogRef: MatDialogRef<BusinessPartnerDetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: any,
    private translationService: TranslationService,
  ) {
    if (dialogData) {
      this.isEdit = dialogData.isEdit ?? false;
      this.data = dialogData.data ?? <BusinessPartner>{};
      this.id = dialogData.id ?? null;
    }
  }

  ngOnInit(): void {
    this.initializeTitle();
  }

  close(): void {
    this.dialogRef.close(null);
  }

  initializeTitle(): void {
    const type = this.translationService.instant(
      this.data?.type === BusinessPartnerType.Client
        ? 'SIDEBAR.CLIENTS'
        : 'SIDEBAR.SUPPLIERS',
    );

    this.title = this.translationService.instant(
      this.isEdit ? 'COMMON.EDIT_ENTITY' : 'COMMON.ADD_ENTITY',
      { entity: type },
    );
  }
}
