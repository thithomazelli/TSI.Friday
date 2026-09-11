import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Product, ProductService, ProductType, TranslationService } from '@nexus/core';
import { Subject, takeUntil } from 'rxjs';
import { HeaderComponent } from '../../../shared/header/header.component';
import { PhotoComponent } from '../../../shared/photo/photo.component';
import { NgIf } from '@angular/common';
import { ProductFormComponent } from '../product-form/product-form.component';
import { OrderProductsComponent } from '../../../order-products/order-products.component';
import { AttachmentsComponent } from '../../../shared/attachments/attachments.component';
import { AuditTabComponent } from '../../../shared/components/audit-tab/audit-tab.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-product-details-page',
    templateUrl: './product-details-page.component.html',
    styleUrl: './product-details-page.component.scss',
    imports: [
        HeaderComponent,
        PhotoComponent,
        NgIf,
        ProductFormComponent,
        OrderProductsComponent,
        AttachmentsComponent,
        AuditTabComponent,
        LoadingSpinnerComponent,
        TranslatePipe,
    ],
})
export class ProductDetailsPageComponent implements OnInit, OnDestroy {
  isEdit = false;
  data?: Product | null = null;
  id: string | null = null;
  loading = false;
  activeTab: 'details' | 'image' | 'history' | 'attachments' | 'audit' =
    'details';

  get productTypeOptions(): Record<ProductType, string> {
    return {
      [ProductType.Rental]: this.translationService.instant('PRODUCTS.TYPE_RENTAL'),
      [ProductType.Sale]: this.translationService.instant('PRODUCTS.TYPE_SALE'),
      [ProductType.Service]: this.translationService.instant('PRODUCTS.SINGULAR'),
    };
  }

  private _destroy$ = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private productService: ProductService,
    private routerService: Router,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.activatedRoute.paramMap
      .pipe(takeUntil(this._destroy$))
      .subscribe((paramMap) => {
        const idParam = paramMap.get('id');

        if (idParam && idParam !== 'new') {
          this.isEdit = true;
          this.id = idParam;
          this.getProductById(idParam);
        } else {
          this.isEdit = false;
          this.data = null;
        }
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  getProductTypeLabel(): string {
    if (!this.data?.type || this.data?.type === undefined) {
      return '';
    }
    return this.productTypeOptions[this.data.type];
  }

  private getProductById(id: string): void {
    this.loading = true;
    this.productService
      .getById(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.data == null) {
            this.routerService.navigateByUrl('/not-found');
            return;
          }
          this.data = response.data;
        },
        error: () => {
          this.loading = false;
          this.routerService.navigateByUrl('/not-found');
        },
      });
  }
}
