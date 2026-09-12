// Instantiated directly - see driver-details-modal.component.spec.ts for why: the real
// EventFormComponent embedded in the template drags in its own DI tree via
// TestBed.createComponent(), which belongs to that component's own spec, not this modal's.
import { MatDialogRef } from '@angular/material/dialog';
import { AgendaEvent } from '@nexus/core';
import { EventDetailsModalComponent } from './event-details-modal.component';

describe('EventDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: unknown) {
    dialogRefMock = { close: vi.fn() };
    return new EventDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<EventDetailsModalComponent>,
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
    expect(component.prefillStart).toBeNull();
    expect(component.prefillEnd).toBeNull();
    expect(component.lockedLinkField).toBeNull();
    expect(component.lockedLinkId).toBeNull();
    expect(component.lockedLinkLabel).toBeNull();
  });

  it('populates edit state and prefill/lock fields from dialogData', () => {
    const event = { id: 'e1' } as AgendaEvent;
    const prefillStart = new Date(2024, 0, 1);
    const prefillEnd = new Date(2024, 0, 2);
    const component = createComponent({
      isEdit: true,
      data: event,
      prefillStart,
      prefillEnd,
      lockedLinkField: 'tripId',
      lockedLinkId: 't1',
      lockedLinkLabel: 'Trip 1',
    });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(event);
    expect(component.prefillStart).toBe(prefillStart);
    expect(component.prefillEnd).toBe(prefillEnd);
    expect(component.lockedLinkField).toBe('tripId');
    expect(component.lockedLinkId).toBe('t1');
    expect(component.lockedLinkLabel).toBe('Trip 1');
  });

  it('falls back to defaults when dialog data omits fields', () => {
    const component = createComponent({});

    expect(component.isEdit).toBe(false);
    expect(component.data).toBeNull();
    expect(component.prefillStart).toBeNull();
    expect(component.prefillEnd).toBeNull();
    expect(component.lockedLinkField).toBeNull();
    expect(component.lockedLinkId).toBeNull();
    expect(component.lockedLinkLabel).toBeNull();
  });

  it('closes the dialog with null when close() is called', () => {
    const component = createComponent(null);
    component.close();

    expect(dialogRefMock.close).toHaveBeenCalledWith(null);
  });
});
