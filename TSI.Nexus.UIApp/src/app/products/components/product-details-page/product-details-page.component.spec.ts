import { ActivatedRoute, Router } from '@angular/router';
import { Product, ProductService, ProductType, TranslationService } from '@nexus/core';
import { Subject, of, throwError } from 'rxjs';
import { ProductDetailsPageComponent } from './product-details-page.component';

describe('ProductDetailsPageComponent', () => {
  let paramMap$: Subject<{ get: (key: string) => string | null }>;
  let activatedRouteMock: { paramMap: Subject<{ get: (key: string) => string | null }> };
  let productServiceMock: { getById: ReturnType<typeof vi.fn> };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };

  function createComponent(): ProductDetailsPageComponent {
    paramMap$ = new Subject();
    activatedRouteMock = { paramMap: paramMap$ };
    productServiceMock = { getById: vi.fn() };
    routerMock = { navigateByUrl: vi.fn() };
    translationServiceMock = { instant: vi.fn((key: string) => key) };

    return new ProductDetailsPageComponent(
      activatedRouteMock as unknown as ActivatedRoute,
      productServiceMock as unknown as ProductService,
      routerMock as unknown as Router,
      translationServiceMock as unknown as TranslationService,
    );
  }

  function paramMap(entries: Record<string, string | null>) {
    return { get: (key: string) => entries[key] ?? null };
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('stays in add mode for the "new" route param', () => {
      const component = createComponent();
      component.ngOnInit();

      paramMap$.next(paramMap({ id: 'new' }));

      expect(component.isEdit).toBe(false);
      expect(component.data).toBeNull();
      expect(productServiceMock.getById).not.toHaveBeenCalled();
    });

    it('loads the product for a real id', () => {
      const component = createComponent();
      productServiceMock.getById.mockReturnValue(
        of({ data: { id: 'p1', type: ProductType.Sale } as Product }),
      );

      component.ngOnInit();
      paramMap$.next(paramMap({ id: 'p1' }));

      expect(component.isEdit).toBe(true);
      expect(component.id).toBe('p1');
      expect(component.data).toEqual({ id: 'p1', type: ProductType.Sale });
      expect(component.loading).toBe(false);
    });

    it('redirects to not-found when the product does not exist', () => {
      const component = createComponent();
      productServiceMock.getById.mockReturnValue(of({ data: null }));

      component.ngOnInit();
      paramMap$.next(paramMap({ id: 'missing' }));

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
    });

    it('redirects to not-found when the fetch fails', () => {
      const component = createComponent();
      productServiceMock.getById.mockReturnValue(throwError(() => new Error('fail')));

      component.ngOnInit();
      paramMap$.next(paramMap({ id: 'p1' }));

      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/not-found');
      expect(component.loading).toBe(false);
    });

    it('stops reacting to route changes after ngOnDestroy', () => {
      const component = createComponent();
      component.ngOnInit();
      component.ngOnDestroy();

      paramMap$.next(paramMap({ id: 'p1' }));

      expect(productServiceMock.getById).not.toHaveBeenCalled();
    });
  });

  describe('getProductTypeLabel', () => {
    it('returns an empty string without a loaded product', () => {
      const component = createComponent();
      expect(component.getProductTypeLabel()).toBe('');
    });

    it('translates the loaded product type', () => {
      const component = createComponent();
      component.data = { type: ProductType.Rental } as Product;

      expect(component.getProductTypeLabel()).toBe('PRODUCTS.TYPE_RENTAL');
    });
  });
});
