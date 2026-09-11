import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  ModalService,
  Product,
  ProductService,
  WebApiResponse,
} from '@nexus/core';
import { Subject, takeUntil } from 'rxjs';
import { NgIf, NgFor } from '@angular/common';

import { PurchaseOrderDetailsModalComponent } from '../../../purchase-orders/components/purchase-order-details-modal/purchase-order-details-modal.component';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

// Erro (vermelho): produto sem estoque (<=0). Aviso (amarelo): estoque baixo (>0 e <=3). Mesmo
// padrão dos demais alertas da navbar - busca os próprios dados via ProductService.getAll() e
// filtra client-side, sem endpoint dedicado (ver VehicleBlockedNotificationComponent).
@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-stock-alert-notification',
    templateUrl: './stock-alert-notification.component.html',
    styleUrl: './stock-alert-notification.component.scss',
    imports: [NgIf, NgFor, TranslatePipe],
})
export class StockAlertNotificationComponent implements OnInit, OnDestroy {
  outOfStockProducts: Product[] = [];
  lowStockProducts: Product[] = [];
  total = 0;

  private _destroy$ = new Subject<void>();

  constructor(
    private productService: ProductService,
    private modalService: ModalService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  get showBadge(): boolean {
    return this.total > 0;
  }

  openProduct(product: Product): void {
    this.modalService.showTemplateModal(PurchaseOrderDetailsModalComponent, {
      isEdit: false,
      preselectedProductId: product.id,
    });
  }

  onSeeAll(): void {
    this.router.navigate(['/products'], {
      queryParams: { stockStatus: 'Low' },
    });
  }

  private load(): void {
    this.productService
      .getAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe((response: WebApiResponse<Product[]>) => {
        const products = response?.data || [];
        this.outOfStockProducts = products.filter(
          (p) => (p.quantityInStock ?? 0) <= 0,
        );
        this.lowStockProducts = products.filter(
          (p) => (p.quantityInStock ?? 0) > 0 && (p.quantityInStock ?? 0) <= 3,
        );
        this.total = this.outOfStockProducts.length + this.lowStockProducts.length;
      });
  }
}
