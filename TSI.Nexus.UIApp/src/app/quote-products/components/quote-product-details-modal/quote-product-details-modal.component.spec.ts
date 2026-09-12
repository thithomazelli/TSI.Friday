import { MatDialogRef } from '@angular/material/dialog';
import { QuoteProduct } from '@nexus/core';
import { QuoteProductDetailsModalComponent } from './quote-product-details-modal.component';

describe('QuoteProductDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: any = null): QuoteProductDetailsModalComponent {
    dialogRefMock = { close: vi.fn() };
    return new QuoteProductDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<QuoteProductDetailsModalComponent>,
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
    const quoteProduct = { id: 'qp1' } as QuoteProduct;
    const parentData = { id: 'q1' };
    const component = createComponent({
      isEdit: true,
      data: quoteProduct,
      id: 'qp1',
      parentId: 'q1',
      parentData,
    });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(quoteProduct);
    expect(component.id).toBe('qp1');
    expect(component.parentId).toBe('q1');
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
