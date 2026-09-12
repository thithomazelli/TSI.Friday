import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import {
  TranslationService,
  Trip,
  TripLegService,
  TripService,
  Vehicle,
  VehicleMaintenanceService,
  VehicleService,
  WebApiResponse,
} from '@nexus/core';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { VehicleDetailsPageComponent } from './vehicle-details-page.component';

describe('VehicleDetailsPageComponent', () => {
  let paramMap$: Subject<{ get: (key: string) => string | null }>;
  let activatedRouteMock: { paramMap: Subject<{ get: (key: string) => string | null }> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let vehicleServiceMock: { getById: ReturnType<typeof vi.fn>; vehicleChanged$: Subject<void> };
  let vehicleMaintenanceServiceMock: { maintenanceChanged$: Subject<void> };
  let tripServiceMock: { getByVehicleId: ReturnType<typeof vi.fn>; buildAgendaEvent: ReturnType<typeof vi.fn> };
  let tripLegServiceMock: { getByTrip: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let featureFlagServiceMock: { isEnabled: ReturnType<typeof vi.fn> };

  function createComponent(): VehicleDetailsPageComponent {
    paramMap$ = new Subject();
    activatedRouteMock = { paramMap: paramMap$ };
    translationServiceMock = { instant: vi.fn((key: string) => key) };
    vehicleServiceMock = { getById: vi.fn().mockReturnValue(new Subject()), vehicleChanged$: new Subject() };
    vehicleMaintenanceServiceMock = { maintenanceChanged$: new Subject() };
    tripServiceMock = {
      getByVehicleId: vi.fn().mockReturnValue(of({ data: [] } as unknown as WebApiResponse<Trip[]>)),
      buildAgendaEvent: vi.fn(),
    };
    tripLegServiceMock = { getByTrip: vi.fn() };
    routerMock = { navigateByUrl: vi.fn() };
    featureFlagServiceMock = { isEnabled: vi.fn().mockReturnValue(of(true)) };

    TestBed.configureTestingModule({});
    return TestBed.runInInjectionContext(
      () =>
        new VehicleDetailsPageComponent(
          activatedRouteMock as unknown as ActivatedRoute,
          translationServiceMock as unknown as TranslationService,
          vehicleServiceMock as unknown as VehicleService,
          vehicleMaintenanceServiceMock as unknown as VehicleMaintenanceService,
          tripServiceMock as unknown as TripService,
          tripLegServiceMock as unknown as TripLegService,
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
    it('sets isEdit=false for a new vehicle', () => {
      const component = createComponent();
      component.ngOnInit();

      paramMap$.next(paramMap('new'));

      expect(component.isEdit).toBe(false);
      expect(component.data).toBeNull();
    });

    it('loads an existing vehicle by id and its trip agenda events', () => {
      const component = createComponent();
      const response$ = new Subject<WebApiResponse<Vehicle>>();
      vehicleServiceMock.getById.mockReturnValue(response$);
      const trip = { id: 'trip1' } as Trip;
      tripServiceMock.getByVehicleId.mockReturnValue(of({ data: [trip] } as WebApiResponse<Trip[]>));
      tripLegServiceMock.getByTrip.mockReturnValue(of({ data: [] }));
      tripServiceMock.buildAgendaEvent.mockReturnValue({ id: 'agenda1' });

      component.ngOnInit();
      paramMap$.next(paramMap('v1'));

      expect(component.isEdit).toBe(true);
      expect(component.loading).toBe(true);
      expect(vehicleServiceMock.getById).toHaveBeenCalledWith('v1');

      const data = { id: 'v1' } as Vehicle;
      response$.next({ data } as WebApiResponse<Vehicle>);

      expect(component.loading).toBe(false);
      expect(component.data).toBe(data);
      expect(tripServiceMock.getByVehicleId).toHaveBeenCalledWith('v1');
      expect(component.tripAgendaEvents).toEqual([{ id: 'agenda1' }]);
    });

    it('navigates to not-found when the vehicle does not exist', () => {
      const component = createComponent();
      const response$ = new Subject<WebApiResponse<Vehicle>>();
      vehicleServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      paramMap$.next(paramMap('missing'));
      response$.next({ data: null } as unknown as WebApiResponse<Vehicle>);

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });

    it('navigates to not-found and stops loading when the request errors', () => {
      const component = createComponent();
      const response$ = new Subject<WebApiResponse<Vehicle>>();
      vehicleServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      paramMap$.next(paramMap('v1'));
      response$.error(new Error('fail'));

      expect(component.loading).toBe(false);
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });

    it('falls back to an empty trip list when the response has no data', () => {
      const component = createComponent();
      const response$ = new Subject<WebApiResponse<Vehicle>>();
      vehicleServiceMock.getById.mockReturnValue(response$);
      tripServiceMock.getByVehicleId.mockReturnValue(of({} as WebApiResponse<Trip[]>));

      component.ngOnInit();
      paramMap$.next(paramMap('v1'));
      response$.next({ data: { id: 'v1' } } as WebApiResponse<Vehicle>);

      expect(component.tripAgendaEvents).toEqual([]);
    });

    it('falls back to an empty leg list when building a trip agenda event', () => {
      const component = createComponent();
      const response$ = new Subject<WebApiResponse<Vehicle>>();
      vehicleServiceMock.getById.mockReturnValue(response$);
      const trip = { id: 'trip1' } as Trip;
      tripServiceMock.getByVehicleId.mockReturnValue(of({ data: [trip] } as WebApiResponse<Trip[]>));
      tripLegServiceMock.getByTrip.mockReturnValue(of({} as WebApiResponse<unknown>));
      tripServiceMock.buildAgendaEvent.mockReturnValue({ id: 'agenda1' });

      component.ngOnInit();
      paramMap$.next(paramMap('v1'));
      response$.next({ data: { id: 'v1' } } as WebApiResponse<Vehicle>);

      expect(tripServiceMock.buildAgendaEvent).toHaveBeenCalledWith(trip, []);
    });

    it('re-fetches on a real vehicleChanged$ event, but not on the skip(1)-dropped first one', () => {
      const component = createComponent();
      const firstResponse$ = new Subject<WebApiResponse<Vehicle>>();
      const secondResponse$ = new Subject<WebApiResponse<Vehicle>>();
      vehicleServiceMock.getById
        .mockReturnValueOnce(firstResponse$)
        .mockReturnValueOnce(secondResponse$);

      component.ngOnInit();
      paramMap$.next(paramMap('v1'));
      firstResponse$.next({ data: { id: 'v1' } } as WebApiResponse<Vehicle>);
      expect(vehicleServiceMock.getById).toHaveBeenCalledTimes(1);

      vehicleServiceMock.vehicleChanged$.next();
      expect(vehicleServiceMock.getById).toHaveBeenCalledTimes(1);

      vehicleServiceMock.vehicleChanged$.next();
      expect(vehicleServiceMock.getById).toHaveBeenCalledTimes(2);

      secondResponse$.next({ data: { id: 'v1' } } as WebApiResponse<Vehicle>);
      expect(component.data).toEqual({ id: 'v1' });
    });
  });

  describe('getStatusLabel', () => {
    it('returns an empty string when there is no data', () => {
      const component = createComponent();
      expect(component.getStatusLabel()).toBe('');
    });

    it('resolves the translated status label', () => {
      const component = createComponent();
      component.data = { status: 'Available' } as Vehicle;

      expect(component.getStatusLabel()).toBe('VEHICLES.STATUS_AVAILABLE');
    });

    it('falls back to an empty string for a status with no mapped label', () => {
      const component = createComponent();
      component.data = { status: 'Unknown' } as unknown as Vehicle;

      expect(component.getStatusLabel()).toBe('');
    });
  });

  it('ngOnDestroy does not throw', () => {
    const component = createComponent();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });

  it('ngOnDestroy also unsubscribes from vehicleChanged$/maintenanceChanged$ when editing an existing vehicle', () => {
    const component = createComponent();
    vehicleServiceMock.getById.mockReturnValue(new Subject());
    component.ngOnInit();
    paramMap$.next(paramMap('v1'));

    component.ngOnDestroy();
    vehicleServiceMock.getById.mockClear();
    vehicleServiceMock.vehicleChanged$.next();
    vehicleServiceMock.vehicleChanged$.next();

    expect(vehicleServiceMock.getById).not.toHaveBeenCalled();
  });
});
