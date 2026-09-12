import { MatDialogRef } from '@angular/material/dialog';
import { Product } from '@nexus/core';
import { ProductDetailsModalComponent } from './product-details-modal.component';

describe('ProductDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: any = null): ProductDetailsModalComponent {
    dialogRefMock = { close: vi.fn() };
    return new ProductDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<ProductDetailsModalComponent>,
      dialogData,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('defaults to add mode with no data when there is no dialog data', () => {
    const component = createComponent();

    expect(component.isEdit).toBe(false);
    expect(component.data).toBeNull();
    expect(component.id).toBeNull();
  });

  it('initializes from dialog data in edit mode', () => {
    const product = { id: 'p1', name: 'Item' } as Product;
    const component = createComponent({ isEdit: true, data: product, id: 'p1' });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(product);
    expect(component.id).toBe('p1');
  });

  it('falls back to defaults when dialog data omits fields', () => {
    const component = createComponent({});

    expect(component.isEdit).toBe(false);
    expect(component.data).toBeNull();
    expect(component.id).toBeNull();
  });

  describe('close', () => {
    it('closes the dialog with no result', () => {
      const component = createComponent();
      component.close();

      expect(dialogRefMock.close).toHaveBeenCalledWith(null);
    });
  });
});
