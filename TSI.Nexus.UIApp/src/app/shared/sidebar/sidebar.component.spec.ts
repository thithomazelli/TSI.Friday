import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { User } from '@nexus/core';
import { AccountService } from '../../core/services/account/account.service';
import { FeatureFlagService } from '../../core/services/feature-flag/feature-flag.service';
import { FeatureToggleKeys } from '../../core/models/feature-toggle.model';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  let user$: Subject<User | null>;

  beforeEach(async () => {
    user$ = new Subject();
    const enabledKeys = new Set<string>([
      FeatureToggleKeys.FleetModule,
      FeatureToggleKeys.QuotesModule,
      FeatureToggleKeys.SalesOrdersModule,
      FeatureToggleKeys.PurchaseOrdersModule,
      FeatureToggleKeys.VehicleMaintenance,
      FeatureToggleKeys.FuelLog,
      FeatureToggleKeys.AgendaModule,
      FeatureToggleKeys.Event,
    ]);

    const featureFlagServiceMock = {
      isEnabled: vi.fn((key: string) => of(enabledKeys.has(key))),
    };
    const accountServiceMock = { user$ };

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: AccountService, useValue: accountServiceMock },
        { provide: FeatureFlagService, useValue: featureFlagServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('resolves simple module flags directly from FeatureFlagService.isEnabled()', () => {
    expect(component.isFleetModuleEnabled()).toBe(true);
    expect(component.isQuotesModuleEnabled()).toBe(true);
    expect(component.isSalesOrdersModuleEnabled()).toBe(true);
    expect(component.isPurchaseOrdersModuleEnabled()).toBe(true);
  });

  it('combines group + entity flags for VehicleMaintenance/FuelLog/Agenda', () => {
    expect(component.isVehicleMaintenanceEnabled()).toBe(true);
    expect(component.isFuelLogEnabled()).toBe(true);
    expect(component.isAgendaModuleEnabled()).toBe(true);
  });

  it('isAdmin/isMaster reflect the current user roles once user$ emits', () => {
    expect(component.isAdmin()).toBe(false);
    expect(component.isMaster()).toBe(false);

    user$.next({ roles: ['Admin'] } as unknown as User);
    fixture.detectChanges();
    expect(component.isAdmin()).toBe(true);
    expect(component.isMaster()).toBe(false);

    user$.next({ roles: ['Master'] } as unknown as User);
    fixture.detectChanges();
    expect(component.isAdmin()).toBe(false);
    expect(component.isMaster()).toBe(true);
  });

  it('isAdmin/isMaster are false when there is no user', () => {
    user$.next(null);
    fixture.detectChanges();

    expect(component.isAdmin()).toBe(false);
    expect(component.isMaster()).toBe(false);
  });

  it('onSidebarMenuClick closes the mobile sidebar when a nav-link is clicked', () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    document.body.classList.add('sidebar-open');
    const link = document.createElement('a');
    link.classList.add('nav-link');
    document.body.appendChild(link);

    component.onSidebarMenuClick({ target: link } as unknown as MouseEvent);

    expect(document.body.classList.contains('sidebar-open')).toBe(false);
    document.body.removeChild(link);
  });

  it('ngOnDestroy cleans up registered listeners without throwing', () => {
    expect(() => component.ngOnDestroy()).not.toThrow();
  });
});
