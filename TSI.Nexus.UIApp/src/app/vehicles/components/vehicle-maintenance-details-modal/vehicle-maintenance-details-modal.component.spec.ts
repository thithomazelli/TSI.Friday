// Instantiated directly - see driver-details-modal.component.spec.ts for why: the real
// VehicleMaintenanceFormComponent embedded in the template drags in its own DI tree via
// TestBed.createComponent(), which belongs to that component's own spec, not this modal's.
import { MatDialogRef } from '@angular/material/dialog';
import { VehicleMaintenance } from '@nexus/core';
import { VehicleMaintenanceDetailsModalComponent } from './vehicle-maintenance-details-modal.component';

describe('VehicleMaintenanceDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: unknown) {
    dialogRefMock = { close: vi.fn() };
    return new VehicleMaintenanceDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<VehicleMaintenanceDetailsModalComponent>,
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

  it('derives isEdit from whether the maintenance data has an id', () => {
    const maintenance = { id: 'vm1' } as VehicleMaintenance;
    const component = createComponent({ data: maintenance, vehicleId: 'v1' });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(maintenance);
    expect(component.vehicleId).toBe('v1');
  });

  it('is not in edit mode when the provided data has no id', () => {
    const component = createComponent({ data: {} as VehicleMaintenance, vehicleId: 'v1' });

    expect(component.isEdit).toBe(false);
  });

  it('closes the dialog with null when close() is called', () => {
    const component = createComponent(null);
    component.close();

    expect(dialogRefMock.close).toHaveBeenCalledWith(null);
  });
});
