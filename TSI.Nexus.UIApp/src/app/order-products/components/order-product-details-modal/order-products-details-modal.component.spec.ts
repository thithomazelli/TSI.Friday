import { MatDialogRef } from '@angular/material/dialog';
import { OrderProduct } from '@nexus/core';
import { OrderProductsDetailsModalComponent } from './order-products-details-modal.component';

describe('OrderProductsDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: any = null): OrderProductsDetailsModalComponent {
    dialogRefMock = { close: vi.fn() };
    return new OrderProductsDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<OrderProductsDetailsModalComponent>,
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
    expect(component.parentId).toBeNull();
    expect(component.parentData).toBeUndefined();
  });

  it('initializes from dialog data in edit mode', () => {
    const orderProduct = { id: 'op1' } as OrderProduct;
    const parentData = { id: 'o1' };
    const component = createComponent({
      isEdit: true,
      data: orderProduct,
      id: 'op1',
      parentId: 'o1',
      parentData,
    });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(orderProduct);
    expect(component.id).toBe('op1');
    expect(component.parentId).toBe('o1');
    expect(component.parentData).toBe(parentData);
  });

  describe('close', () => {
    it('closes the dialog with no result', () => {
      const component = createComponent();
      component.close();

      expect(dialogRefMock.close).toHaveBeenCalledWith(null);
    });
  });
});
