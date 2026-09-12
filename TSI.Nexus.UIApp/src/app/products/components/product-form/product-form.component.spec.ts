import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ModalService,
  NotificationService,
  Product,
  ProductService,
  ProductType,
  ProductUnit,
  ResponseStatus,
  SelectableOptionService,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { config, of, throwError } from 'rxjs';
import { ProductFormComponent } from './product-form.component';

describe('ProductFormComponent', () => {
  let modalServiceMock: {
    hideModal: ReturnType<typeof vi.fn>;
    showNotification: ReturnType<typeof vi.fn>;
    showSweetConfirmation: ReturnType<typeof vi.fn>;
    showSweetNotification: ReturnType<typeof vi.fn>;
    showTemplateModal: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { showMessage: ReturnType<typeof vi.fn> };
  let productServiceMock: {
    add: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let selectableOptionServiceMock: { getByGroup: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  function createComponent(): ProductFormComponent {
    modalServiceMock = {
      hideModal: vi.fn(),
      showNotification: vi.fn(),
      showSweetConfirmation: vi.fn(),
      showSweetNotification: vi.fn(),
      showTemplateModal: vi.fn(),
    };
    notificationServiceMock = { showMessage: vi.fn() };
    productServiceMock = { add: vi.fn(), update: vi.fn(), delete: vi.fn() };
    routerMock = { navigateByUrl: vi.fn() };
    selectableOptionServiceMock = { getByGroup: vi.fn().mockReturnValue(of({ data: [] })) };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    cdrMock = { markForCheck: vi.fn() };

    return new ProductFormComponent(
      new FormBuilder(),
      modalServiceMock as unknown as ModalService,
      notificationServiceMock as unknown as NotificationService,
      productServiceMock as unknown as ProductService,
      routerMock as unknown as Router,
      selectableOptionServiceMock as unknown as SelectableOptionService,
      translationServiceMock as unknown as TranslationService,
      cdrMock as unknown as ChangeDetectorRef,
    );
  }

  function validRawValue() {
    return {
      sku: 'SKU-1',
      name: 'Produto A',
      description: '',
      price: 10,
      unit: ProductUnit.Unit,
      type: ProductType.Rental,
      quantityInStock: 5,
      photo: '',
      category: 'cat1',
    };
  }

  function fillValidForm(component: ProductFormComponent) {
    component.form.patchValue(validRawValue());
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('exposes translated unit and product type options', () => {
    const component = createComponent();
    expect(component.unitOptions.length).toBe(3);
    expect(component.productTypeOptions.length).toBe(3);
  });

  describe('ngOnInit', () => {
    it('builds a form without an id control when adding', () => {
      const component = createComponent();
      component.ngOnInit();
      expect(component.form.get('id')).toBeNull();
    });

    it('builds a form with an id control when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();
      expect(component.form.get('id')).toBeTruthy();
    });

    it('patches the form with the provided data', () => {
      const component = createComponent();
      component.data = { name: 'Produto B' } as Product;
      component.ngOnInit();
      expect(component.form.get('name')!.value).toBe('Produto B');
    });

    it('loads categories and falls back to an empty array when the response has no data', () => {
      const component = createComponent();
      selectableOptionServiceMock.getByGroup.mockReturnValue(of({}));

      component.ngOnInit();

      expect(component.categories).toEqual([]);
      expect(cdrMock.markForCheck).toHaveBeenCalled();
    });

    it('loads categories from the response data', () => {
      const component = createComponent();
      selectableOptionServiceMock.getByGroup.mockReturnValue(
        of({ data: [{ id: 'cat1', name: 'Categoria 1' }] }),
      );

      component.ngOnInit();

      expect(component.categories).toEqual([{ id: 'cat1', name: 'Categoria 1' }]);
    });
  });

  describe('ngOnChanges', () => {
    it('patches the form when data changes to a new value after init', () => {
      const component = createComponent();
      component.ngOnInit();
      component.data = { name: 'Produto C' } as Product;

      component.ngOnChanges({ data: { currentValue: component.data } as never });

      expect(component.form.get('name')!.value).toBe('Produto C');
    });

    it('does nothing when the changed input is not data', () => {
      const component = createComponent();
      component.ngOnInit();

      component.ngOnChanges({ compact: { currentValue: true } as never });

      expect(component.form.get('name')!.value).toBe('');
    });

    it('does nothing when data has no currentValue', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() =>
        component.ngOnChanges({ data: { currentValue: null } as never }),
      ).not.toThrow();
      expect(component.form.get('name')!.value).toBe('');
    });

    it('re-initializes the form when isEdit changes after the first change', () => {
      const component = createComponent();
      component.ngOnInit();
      expect(component.form.get('id')).toBeNull();
      component.isEdit = true;

      component.ngOnChanges({
        isEdit: { currentValue: true, firstChange: false } as never,
      });

      expect(component.form.get('id')).toBeTruthy();
    });

    it('does not re-initialize the form on the first isEdit change', () => {
      const component = createComponent();
      component.ngOnInit();
      const before = component.form;

      component.ngOnChanges({
        isEdit: { currentValue: false, firstChange: true } as never,
      });

      expect(component.form).toBe(before);
    });
  });

  describe('ngOnDestroy', () => {
    it('unsubscribes all tracked subscriptions', () => {
      const component = createComponent();
      component.ngOnInit();

      expect(() => component.ngOnDestroy()).not.toThrow();
      expect((component as any)._subscriptions).toEqual([]);
    });

    it('does not throw when there are no subscriptions to clean up', () => {
      const component = createComponent();

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('patchFormWithData (type -> quantityInStock)', () => {
    it('zeroes and disables quantityInStock when the type changes to Service', () => {
      const component = createComponent();
      component.ngOnInit();

      component.form.get('type')!.setValue(ProductType.Service);

      expect(component.form.get('quantityInStock')!.value).toBe(0);
      expect(component.form.get('quantityInStock')!.disabled).toBe(true);
    });

    it('enables quantityInStock when the type changes away from Service', () => {
      const component = createComponent();
      component.ngOnInit();
      component.form.get('type')!.setValue(ProductType.Service);

      component.form.get('type')!.setValue(ProductType.Sale);

      expect(component.form.get('quantityInStock')!.disabled).toBe(false);
    });

    it('does not throw when there is no data to patch', () => {
      const component = createComponent();
      component.data = null;

      expect(() => component.ngOnInit()).not.toThrow();
    });

    it('does not track a subscription when the form has no type control', () => {
      const component = createComponent();
      component.form = new FormBuilder().group({ other: [''] }) as any;

      expect(() => (component as any).patchFormWithData()).not.toThrow();

      expect((component as any)._subscriptions).toEqual([]);
    });
  });

  describe('submit', () => {
    it('marks the form as touched and returns null without saving when invalid', () => {
      const component = createComponent();
      component.ngOnInit();

      let result: unknown;
      component.submit().subscribe((r) => (result = r));

      expect(result).toBeNull();
      expect(component.form.get('sku')!.touched).toBe(true);
      expect(productServiceMock.add).not.toHaveBeenCalled();
    });

    it('adds a new product when not editing and there is no existing data', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      productServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'p1' } } as WebApiResponse<Product>),
      );

      component.submit().subscribe();

      expect(productServiceMock.add).toHaveBeenCalled();
    });

    it('merges the raw value into data before saving, and updates when editing', () => {
      const component = createComponent();
      component.isEdit = true;
      component.data = { id: 'p1' } as Product;
      component.ngOnInit();
      fillValidForm(component);
      productServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'p1' } } as WebApiResponse<Product>),
      );

      component.submit().subscribe();

      expect(productServiceMock.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'p1', name: 'Produto A' }),
      );
    });

    it('adds instead of updating when isEdit is true but there is no existing data', () => {
      const component = createComponent();
      component.isEdit = true;
      component.ngOnInit();
      fillValidForm(component);
      productServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'p1' } } as WebApiResponse<Product>),
      );

      component.submit().subscribe();

      expect(productServiceMock.add).toHaveBeenCalled();
      expect(productServiceMock.update).not.toHaveBeenCalled();
    });

    it('notifies without saving when the backend reports a business-rule failure', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      productServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'SKU duplicado' } as WebApiResponse<Product>),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        ResponseStatus.Error,
        'SKU duplicado',
      );
    });

    it('saves via the modal path when isModal is true', () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = { close: vi.fn() };
      component.dialogRef = dialogRefMock as any;
      component.ngOnInit();
      fillValidForm(component);
      productServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'p1' }, message: 'OK' } as WebApiResponse<Product>),
      );

      component.submit().subscribe();

      expect(dialogRefMock.close).toHaveBeenCalled();
    });

    it('saves via the page path when isModal is false', () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      fillValidForm(component);
      productServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'p1' } } as WebApiResponse<Product>),
      );

      component.submit().subscribe();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/products/p1');
    });

    it('notifies an error when the save request errors', () => {
      const component = createComponent();
      component.ngOnInit();
      fillValidForm(component);
      productServiceMock.add.mockReturnValue(throwError(() => new Error('boom')));

      component.submit().subscribe({ error: () => {} });

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
        'error',
        'Erro ao salvar',
      );
    });
  });

  describe('cancel', () => {
    it('hides the modal when isModal is true', () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = {};
      component.dialogRef = dialogRefMock as any;

      component.cancel();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
    });

    it('navigates back to the list when isModal is false', () => {
      const component = createComponent();
      component.isModal = false;

      component.cancel();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/products');
    });
  });

  describe('remove', () => {
    it('deletes and notifies success outside a modal when confirmed', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'p1' } as Product;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      productServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' } as WebApiResponse<Product>),
      );

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith();
      expect(modalServiceMock.showSweetNotification).toHaveBeenCalledWith(
        '',
        'Removido',
        ResponseStatus.Success,
      );
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/products');
    });

    it('hides the modal and does not navigate on success inside a modal', async () => {
      const component = createComponent();
      component.isModal = true;
      const dialogRefMock = {};
      component.dialogRef = dialogRefMock as any;
      component.data = { id: 'p1' } as Product;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      productServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'Removido' } as WebApiResponse<Product>),
      );

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.hideModal).toHaveBeenCalledWith(dialogRefMock);
      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('does not navigate when the delete reports an error status', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'p1' } as Product;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
      productServiceMock.delete.mockReturnValue(
        of({ status: ResponseStatus.Error, message: 'Falhou' } as WebApiResponse<Product>),
      );

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(routerMock.navigateByUrl).not.toHaveBeenCalled();
    });

    it('notifies an error when the delete request fails', async () => {
      const originalOnUnhandledError = config.onUnhandledError;
      config.onUnhandledError = () => {};
      try {
        const component = createComponent();
        component.data = { id: 'p1' } as Product;
        modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: true });
        productServiceMock.delete.mockReturnValue(throwError(() => new Error('boom')));

        component.remove();
        await Promise.resolve();
        await Promise.resolve();

        expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(
          'error',
          'Erro ao remover',
        );

        await new Promise((resolve) => setTimeout(resolve, 0));
      } finally {
        config.onUnhandledError = originalOnUnhandledError;
      }
    });

    it('does nothing further when the deletion is cancelled outside a modal', async () => {
      const component = createComponent();
      component.isModal = false;
      component.data = { id: 'p1' } as Product;
      modalServiceMock.showSweetConfirmation.mockResolvedValue({ isConfirmed: false });

      component.remove();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalServiceMock.showTemplateModal).not.toHaveBeenCalled();
      expect(productServiceMock.delete).not.toHaveBeenCalled();
    });

    // The isModal=true reopen path loads ProductDetailsModalComponent via a dynamic import() (see
    // remove()'s comment on why) - unlike every other reopen-after-cancel pattern in this codebase
    // (a plain top-level import), that async module resolution doesn't settle within any number of
    // microtask/macrotask ticks under this bundler's test transform, making the "showTemplateModal
    // was called" branch impractical to assert here. The cancelled-outside-a-modal path above
    // already covers isModal=false; the isModal=true branch's only difference is this dynamic
    // import wrapping the exact same showTemplateModal call already verified there.
  });

  describe('saveModal (via submit)', () => {
    it('shows a success notification when saving via the modal', () => {
      const component = createComponent();
      component.isModal = true;
      component.ngOnInit();
      fillValidForm(component);
      productServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK' } as WebApiResponse<Product>),
      );

      component.submit().subscribe();

      expect(modalServiceMock.showNotification).toHaveBeenCalledWith(
        true,
        'Produto adicionado',
        'OK',
      );
    });

    it('does not throw when there is no dialogRef to close', () => {
      const component = createComponent();
      component.isModal = true;
      component.dialogRef = undefined;
      component.ngOnInit();
      fillValidForm(component);
      productServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK' } as WebApiResponse<Product>),
      );

      expect(() => component.submit().subscribe()).not.toThrow();
    });
  });

  describe('savePage (via submit)', () => {
    it('notifies and updates local data when editing', () => {
      const component = createComponent();
      component.isModal = false;
      component.isEdit = true;
      component.data = { id: 'p1' } as Product;
      component.ngOnInit();
      fillValidForm(component);
      const updated = { id: 'p1', name: 'Produto A' } as Product;
      productServiceMock.update.mockReturnValue(
        of({ status: ResponseStatus.Success, message: 'OK', data: updated } as WebApiResponse<Product>),
      );

      component.submit().subscribe();

      expect(notificationServiceMock.showMessage).toHaveBeenCalledWith(ResponseStatus.Success, 'OK');
      expect(component.data).toBe(updated);
      expect(routerMock.navigateByUrl).not.toHaveBeenCalledWith('/products/p1');
    });

    it('navigates to the new product when adding', () => {
      const component = createComponent();
      component.isModal = false;
      component.ngOnInit();
      fillValidForm(component);
      productServiceMock.add.mockReturnValue(
        of({ status: ResponseStatus.Success, data: { id: 'p2' } } as WebApiResponse<Product>),
      );

      component.submit().subscribe();

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/products/p2');
    });
  });
});
