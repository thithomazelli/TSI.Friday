// Instantiated directly - see driver-details-modal.component.spec.ts for why: the real
// PurchaseOrderProductsFormComponent embedded in the template drags in its own DI tree via
// TestBed.createComponent(), which belongs to that component's own spec, not this modal's.
import { MatDialogRef } from '@angular/material/dialog';
import { PurchaseOrderProduct } from '@nexus/core';
import { PurchaseOrderProductsDetailsModalComponent } from './purchase-order-products-details-modal.component';

describe('PurchaseOrderProductsDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: unknown) {
    dialogRefMock = { close: vi.fn() };
    return new PurchaseOrderProductsDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<PurchaseOrderProductsDetailsModalComponent>,
      dialogData,
    );
  }

  it('should create', () => {
    expect(createComponent(null)).toBeTruthy();
  });

  it('defaults every field to null/false when no dialogData is provided', () => {
    const component = createComponent(null);

    expect(component.isEdit).toBe(false);
    expect(component.data).toBeNull();
    expect(component.id).toBeNull();
    expect(component.parentId).toBeNull();
    expect(component.parentData).toBeUndefined();
  });

  it('populates edit state and parent linkage from dialogData', () => {
    const product = { id: 'p1' } as PurchaseOrderProduct;
    const parentData = { id: 'po1' };
    const component = createComponent({
      isEdit: true,
      data: product,
      id: 'p1',
      parentId: 'po1',
      parentData,
    });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(product);
    expect(component.id).toBe('p1');
    expect(component.parentId).toBe('po1');
    expect(component.parentData).toBe(parentData);
  });

  it('falls back to defaults when dialog data omits fields', () => {
    const component = createComponent({});

    expect(component.isEdit).toBe(false);
    expect(component.data).toBeNull();
    expect(component.id).toBeNull();
    expect(component.parentId).toBeNull();
    expect(component.parentData).toBeNull();
  });

  it('closes the dialog with null when close() is called', () => {
    const component = createComponent(null);
    component.close();

    expect(dialogRefMock.close).toHaveBeenCalledWith(null);
  });
});
