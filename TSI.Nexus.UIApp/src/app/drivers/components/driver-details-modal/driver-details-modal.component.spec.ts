// Instantiated directly (no TestBed/fixture): the component's template embeds the real
// DriverFormComponent, whose own dependency tree (ngx-mask config, reference-data services, etc.)
// gets constructed as soon as TestBed.createComponent() builds the view - dragging in dependencies
// that belong to DriverFormComponent's own spec, not this modal's. This class has no Angular DI
// beyond its constructor params, so plain `new` exercises 100% of its real logic without any of
// that.
import { Driver } from '@nexus/core';
import { MatDialogRef } from '@angular/material/dialog';
import { DriverDetailsModalComponent } from './driver-details-modal.component';

describe('DriverDetailsModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };

  function createComponent(dialogData: unknown) {
    dialogRefMock = { close: vi.fn() };
    return new DriverDetailsModalComponent(
      dialogRefMock as unknown as MatDialogRef<DriverDetailsModalComponent>,
      dialogData,
    );
  }

  it('should create', () => {
    expect(createComponent(null)).toBeTruthy();
  });

  it('defaults to add mode with an empty driver when no dialogData is provided', () => {
    const component = createComponent(null);

    expect(component.isEdit).toBe(false);
    expect(component.data).toEqual({});
    expect(component.id).toBeNull();
  });

  it('populates edit state from dialogData', () => {
    const driver = { id: 'd1', name: 'Ana' } as Driver;
    const component = createComponent({ isEdit: true, data: driver, id: 'd1' });

    expect(component.isEdit).toBe(true);
    expect(component.data).toBe(driver);
    expect(component.id).toBe('d1');
  });

  it('sets the add title on init when not editing', () => {
    const component = createComponent(null);
    component.ngOnInit();

    expect(component.title).toBe('Adicionar Motorista');
  });

  it('sets the edit title on init when editing', () => {
    const component = createComponent({ isEdit: true, data: {}, id: 'd1' });
    component.ngOnInit();

    expect(component.title).toBe('Editar Motorista');
  });

  it('closes the dialog with null when close() is called', () => {
    const component = createComponent(null);
    component.close();

    expect(dialogRefMock.close).toHaveBeenCalledWith(null);
  });
});
