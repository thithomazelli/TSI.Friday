// Instantiated directly - see driver-details-modal.component.spec.ts for why: the real
// FuelLogFormComponent embedded in the template drags in its own DI tree via
// TestBed.createComponent(), which belongs to that component's own spec, not this modal's.
import { MatDialogRef } from '@angular/material/dialog';
import { FuelLog } from '@nexus/core';
import { FuelLogDetailsModalComponent } from './fuel-log-details-modal.component';

describe('FuelLogDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: unknown) {
    dialogRefMock = { close: vi.fn() };
    return new FuelLogDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<FuelLogDetailsModalComponent>,
      dialogData,
    );
  }

  it('should create', () => {
    expect(createComponent(null)).toBeTruthy();
  });

  it('defaults to add mode with no data/vehicleId when no dialogData is provided', () => {
    const component = createComponent(null);

    expect(component.isEdit).toBe(false);
    expect(component.data).toBeNull();
    expect(component.vehicleId).toBe('');
  });

  it('derives isEdit from whether the fuel log data has an id', () => {
    const fuelLog = { id: 'fl1' } as FuelLog;
    const component = createComponent({ data: fuelLog, vehicleId: 'v1' });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(fuelLog);
    expect(component.vehicleId).toBe('v1');
  });

  it('is not in edit mode when the provided data has no id', () => {
    const component = createComponent({ data: {} as FuelLog, vehicleId: 'v1' });

    expect(component.isEdit).toBe(false);
  });

  it('closes the dialog with null when close() is called', () => {
    const component = createComponent(null);
    component.close();

    expect(dialogRefMock.close).toHaveBeenCalledWith(null);
  });
});
