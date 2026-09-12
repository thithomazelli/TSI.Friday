// Instantiated directly - see driver-details-modal.component.spec.ts for why: the real
// TripFormComponent embedded in the template drags in its own DI tree via
// TestBed.createComponent(), which belongs to that component's own spec, not this modal's.
import { MatDialogRef } from '@angular/material/dialog';
import { Trip } from '@nexus/core';
import { TripDetailsModalComponent } from './trip-details-modal.component';

describe('TripDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: unknown) {
    dialogRefMock = { close: vi.fn() };
    return new TripDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<TripDetailsModalComponent>,
      dialogData,
    );
  }

  it('should create', () => {
    expect(createComponent(null)).toBeTruthy();
  });

  it('defaults to add mode with an empty trip when no dialogData is provided', () => {
    const component = createComponent(null);

    expect(component.isEdit).toBe(false);
    expect(component.data).toEqual({});
    expect(component.id).toBeNull();
  });

  it('populates edit state from dialogData', () => {
    const trip = { id: 't1' } as Trip;
    const component = createComponent({ isEdit: true, data: trip, id: 't1' });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(trip);
    expect(component.id).toBe('t1');
  });

  it('closes the dialog with null when close() is called', () => {
    const component = createComponent(null);
    component.close();

    expect(dialogRefMock.close).toHaveBeenCalledWith(null);
  });
});
