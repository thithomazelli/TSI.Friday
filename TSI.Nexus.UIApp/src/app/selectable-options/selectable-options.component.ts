import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import {
  ModalService,
  NotificationService,
  ResponseStatus,
  SelectableOption,
  SelectableOptionGroup,
  SelectableOptionService,
  TranslationService,
} from '@nexus/core';
import { HeaderComponent } from '../shared/header/header.component';
import { NgFor, NgIf } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TranslatePipe } from '../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-selectable-options',
    templateUrl: './selectable-options.component.html',
    styleUrl: './selectable-options.component.scss',
    imports: [
        HeaderComponent,
        NgFor,
        ReactiveFormsModule,
        FormsModule,
        NgIf,
        TranslatePipe,
    ],
})
export class SelectableOptionsComponent implements OnInit {
  readonly groups = [
    {
      value: SelectableOptionGroup.AddressType,
      labelKey: 'SELECTABLE_OPTIONS.GROUP_ADDRESS_TYPE',
    },
    {
      value: SelectableOptionGroup.ProductCategory,
      labelKey: 'SELECTABLE_OPTIONS.GROUP_PRODUCT_CATEGORY',
    },
    {
      value: SelectableOptionGroup.TransactionCategory,
      labelKey: 'SELECTABLE_OPTIONS.GROUP_TRANSACTION_CATEGORY',
    },
    {
      value: SelectableOptionGroup.FuelLogStatus,
      labelKey: 'SELECTABLE_OPTIONS.GROUP_FUEL_LOG_STATUS',
    },
    {
      value: SelectableOptionGroup.EventType,
      labelKey: 'SELECTABLE_OPTIONS.GROUP_EVENT_TYPE',
    },
  ];

  activeGroup: SelectableOptionGroup = SelectableOptionGroup.AddressType;
  options: SelectableOption[] = [];
  newValue = '';
  newColor = '#3788d8';
  loading = false;
  saving = false;

  get isEventTypeGroup(): boolean {
    return this.activeGroup === SelectableOptionGroup.EventType;
  }

  constructor(
    private selectableOptionService: SelectableOptionService,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  selectGroup(group: SelectableOptionGroup): void {
    if (group === this.activeGroup) {
      return;
    }
    this.activeGroup = group;
    this.newValue = '';
    this.load();
  }

  add(): void {
    const value = this.newValue.trim();
    if (!value || this.saving) {
      return;
    }

    this.saving = true;
    this.selectableOptionService
      .add({
        group: this.activeGroup,
        value,
        color: this.isEventTypeGroup ? this.newColor : null,
      })
      .subscribe({
        next: (response) => {
          this.saving = false;
          if (response.status === ResponseStatus.Success) {
            this.newValue = '';
            this.load();
          }
          this.notificationService.showMessage(response.status, response.message);
        },
        error: () => {
          this.saving = false;
          this.notificationService.showMessage(
            'Error',
            this.translationService.instant('COMMON.SAVE_ERROR'),
          );
        },
      });
  }

  updateColor(option: SelectableOption, color: string): void {
    this.selectableOptionService.update({ ...option, color }).subscribe({
      next: (response) => {
        if (response.status === ResponseStatus.Success) {
          option.color = color;
        }
        this.notificationService.showMessage(response.status, response.message);
      },
      error: () => {
        this.notificationService.showMessage(
          'Error',
          this.translationService.instant('COMMON.SAVE_ERROR'),
        );
      },
    });
  }

  remove(option: SelectableOption): void {
    this.modalService
      .showSweetConfirmation(
        '',
        this.translationService.instant('GRID.CONFIRM_DELETE'),
        'question',
      )
      .then((result: any) => {
        if (!result.isConfirmed) {
          return;
        }
        this.selectableOptionService.remove(option).subscribe({
          next: (response) => {
            this.notificationService.showMessage(response.status, response.message);
            this.load();
          },
          error: () => {
            this.notificationService.showMessage(
              'Error',
              this.translationService.instant('COMMON.SAVE_ERROR'),
            );
          },
        });
      });
  }

  private load(): void {
    this.loading = true;
    this.selectableOptionService.getByGroup(this.activeGroup).subscribe({
      next: (response) => {
        this.options = response.data ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
