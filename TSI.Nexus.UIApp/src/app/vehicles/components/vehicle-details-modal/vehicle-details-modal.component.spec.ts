// Instantiated directly - see driver-details-modal.component.spec.ts for why: the real
// VehicleFormComponent embedded in the template drags in its own DI tree via
// TestBed.createComponent(), which belongs to that component's own spec, not this modal's.
import { MatDialogRef } from '@angular/material/dialog';
import { TranslationService, Vehicle } from '@nexus/core';
import { VehicleDetailsModalComponent } from './vehicle-details-modal.component';

describe('VehicleDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: unknown) {
    dialogRefMock = { close: vi.fn() };
    translationServiceMock = {
      instant: vi.fn((key: string, params?: Record<string, string>) => {
        if (key === 'COMMON.ADD_ENTITY') return `Adicionar ${params?.['entity']}`;
        if (key === 'COMMON.EDIT_ENTITY') return `Editar ${params?.['entity']}`;
        if (key === 'VEHICLES.SINGULAR') return 'Veículo';
        return key;
      }),
    };
    return new VehicleDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<VehicleDetailsModalComponent>,
      dialogData,
      translationServiceMock as unknown as TranslationService,
    );
  }

  it('should create', () => {
    expect(createComponent(null)).toBeTruthy();
  });

  it('defaults to add mode with an empty vehicle when no dialogData is provided', () => {
    const component = createComponent(null);

    expect(component.isEdit).toBe(false);
    expect(component.data).toEqual({});
    expect(component.id).toBeNull();
  });

  it('populates edit state from dialogData', () => {
    const vehicle = { id: 'v1', plate: 'ABC1234' } as Vehicle;
    const component = createComponent({ isEdit: true, data: vehicle, id: 'v1' });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(vehicle);
    expect(component.id).toBe('v1');
  });

  it('sets the add title (translated) on init when not editing', () => {
    const component = createComponent(null);
    component.ngOnInit();

    expect(component.title).toBe('Adicionar Veículo');
  });

  it('sets the edit title (translated) on init when editing', () => {
    const component = createComponent({ isEdit: true, data: {}, id: 'v1' });
    component.ngOnInit();

    expect(component.title).toBe('Editar Veículo');
  });

  it('closes the dialog with null when close() is called', () => {
    const component = createComponent(null);
    component.close();

    expect(dialogRefMock.close).toHaveBeenCalledWith(null);
  });
});
