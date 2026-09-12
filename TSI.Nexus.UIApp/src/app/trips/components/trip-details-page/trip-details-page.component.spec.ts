import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import {
  ModalService,
  PaymentService,
  TranslationService,
  Trip,
  TripService,
  WebApiResponse,
} from '@nexus/core';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { TripDetailsPageComponent } from './trip-details-page.component';

describe('TripDetailsPageComponent', () => {
  let activatedRouteMock: { snapshot: { paramMap: { get: ReturnType<typeof vi.fn> } } };
  let tripServiceMock: {
    getById: ReturnType<typeof vi.fn>;
    getContractPdf: ReturnType<typeof vi.fn>;
    getServiceOrderPdf: ReturnType<typeof vi.fn>;
    tripChanged$: Subject<void>;
  };
  let paymentServiceMock: { paymentChanged$: Subject<void> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let featureFlagServiceMock: { isEnabled: ReturnType<typeof vi.fn> };
  let modalServiceMock: { showPdfProgress: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let progressHandle: { setIndeterminate: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  function createComponent(id: string | null): TripDetailsPageComponent {
    activatedRouteMock = { snapshot: { paramMap: { get: vi.fn().mockReturnValue(id) } } };
    tripServiceMock = {
      getById: vi.fn().mockReturnValue(new Subject()),
      getContractPdf: vi.fn(),
      getServiceOrderPdf: vi.fn(),
      tripChanged$: new Subject(),
    };
    paymentServiceMock = { paymentChanged$: new Subject() };
    routerMock = { navigateByUrl: vi.fn() };
    featureFlagServiceMock = { isEnabled: vi.fn().mockReturnValue(of(true)) };
    progressHandle = { setIndeterminate: vi.fn(), success: vi.fn(), error: vi.fn() };
    modalServiceMock = { showPdfProgress: vi.fn().mockReturnValue(progressHandle) };
    translationServiceMock = { instant: vi.fn((key: string) => key) };

    TestBed.configureTestingModule({});
    return TestBed.runInInjectionContext(
      () =>
        new TripDetailsPageComponent(
          activatedRouteMock as unknown as ActivatedRoute,
          tripServiceMock as unknown as TripService,
          paymentServiceMock as unknown as PaymentService,
          routerMock as unknown as Router,
          featureFlagServiceMock as unknown as FeatureFlagService,
          modalServiceMock as unknown as ModalService,
          translationServiceMock as unknown as TranslationService,
        ),
    );
  }

  it('should create', () => {
    expect(createComponent(null)).toBeTruthy();
  });

  it('isAgendaEnabled combines the group and entity flags', () => {
    const component = createComponent(null);
    expect(component.isAgendaEnabled()).toBe(true);
  });

  describe('ngOnInit', () => {
    it('sets isEdit=false and defaults data to {} for a new trip', () => {
      const component = createComponent(null);
      component.ngOnInit();

      expect(component.isEdit).toBe(false);
      expect(component.data).toEqual({});
    });

    it('loads an existing trip by id', () => {
      const component = createComponent('t1');
      const response$ = new Subject<WebApiResponse<Trip>>();
      tripServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      expect(component.loading).toBe(true);
      expect(tripServiceMock.getById).toHaveBeenCalledWith('t1');

      const data = { id: 't1' } as Trip;
      response$.next({ data } as WebApiResponse<Trip>);

      expect(component.loading).toBe(false);
      expect(component.data).toBe(data);
    });

    it('navigates to not-found when the trip does not exist', () => {
      const component = createComponent('missing');
      const response$ = new Subject<WebApiResponse<Trip>>();
      tripServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      response$.next({ data: null } as unknown as WebApiResponse<Trip>);

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });

    it('re-fetches on a real paymentChanged$ event, but not on the skip(1)-dropped first one', () => {
      const component = createComponent('t1');
      const firstResponse$ = new Subject<WebApiResponse<Trip>>();
      const secondResponse$ = new Subject<WebApiResponse<Trip>>();
      tripServiceMock.getById
        .mockReturnValueOnce(firstResponse$)
        .mockReturnValueOnce(secondResponse$);

      component.ngOnInit();
      firstResponse$.next({ data: { id: 't1' } } as WebApiResponse<Trip>);
      expect(tripServiceMock.getById).toHaveBeenCalledTimes(1);

      paymentServiceMock.paymentChanged$.next();
      expect(tripServiceMock.getById).toHaveBeenCalledTimes(1);

      paymentServiceMock.paymentChanged$.next();
      expect(tripServiceMock.getById).toHaveBeenCalledTimes(2);

      secondResponse$.next({ data: { id: 't1' } } as WebApiResponse<Trip>);
      expect(component.data).toEqual({ id: 't1' });
    });
  });

  describe('getStatusLabel', () => {
    it('returns an empty string when there is no data', () => {
      const component = createComponent(null);
      expect(component.getStatusLabel()).toBe('');
    });
  });

  describe('emitContract', () => {
    it('does nothing without data', () => {
      const component = createComponent(null);
      component.emitContract();
      expect(modalServiceMock.showPdfProgress).not.toHaveBeenCalled();
    });

    it('shows progress and reports success on a resolved PDF', () => {
      const component = createComponent(null);
      component.data = { id: 't1', tripNumber: 'V-1000' } as Trip;
      tripServiceMock.getContractPdf.mockReturnValue(of(new Blob(['x'])));

      component.emitContract();

      expect(progressHandle.success).toHaveBeenCalled();
      expect(component.emittingContract).toBe(false);
    });

    it('reports an error when PDF generation fails', () => {
      const component = createComponent(null);
      component.data = { id: 't1', tripNumber: 'V-1000' } as Trip;
      const error$ = new Subject<Blob>();
      tripServiceMock.getContractPdf.mockReturnValue(error$);

      component.emitContract();
      error$.error(new Error('boom'));

      expect(progressHandle.error).toHaveBeenCalled();
      expect(component.emittingContract).toBe(false);
    });
  });

  describe('emitServiceOrder', () => {
    it('does nothing without data', () => {
      const component = createComponent(null);
      component.emitServiceOrder();
      expect(modalServiceMock.showPdfProgress).not.toHaveBeenCalled();
    });

    it('shows progress and reports success on a resolved PDF', () => {
      const component = createComponent(null);
      component.data = { id: 't1', tripNumber: 'V-1000' } as Trip;
      tripServiceMock.getServiceOrderPdf.mockReturnValue(of(new Blob(['x'])));

      component.emitServiceOrder();

      expect(progressHandle.success).toHaveBeenCalled();
      expect(component.emittingServiceOrder).toBe(false);
    });
  });

  it('ngOnDestroy does not throw', () => {
    const component = createComponent(null);
    component.ngOnInit();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });
});
