import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import {
  ModalService,
  Quote,
  QuoteProductService,
  QuoteService,
  QuoteType,
  TranslationService,
  WebApiResponse,
} from '@nexus/core';
import { FeatureFlagService } from '../../../core/services/feature-flag/feature-flag.service';
import { QuoteDetailsPageComponent } from './quote-details-page.component';

describe('QuoteDetailsPageComponent', () => {
  let activatedRouteMock: { snapshot: { paramMap: { get: ReturnType<typeof vi.fn> } } };
  let quoteServiceMock: {
    getById: ReturnType<typeof vi.fn>;
    getByQuoteNumber: ReturnType<typeof vi.fn>;
    getPdf: ReturnType<typeof vi.fn>;
    quoteChanged$: Subject<void>;
  };
  let quoteProductServiceMock: { quoteProductChanged$: Subject<void> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let featureFlagServiceMock: { isEnabled: ReturnType<typeof vi.fn> };
  let modalServiceMock: { showPdfProgress: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let progressHandle: { setIndeterminate: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  function createComponent(id: string | null): QuoteDetailsPageComponent {
    activatedRouteMock = { snapshot: { paramMap: { get: vi.fn().mockReturnValue(id) } } };
    quoteServiceMock = {
      getById: vi.fn().mockReturnValue(new Subject()),
      getByQuoteNumber: vi.fn().mockReturnValue(new Subject()),
      getPdf: vi.fn(),
      quoteChanged$: new Subject(),
    };
    quoteProductServiceMock = { quoteProductChanged$: new Subject() };
    routerMock = { navigateByUrl: vi.fn() };
    featureFlagServiceMock = { isEnabled: vi.fn().mockReturnValue(of(true)) };
    progressHandle = { setIndeterminate: vi.fn(), success: vi.fn(), error: vi.fn() };
    modalServiceMock = { showPdfProgress: vi.fn().mockReturnValue(progressHandle) };
    translationServiceMock = { instant: vi.fn((key: string) => key) };

    TestBed.configureTestingModule({});
    return TestBed.runInInjectionContext(
      () =>
        new QuoteDetailsPageComponent(
          activatedRouteMock as unknown as ActivatedRoute,
          quoteServiceMock as unknown as QuoteService,
          quoteProductServiceMock as unknown as QuoteProductService,
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
    it('sets isEdit=false for a new quote', () => {
      const component = createComponent(null);
      component.ngOnInit();

      expect(component.isEdit).toBe(false);
      expect(component.data).toBeNull();
    });

    it('loads an existing quote by GUID id', () => {
      const guid = '11111111-1111-1111-1111-111111111111';
      const component = createComponent(guid);
      const response$ = new Subject<WebApiResponse<Quote>>();
      quoteServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      expect(quoteServiceMock.getById).toHaveBeenCalledWith(guid);
      expect(quoteServiceMock.getByQuoteNumber).not.toHaveBeenCalled();

      const data = { id: guid } as Quote;
      response$.next({ data } as WebApiResponse<Quote>);
      expect(component.data).toBe(data);
    });

    it('loads an existing quote by quote number when the id param is not a GUID', () => {
      const component = createComponent('Q-1000');
      const response$ = new Subject<WebApiResponse<Quote>>();
      quoteServiceMock.getByQuoteNumber.mockReturnValue(response$);

      component.ngOnInit();
      expect(quoteServiceMock.getByQuoteNumber).toHaveBeenCalledWith('Q-1000');
      expect(quoteServiceMock.getById).not.toHaveBeenCalled();
    });

    it('navigates to not-found when the quote does not exist', () => {
      const component = createComponent('Q-1000');
      const response$ = new Subject<WebApiResponse<Quote>>();
      quoteServiceMock.getByQuoteNumber.mockReturnValue(response$);

      component.ngOnInit();
      response$.next({ data: null } as unknown as WebApiResponse<Quote>);

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });

    it('navigates to not-found and stops loading when the request errors', () => {
      const guid = '11111111-1111-1111-1111-111111111111';
      const component = createComponent(guid);
      const response$ = new Subject<WebApiResponse<Quote>>();
      quoteServiceMock.getById.mockReturnValue(response$);

      component.ngOnInit();
      response$.error(new Error('fail'));

      expect(component.loading).toBe(false);
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });

    it('re-fetches (using the same fetch method) on a real quoteProductChanged$ event, but not on the skip(1)-dropped first one', () => {
      const component = createComponent('Q-1000');
      const firstResponse$ = new Subject<WebApiResponse<Quote>>();
      const secondResponse$ = new Subject<WebApiResponse<Quote>>();
      quoteServiceMock.getByQuoteNumber
        .mockReturnValueOnce(firstResponse$)
        .mockReturnValueOnce(secondResponse$);

      component.ngOnInit();
      firstResponse$.next({ data: { id: 'q1' } } as WebApiResponse<Quote>);
      expect(quoteServiceMock.getByQuoteNumber).toHaveBeenCalledTimes(1);

      quoteProductServiceMock.quoteProductChanged$.next();
      expect(quoteServiceMock.getByQuoteNumber).toHaveBeenCalledTimes(1);

      quoteProductServiceMock.quoteProductChanged$.next();
      expect(quoteServiceMock.getByQuoteNumber).toHaveBeenCalledTimes(2);

      secondResponse$.next({ data: { id: 'q1' } } as WebApiResponse<Quote>);
      expect(component.data).toEqual({ id: 'q1' });
    });
  });

  describe('isTripQuote', () => {
    it('reflects the quote type', () => {
      const component = createComponent(null);
      component.data = { type: QuoteType.Trip } as Quote;
      expect(component.isTripQuote()).toBe(true);

      component.data = { type: QuoteType.Product } as Quote;
      expect(component.isTripQuote()).toBe(false);
    });
  });

  describe('getStatusLabel', () => {
    it('returns an empty string when there is no data', () => {
      const component = createComponent(null);
      expect(component.getStatusLabel()).toBe('');
    });

    it('returns an empty string when data has no status', () => {
      const component = createComponent(null);
      component.data = { id: 'q1', status: null } as unknown as Quote;
      expect(component.getStatusLabel()).toBe('');
    });

    it('resolves the mapped status label', () => {
      const component = createComponent(null);
      component.data = { id: 'q1', status: 'Open' } as unknown as Quote;
      expect(component.getStatusLabel()).toBe('Em aberto');
    });

    it('falls back to an empty string for a status with no mapped label', () => {
      const component = createComponent(null);
      component.data = { id: 'q1', status: 'Unknown' } as unknown as Quote;
      expect(component.getStatusLabel()).toBe('');
    });
  });

  describe('emitQuote', () => {
    it('does nothing without data', () => {
      const component = createComponent(null);
      component.emitQuote();
      expect(modalServiceMock.showPdfProgress).not.toHaveBeenCalled();
    });

    it('shows progress and reports success on a resolved PDF', () => {
      const component = createComponent(null);
      component.data = { id: 'q1', quoteNumber: 'Q-1000' } as Quote;
      quoteServiceMock.getPdf.mockReturnValue(of(new Blob(['x'])));

      component.emitQuote();

      expect(progressHandle.setIndeterminate).toHaveBeenCalled();
      expect(progressHandle.success).toHaveBeenCalled();
      expect(component.emittingQuote).toBe(false);
    });

    it('reports an error when PDF generation fails', () => {
      const component = createComponent(null);
      component.data = { id: 'q1', quoteNumber: 'Q-1000' } as Quote;
      const error$ = new Subject<Blob>();
      quoteServiceMock.getPdf.mockReturnValue(error$);

      component.emitQuote();
      error$.error(new Error('boom'));

      expect(progressHandle.error).toHaveBeenCalled();
      expect(component.emittingQuote).toBe(false);
    });

    it('does nothing while a previous emission is still in flight', () => {
      const component = createComponent(null);
      component.data = { id: 'q1', quoteNumber: 'Q-1000' } as Quote;
      component.emittingQuote = true;

      component.emitQuote();

      expect(modalServiceMock.showPdfProgress).not.toHaveBeenCalled();
    });
  });

  it('ngOnDestroy does not throw', () => {
    const component = createComponent(null);
    component.ngOnInit();
    expect(() => component.ngOnDestroy()).not.toThrow();
  });

  it('ngOnDestroy also unsubscribes from quoteChanged$/quoteProductChanged$ when editing an existing quote', () => {
    const guid = '11111111-1111-1111-1111-111111111111';
    const component = createComponent(guid);
    quoteServiceMock.getById.mockReturnValue(new Subject());
    component.ngOnInit();

    component.ngOnDestroy();
    quoteServiceMock.getById.mockClear();
    quoteServiceMock.quoteChanged$.next();
    quoteServiceMock.quoteChanged$.next();

    expect(quoteServiceMock.getById).not.toHaveBeenCalled();
  });
});
