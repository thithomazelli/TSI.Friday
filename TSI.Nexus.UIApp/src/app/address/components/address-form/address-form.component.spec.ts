import { HttpClient } from '@angular/common/http';
import { FormBuilder } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import {
  Address,
  AddressService,
  ModalService,
  NotificationService,
  ResponseStatus,
  SelectableOptionService,
  TranslationService,
} from '@nexus/core';
import { ChangeDetectorRef } from '@angular/core';
import { Subject, from, of, throwError } from 'rxjs';
import { AddressFormComponent } from './address-form.component';
import { AddressDetailsModalComponent } from '../address-details-modal/address-details-modal.component';

describe('AddressFormComponent', () => {
  let addressServiceMock: {
    add: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let httpMock: { get: ReturnType<typeof vi.fn> };
  let modalServiceMock: {
    showSweetNotification: ReturnType<typeof vi.fn>;
    hideModal: ReturnType<typeof vi.fn>;
    showSweetConfirmation: ReturnType<typeof vi.fn>;
    showTemplateModal: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let selectableOptionServiceMock: { getByGroup: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(): AddressFormComponent {
    addressServiceMock = { add: vi.fn(), update: vi.fn(), delete: vi.fn() };
    // Default estados response is non-empty on purpose: getEstados() always runs (and re-fetches)
    // before setupAutoComplete() inside ngOnInit/ngOnChanges, so if a test sets `data` and leaves
    // this synchronously-resolving default at an EMPTY array, setupAutoComplete falls into its
    // "estados not loaded yet" branch, which fetches a second time and crashes with a TDZ
    // ReferenceError the moment that (also synchronous, by default) response resolves - a race
    // that only exists here because `of(...)` resolves synchronously, unlike a real HttpClient.
    // Tests exercising that branch on purpose override this explicitly (see "loads estados first").
    httpMock = {
      get: vi.fn().mockImplementation((url: string) =>
        url.includes('estados?orderBy=nome') ? of([{ id: 1, sigla: 'SP', nome: 'São Paulo' }]) : of([]),
      ),
    };
    modalServiceMock = {
      showSweetNotification: vi.fn(),
      hideModal: vi.fn(),
      showSweetConfirmation: vi.fn(),
      showTemplateModal: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    selectableOptionServiceMock = {
      getByGroup: vi.fn().mockReturnValue(of({ data: [] })),
    };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };
    dialogRefMock = { close: vi.fn() };

    const component = new AddressFormComponent(
      addressServiceMock as unknown as AddressService,
      new FormBuilder(),
      httpMock as unknown as HttpClient,
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      selectableOptionServiceMock as unknown as SelectableOptionService,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
    component.dialogRef = dialogRefMock as unknown as MatDialogRef<AddressDetailsModalComponent>;
    return component;
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('builds its own form, loads states, and loads address type options', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('name')).toBeTruthy();
      expect(httpMock.get).toHaveBeenCalled();
      expect(selectableOptionServiceMock.getByGroup).toHaveBeenCalled();
    });

    it('reuses an externally provided form group instead of building its own', () => {
      const component = createComponent();
      const externalForm = new FormBuilder().group({ name: [''] });
      component.formGroup = externalForm;

      component.ngOnInit();

      expect(component.form).toBe(externalForm);
    });
  });

  describe('submit', () => {
    it('marks the form touched and emits null when invalid', () => {
      const component = createComponent();
      component.ngOnInit();

      let value: unknown;
      component.submit().subscribe((v) => (value = v));

      expect(value).toBeNull();
      expect(addressServiceMock.add).not.toHaveBeenCalled();
    });

    it('adds a new address and closes the dialog on success', () => {
      const component = createComponent();
      component.ngOnInit();
      addressServiceMock.add.mockReturnValue(
        of({ value: {}, message: 'Salvo', status: 'success' }),
      );

      component.form.setValue({
        name: 'Casa',
        type: 'Home',
        zipCode: '12345678',
        state: 'SP',
        city: 'São Paulo',
        street: 'Rua A',
        number: 10,
        comments: '',
        businessPartnerId: '',
        country: 'BR',
        isDefault: false,
      });
      component.submit().subscribe();

      expect(addressServiceMock.add).toHaveBeenCalled();
      expect(dialogRefMock.close).toHaveBeenCalled();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Salvo',
        'success',
      );
    });

    it('shows an error notification when saving fails', () => {
      const component = createComponent();
      component.ngOnInit();
      addressServiceMock.add.mockReturnValue(throwError(() => new Error('fail')));

      component.form.setValue({
        name: 'Casa',
        type: 'Home',
        zipCode: '12345678',
        state: 'SP',
        city: 'São Paulo',
        street: 'Rua A',
        number: 10,
        comments: '',
        businessPartnerId: '',
        country: 'BR',
        isDefault: false,
      });
      component.submit().subscribe({ error: () => {} });

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'error',
        'Erro ao salvar',
      );
    });
  });

  describe('cancel', () => {
    it('hides the modal', () => {
      const component = createComponent();
      component.cancel();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
    });
  });

  describe('remove', () => {
    it('deletes the address and notifies when the user confirms', async () => {
      const component = createComponent();
      component.ngOnInit();
      component.data = { id: 'a1' } as Address;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      addressServiceMock.delete.mockReturnValue(
        of({ value: {}, message: 'Removido', status: ResponseStatus.Success }),
      );

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(addressServiceMock.delete).toHaveBeenCalledWith(component.data);
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Removido',
        ResponseStatus.Success,
      );
    });

    it('shows an error notification when the delete fails', async () => {
      const component = createComponent();
      component.ngOnInit();
      component.data = { id: 'a1' } as Address;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      addressServiceMock.delete.mockReturnValue(throwError(() => new Error('fail')));

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'error',
        'Erro ao remover',
      );
    });
  });

  describe('trackBy helpers', () => {
    it('trackByEstadoId falls back to index when there is no id', () => {
      const component = createComponent();
      expect(component.trackByEstadoId(2, { sigla: 'SP', nome: 'São Paulo' })).toBe(2);
      expect(component.trackByEstadoId(2, { id: 5, sigla: 'SP', nome: 'São Paulo' })).toBe(5);
    });

    it('trackByCidadeId falls back to index when there is no id', () => {
      const component = createComponent();
      expect(component.trackByCidadeId(1, { nome: 'São Paulo' })).toBe(1);
      expect(component.trackByCidadeId(1, { id: 7, nome: 'São Paulo' })).toBe(7);
    });
  });

  describe('ngOnChanges', () => {
    it('patches the form (without emitting events) when data changes to a new value', () => {
      const component = createComponent();
      component.ngOnInit();
      component.data = { name: 'Nova Casa' } as Address;
      let valueChangesFired = false;
      component.form.get('name')!.valueChanges.subscribe(() => (valueChangesFired = true));

      component.ngOnChanges({ data: { currentValue: component.data } as never });

      expect(component.form.get('name')!.value).toBe('Nova Casa');
      expect(valueChangesFired).toBe(false);
    });

    it('does nothing when data has no currentValue', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() => component.ngOnChanges({ data: { currentValue: null } as never })).not.toThrow();
      expect(component.form.get('name')!.value).toBe('');
    });

    it('does not throw when data changes before the form exists', () => {
      const component = createComponent();
      component.data = { name: 'X' } as Address;

      expect(() => component.ngOnChanges({ data: { currentValue: component.data } as never })).not.toThrow();
    });

    it('disables id and businessPartnerId when isEdit turns true after the first change', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();

      component.ngOnChanges({ isEdit: { currentValue: true, firstChange: false } as never });

      expect(component.form.get('id')!.disabled).toBe(true);
      expect(component.form.get('businessPartnerId')!.disabled).toBe(true);
    });

    it('does not disable fields on the first isEdit change', () => {
      const component = createComponent();
      component.ngOnInit();

      component.ngOnChanges({ isEdit: { currentValue: false, firstChange: true } as never });

      expect(component.form.get('businessPartnerId')!.disabled).toBe(false);
    });

    it('does not disable fields when isEdit changes to false', () => {
      const component = createComponent();
      component.ngOnInit();

      component.ngOnChanges({ isEdit: { currentValue: false, firstChange: false } as never });

      expect(component.form.get('businessPartnerId')!.disabled).toBe(false);
    });

    it('always re-runs setupAutoComplete', () => {
      const component = createComponent();
      component.ngOnInit();
      const spy = vi.spyOn(component as any, 'setupAutoComplete');

      component.ngOnChanges({});

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('initForm (private, via ngOnInit)', () => {
    it('builds an edit-mode form with a disabled id control', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();

      expect(component.form.get('id')).toBeTruthy();
      expect(component.form.get('id')!.disabled).toBe(true);
    });

    it('defaults isDefault to false when there is no data', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(component.form.get('isDefault')!.value).toBe(false);
    });

    it('seeds isDefault from the provided data', () => {
      const component = createComponent();
      component.data = { isDefault: true } as Address;
      component.ngOnInit();

      expect(component.form.get('isDefault')!.value).toBe(true);
    });
  });

  describe('submit - save() branching (private, via submit)', () => {
    function fillValidForm(component: AddressFormComponent) {
      component.form.patchValue({
        name: 'Casa',
        type: 'Home',
        zipCode: '12345678',
        state: 'SP',
        city: 'São Paulo',
        street: 'Rua A',
        number: 10,
        comments: '',
        businessPartnerId: '',
        country: 'BR',
        isDefault: false,
      });
    }

    it('sets businessPartnerId from parentId when present', () => {
      const component = createComponent();
      component.parentId = 'bp1';
      component.ngOnInit();
      fillValidForm(component);
      addressServiceMock.add.mockReturnValue(of({ message: 'OK', status: 'success' }));

      component.submit().subscribe();

      expect(addressServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ businessPartnerId: 'bp1' }),
      );
    });

    it('falls back to an empty businessPartnerId when there is no parentId', () => {
      const component = createComponent();
      component.parentId = null;
      component.ngOnInit();
      fillValidForm(component);
      addressServiceMock.add.mockReturnValue(of({ message: 'OK', status: 'success' }));

      component.submit().subscribe();

      expect(addressServiceMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ businessPartnerId: '' }),
      );
    });

    it('updates when editing an existing address', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 'a1' } as Address;
      component.ngOnInit();
      fillValidForm(component);
      addressServiceMock.update.mockReturnValue(of({ message: 'Salvo', status: 'success' }));

      component.submit().subscribe();

      expect(addressServiceMock.update).toHaveBeenCalled();
      expect(addressServiceMock.add).not.toHaveBeenCalled();
    });

    it('adds instead of updating when isEdit is true but there is no existing data', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();
      fillValidForm(component);
      addressServiceMock.add.mockReturnValue(of({ message: 'OK', status: 'success' }));

      component.submit().subscribe();

      expect(addressServiceMock.add).toHaveBeenCalled();
      expect(addressServiceMock.update).not.toHaveBeenCalled();
    });
  });

  describe('remove - additional branches', () => {
    it('hides the dialogRef and notifies when deletion succeeds inside a modal', async () => {
      const component = createComponent();
      component.isModal = true;
      component.ngOnInit();
      component.data = { id: 'a1' } as Address;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      addressServiceMock.delete.mockReturnValue(
        of({ message: 'Removido', status: ResponseStatus.Success }),
      );

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Removido',
        ResponseStatus.Success,
      );
    });

    it('does nothing further when the deletion is cancelled outside a modal', async () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      component.data = { id: 'a1' } as Address;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(addressServiceMock.delete).not.toHaveBeenCalled();
      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
    });

    // The isModal=true reopen path loads AddressDetailsModalComponent via a dynamic import() (see
    // remove()'s comment on why) - like every other reopen-after-cancel pattern using a dynamic
    // import in this codebase (product-form, purchase-order-products-form, payment-form, ...),
    // that async module resolution doesn't settle within any number of microtask/macrotask ticks
    // under this bundler's test transform, making the "showTemplateModal was called" branch
    // impractical to assert here. The cancelled-outside-a-modal case above already covers
    // isModal=false; the isModal=true branch's only difference is this dynamic import wrapping.
  });

  describe('setupAutoComplete (private, via ngOnInit/ngOnChanges)', () => {
    it('does nothing when there is no form yet', () => {
      const component = createComponent();
      expect(() => (component as any).setupAutoComplete()).not.toThrow();
      expect(httpMock.get).not.toHaveBeenCalled();
    });

    it('binds the zipCode lookup only once across multiple setupAutoComplete runs', () => {
      const component = createComponent();
      component.ngOnInit();
      const spy = vi.spyOn(component as any, 'buscarEnderecoPorCep').mockImplementation(() => {});

      component.ngOnChanges({});
      component.ngOnChanges({});
      component.form.get('zipCode')!.setValue('12345678');

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not look up the CEP for a short or empty value', () => {
      const component = createComponent();
      component.ngOnInit();
      const spy = vi.spyOn(component as any, 'buscarEnderecoPorCep').mockImplementation(() => {});

      component.form.get('zipCode')!.setValue('123');
      component.form.get('zipCode')!.setValue('');

      expect(spy).not.toHaveBeenCalled();
    });

    describe('state -> city cascade', () => {
      it('clears cidades and city when the state is cleared', () => {
        const component = createComponent();
        component.ngOnInit();
        component.cidades = [{ id: 1, nome: 'São Paulo' }];

        component.form.get('state')!.setValue('');

        expect(component.cidades).toEqual([]);
        expect(component.form.get('city')!.value).toBeNull();
      });

      it('clears cidades and city when the selected state is not among the loaded estados', () => {
        const component = createComponent();
        component.ngOnInit();
        component.estados = [{ id: 1, sigla: 'RJ', nome: 'Rio de Janeiro' }];

        component.form.get('state')!.setValue('SP');

        expect(component.cidades).toEqual([]);
        expect(component.form.get('city')!.value).toBeNull();
      });

      it('loads cidades for the selected state and keeps a matching city value', () => {
        const component = createComponent();
        component.ngOnInit();
        component.estados = [{ id: 35, sigla: 'SP', nome: 'São Paulo' }];
        httpMock.get.mockReturnValue(
          of([{ id: 1, nome: 'São Paulo' }, { id: 1, nome: 'São Paulo' }, { id: 2, nome: 'Campinas' }]),
        );
        component.form.get('city')!.setValue('sao paulo');

        component.form.get('state')!.setValue('SP');

        expect(component.cidades).toEqual([{ id: 1, nome: 'São Paulo' }, { id: 2, nome: 'Campinas' }]);
        expect(component.form.get('city')!.value).toBe('sao paulo');
      });

      it('resets the city to a placeholder when it does not match any loaded cidade', () => {
        const component = createComponent();
        component.ngOnInit();
        component.estados = [{ id: 35, sigla: 'SP', nome: 'São Paulo' }];
        httpMock.get.mockReturnValue(of([{ id: 1, nome: 'Campinas' }]));
        component.form.get('city')!.setValue('Cidade Inexistente');

        component.form.get('state')!.setValue('SP');

        expect(component.form.get('city')!.value).toBeNull();
      });

      it('treats a null municipios response as an empty cidades list', () => {
        const component = createComponent();
        component.ngOnInit();
        component.estados = [{ id: 35, sigla: 'SP', nome: 'São Paulo' }];
        httpMock.get.mockImplementation((url: string) =>
          url.includes('municipios') ? of(null) : of([]),
        );

        expect(() => component.form.get('state')!.setValue('SP')).not.toThrow();

        expect(component.cidades).toEqual([]);
      });

      it('sets city as required when there is no external formGroup', () => {
        const component = createComponent();
        component.ngOnInit();
        component.estados = [{ id: 35, sigla: 'SP', nome: 'São Paulo' }];
        httpMock.get.mockReturnValue(of([]));

        component.form.get('state')!.setValue('SP');

        expect(component.form.get('city')!.hasError('required')).toBe(true);
      });

      it('does not require city when bound to an external formGroup', () => {
        const component = createComponent();
        const externalForm = new FormBuilder().group({
          state: [''],
          city: [''],
        });
        component.formGroup = externalForm;
        component.ngOnInit();
        component.estados = [{ id: 35, sigla: 'SP', nome: 'São Paulo' }];
        httpMock.get.mockReturnValue(of([]));

        component.form.get('state')!.setValue('SP');

        expect(component.form.get('city')!.hasError('required')).toBe(false);
      });
    });

    describe('patching an existing address (this.data set)', () => {
      it('loads estados first when none are loaded yet, then patches and loads cidades', async () => {
        // A real HttpClient resolves asynchronously, so by the time setupAutoComplete() runs
        // right after getEstados() in ngOnInit, this.estados can still be empty - that race is
        // what the "else" branch in setupAutoComplete (loading estados a second time) handles.
        // The estados response must resolve on a later microtask (not synchronously, like a bare
        // `of(...)` would) or the component's own `const estadosSub = ...subscribe(cb)` - where
        // cb calls `estadosSub.unsubscribe()` - fires synchronously inside the same subscribe()
        // call and throws a TDZ ReferenceError; a real HttpClient never resolves that fast.
        const component = createComponent();
        httpMock.get.mockImplementation((url: string) => {
          if (url.includes('municipios')) {
            return of([{ id: 1, nome: 'São Paulo' }]);
          }
          if (url.includes('estados?orderBy=nome')) {
            return from(Promise.resolve([{ id: 35, sigla: 'SP', nome: 'São Paulo' }]));
          }
          return of([]);
        });
        component.data = { state: 'SP', city: 'São Paulo' } as Address;

        component.ngOnInit();
        expect(component.estados).toEqual([]);
        await Promise.resolve();
        await Promise.resolve();

        expect(component.estados).toEqual([{ id: 35, sigla: 'SP', nome: 'São Paulo' }]);
        expect(component.form.get('city')!.value).toBe('São Paulo');
      });

      // getEstados() always runs (and re-fetches) before setupAutoComplete() inside ngOnInit, so
      // the mocked "estados?orderBy=nome" response must itself stay non-empty in every test below
      // - otherwise getEstados() overwrites the pre-seeded component.estados back to [], forcing
      // setupAutoComplete() through its "estados not loaded yet" branch (see the dedicated
      // "loads estados first" tests above for why a *synchronous* response down that branch
      // crashes with a TDZ error in the component's own `estadosSub` cleanup).
      const spEstado = [{ id: 35, sigla: 'SP', nome: 'São Paulo' }];

      it('patches immediately when estados are already loaded', () => {
        const component = createComponent();
        component.estados = spEstado;
        httpMock.get.mockImplementation((url: string) => {
          if (url.includes('municipios')) return of([{ id: 1, nome: 'São Paulo' }]);
          if (url.includes('estados?orderBy=nome')) return of(spEstado);
          return of([]);
        });
        component.data = { state: 'SP', city: 'São Paulo' } as Address;

        component.ngOnInit();

        expect(component.form.get('name')).toBeTruthy();
        expect(component.form.get('city')!.value).toBe('São Paulo');
      });

      it('forces a placeholder city when the matched cidade cannot be found', () => {
        const component = createComponent();
        component.estados = spEstado;
        httpMock.get.mockImplementation((url: string) => {
          if (url.includes('municipios')) return of([{ id: 1, nome: 'Campinas' }]);
          if (url.includes('estados?orderBy=nome')) return of(spEstado);
          return of([]);
        });
        component.data = { state: 'SP', city: 'Cidade Inexistente' } as Address;

        component.ngOnInit();

        expect(component.form.get('city')!.value).toBeNull();
      });

      it('forces a null city when the address state is not among the loaded estados', () => {
        const component = createComponent();
        const rjEstado = [{ id: 1, sigla: 'RJ', nome: 'Rio de Janeiro' }];
        component.estados = rjEstado;
        httpMock.get.mockImplementation((url: string) =>
          url.includes('estados?orderBy=nome') ? of(rjEstado) : of([]),
        );
        component.data = { state: 'SP', city: 'São Paulo' } as Address;

        component.ngOnInit();

        expect(component.form.get('city')!.value).toBeNull();
      });

      it('forces a null city when the address has no state at all', () => {
        const component = createComponent();
        component.estados = spEstado;
        httpMock.get.mockImplementation((url: string) =>
          url.includes('estados?orderBy=nome') ? of(spEstado) : of([]),
        );
        component.data = { state: '', city: 'São Paulo' } as unknown as Address;

        component.ngOnInit();

        expect(component.form.get('city')!.value).toBeNull();
      });

      it('patches immediately when bound to an external formGroup with estados already loaded', () => {
        const component = createComponent();
        const externalForm = new FormBuilder().group({
          name: [''],
          state: [''],
          city: [''],
        });
        component.formGroup = externalForm;
        component.estados = spEstado;
        httpMock.get.mockImplementation((url: string) => {
          if (url.includes('municipios')) return of([{ id: 1, nome: 'São Paulo' }]);
          if (url.includes('estados?orderBy=nome')) return of(spEstado);
          return of([]);
        });
        component.data = { name: 'Casa', state: 'SP', city: 'São Paulo' } as Address;

        component.ngOnInit();

        expect(externalForm.get('city')!.value).toBe('São Paulo');
      });

      it('loads estados first when bound to an external formGroup with none loaded yet', async () => {
        const component = createComponent();
        const externalForm = new FormBuilder().group({
          name: [''],
          state: [''],
          city: [''],
        });
        component.formGroup = externalForm;
        httpMock.get.mockImplementation((url: string) => {
          if (url.includes('municipios')) {
            return of([{ id: 1, nome: 'São Paulo' }]);
          }
          if (url.includes('estados?orderBy=nome')) {
            return from(Promise.resolve([{ id: 35, sigla: 'SP', nome: 'São Paulo' }]));
          }
          return of([]);
        });
        component.data = { name: 'Casa', state: 'SP', city: 'São Paulo' } as Address;

        component.ngOnInit();
        expect(component.estados).toEqual([]);
        await Promise.resolve();
        await Promise.resolve();

        expect(component.estados).toEqual([{ id: 35, sigla: 'SP', nome: 'São Paulo' }]);
        expect(externalForm.get('city')!.value).toBe('São Paulo');
      });

      it('treats a null municipios response as an empty cidades list when patching', () => {
        const component = createComponent();
        component.estados = spEstado;
        httpMock.get.mockImplementation((url: string) => {
          if (url.includes('municipios')) return of(null);
          if (url.includes('estados?orderBy=nome')) return of(spEstado);
          return of([]);
        });
        component.data = { state: 'SP', city: 'São Paulo' } as Address;

        expect(() => component.ngOnInit()).not.toThrow();

        expect(component.cidades).toEqual([]);
      });

      it('drops cidades with a null id and deduplicates the rest, defaulting a missing city to an empty filter value', () => {
        const component = createComponent();
        component.estados = spEstado;
        httpMock.get.mockImplementation((url: string) => {
          if (url.includes('municipios')) {
            return of([
              { id: null, nome: 'Sem Id' },
              { id: 1, nome: 'São Paulo' },
              { id: 1, nome: 'São Paulo' },
            ]);
          }
          if (url.includes('estados?orderBy=nome')) return of(spEstado);
          return of([]);
        });
        // No `city` field at all, exercising the `patch.city ?? ''` fallback.
        component.data = { state: 'SP' } as Address;

        component.ngOnInit();

        expect(component.cidades).toEqual([{ id: 1, nome: 'São Paulo' }]);
        expect(component.form.get('city')!.value).toBeNull();
      });
    });
  });

  describe('loadAddressTypeOptions (private, via ngOnInit)', () => {
    it('falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      selectableOptionServiceMock.getByGroup.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.addressTypeOptions).toEqual([]);
    });

    it('loads the address type options from the response data', () => {
      const component = createComponent();
      selectableOptionServiceMock.getByGroup.mockReturnValue(
        of({ data: [{ value: 'Home', label: 'Casa' }] }),
      );

      component.ngOnInit();

      expect(component.addressTypeOptions).toEqual([{ value: 'Home', label: 'Casa' }]);
    });
  });

  describe('getEstados (private, via ngOnInit)', () => {
    it('deduplicates estados by id and forces state/city to placeholders', () => {
      const component = createComponent();
      httpMock.get.mockReturnValue(
        of([{ id: 1, sigla: 'SP', nome: 'São Paulo' }, { id: 1, sigla: 'SP', nome: 'São Paulo' }]),
      );

      component.ngOnInit();

      expect(component.estados).toEqual([{ id: 1, sigla: 'SP', nome: 'São Paulo' }]);
      expect(component.form.get('state')!.value).toBeNull();
      expect(component.form.get('city')!.value).toBeNull();
    });

    it('does not throw when there is no form yet', () => {
      const component = createComponent();
      expect(() => (component as any).getEstados()).not.toThrow();
    });
  });

  describe('buscarEnderecoPorCep (private, via the zipCode subscription)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('does nothing for an incomplete CEP', () => {
      const component = createComponent();
      component.ngOnInit();
      httpMock.get.mockClear();

      component.form.get('zipCode')!.setValue('123');

      expect(httpMock.get).not.toHaveBeenCalled();
      expect(component.loadingCep).toBe(false);
    });

    it('does nothing when the raw value is long enough but has fewer than 8 digits', () => {
      const component = createComponent();
      component.ngOnInit();
      httpMock.get.mockClear();

      // Passes the zipCode subscription's own `cep.length >= 8` guard (8 raw characters), but
      // digits-only length is 7 - exercises buscarEnderecoPorCep's own internal guard.
      (component as any).buscarEnderecoPorCep('1234-567');

      expect(httpMock.get).not.toHaveBeenCalled();
      expect(component.loadingCep).toBe(false);
    });

    // These tests let `patchValue({ street, state: res.uf })` inside buscarEnderecoPorCep
    // trigger the real "state" valueChanges cascade (setupAutoComplete wires it with the default
    // emitEvent:true) to populate `this.cidades` via the mocked municipios endpoint, rather than
    // assigning component.cidades directly - a direct assignment would just be overwritten by
    // that same cascade the moment `state` is patched.
    it('fills street/state and matches an existing cidade from the response', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.estados = [{ id: 35, sigla: 'SP', nome: 'São Paulo' }];
      httpMock.get.mockImplementation((url: string) => {
        if (url.includes('municipios')) {
          return of([{ id: 1, nome: 'São Paulo' }, { id: 2, nome: 'Campinas' }]);
        }
        if (url.includes('viacep')) {
          return of({ logradouro: 'Av. Paulista', uf: 'SP', localidade: 'São Paulo', erro: false });
        }
        return of([]);
      });

      component.form.get('zipCode')!.setValue('01310-100');
      vi.advanceTimersByTime(150);

      expect(component.form.get('street')!.value).toBe('Av. Paulista');
      expect(component.form.get('state')!.value).toBe('SP');
      expect(component.form.get('city')!.value).toBe('São Paulo');
      expect(component.loadingCep).toBe(false);
    });

    it('falls back to the first cidade when localidade does not match any loaded cidade', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.estados = [{ id: 35, sigla: 'SP', nome: 'São Paulo' }];
      httpMock.get.mockImplementation((url: string) => {
        if (url.includes('municipios')) {
          return of([{ id: 1, nome: 'Campinas' }]);
        }
        if (url.includes('viacep')) {
          return of({ logradouro: 'Rua X', uf: 'SP', localidade: 'Cidade Desconhecida', erro: false });
        }
        return of([]);
      });

      component.form.get('zipCode')!.setValue('13000000');
      vi.advanceTimersByTime(150);

      expect(component.form.get('city')!.value).toBe('Campinas');
    });

    it('falls back to the first cidade when the response has no localidade at all', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      component.estados = [{ id: 35, sigla: 'SP', nome: 'São Paulo' }];
      httpMock.get.mockImplementation((url: string) => {
        if (url.includes('municipios')) {
          return of([{ id: 1, nome: 'Campinas' }]);
        }
        if (url.includes('viacep')) {
          return of({ logradouro: 'Rua X', uf: 'SP', erro: false });
        }
        return of([]);
      });

      component.form.get('zipCode')!.setValue('13000000');
      vi.advanceTimersByTime(150);

      expect(component.form.get('city')!.value).toBe('Campinas');
    });

    it('leaves the city blank when there are no cidades loaded at all', () => {
      vi.useFakeTimers();
      const component = createComponent();
      component.ngOnInit();
      // No estados configured, so the "state" cascade's estado-not-found branch clears cidades.
      httpMock.get.mockImplementation((url: string) =>
        url.includes('viacep') ? of({ logradouro: 'Rua X', uf: 'SP', erro: false }) : of([]),
      );

      component.form.get('zipCode')!.setValue('13000000');
      vi.advanceTimersByTime(150);

      expect(component.form.get('city')!.value).toBe('');
    });

    it('shows a not-found notification when the CEP service reports erro', () => {
      const component = createComponent();
      component.ngOnInit();
      httpMock.get.mockReturnValue(of({ erro: true }));

      component.form.get('zipCode')!.setValue('00000000');

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'ADDRESS.CEP_NOT_FOUND',
      );
      expect(component.loadingCep).toBe(false);
    });

    it('shows a lookup-error notification when the request fails', () => {
      const component = createComponent();
      component.ngOnInit();
      httpMock.get.mockReturnValue(throwError(() => new Error('network down')));

      component.form.get('zipCode')!.setValue('00000000');

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'ADDRESS.CEP_LOOKUP_ERROR',
      );
      // Note: unlike the success path, the `error` callback does not reset loadingCep - only
      // `complete` does, and RxJS never calls `complete` after an `error`. This mirrors the
      // component's actual (pre-existing) behavior rather than asserting a fix for it.
      expect(component.loadingCep).toBe(true);
    });
  });
});
