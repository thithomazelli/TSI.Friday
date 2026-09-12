import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, TripLeg, WebApiResponse } from '@nexus/core';
import { TripLegService } from './trip-leg.service';

describe('TripLegService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): TripLegService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(TripLegService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getByTrip hits the expected endpoint', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getByTrip('t1');

    expect(apiServiceMock.get).toHaveBeenCalledWith('triplegs/getByTrip/t1');
  });

  it('tripLegChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.tripLegChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each notify tripLegChanged$ after the request completes', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<TripLeg>>();
    const updateResponse$ = new Subject<WebApiResponse<TripLeg>>();
    const deleteResponse$ = new Subject<WebApiResponse<TripLeg>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);

    let emissions = 0;
    service.tripLegChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as TripLeg).subscribe();
    addResponse$.next({} as WebApiResponse<TripLeg>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.update({} as TripLeg).subscribe();
    updateResponse$.next({} as WebApiResponse<TripLeg>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as TripLeg).subscribe();
    deleteResponse$.next({} as WebApiResponse<TripLeg>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);
  });

  it('add/update/delete post to the expected endpoints with the given payload', () => {
    const service = createService();
    apiServiceMock.post.mockReturnValue(new Subject());
    apiServiceMock.put.mockReturnValue(new Subject());
    apiServiceMock.delete.mockReturnValue(new Subject());
    const tripLeg = { id: 'tl1' } as TripLeg;

    service.add(tripLeg).subscribe();
    expect(apiServiceMock.post).toHaveBeenCalledWith('triplegs/add', tripLeg);

    service.update(tripLeg).subscribe();
    expect(apiServiceMock.put).toHaveBeenCalledWith('triplegs/update', tripLeg);

    service.delete(tripLeg).subscribe();
    expect(apiServiceMock.delete).toHaveBeenCalledWith('triplegs/remove', tripLeg);
  });
});
