import { MatDialogRef } from '@angular/material/dialog';
import { Order } from '@nexus/core';
import { OrderDetailsModalComponent } from './order-details-modal.component';

describe('OrderDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: any = null): OrderDetailsModalComponent {
    dialogRefMock = { close: vi.fn() };
    return new OrderDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<OrderDetailsModalComponent>,
      dialogData,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('defaults to add mode with an empty order-products list when there is no dialog data', () => {
    const component = createComponent();

    expect(component.isEdit).toBe(false);
    expect(component.data).toEqual({ orderProducts: [] });
    expect(component.id).toBeNull();
  });

  it('initializes from dialog data in edit mode', () => {
    const order = { id: 'o1', orderProducts: [{ id: 'op1' }] } as unknown as Order;
    const component = createComponent({ isEdit: true, data: order, id: 'o1' });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(order);
    expect(component.id).toBe('o1');
  });

  describe('close', () => {
    it('closes the dialog with no result', () => {
      const component = createComponent();
      component.close();

      expect(dialogRefMock.close).toHaveBeenCalledWith(null);
    });
  });
});
