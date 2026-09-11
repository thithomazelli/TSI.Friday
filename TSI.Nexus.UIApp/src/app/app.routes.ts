import { Routes } from '@angular/router';
import { AuthorizationGuard } from './core/guards/authorization.guard';
import { NotFoundComponent } from './shared/components/errors/not-found/not-found.component';

export const routes: Routes = [
  {
    path: '',
    canActivate: [AuthorizationGuard],
    // loadComponent, not a direct component reference: HomeComponent pulls in the
    // dashboard charts (ApexCharts, ~600KB), and app.routes.ts itself loads eagerly - a
    // direct reference here would put that weight in the initial bundle for every route,
    // not just the dashboard.
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'account',
    loadChildren: () =>
      import('./account/account.routes').then((m) => m.ACCOUNT_ROUTES),
  },
  {
    path: 'alert-configs',
    canActivateChild: [AuthorizationGuard],
    loadChildren: () =>
      import('./alert-configs/alert-configs.routes').then(
        (m) => m.ALERT_CONFIGS_ROUTES,
      ),
  },
  {
    path: 'agenda',
    canActivateChild: [AuthorizationGuard],
    data: { featureFlag: 'AgendaModule' },
    loadChildren: () =>
      import('./agenda/agenda.routes').then((m) => m.AGENDA_ROUTES),
  },
  {
    path: 'clients',
    canActivateChild: [AuthorizationGuard],
    loadChildren: () =>
      import('./business-partner/business-partner.routes').then(
        (m) => m.BUSINESS_PARTNER_ROUTES,
      ),
  },
  {
    path: 'document-templates',
    canActivateChild: [AuthorizationGuard],
    loadChildren: () =>
      import('./document-templates/document-templates.routes').then(
        (m) => m.DOCUMENT_TEMPLATES_ROUTES,
      ),
  },
  {
    path: 'drivers',
    canActivateChild: [AuthorizationGuard],
    loadChildren: () =>
      import('./drivers/drivers.routes').then((m) => m.DRIVERS_ROUTING),
  },
  {
    path: 'feature-toggles',
    canActivateChild: [AuthorizationGuard],
    loadChildren: () =>
      import('./feature-toggles/feature-toggles.routes').then(
        (m) => m.FEATURE_TOGGLES_ROUTES,
      ),
  },
  {
    path: 'fuel-logs',
    canActivateChild: [AuthorizationGuard],
    data: { featureFlag: ['FleetModule', 'FuelLog'] },
    loadChildren: () =>
      import('./fuel-logs/fuel-logs.routes').then((m) => m.FUEL_LOGS_ROUTES),
  },
  {
    path: 'home',
    canActivate: [AuthorizationGuard],
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'not-found',
    canActivate: [AuthorizationGuard],
    component: NotFoundComponent,
  },
  {
    path: 'orders',
    canActivateChild: [AuthorizationGuard],
    data: { featureFlag: 'SalesOrdersModule' },
    loadChildren: () =>
      import('./orders/orders.routes').then((m) => m.ORDERS_ROUTES),
  },
  {
    path: 'payments',
    canActivateChild: [AuthorizationGuard],
    loadChildren: () =>
      import('./payments/payments.routes').then((m) => m.PAYMENTS_ROUTES),
  },
  {
    path: 'purchase-orders',
    canActivateChild: [AuthorizationGuard],
    data: { featureFlag: 'PurchaseOrdersModule' },
    loadChildren: () =>
      import('./purchase-orders/purchase-orders.routes').then(
        (m) => m.PURCHASE_ORDERS_ROUTES,
      ),
  },
  {
    path: 'products',
    canActivateChild: [AuthorizationGuard],
    loadChildren: () =>
      import('./products/products.routes').then((m) => m.PRODUCTS_ROUTES),
  },
  {
    path: 'quotes',
    canActivateChild: [AuthorizationGuard],
    data: { featureFlag: 'QuotesModule' },
    loadChildren: () =>
      import('./quotes/quotes.routes').then((m) => m.QUOTES_ROUTES),
  },
  {
    path: 'reports',
    canActivateChild: [AuthorizationGuard],
    loadChildren: () =>
      import('./reports/reports.routes').then((m) => m.REPORTS_ROUTES),
  },
  {
    path: 'selectable-options',
    canActivateChild: [AuthorizationGuard],
    loadChildren: () =>
      import('./selectable-options/selectable-options.routes').then(
        (m) => m.SELECTABLE_OPTIONS_ROUTES,
      ),
  },
  {
    path: 'suppliers',
    canActivateChild: [AuthorizationGuard],
    loadChildren: () =>
      import('./business-partner/business-partner.routes').then(
        (m) => m.BUSINESS_PARTNER_ROUTES,
      ),
  },
  {
    path: 'transactions',
    canActivateChild: [AuthorizationGuard],
    loadChildren: () =>
      import('./transactions/transactions.routes').then(
        (m) => m.TRANSACTIONS_ROUTES,
      ),
  },
  {
    path: 'trips',
    canActivateChild: [AuthorizationGuard],
    data: { featureFlag: 'FleetModule' },
    loadChildren: () =>
      import('./trips/trips.routes').then((m) => m.TRIPS_ROUTES),
  },
  {
    path: 'users',
    canActivateChild: [AuthorizationGuard],
    loadChildren: () =>
      import('./users/users.routes').then((m) => m.USERS_ROUTES),
  },
  {
    path: 'vehicle-maintenances',
    canActivateChild: [AuthorizationGuard],
    data: { featureFlag: ['FleetModule', 'VehicleMaintenance'] },
    loadChildren: () =>
      import('./vehicle-maintenances/vehicle-maintenances.routes').then(
        (m) => m.VEHICLE_MAINTENANCES_ROUTES,
      ),
  },
  {
    path: 'vehicles',
    canActivateChild: [AuthorizationGuard],
    loadChildren: () =>
      import('./vehicles/vehicles.routes').then((m) => m.VEHICLES_ROUTES),
  },
  {
    path: '**',
    runGuardsAndResolvers: 'always',
    redirectTo: 'not-found',
  },
];