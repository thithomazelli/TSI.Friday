import { MatDialogRef } from '@angular/material/dialog';
import { Quote } from '@nexus/core';
import { QuoteDetailsModalComponent } from './quote-details-modal.component';

describe('QuoteDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: any = null): QuoteDetailsModalComponent {
    dialogRefMock = { close: vi.fn() };
    return new QuoteDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<QuoteDetailsModalComponent>,
      dialogData,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('defaults to add mode with an empty quote-products list when there is no dialog data', () => {
    const component = createComponent();

    expect(component.isEdit).toBe(false);
    expect(component.data).toEqual({ quoteProducts: [] });
    expect(component.id).toBeNull();
  });

  it('initializes from dialog data in edit mode', () => {
    const quote = { id: 'q1', quoteProducts: [{ id: 'qp1' }] } as unknown as Quote;
    const component = createComponent({ isEdit: true, data: quote, id: 'q1' });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(quote);
    expect(component.id).toBe('q1');
  });

  describe('close', () => {
    it('closes the dialog with no result', () => {
      const component = createComponent();
      component.close();

      expect(dialogRefMock.close).toHaveBeenCalledWith(null);
    });
  });
});
