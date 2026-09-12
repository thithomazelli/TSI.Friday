import { MatDialogRef } from '@angular/material/dialog';
import { Address } from '@nexus/core';
import { AddressDetailsModalComponent } from './address-details-modal.component';

describe('AddressDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: any = null): AddressDetailsModalComponent {
    dialogRefMock = { close: vi.fn() };
    return new AddressDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<AddressDetailsModalComponent>,
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
  });

  it('initializes from dialog data in edit mode', () => {
    const address = { id: 'a1', street: 'Rua A' } as Address;
    const component = createComponent({
      isEdit: true,
      data: address,
      id: 'a1',
      parentId: 'bp1',
    });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(address);
    expect(component.id).toBe('a1');
    expect(component.parentId).toBe('bp1');
  });

  describe('close', () => {
    it('closes the dialog with no result', () => {
      const component = createComponent();
      component.close();

      expect(dialogRefMock.close).toHaveBeenCalledWith(null);
    });
  });
});
