import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, Passenger, WebApiResponse } from '@nexus/core';
import { PassengerService } from './passenger.service';

describe('PassengerService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): PassengerService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(PassengerService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getByTrip hits the expected endpoint', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getByTrip('t1');

    expect(apiServiceMock.get).toHaveBeenCalledWith('passengers/getByTrip/t1');
  });

  it('passengerChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.passengerChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/addRange/update/delete each notify passengerChanged$ after the request completes', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<Passenger>>();
    const addRangeResponse$ = new Subject<WebApiResponse<Passenger[]>>();
    const updateResponse$ = new Subject<WebApiResponse<Passenger>>();
    const deleteResponse$ = new Subject<WebApiResponse<Passenger>>();
    apiServiceMock.post.mockReturnValueOnce(addResponse$).mockReturnValueOnce(addRangeResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);

    let emissions = 0;
    service.passengerChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as Passenger).subscribe();
    addResponse$.next({} as WebApiResponse<Passenger>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.addRange([{} as Passenger]).subscribe();
    expect(apiServiceMock.post).toHaveBeenCalledWith('passengers/addRange', [{}]);
    addRangeResponse$.next({} as WebApiResponse<Passenger[]>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.update({} as Passenger).subscribe();
    updateResponse$.next({} as WebApiResponse<Passenger>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);

    service.delete({} as Passenger).subscribe();
    deleteResponse$.next({} as WebApiResponse<Passenger>);
    TestBed.flushEffects();
    expect(emissions).toBe(5);
  });
});
