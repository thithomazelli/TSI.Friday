import { MatDialogRef } from '@angular/material/dialog';
import { Payment } from '@nexus/core';
import { PaymentDetailsModalComponent } from './payment-details-modal.component';

describe('PaymentDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: any = null): PaymentDetailsModalComponent {
    dialogRefMock = { close: vi.fn() };
    return new PaymentDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<PaymentDetailsModalComponent>,
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
    const payment = { id: 'p1' } as Payment;
    const parentData = { id: 't1' };
    const component = createComponent({
      isEdit: true,
      data: payment,
      id: 'p1',
      parentId: 't1',
      parentData,
    });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(payment);
    expect(component.id).toBe('p1');
    expect(component.parentId).toBe('t1');
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
