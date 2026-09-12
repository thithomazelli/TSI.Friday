import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, QuoteTripLeg, WebApiResponse } from '@nexus/core';
import { QuoteTripLegService } from './quote-trip-leg.service';

describe('QuoteTripLegService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): QuoteTripLegService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(QuoteTripLegService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getByQuoteTrip hits the expected endpoint', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getByQuoteTrip('qt1');

    expect(apiServiceMock.get).toHaveBeenCalledWith('quotetriplegs/getByQuoteTrip/qt1');
  });

  it('quoteTripLegChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.quoteTripLegChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each notify quoteTripLegChanged$ after the request completes', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<QuoteTripLeg>>();
    const updateResponse$ = new Subject<WebApiResponse<QuoteTripLeg>>();
    const deleteResponse$ = new Subject<WebApiResponse<QuoteTripLeg>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);

    let emissions = 0;
    service.quoteTripLegChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();
    expect(emissions).toBe(1);

    service.add({} as QuoteTripLeg).subscribe();
    addResponse$.next({} as WebApiResponse<QuoteTripLeg>);
    TestBed.flushEffects();
    expect(emissions).toBe(2);

    service.update({} as QuoteTripLeg).subscribe();
    updateResponse$.next({} as WebApiResponse<QuoteTripLeg>);
    TestBed.flushEffects();
    expect(emissions).toBe(3);

    service.delete({} as QuoteTripLeg).subscribe();
    deleteResponse$.next({} as WebApiResponse<QuoteTripLeg>);
    TestBed.flushEffects();
    expect(emissions).toBe(4);
  });
});
