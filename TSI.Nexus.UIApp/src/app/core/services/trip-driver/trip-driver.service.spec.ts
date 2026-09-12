import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, ResponseStatus, TripDriver, WebApiResponse } from '@nexus/core';
import { TripDriverService } from './trip-driver.service';

describe('TripDriverService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): TripDriverService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(TripDriverService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getByTripId/getByDriverId hit the expected endpoints', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getByTripId('t1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('tripdrivers/getByTripId/t1');

    service.getByDriverId('d1');
    expect(apiServiceMock.get).toHaveBeenCalledWith('tripdrivers/getByDriverId/d1');
  });

  it('tripDriverChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.tripDriverChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each notify tripDriverChanged$ after the request completes', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<TripDriver>>();
    const updateResponse$ = new Subject<WebApiResponse<TripDriver>>();
    const deleteResponse$ = new Subject<WebApiResponse<TripDriver>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);

    let emissions = 0;
    service.tripDriverChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as TripDriver).subscribe();
    addResponse$.next({} as WebApiResponse<TripDriver>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.update({} as TripDriver).subscribe();
    updateResponse$.next({} as WebApiResponse<TripDriver>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as TripDriver).subscribe();
    deleteResponse$.next({} as WebApiResponse<TripDriver>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);
  });

  describe('addTemporary', () => {
    it('emits the item on tripDriverAdded$ and returns a synthetic success response', () => {
      const service = createService();
      const item = { id: 'td1' } as TripDriver;
      let added: TripDriver | undefined;
      service.tripDriverAdded$.subscribe((v) => (added = v));

      let response: WebApiResponse<TripDriver> | undefined;
      service.addTemporary(item).subscribe((v) => (response = v));

      expect(added).toBe(item);
      expect(response?.status).toBe(ResponseStatus.Success);
      expect(response?.data).toBe(item);
      expect(apiServiceMock.post).not.toHaveBeenCalled();
    });

    it('does not notify tripDriverChanged$ (it is not a persisted change)', () => {
      const service = createService();
      let emissions = 0;
      service.tripDriverChanged$.subscribe(() => emissions++);
      TestBed.flushEffects();
      expect(emissions).toBe(1);

      service.addTemporary({} as TripDriver).subscribe();
      TestBed.flushEffects();

      expect(emissions).toBe(1);
    });
  });
});
