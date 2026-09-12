import { MatDialogRef } from '@angular/material/dialog';
import { Transaction } from '@nexus/core';
import { TransactionDetailsModalComponent } from './transaction-details-modal.component';

describe('TransactionDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: any = null): TransactionDetailsModalComponent {
    dialogRefMock = { close: vi.fn() };
    return new TransactionDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<TransactionDetailsModalComponent>,
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
    const transaction = { id: 't1' } as Transaction;
    const component = createComponent({ isEdit: true, data: transaction, id: 't1' });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(transaction);
    expect(component.id).toBe('t1');
  });

  describe('close', () => {
    it('closes the dialog with no result', () => {
      const component = createComponent();
      component.close();

      expect(dialogRefMock.close).toHaveBeenCalledWith(null);
    });
  });
});
