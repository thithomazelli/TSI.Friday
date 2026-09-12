import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, Validators, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';

import {
  Address,
  BusinessPartner,
  BusinessPartnerService,
  BusinessPartnerType,
  Company,
  FormBaseComponent,
  Individual,
  ModalService,
  NotificationService,
  ResponseStatus,
  WebApiResponse,
  formatCPF,
  formatCNPJ,
} from '@nexus/core';

import { Observable, of, tap } from 'rxjs';

// Type-only: BusinessPartnerDetailsModalComponent imports this form back (it renders
// <app-business-partner-form> in its template), so a normal import here would form a
// module-load-order circular dependency between the two files - `import type` is erased at
// compile time and can't contribute to that cycle. The one place this component needs the
// class itself at runtime (reopening the modal after a cancelled delete, in remove() below)
// loads it dynamically instead, for the same reason.
import type { BusinessPartnerDetailsModalComponent } from '../business-partner-details-modal/business-partner-details-modal.component';
import { NgClass, NgIf, NgFor } from '@angular/common';
import { DateFieldComponent } from '../../../shared/components/date-field/date-field.component';
import { NgxMaskDirective } from 'ngx-mask';
import { AddressFormComponent } from '../../../address/components/address-form/address-form.component';
import { ClickDirective } from '../../../core/directives/click.directive';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    selector: 'app-business-partner-form',
    templateUrl: './business-partner-form.component.html',
    styleUrl: './business-partner-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgClass,
        ReactiveFormsModule,
        NgIf,
        DateFieldComponent,
        NgxMaskDirective,
        NgFor,
        AddressFormComponent,
        ClickDirective,
        TranslatePipe,
    ],
})
export class BusinessPartnerFormComponent
  extends FormBaseComponent
  implements OnInit, OnChanges
{
  @Input()
  isModal = false;

  @Input()
  isEdit = false;

  @Input()
  data?: Individual | Company | null = <BusinessPartner>{};

  @Input()
  compact = false;

  @Input()
  dialogRef?: MatDialogRef<BusinessPartnerDetailsModalComponent>;

  // 'list': shows existing addresses as a read-only summary + one "add new address" link.
  // 'form': shows the inline address form. Edit mode uses it for one address at a time (its own
  // Cancel/Save buttons replace the partner-level Cancel/Remove/Save row so a half-finished
  // address edit can't be submitted together with unrelated partner changes); Add mode starts
  // here directly since Address is required, and lets several addresses be staged - via its own
  // Cancel/"Adicionar um novo endereço" links - before the final partner-level submit.
  addressPanelMode: 'list' | 'form' = 'list';
  selectedAddressIndex: number | null = null;

  private _baseEndPoint = '';

  constructor(
    private businessPartnerService: BusinessPartnerService,
    private formBuilder: FormBuilder,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private routerService: Router,
    private cdr: ChangeDetectorRef,
  ) {
    super();
  }

  ngOnInit(): void {
    this.defineBusinessPartnerType();
    this.initForm();
    this.initAddressInfo();
    this.setInitialAddressPanelMode();
    this.disableEditFields();
    this.patchFormWithData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      (changes['data'] && !changes['data'].firstChange) ||
      (changes['isEdit'] && !changes['isEdit'].firstChange)
    ) {
      this.initForm();
      this.disableEditFields();
      this.patchFormWithData();
    }
  }

  get addressFormGroup(): FormGroup {
    return this.form.get('address') as FormGroup;
  }

  /**
   * Retorna o endereço selecionado de forma segura para o template
   */
  get selectedAddress(): Address | null {
    if (
      this.selectedAddressIndex !== null &&
      Array.isArray(this.data?.addresses) &&
      this.selectedAddressIndex >= 0 &&
      this.selectedAddressIndex < this.data.addresses.length
    ) {
      return this.data.addresses[this.selectedAddressIndex];
    }
    return null;
  }

  // Edit mode: the address sub-form takes over the whole footer (its own Cancel/Save Address
  // buttons replace the partner-level Cancel/Remove/Save row) so a half-finished address edit
  // can't be submitted together with unrelated partner changes. Add mode keeps the outer row
  // visible alongside the address form, since there the address is just one optional item that
  // can be staged before the final partner-level submit.
  get isEditingAddressExclusively(): boolean {
    return this.addressPanelMode === 'form' && this.isEdit;
  }

  get canAddAddress(): boolean {
    // Se for Client, usa a validação normal do form
    if (this.data?.type === BusinessPartnerType.Client) {
      return this.addressFormGroup.valid;
    }
    // Para Supplier, exige apenas os campos essenciais preenchidos
    const controls = this.addressFormGroup.controls;
    const requiredFields = [
      'type',
      'zipCode',
      'street',
      'number',
      'state',
      'city',
      'name',
    ];
    return requiredFields.every((field) => {
      const ctrl = controls[field];
      return (
        ctrl &&
        ctrl.value !== null &&
        ctrl.value !== undefined &&
        String(ctrl.value).trim() !== ''
      );
    });
  }

  submit(): Observable<WebApiResponse<BusinessPartner> | null> {
    this.submitted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // Invalid fields still show red via markAllAsTouched() above. Reset `submitted` right
      // away so this rejected attempt doesn't permanently disable the address section's own
      // links/buttons (they're gated on `submitted`, meant to block them only while a save is
      // actually in flight) for the rest of the component's lifetime.
      this.submitted = false;
      return of(null);
    }

    const raw = this.form.getRawValue();

    if (!raw.birthday || raw.birthday === '') {
      this.data!.birthday = undefined;
      delete raw.birthday;
    }

    if (this.compact && raw.address && raw.address.zipCode != null) {
      // Se vier address preenchido, mova para addresses
      if (Object.keys(raw.address).some((k) => raw.address[k])) {
        if (!this.data!.addresses) {
          this.data!.addresses = [];
        }
        // Se address já existe em addresses (por id ou igualdade), substitui, senão adiciona
        const idx = this.data!.addresses.findIndex(
          (a) => a.id && raw.address.id && a.id === raw.address.id,
        );

        if (idx !== -1) {
          this.data!.addresses = this.data!.addresses.map((addr, i) =>
            i === idx ? new Address({ ...raw.address }) : addr,
          );
        } else if (raw.address?.street != '') {
          this.data!.addresses = [
            ...this.data!.addresses,
            new Address({ ...raw.address }),
          ];
        }
      }

      // Atualiza as propriedades de data com os valores do formulário, exceto address
      const { address, ...rest } = raw;
      Object.assign(this.data!, rest);

      // Remove o atributo address do objeto final, se existir
      if ('address' in this.data!) {
        delete (this.data as any).address;
      }

      // Se não tiver endereço default, define o primeiro como default
      if (
        Array.isArray(this.data?.addresses) &&
        this.data.addresses.length > 0 &&
        !this.data.addresses.find((addr) => addr.isDefault)
      ) {
        this.data!.addresses![0].isDefault = true;
      }

      this.data?.addresses.find((addr) => {
        if (addr.id == null) {
          delete addr.id;
        }
      });
    } else {
      Object.assign(this.data!, raw);
    }

    return this.save(this.data!).pipe(
      tap({
        next: (response: WebApiResponse<BusinessPartner>) => {
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
        error: (err) => {
          this.notificationService.showMessage('Error', 'Erro ao salvar');
        },
      }),
    );
  }

  private parseBirthday(value: string): Date | undefined {
    const parts = value.split('/').map((part) => Number(part));
    if (parts.length !== 3) {
      return undefined;
    }

    const [day, month, year] = parts;
    const parsedDate = new Date(year, month - 1, day);
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.getDate() !== day ||
      parsedDate.getMonth() !== month - 1 ||
      parsedDate.getFullYear() !== year
    ) {
      return undefined;
    }

    return parsedDate;
  }

  cancel(): void {
    if (this.isModal) {
      this.modalService.hideModal(this.dialogRef);
    } else {
      this.routerService.navigateByUrl(`/${this._baseEndPoint}`);
    }
  }

  onSaveAndAddNewAddress(): void {
    this.addressFormGroup.markAllAsTouched();
    if (this.addressFormGroup.valid) {
      this.saveAddress(this.addressFormGroup.value);
    }
  }

  displayNewAddress(): void {
    this.restoreAddressValidators();
    this.selectedAddressIndex = null;
    this.addressPanelMode = 'form';
  }

  editAddress(addr: Address) {
    const idx = this.data?.addresses?.findIndex((a) => a === addr);
    if (idx !== undefined && idx !== -1) {
      this.selectedAddressIndex = idx;
      // Preenche o form de endereço com os dados selecionados
      this.addressFormGroup.patchValue({ ...addr });
      this.restoreAddressValidators();
      this.addressPanelMode = 'form';
    }
  }

  cancelAddress(): void {
    this.addressPanelMode = 'list';
    this.selectedAddressIndex = null;
    this.resetAddressForm();
  }

  saveAddress(address: Address): void {
    if (!this.addressFormGroup.valid) {
      return;
    }

    if (this.selectedAddressIndex !== null && this.data?.addresses) {
      // Atualiza o endereço editado
      const index = this.selectedAddressIndex;
      this.data.addresses = this.data.addresses.map((addr, i) =>
        i === index ? address : addr,
      );
    } else {
      // Adiciona novo endereço
      this.data!.addresses = [...this.data!.addresses, address];
    }

    this.initAddressInfo();
    this.resetAddressForm();

    this.selectedAddressIndex = null;
    // Add mode lets several addresses be staged before the final partner-level submit, so keep
    // the form open for the next one; Edit mode is one focused change at a time, so collapse
    // back to the summary list after saving.
    this.addressPanelMode = this.isEdit ? 'list' : 'form';

    if (this.addressPanelMode === 'form') {
      this.restoreAddressValidators();
    }
  }

  remove(): void {
    this.modalService.hideModal();
    this.modalService
      .showSweetConfirmation(
        '',
        'Deseja realmente excluir este registro?',
        'question',
      )
      .then((result: any) => {
        if (result.isConfirmed) {
          this.businessPartnerService.delete(this.data as BusinessPartner).subscribe({
            next: (response: WebApiResponse<BusinessPartner>) => {
              if (this.isModal) {
                this.modalService.hideModal();
                this.modalService.showSweetNotification(
                  '',
                  response.message,
                  response.status,
                );
              } else {
                this.modalService.showSweetNotification(
                  '',
                  response.message,
                  response.status,
                );
                if (response.status === ResponseStatus.Success) {
                  this.routerService.navigateByUrl(`/${this._baseEndPoint}`);
                }
              }
            },
            error: () => {
              this.notificationService.showMessage('error', 'Erro ao remover');
            },
          });
        } else {
          if (this.isModal) {
            const initialState = {
              isEdit: this.isEdit,
              data: this.data,
              id: this.data?.id,
            };
            import(
              '../business-partner-details-modal/business-partner-details-modal.component'
            ).then(({ BusinessPartnerDetailsModalComponent }) => {
              this.modalService.showTemplateModal(
                BusinessPartnerDetailsModalComponent,
                initialState,
              );
            });
          }
        }
      });
  }

  private initAddressInfo() {
    if (!this.data) {
      return;
    }

    if (!this.data.addresses) {
      this.data.addresses = [];
      return;
    }

    this.data.addresses = (this.data.addresses ?? []).map(
      (addr) => new Address({ ...addr }),
    );
  }

  private initForm(): void {
    const isAddressRequired = this.data?.type == BusinessPartnerType.Client;

    const addressGroup = this.formBuilder.group({
      id: [null],
      name: ['', isAddressRequired ? Validators.required : null],
      type: [null, isAddressRequired ? Validators.required : null],
      zipCode: ['', isAddressRequired ? Validators.required : null],
      state: ['', isAddressRequired ? Validators.required : null],
      city: ['', isAddressRequired ? Validators.required : null],
      street: ['', isAddressRequired ? Validators.required : null],
      number: [null, isAddressRequired ? Validators.required : null],
      comments: [''],
      businessPartnerId: [null],
      country: ['BR', isAddressRequired ? Validators.required : null],
      isDefault: [false],
    });

    const commonControls = {
      name: ['', [Validators.required]],
      email: [
        '',
        [
          Validators.required,
          Validators.pattern(
            /^([\w!#$%&'*+\-/=?^`{|}~]+\.)*[\w!#$%&'*+\-/=?^`{|}~]+@((((([a-zA-Z0-9]{1}[a-zA-Z0-9\-]{0,62}[a-zA-Z0-9]{1})|[a-zA-Z])\.)+[a-zA-Z]{2,6})|(\d{1,3}\.){3}\d{1,3}(\:\d{1,5})?)$/,
          ),
        ],
      ],
      type: [this.data?.type, Validators.required],
      documentType: ['Física', [Validators.required]],
      phone: ['', []],
      mobile: ['', []],
      socialSecurityCard: ['', this.businessPartnerService.cpfValidator()],
      nationalRegistry: ['', this.businessPartnerService.cnpjValidator()],
      birthday: [null],
      photo: [''],
      address: this.compact ? addressGroup : null,
    };

    this.form = !this.isEdit
      ? this.formBuilder.group({
          ...commonControls,
        })
      : this.formBuilder.group({
          id: [''],
          ...commonControls,
        });

    this.form.get('documentType')?.valueChanges.subscribe((documentType) => {
      this.updateFieldValidators(documentType, true);
    });
    // Inicializa validações corretas para o tipo atual
    this.updateFieldValidators(this.form.get('documentType')?.value, false);
  }

  private resetAddressForm(): void {
    this.addressFormGroup.reset();

    // Remove validators dos campos do grupo address
    Object.keys(this.addressFormGroup.controls).forEach((key) => {
      this.addressFormGroup.get(key)?.clearValidators();
      this.addressFormGroup.get(key)?.updateValueAndValidity();
    });
  }

  /**
   * Restaura os validadores obrigatórios do addressFormGroup
   */
  private restoreAddressValidators(): void {
    const controls = this.addressFormGroup.controls;
    if (controls['name']) {
      controls['name'].setValidators([Validators.required]);
    }

    if (controls['type']) {
      controls['type'].setValidators([Validators.required]);
    }

    if (controls['zipCode']) {
      controls['zipCode'].setValidators([Validators.required]);
    }

    if (controls['state']) {
      controls['state'].setValidators([Validators.required]);
    }

    if (controls['city']) {
      controls['city'].setValidators([Validators.required]);
    }

    if (controls['street']) {
      controls['street'].setValidators([Validators.required]);
    }

    if (controls['number']) {
      controls['number'].setValidators([Validators.required]);
    }

    if (controls['country']) {
      controls['country'].setValue('BR');
      controls['country'].setValidators([Validators.required]);
    }

    if (controls['isDefault']) {
      controls['isDefault'].setValue(false);
    }

    // Campos opcionais não recebem validadores
    Object.keys(controls).forEach((key) =>
      controls[key].updateValueAndValidity(),
    );
  }

  private disableEditFields(): void {
    if (this.isEdit && this.form) {
      this.form.get('documentType')?.disable();
      this.form.get('socialSecurityCard')?.disable();
      this.form.get('nationalRegistry')?.disable();
    }
  }

  private patchFormWithData(): void {
    if (this.data && this.form) {
      const patch = { ...this.data };
      this.form.patchValue(patch);
    }

    // The address sub-form only exists when compact (see initForm(): addressFormGroup is null
    // otherwise) - the full, non-compact "Editar Cliente" page handles its address in a separate
    // tab instead, so there's nothing here to reset.
    if (this.compact && this.addressPanelMode === 'list') {
      this.resetAddressForm();
    }
  }

  private updateFieldValidators(
    documentType: string,
    clearBirthday: boolean,
  ): void {
    if (documentType === 'Física') {
      this.form
        .get('socialSecurityCard')
        ?.setValidators([
          Validators.required,
          this.businessPartnerService.cpfValidator(),
        ]);
      this.form.get('nationalRegistry')?.clearValidators();
      this.form.get('nationalRegistry')?.setValue('');
    } else if (documentType === 'Jurídica') {
      this.form
        .get('nationalRegistry')
        ?.setValidators([
          Validators.required,
          this.businessPartnerService.cnpjValidator(),
        ]);
      this.form.get('socialSecurityCard')?.clearValidators();
      this.form.get('socialSecurityCard')?.setValue('');
      if (clearBirthday) {
        this.form.get('birthday')?.setValue('');
      }
    }
    this.form.get('socialSecurityCard')?.updateValueAndValidity();
    this.form.get('nationalRegistry')?.updateValueAndValidity();
    this.form.get('birthday')?.updateValueAndValidity();
  }

  private save(
    businessPartner: Company | Individual,
  ): Observable<WebApiResponse<BusinessPartner>> {
    return this.isEdit && this.data
      ? this.businessPartnerService.update(businessPartner)
      : this.businessPartnerService.add(businessPartner);
  }

  private saveModal(response: WebApiResponse<BusinessPartner>): any {
    this.dialogRef?.close(response);

    if (response.status == ResponseStatus.Success) {
      this.modalService.showNotification(
        response.status == ResponseStatus.Success,
        response.data.type === BusinessPartnerType.Client
          ? 'Cliente adicionado'
          : 'Fornecedor adicionado',
        response.message,
      );
      return;
    }

    const formattedMessage = this.formatErrorMessage(response.message);
    this.modalService.showNotification(false, '', formattedMessage);
  }

  private savePage(response: WebApiResponse<BusinessPartner>): any {
    if (this.isEdit && this.data) {
      const formattedMessage = this.formatErrorMessage(response.message);
      this.notificationService.showMessage(response.status, formattedMessage);
      this.data = response.data;
      this.cdr.markForCheck();
    } else {
      this.routerService.navigateByUrl(
        `/${this._baseEndPoint}/${response.data.id}`,
      );
    }
  }

  private formatErrorMessage(message: string): string {
    if (!message) return message;

    let formatted = message.replace(/\b(\d{11})\b/g, (match: string) => {
      return formatCPF(match);
    });

    formatted = formatted.replace(/\b(\d{14})\b/g, (match: string) => {
      return formatCNPJ(match);
    });

    return formatted;
  }

  private defineBusinessPartnerType(): void {
    if (this.data?.type === BusinessPartnerType.Client) {
      this._baseEndPoint = 'clients';
    } else {
      this._baseEndPoint = 'suppliers';
    }
  }

  private setInitialAddressPanelMode(): void {
    const hasAddresses = !!this.data?.addresses?.length;
    // Editing a partner that already has at least one address: start collapsed, showing the
    // summary + a link to add another. Otherwise (adding a new partner, or editing one with no
    // address yet) start with the form open, since Address is required for Client-type partners.
    this.addressPanelMode = this.isEdit && hasAddresses ? 'list' : 'form';
  }
}
