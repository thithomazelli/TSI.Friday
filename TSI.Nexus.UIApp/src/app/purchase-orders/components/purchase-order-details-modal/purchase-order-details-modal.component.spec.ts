// Instantiated directly - see driver-details-modal.component.spec.ts for why: the real
// PurchaseOrderFormComponent embedded in the template drags in its own DI tree via
// TestBed.createComponent(), which belongs to that component's own spec, not this modal's.
import { MatDialogRef } from '@angular/material/dialog';
import { PurchaseOrder } from '@nexus/core';
import { PurchaseOrderDetailsModalComponent } from './purchase-order-details-modal.component';

describe('PurchaseOrderDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: unknown) {
    dialogRefMock = { close: vi.fn() };
    return new PurchaseOrderDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<PurchaseOrderDetailsModalComponent>,
      dialogData,
    );
  }

  it('should create', () => {
    expect(createComponent(null)).toBeTruthy();
  });

  it('defaults to add mode with an empty purchase order when no dialogData is provided', () => {
    const component = createComponent(null);

    expect(component.isEdit).toBe(false);
    expect(component.data).toEqual({ purchaseOrderProducts: [] });
    expect(component.id).toBeNull();
    expect(component.preselectedProductId).toBeNull();
  });

  it('populates edit state and preselectedProductId from dialogData', () => {
    const order = { id: 'po1', purchaseOrderProducts: [] } as PurchaseOrder;
    const component = createComponent({
      isEdit: true,
      data: order,
      id: 'po1',
      preselectedProductId: 'prod-1',
    });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(order);
    expect(component.id).toBe('po1');
    expect(component.preselectedProductId).toBe('prod-1');
  });

  it('falls back to defaults when dialog data omits fields', () => {
    const component = createComponent({});

    expect(component.isEdit).toBe(false);
    expect(component.data).toEqual({ purchaseOrderProducts: [] });
    expect(component.id).toBeNull();
    expect(component.preselectedProductId).toBeNull();
  });

  it('closes the dialog with null when close() is called', () => {
    const component = createComponent(null);
    component.close();

    expect(dialogRefMock.close).toHaveBeenCalledWith(null);
  });
});
