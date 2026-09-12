import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, Trip, TripLeg, WebApiResponse } from '@nexus/core';
import { TripService } from './trip.service';

describe('TripService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getBlob: ReturnType<typeof vi.fn>;
  };

  function createService(): TripService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), getBlob: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(TripService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getAll/getById/getByBusinessPartnerId/getByDriverId/getByVehicleId hit the expected endpoints', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getAll();
    expect(apiServiceMock.get).toHaveBeenCalledWith('trips/getAll');

    service.getById('t1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('trips/getById/t1');

    service.getByBusinessPartnerId('bp1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('trips/getByBusinessPartnerId/bp1');

    service.getByDriverId('d1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('trips/getByDriverId/d1');

    service.getByVehicleId('v1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('trips/getByVehicleId/v1');
  });

  it('getAllPaged builds the query string and unwraps response.data', () => {
    const service = createService();
    const paged$ = new Subject<WebApiResponse<{ items: Trip[] }>>();
    apiServiceMock.get.mockReturnValue(paged$);

    let result: unknown;
    service.getAllPaged({ page: 1, pageSize: 20 }).subscribe((v) => (result = v));
    paged$.next({ data: { items: [] } } as unknown as WebApiResponse<{ items: Trip[] }>);

    expect(apiServiceMock.get).toHaveBeenCalledWith('trips/getAllPaged?page=1&pageSize=20');
    expect(result).toEqual({ items: [] });
  });

  it('getContractPdf and getServiceOrderPdf fetch a blob from the expected endpoints', () => {
    const service = createService();
    apiServiceMock.getBlob.mockReturnValue(new Subject());

    service.getContractPdf('t1');
    expect(apiServiceMock.getBlob).toHaveBeenCalledWith('trips/t1/ContractPdf');

    service.getServiceOrderPdf('t1');
    expect(apiServiceMock.getBlob).toHaveBeenCalledWith('trips/t1/ServiceOrderPdf');
  });

  it('refreshTrips delegates to getAll', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.refreshTrips();

    expect(apiServiceMock.get).toHaveBeenCalledWith('trips/getAll');
  });

  it('tripChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.tripChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each notify tripChanged$ after the request completes', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<Trip>>();
    const updateResponse$ = new Subject<WebApiResponse<Trip>>();
    const deleteResponse$ = new Subject<WebApiResponse<Trip>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);

    let emissions = 0;
    service.tripChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as Trip).subscribe();
    addResponse$.next({} as WebApiResponse<Trip>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.update({} as Trip).subscribe();
    updateResponse$.next({} as WebApiResponse<Trip>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as Trip).subscribe();
    deleteResponse$.next({} as WebApiResponse<Trip>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);
  });

  describe('buildAgendaEvent', () => {
    function leg(overrides: Partial<TripLeg> = {}): TripLeg {
      return {
        sequenceNumber: 1,
        departureDate: new Date('2024-01-01T08:00:00'),
        arrivalDate: new Date('2024-01-01T10:00:00'),
        ...overrides,
      } as TripLeg;
    }

    it('spans from the first departure to the last arrival, by sequence', () => {
      const service = createService();
      const trip = { id: 't1', tripNumber: 'T-001', route: 'SP-RJ' } as Trip;
      const legs = [
        leg({
          sequenceNumber: 2,
          departureDate: new Date('2024-01-02T08:00:00'),
          arrivalDate: new Date('2024-01-02T12:00:00'),
        }),
        leg({
          sequenceNumber: 1,
          departureDate: new Date('2024-01-01T08:00:00'),
          arrivalDate: new Date('2024-01-01T10:00:00'),
        }),
      ];

      const event = service.buildAgendaEvent(trip, legs);

      expect(event.startDate).toEqual(new Date('2024-01-01T08:00:00'));
      expect(event.endDate).toEqual(new Date('2024-01-02T12:00:00'));
      expect(event.title).toBe('T-001 - SP-RJ');
      expect(event.tripId).toBe('t1');
      expect(event.readOnly).toBe(true);
    });

    it('falls back to the trip date when there are no legs with valid dates', () => {
      const service = createService();
      const trip = { id: 't1', tripNumber: 'T-001', date: new Date('2024-05-01T00:00:00') } as unknown as Trip;

      const event = service.buildAgendaEvent(trip, []);

      expect(event.startDate).toEqual(new Date('2024-05-01T00:00:00'));
      expect(event.endDate).toEqual(new Date('2024-05-01T00:00:00'));
      expect(event.title).toBe('T-001');
    });

    it('uses departureDate as the arrival fallback when arrivalDate is missing', () => {
      const service = createService();
      const trip = { id: 't1', tripNumber: 'T-001' } as Trip;
      const legs = [leg({ arrivalDate: undefined as unknown as Date })];

      const event = service.buildAgendaEvent(trip, legs);

      expect(event.endDate).toEqual(event.startDate);
    });
  });
});
