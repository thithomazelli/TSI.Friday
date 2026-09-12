import { FormGroup, ReactiveFormsModule } from '@angular/forms';

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Observable, Subject, of } from 'rxjs';
import { switchMap, takeUntil, tap } from 'rxjs/operators';
import {
  Address,
  AddressService,
  FormBaseComponent,
  ModalService,
  NotificationService,
  ResponseStatus,
  SelectableOption,
  SelectableOptionGroup,
  SelectableOptionService,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef } from '@angular/material/dialog';
// Type-only: AddressDetailsModalComponent imports this form back (renders <app-address-form> in
// its template), so a normal import here would form a module-load-order circular dependency
// between the two files - `import type` is erased at compile time and can't contribute to that
// cycle. The one place this component needs the class itself at runtime (reopening the modal
// after a cancelled delete, in remove() below) loads it dynamically instead, for the same reason.
import type { AddressDetailsModalComponent } from '../address-details-modal/address-details-modal.component';
import { NgClass, NgFor } from '@angular/common';
import { NgxMaskDirective } from 'ngx-mask';
import { ClickDirective } from '../../../core/directives/click.directive';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    selector: 'app-address-form',
    templateUrl: './address-form.component.html',
    styleUrl: './address-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgClass,
        ReactiveFormsModule,
        NgFor,
        NgxMaskDirective,
        ClickDirective,
        TranslatePipe,
    ],
})
export class AddressFormComponent
  extends FormBaseComponent
  implements OnInit, OnChanges
{
  @Input()
  isModal = false;

  @Input()
  isEdit = false;

  @Input()
  data?: Address | null;

  @Input()
  parentId?: string | null;

  @Input()
  compact = false;

  @Input()
  errors: string[] | undefined;

  @Input()
  formGroup: FormGroup<any> | null = null;

  @Input()
  dialogRef?: MatDialogRef<AddressDetailsModalComponent>;

  estados: { id: number; sigla: string; nome: string }[] = [];
  cidades: { id: number; nome: string }[] = [];
  loadingCep = false;
  addressTypeOptions: SelectableOption[] = [];

  private _cidadesCancel$ = new Subject<void>();
  private _zipCodeLookupBound = false;

  constructor(
    private addressService: AddressService,
    private formBuilder: FormBuilder,
    private http: HttpClient,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private selectableOptionService: SelectableOptionService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
  ) {
    super();
  }

  ngOnInit(): void {
    if (this.formGroup) {
      this.form = this.formGroup;
    } else {
      this.initForm();
    }

    this.getEstados();
    this.setupAutoComplete();
    this.loadAddressTypeOptions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // emitEvent: false - this is loading an existing address's saved data, not the user typing a
    // new one, so it must not re-trigger the CEP-lookup/state->city cascade below.
    if (changes['data'] && changes['data'].currentValue && this.form) {
      this.form.patchValue(changes['data'].currentValue, { emitEvent: false });
    }
    if (changes['isEdit'] && !changes['isEdit'].firstChange) {
      if (this.isEdit) {
        this.form.get('id')?.disable();
        this.form.get('businessPartnerId')?.disable();
      }
    }

    this.setupAutoComplete();
  }

  submit(): Observable<WebApiResponse<Address> | null> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return of(null);
    }

    const rawValue = this.form.getRawValue();

    if (this.data) {
      Object.assign(this.data!, rawValue);
    }

    return this.save(rawValue as Address).pipe(
      tap({
        next: (response: WebApiResponse<Address>) => {
          this.dialogRef?.close(response);
          this.modalService.showSweetNotification(
            '',
            response.message,
            response.status,
          );
        },
        error: (err) => {
          this.notificationService.showMessage('error', 'Erro ao salvar');
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
        'Deseja realmente excluir este registro?',
        'question',
      )
      .then((result: any) => {
        if (result.isConfirmed) {
          this.addressService.delete(this.data as Address).subscribe({
            next: (response: WebApiResponse<Address>) => {
              if (this.isModal) {
                this.modalService.hideModal(this.dialogRef);
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
              '../address-details-modal/address-details-modal.component'
            ).then(({ AddressDetailsModalComponent }) => {
              this.modalService.showTemplateModal(
                AddressDetailsModalComponent,
                initialState,
              );
            });
          }
        }
      });
  }

  trackByEstadoId(
    index: number,
    estado: { id?: number; sigla: string; nome: string },
  ) {
    return estado.id != null ? estado.id : index;
  }

  trackByCidadeId(index: number, cidade: { id?: number; nome: string }) {
    return cidade.id != null ? cidade.id : index;
  }

  private initForm(): void {
    const commonControls = {
      name: ['', Validators.required],
      type: [null, Validators.required],
      zipCode: ['', Validators.required],
      state: ['', Validators.required],
      city: ['', Validators.required],
      street: ['', Validators.required],
      number: [null, Validators.required],
      comments: [''],
      businessPartnerId: [''],
      country: ['BR', Validators.required],
      isDefault: [this.data?.isDefault ?? false],
    };

    this.form = !this.isEdit
      ? this.formBuilder.group({
          ...commonControls,
        })
      : this.formBuilder.group({
          id: [''],
          ...commonControls,
        });

    if (this.isEdit) {
      this.form.get('id')?.disable();
    }
  }

  private save(address: Address): Observable<WebApiResponse<Address>> {
    address.businessPartnerId = this.parentId ?? '';
    return this.isEdit && this.data
      ? this.addressService.update(address)
      : this.addressService.add(address);
  }

  private setupAutoComplete(): void {
    if (!this.form) {
      return;
    }

    this._cidadesCancel$.next();

    if (this.data) {
      const patch = { ...this.data };
      const patchAndLoadCities = () => {
        // emitEvent: false - same as above, this restores saved data and must not re-trigger the
        // CEP lookup (city/state are populated explicitly below regardless).
        this.form.patchValue(patch, { emitEvent: false });
        if (patch.state) {
          const estado = this.estados.find((e) => e.sigla === patch.state);
          if (estado) {
            this.http
              .get<
                any[]
              >(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado.id}/municipios`)
              .subscribe((cidades) => {
                const uniqueCidades = (cidades || []).filter(
                  (cidade: any, index: number, self: any[]) =>
                    cidade.id != null &&
                    index === self.findIndex((e) => e.id === cidade.id),
                );
                this.cidades = uniqueCidades;
                const normalize = (str: string) =>
                  str
                    .normalize('NFD')
                    .replace(/\p{Diacritic}/gu, '')
                    .toLowerCase();
                let cidadeFinal: string | null = null;
                const cityValue = patch.city ?? '';
                const cidadeMatch = this.cidades.find(
                  (c) => normalize(c.nome) === normalize(cityValue),
                );
                if (cidadeMatch) {
                  cidadeFinal = cidadeMatch.nome;
                } else {
                  cidadeFinal = null; // força placeholder
                }
                this.form.get('city')?.setValue(cidadeFinal);
                this.form.get('city')?.updateValueAndValidity();
                this.form.updateValueAndValidity();
                this.cdr.markForCheck();
              });
          } else {
            // Estado não encontrado, força placeholder
            this.form.get('city')?.setValue(null);
          }
        } else {
          // Estado não selecionado, força placeholder
          this.form.get('city')?.setValue(null);
        }
      };
      // Se for formGroup externo, só faz patch depois dos estados carregarem
      if (this.formGroup) {
        if (this.estados && this.estados.length > 0) {
          patchAndLoadCities();
        } else {
          const estadosSub = this.http
            .get<
              any[]
            >('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
            .subscribe((estados) => {
              this.estados = estados;
              patchAndLoadCities();
              estadosSub.unsubscribe();
              this.cdr.markForCheck();
            });
        }
      } else {
        // Se não for externo, mantém fluxo normal
        if (this.estados && this.estados.length > 0) {
          patchAndLoadCities();
        } else {
          const estadosSub = this.http
            .get<
              any[]
            >('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
            .subscribe((estados) => {
              this.estados = estados;
              patchAndLoadCities();
              estadosSub.unsubscribe();
              this.cdr.markForCheck();
            });
        }
      }
    }

    // SUBSCRIPTIONS REATIVAS
    // setupAutoComplete() re-runs on every ngOnChanges (e.g. whenever `data` is reassigned), so
    // this subscribes only once per component instance - otherwise each re-run stacked another
    // live subscription on top of the previous ones, and a single real CEP edit would fire the
    // lookup (and any resulting "not found" toast) once per accumulated subscription.
    if (!this._zipCodeLookupBound) {
      this._zipCodeLookupBound = true;
      this.form.get('zipCode')?.valueChanges.subscribe((cep: string) => {
        if (cep && cep.length >= 8) {
          this.buscarEnderecoPorCep(cep);
        }
      });
    }

    this.form
      .get('state')
      ?.valueChanges.pipe(
        takeUntil(this._cidadesCancel$),
        switchMap((sigla: string) => {
          if (!sigla) {
            this.cidades = [];
            this.form.get('city')?.setValue('');
            return of([]);
          }
          const estado = this.estados.find((e) => e.sigla === sigla);
          if (!estado) {
            this.cidades = [];
            this.form.get('city')?.setValue('');
            return of([]);
          }
          return this.http.get<any[]>(
            `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado.id}/municipios`,
          );
        }),
      )
      .subscribe((cidades) => {
        const uniqueCidades = (cidades || []).filter(
          (cidade: any, index: number, self: any[]) =>
            index === self.findIndex((e) => e.id === cidade.id),
        );
        this.cidades = uniqueCidades;
        let cidadeFinal: string | null = null;
        const cityControl = this.form.get('city');
        const normalize = (str: string) =>
          str
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase();
        if (
          cityControl?.value &&
          this.cidades.some(
            (c) => normalize(c.nome) === normalize(cityControl.value),
          )
        ) {
          cidadeFinal = cityControl.value;
        } else {
          cidadeFinal = null; // força placeholder
        }
        cityControl?.setValue(cidadeFinal);
        cityControl?.setValidators(
          !this.formGroup ? [Validators.required] : null,
        );
        cityControl?.updateValueAndValidity();
        this.form.updateValueAndValidity();
        this.cdr.markForCheck();
      });
  }

  private loadAddressTypeOptions(): void {
    this.selectableOptionService
      .getByGroup(SelectableOptionGroup.AddressType)
      .subscribe((response) => {
        this.addressTypeOptions = response.data ?? [];
        this.cdr.markForCheck();
      });
  }

  private getEstados() {
    this.http
      .get<
        any[]
      >('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .subscribe((estados) => {
        // Remove duplicados pelo id
        const uniqueEstados = estados.filter(
          (estado: any, index: number, self: any[]) =>
            index === self.findIndex((e) => e.id === estado.id),
        );
        this.estados = uniqueEstados;
        // Força o valor null ao carregar estados para mostrar placeholder
        if (this.form && this.form.get('state')) {
          this.form.get('state')?.setValue(null);
        }
        if (this.form && this.form.get('city')) {
          this.form.get('city')?.setValue(null);
        }
        this.cdr.markForCheck();
      });
  }

  private buscarEnderecoPorCep(cep: string) {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    this.loadingCep = true;
    this.http.get<any>(`https://viacep.com.br/ws/${cepLimpo}/json/`).subscribe({
      next: (res) => {
        if (!res.erro) {
          this.form.patchValue({
            street: res.logradouro || '',
            state: res.uf || '',
          });
          // Aguarda o subscribe do state para preencher cidade
          setTimeout(() => {
            const cityControl = this.form.get('city');
            const normalize = (str: string) =>
              str
                .normalize('NFD')
                .replace(/\p{Diacritic}/gu, '')
                .toLowerCase();
            let cidadeFinal = '';
            if (res.localidade && this.cidades.length > 0) {
              const cidadeMatch = this.cidades.find(
                (c) => normalize(c.nome) === normalize(res.localidade),
              );
              if (cidadeMatch) cidadeFinal = cidadeMatch.nome;
            }
            if (!cidadeFinal && this.cidades.length > 0) {
              cidadeFinal = this.cidades[0].nome;
            }
            cityControl?.setValue(cidadeFinal);
            cityControl?.updateValueAndValidity();
            this.form.updateValueAndValidity();
            this.cdr.markForCheck();
          }, 150);
        } else {
          this.notificationService.showMessage(
            ResponseStatus.Error,
            this.translationService.instant('ADDRESS.CEP_NOT_FOUND'),
          );
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.notificationService.showMessage(
          ResponseStatus.Error,
          this.translationService.instant('ADDRESS.CEP_LOOKUP_ERROR'),
        );
        this.cdr.markForCheck();
      },
      complete: () => {
        this.loadingCep = false;
        this.cdr.markForCheck();
      },
    });
  }
}
