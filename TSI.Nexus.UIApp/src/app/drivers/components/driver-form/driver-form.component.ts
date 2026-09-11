import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { initialConfig, NgxMaskDirective } from 'ngx-mask';

import {
  ApiType,
  BusinessPartnerService,
  Driver,
  DriverService,
  DriverStatus,
  EmploymentType,
  FormBaseComponent,
  ModalService,
  NotificationService,
  ResponseStatus,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';

import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

// Type-only: DriverDetailsModalComponent imports this form back (renders <app-driver-form> in
// its template), so a normal import would form a module-load-order circular dependency between
// the two files - `import type` is erased at compile time and can't contribute to that cycle.
import type { DriverDetailsModalComponent } from '../driver-details-modal/driver-details-modal.component';
import { DateFieldComponent } from '../../../shared/components/date-field/date-field.component';
import { ClickDirective } from '../../../core/directives/click.directive';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-driver-form',
    templateUrl: './driver-form.component.html',
    styleUrl: './driver-form.component.scss',
    imports: [
        ReactiveFormsModule,
        NgxMaskDirective,
        DateFieldComponent,
        ClickDirective,
        TranslatePipe,
    ],
})
export class DriverFormComponent
  extends FormBaseComponent
  implements OnInit, OnChanges
{
  @Input()
  isModal = false;

  @Input()
  isEdit = false;

  @Input()
  data?: Driver | null;

  @Input()
  compact = false;

  @Input()
  dialogRef?: MatDialogRef<DriverDetailsModalComponent>;

  get employmentTypeOptions() {
    return [
      { label: 'CLT', value: EmploymentType.CLT },
      { label: this.translationService.instant('DRIVERS.OUTSOURCED'), value: EmploymentType.Outsourced },
      { label: this.translationService.instant('DRIVERS.AUTONOMOUS'), value: EmploymentType.Autonomous },
    ];
  }

  get statusOptions() {
    return [
      { label: this.translationService.instant('DRIVERS.STATUS_ACTIVE'), value: DriverStatus.Active },
      { label: this.translationService.instant('DRIVERS.STATUS_INACTIVE'), value: DriverStatus.Inactive },
      { label: this.translationService.instant('DRIVERS.STATUS_ON_LEAVE'), value: DriverStatus.OnLeave },
    ];
  }

  // Dígito verificador do RG varia por estado: alguns não têm, e em SP costuma ser "X" em vez
  // de número. "C" é um placeholder customizado opcional que aceita dígito ou X/x, mesclado com
  // os padrões padrão do ngx-mask (senão o "0" do resto da máscara para de funcionar).
  rgMaskPatterns = {
    ...initialConfig.patterns,
    C: { pattern: /[0-9Xx]/, optional: true },
  };

  private _baseEndPoint: ApiType = ApiType.Drivers;

  constructor(
    private formBuilder: FormBuilder,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private driverService: DriverService,
    private businessPartnerService: BusinessPartnerService,
    private routerService: Router,
    private translationService: TranslationService,
  ) {
    super();
  }

  ngOnInit(): void {
    this.initForm();
    this.patchFormWithData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && changes['data'].currentValue && this.form) {
      this.form.patchValue(changes['data'].currentValue);
    }
  }

  submit(): Observable<WebApiResponse<Driver> | null> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return of(null);
    }

    const rawValue = this.form.getRawValue();

    if (this.data) {
      Object.assign(this.data!, rawValue);
    }

    return this.save(rawValue as Driver).pipe(
      tap({
        next: (response: WebApiResponse<Driver>) => {
          // The backend reports business-rule failures as a 200 response with status Error and
          // data: null rather than an HTTP error, so this has to be checked before treating the
          // save as successful - otherwise savePage()/saveModal() crash reading .id off a null
          // response.data.
          if (response.status !== ResponseStatus.Success) {
            this.notificationService.showMessage(response.status, response.message);
            return;
          }
          if (this.isModal) {
            this.saveModal(response);
          } else {
            this.savePage(response);
          }
        },
        error: () =>
          this.notificationService.showMessage(
            ResponseStatus.Error,
            'Erro ao salvar',
          ),
      }),
    );
  }

  cancel(): void {
    if (this.isModal) {
      this.modalService.hideModal(this.dialogRef);
    } else {
      this.routerService.navigateByUrl(`/${this._baseEndPoint}`);
    }
  }

  remove(): void {
    if (!this.data) {
      return;
    }

    this.driverService
      .delete(this.data)
      .pipe(
        tap({
          next: (response: WebApiResponse<Driver>) => {
            if (this.isModal) {
              this.modalService.hideModal(this.dialogRef);
            }
            this.notificationService.showMessage(
              response.status,
              response.message,
            );
            if (response.status === ResponseStatus.Success && !this.isModal) {
              this.routerService.navigateByUrl(`/${this._baseEndPoint}`);
            }
          },
          error: () =>
            this.notificationService.showMessage(
              ResponseStatus.Error,
              'Erro ao remover',
            ),
        }),
      )
      .subscribe();
  }

  private initForm(): void {
    const commonControls = {
      name: ['', Validators.required],
      email: ['', Validators.email],
      // ngx-mask guarda só os dígitos no FormControl (sem parênteses/traço), por isso os
      // padrões abaixo validam DDD + número em dígitos puros, não o texto mascarado exibido.
      phone: ['', Validators.pattern(/^\d{10}$/)],
      mobile: ['', Validators.pattern(/^\d{11}$/)],
      socialSecurityCard: [
        '',
        [Validators.required, this.businessPartnerService.cpfValidator()],
      ],
      // RG não tem padrão nacional único (varia por estado), então só filtramos dígitos via
      // máscara, sem validador de tamanho/checksum fixo.
      nationalIdCard: [''],
      // Backend Driver.Birthday is a non-nullable DateTime - leaving this blank sent JSON null
      // and the API rejected it with a raw deserialization error instead of a friendly
      // validation message.
      birthday: [null as Date | null, Validators.required],
      // CNH: registro nacional de 11 dígitos. Não valida o dígito verificador (algoritmo módulo
      // 11 pouco documentado/testável), só o formato de 11 números.
      licenseNumber: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
      licenseCategory: ['', Validators.required],
      licenseExpiryDate: [null as Date | null, Validators.required],
      employmentType: [EmploymentType.CLT, Validators.required],
      admissionDate: [null as Date | null],
      status: [DriverStatus.Active, Validators.required],
      commissionPercentage: [0, [Validators.min(0), Validators.max(100)]],
    };

    this.form = !this.isEdit
      ? this.formBuilder.group(commonControls)
      : this.formBuilder.group({ id: [''], ...commonControls });
  }

  private patchFormWithData(): void {
    if (this.data && this.form) {
      this.form.patchValue(this.data);
    }
  }

  private save(driver: Driver): Observable<WebApiResponse<Driver>> {
    return this.isEdit && this.data
      ? this.driverService.update(driver)
      : this.driverService.add(driver);
  }

  private savePage(response: WebApiResponse<Driver>): void {
    if (this.isEdit && this.data) {
      this.notificationService.showMessage(response.status, response.message);
      this.data = response.data;
    } else if (response.status === ResponseStatus.Success) {
      this.routerService.navigateByUrl(
        `/${this._baseEndPoint}/${response.data.id}`,
      );
    } else {
      this.notificationService.showMessage(response.status, response.message);
    }
  }

  private saveModal(response: WebApiResponse<Driver>): void {
    this.dialogRef?.close(response);

    if (response.status === ResponseStatus.Success) {
      this.modalService.showNotification(
        true,
        this.isEdit ? 'Motorista atualizado' : 'Motorista adicionado',
        response.message,
      );
      return;
    }

    this.modalService.showNotification(false, '', response.message);
  }
}
