import { of } from 'rxjs';
import { Driver, DriverService, ModalService } from '@nexus/core';
import { DriverLicenseNotificationComponent } from './driver-license-notification.component';

describe('DriverLicenseNotificationComponent', () => {
  let driverServiceMock: { getExpiringLicenses: ReturnType<typeof vi.fn> };
  let modalServiceMock: { showTemplateModal: ReturnType<typeof vi.fn> };

  function createComponent() {
    driverServiceMock = { getExpiringLicenses: vi.fn().mockReturnValue(of({ data: [] })) };
    modalServiceMock = { showTemplateModal: vi.fn() };
    return new DriverLicenseNotificationComponent(
      driverServiceMock as unknown as DriverService,
      modalServiceMock as unknown as ModalService,
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('loads expiring licenses on init and updates total/drivers', () => {
    const drivers = [{ id: 'd1' }, { id: 'd2' }] as Driver[];
    const component = createComponent();
    driverServiceMock.getExpiringLicenses.mockReturnValue(of({ data: drivers }));

    component.ngOnInit();

    expect(component.drivers).toBe(drivers);
    expect(component.total).toBe(2);
  });

  it('defaults to an empty list when the response has no data', () => {
    const component = createComponent();
    driverServiceMock.getExpiringLicenses.mockReturnValue(of({ data: null }));

    component.ngOnInit();

    expect(component.drivers).toEqual([]);
    expect(component.total).toBe(0);
  });

  it('shows the badge only when there is at least one driver', () => {
    const component = createComponent();
    expect(component.showBadge).toBe(false);

    component.total = 1;
    expect(component.showBadge).toBe(true);
  });

  it('treats a past license expiry date as expired', () => {
    const component = createComponent();
    const driver = { licenseExpiryDate: new Date(2000, 0, 1) } as Driver;

    expect(component.isExpired(driver)).toBe(true);
  });

  it('treats a future license expiry date as not expired', () => {
    const component = createComponent();
    const driver = { licenseExpiryDate: new Date(2999, 0, 1) } as Driver;

    expect(component.isExpired(driver)).toBe(false);
  });

  it('opens the driver details modal in edit mode', () => {
    const component = createComponent();
    const driver = { id: 'd1' } as Driver;

    component.openDriver(driver);

    expect(modalServiceMock.showTemplateModal).toHaveBeenCalledWith(
      expect.anything(),
      { isEdit: true, id: 'd1', data: driver },
    );
  });
});
