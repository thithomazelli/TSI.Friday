// Instantiated directly - see driver-details-modal.component.spec.ts for why: the real
// TripDriverFormComponent embedded in the template drags in its own DI tree via
// TestBed.createComponent(), which belongs to that component's own spec, not this modal's.
import { MatDialogRef } from '@angular/material/dialog';
import { TripDriver } from '@nexus/core';
import { TripDriverDetailsModalComponent } from './trip-driver-details-modal.component';

describe('TripDriverDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: unknown) {
    dialogRefMock = { close: vi.fn() };
    return new TripDriverDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<TripDriverDetailsModalComponent>,
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
    const tripDriver = { id: 'td1' } as TripDriver;
    const parentData = { id: 'trip1' };
    const component = createComponent({
      isEdit: true,
      data: tripDriver,
      id: 'td1',
      parentId: 'trip1',
      parentData,
    });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(tripDriver);
    expect(component.id).toBe('td1');
    expect(component.parentId).toBe('trip1');
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
