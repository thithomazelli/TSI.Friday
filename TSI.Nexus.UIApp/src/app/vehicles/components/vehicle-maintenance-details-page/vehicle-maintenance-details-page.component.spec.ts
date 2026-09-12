import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { TranslationService, VehicleMaintenance, VehicleMaintenanceService, WebApiResponse } from '@nexus/core';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { VehicleMaintenanceDetailsPageComponent } from './vehicle-maintenance-details-page.component';

describe('VehicleMaintenanceDetailsPageComponent', () => {
  let paramMap$: Subject<{ get: (key: string) => string | null }>;
  let activatedRouteMock: { paramMap: Subject<{ get: (key: string) => string | null }> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let vehicleMaintenanceServiceMock: { getById: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let featureFlagServiceMock: { isEnabled: ReturnType<typeof vi.fn> };

  function createComponent(): VehicleMaintenanceDetailsPageComponent {
    paramMap$ = new Subject();
    activatedRouteMock = { paramMap: paramMap$ };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    vehicleMaintenanceServiceMock = { getById: vi.fn().mockReturnValue(new Subject()) };
    routerMock = { navigateByUrl: vi.fn() };
    featureFlagServiceMock = { isEnabled: vi.fn().mockReturnValue(of(true)) };

    TestBed.configureTestingModule({});
    return TestBed.runInInjectionContext(
      () =>
        new VehicleMaintenanceDetailsPageComponent(
          activatedRouteMock as unknown as ActivatedRoute,
          translationServiceMock as unknown as TranslationService,
          vehicleMaintenanceServiceMock as unknown as VehicleMaintenanceService,
          routerMock as unknown as Router,
          featureFlagServiceMock as unknown as FeatureFlagService,
        ),
    );
  }

  function paramMap(id: string | null) {
    return { get: (key: string) => (key === 'id' ? id : null) };
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('isAgendaEnabled combines the group and entity flags', () => {
    const component = createComponent();
    expect(component.isAgendaEnabled()).toBe(true);
  });

  describe('ngOnInit', () => {
    it('navigates to not-found when there is no id param', () => {
      const component = createComponent();
      component.ngOnInit();

      paramMap$.next(paramMap(null));

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });

    it('loads an existing maintenance by id', () => {
      const component = createComponent();
      const response$ = new Subject<WebApiResponse<VehicleMaintenance>>();
      vehicleMaintenanceServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      paramMap$.next(paramMap('vm1'));

      expect(component.loading).toBe(true);
      expect(vehicleMaintenanceServiceMock.getById).toHaveBeenCalledWith('vm1');

      const data = { id: 'vm1' } as VehicleMaintenance;
      response$.next({ data } as WebApiResponse<VehicleMaintenance>);

      expect(component.loading).toBe(false);
      expect(component.data).toBe(data);
    });

    it('navigates to not-found when the maintenance does not exist', () => {
      const component = createComponent();
      const response$ = new Subject<WebApiResponse<VehicleMaintenance>>();
      vehicleMaintenanceServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      paramMap$.next(paramMap('missing'));
      response$.next({ data: null } as unknown as WebApiResponse<VehicleMaintenance>);

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });
  });

  describe('getStatusInfo', () => {
    it('returns an empty label with a secondary color when there is no data', () => {
      const component = createComponent();
      expect(component.getStatusInfo()).toEqual({ label: '', color: 'secondary' });
    });

    it('resolves label and color for a known status', () => {
      const component = createComponent();
      component.data = { status: 'Completed' } as VehicleMaintenance;

      expect(component.getStatusInfo()).toEqual({
        label: 'VEHICLES.MAINTENANCE_COMPLETED',
        color: 'success',
      });
    });

    it('falls back to the raw status for an unknown value', () => {
      const component = createComponent();
      component.data = { status: 'SomethingElse' } as unknown as VehicleMaintenance;

      expect(component.getStatusInfo()).toEqual({ label: 'SomethingElse', color: 'secondary' });
    });
  });

  it('ngOnDestroy does not throw', () => {
    const component = createComponent();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });
});
