import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import {
  Driver,
  DriverService,
  FormBaseComponent,
  ModalService,
  NotificationService,
  ResponseStatus,
  TripDriver,
  TripDriverService,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import {
  Observable,
  Subscription,
  combineLatestWith,
  map,
  of,
  startWith,
  tap,
} from 'rxjs';

import { DriverDetailsModalComponent } from '../../../drivers/components/driver-details-modal/driver-details-modal.component';
import { TripDriverDetailsModalComponent } from '../trip-driver-details-modal/trip-driver-details-modal.component';
import { NgClass, NgFor, AsyncPipe, DatePipe } from '@angular/common';
import { MatAutocompleteTrigger, MatAutocomplete, MatOption } from '@angular/material/autocomplete';
import { LinkFieldComponent } from '../../../shared/components/link-field/link-field.component';
import { CurrencyFieldComponent } from '../../../shared/components/currency-field/currency-field.component';
import { ClickDirective } from '../../../core/directives/click.directive';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    selector: 'app-trip-driver-form',
    templateUrl: './trip-driver-form.component.html',
    styleUrl: './trip-driver-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgClass,
        ReactiveFormsModule,
        MatAutocompleteTrigger,
        MatAutocomplete,
        NgFor,
        MatOption,
        LinkFieldComponent,
        CurrencyFieldComponent,
        ClickDirective,
        TranslatePipe,
        AsyncPipe,
        DatePipe,
    ],
})
export class TripDriverFormComponent
  extends FormBaseComponent
  implements OnInit, OnChanges, OnDestroy
{
  @Input()
  isModal = false;

  @Input()
  isEdit = false;

  @Input()
  parentId: string | null = null;

  // The trip's currently-loaded TripDrivers, passed by TripDriverListComponent purely so the
  // autocomplete can flag drivers already associated with this trip (mirrors OrderProductsForm's
  // parentData.orderProducts "alreadyUsed" check).
  @Input()
  parentData: TripDriver[] | null = null;

  @Input()
  data?: TripDriver | null;

  @Input()
  compact = false;

  @Input()
  dialogRef?: MatDialogRef<TripDriverDetailsModalComponent>;

  driversArray$!: Observable<Driver[]>;
  filteredDriversByName$!: Observable<Driver[]>;

  private _subscriptions: Subscription[] = [];

  constructor(
    private driverService: DriverService,
    private formBuilder: FormBuilder,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private translationService: TranslationService,
    private tripDriverService: TripDriverService,
    private cdr: ChangeDetectorRef,
  ) {
    super();
  }

  ngOnInit(): void {
    this.initForm();
    this.patchFormWithData();
    this.setupAutoComplete();
    this.disableEditFields();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data && this.form) {
      this.patchFormWithData();
    }
  }

  ngOnDestroy(): void {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  submit(): Observable<WebApiResponse<TripDriver> | null> {
    this.submitted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return of(null);
    }

    const rawValue = this.form.getRawValue();

    if (this.data) {
      Object.assign(this.data!, rawValue);
    }

    return this.save(rawValue as TripDriver).pipe(
      tap({
        next: (response: WebApiResponse<TripDriver>) => {
          this.dialogRef?.close(response);
          this.modalService.showSweetNotification(
            '',
            response.message,
            response.status,
          );
        },
        error: () => {
          this.notificationService.showMessage(
            'Error',
            this.translationService.instant('COMMON.SAVE_ERROR'),
          );
        },
      }),
    );
  }

  cancel(): void {
    this.modalService.hideModal(this.dialogRef);
  }

  remove(): void {
    this.modalService.hideModal();
    this.modalService
      .showSweetConfirmation(
        '',
        this.translationService.instant('GRID.CONFIRM_DELETE'),
        'question',
      )
      .then((result: any) => {
        if (result.isConfirmed) {
          this.tripDriverService
            .delete(this.data as TripDriver)
            .pipe(
              tap({
                next: (response: WebApiResponse<TripDriver>) => {
                  this.modalService.showSweetNotification(
                    '',
                    response.message,
                    response.status,
                  );
                },
                error: () => {
                  this.notificationService.showMessage(
                    'error',
                    this.translationService.instant('COMMON.SAVE_ERROR'),
                  );
                },
              }),
            )
            .subscribe();
        } else {
          const initialState = {
            isEdit: this.isEdit,
            data: this.data,
            id: this.data?.id,
            parentId: this.parentId,
            parentData: this.parentData,
          };
          this.modalService.showTemplateModal(
            TripDriverDetailsModalComponent,
            initialState,
          );
        }
      });
  }

  async onDriverNameBlur(): Promise<void> {
    setTimeout(() => {
      const driverName = this.form.get('driverName')!.value?.trim();
      if (!driverName) {
        this.cleanDriverSelection();
        this.cdr.markForCheck();
        return;
      }
      const sub = this.driversArray$.subscribe((drivers) => {
        const found = drivers.find((d) => d.name === driverName);
        if (!found) {
          const entityLabel = this.translationService.instant('SIDEBAR.DRIVER');
          const confirmRef = this.modalService.showConfirmation({
            title: this.translationService.instant('COMMON.ENTITY_NOT_FOUND', { entity: entityLabel }),
            message: this.translationService.instant('COMMON.CONFIRM_ADD_ENTITY', { entityLower: entityLabel.toLowerCase(), name: driverName }),
            cancelButtonText: this.translationService.instant('COMMON.CANCEL'),
            confirmButtonText: this.translationService.instant('COMMON.YES'),
          });
          confirmRef.afterClosed().subscribe((confirmed: boolean) => {
            if (confirmed) {
              const driverFormRef: MatDialogRef<any> =
                this.modalService.showTemplateModal(
                  DriverDetailsModalComponent,
                  {
                    data: { name: driverName },
                    disableClose: true,
                  },
                );
              driverFormRef
                .afterClosed()
                .subscribe((result: WebApiResponse<Driver> | undefined) => {
                  if (result?.data) {
                    this.selectDriver(result.data);
                  } else {
                    this.cleanDriverSelection();
                  }
                  this.cdr.markForCheck();
                });
            } else {
              this.cleanDriverSelection();
              this.cdr.markForCheck();
            }
          });
        }
        sub.unsubscribe();
      });
    }, 200);
  }

  selectDriver(driver: Driver): void {
    if (!driver) {
      return;
    }

    const alreadyAdded = this.parentData?.some(
      (td) => td.driverId === driver.id && td.id !== this.data?.id,
    );
    if (alreadyAdded) {
      this.modalService.showNotification(
        false,
        this.translationService.instant('TRIPS.DRIVER_ALREADY_ADDED_TITLE'),
        this.translationService.instant('TRIPS.DRIVER_ALREADY_ADDED_MESSAGE', { name: driver.name + '' }),
      );
      this.cleanDriverSelection();
      return;
    }

    if (!this.form.get('driverId')) {
      this.form.addControl('driverId', this.formBuilder.control(''));
    }

    this.form.patchValue({
      driverId: driver.id,
      driverName: driver.name,
      driverLicenseNumber: driver.licenseNumber,
      driverLicenseExpiryDate: driver.licenseExpiryDate,
    });
  }

  private initForm(): void {
    this.form = this.formBuilder.group({
      driverId: ['', Validators.required],
      driverName: [''],
      driverLicenseNumber: [''],
      driverLicenseExpiryDate: [null as Date | null],
      amount: [0, [Validators.required, Validators.min(0)]],
    });

    if (this.isEdit) {
      this.form.addControl('id', this.formBuilder.control(''));
    } else {
      this._subscriptions.push(
        this.form.get('driverName')!.valueChanges.subscribe((name) => {
          const sub = this.driversArray$.subscribe((drivers) => {
            const driver = drivers.find((d: Driver) => d.name === name);
            if (driver) {
              this.form.get('driverId')!.setValue(driver.id);
            }
          });
          this._subscriptions.push(sub);
        }),
      );
    }
  }

  private patchFormWithData(): void {
    if (this.data && this.form) {
      this.form.patchValue(this.data);
    }
  }

  private disableEditFields(): void {
    if (this.isEdit && this.form) {
      this.form.get('driverName')?.disable();
    }
  }

  private setupAutoComplete(): void {
    this.driversArray$ = this.driverService
      .getAll()
      .pipe(map((response) => response.data ?? []));

    this.filteredDriversByName$ = this.form
      .get('driverName')!
      .valueChanges.pipe(
        startWith(''),
        combineLatestWith(this.driversArray$),
        map(([value, drivers]) => {
          const filterValue = (
            typeof value === 'string' ? value : ''
          ).toLowerCase();
          if (!filterValue) {
            return [];
          }
          return drivers
            .filter((driver: Driver) =>
              (driver.name || '').toLowerCase().includes(filterValue),
            )
            .map((driver: Driver) => ({
              ...driver,
              alreadyUsed: this.parentData?.some(
                (td) => td.driverId === driver.id && td.id !== this.data?.id,
              ),
              licenseExpired: this.isLicenseExpired(driver.licenseExpiryDate),
            }));
        }),
      );
  }

  private isLicenseExpired(licenseExpiryDate: Date | string | null | undefined): boolean {
    if (!licenseExpiryDate) {
      return false;
    }
    const expiry = new Date(licenseExpiryDate);
    return !isNaN(expiry.getTime()) && expiry.getTime() < Date.now();
  }

  private cleanDriverSelection(): void {
    this.form.get('driverId')!.setValue('');
    this.markAsTouched('driverId');
    this.form.get('driverId')!.setErrors({ required: true });
    this.form.get('driverName')!.setValue('');
    this.markAsTouched('driverName');
    this.form.get('driverLicenseNumber')!.setValue('');
    this.form.get('driverLicenseExpiryDate')!.setValue(null);
  }

  private save(tripDriver: TripDriver): Observable<WebApiResponse<TripDriver>> {
    if (!this.parentId) {
      return this.tripDriverService.addTemporary(tripDriver);
    }

    tripDriver.tripId = this.parentId;
    return this.isEdit && this.data
      ? this.tripDriverService.update(tripDriver)
      : this.tripDriverService.add(tripDriver);
  }
}
