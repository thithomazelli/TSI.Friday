import { of } from 'rxjs';
import { ModalService, Vehicle, VehicleService, VehicleStatus } from '@nexus/core';
import { VehicleBlockedNotificationComponent } from './vehicle-blocked-notification.component';

describe('VehicleBlockedNotificationComponent', () => {
  let vehicleServiceMock: { getAll: ReturnType<typeof vi.fn> };
  let modalServiceMock: { showTemplateModal: ReturnType<typeof vi.fn> };

  function createComponent() {
    vehicleServiceMock = { getAll: vi.fn().mockReturnValue(of({ data: [] })) };
    modalServiceMock = { showTemplateModal: vi.fn() };
    return new VehicleBlockedNotificationComponent(
      vehicleServiceMock as unknown as VehicleService,
      modalServiceMock as unknown as ModalService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('filters to only blocked vehicles on init', () => {
    const vehicles = [
      { id: 'v1', status: VehicleStatus.Blocked },
      { id: 'v2', status: VehicleStatus.Available },
      { id: 'v3', status: VehicleStatus.Blocked },
    ] as Vehicle[];
    const component = createComponent();
    vehicleServiceMock.getAll.mockReturnValue(of({ data: vehicles }));

    component.ngOnInit();

    expect(component.vehicles.map((v) => v.id)).toEqual(['v1', 'v3']);
    expect(component.total).toBe(2);
  });

  it('defaults to an empty list when the response has no data', () => {
    const component = createComponent();
    vehicleServiceMock.getAll.mockReturnValue(of({ data: null }));

    component.ngOnInit();

    expect(component.vehicles).toEqual([]);
    expect(component.total).toBe(0);
  });

  it('shows the badge only when there is at least one blocked vehicle', () => {
    const component = createComponent();
    expect(component.showBadge).toBe(false);

    component.total = 1;
    expect(component.showBadge).toBe(true);
  });

  it('opens the vehicle details modal in edit mode', () => {
    const component = createComponent();
    const vehicle = { id: 'v1' } as Vehicle;

    component.openVehicle(vehicle);

    expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
      expect.anything(),
      { isEdit: true, id: 'v1', data: vehicle },
    );
  });
});
