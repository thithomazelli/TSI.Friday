import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import {
  Commission,
  CommissionStatus,
  Driver,
  DriverService,
  DriverStatus,
  Trip,
  TripService,
  ServiceOrderService,
  Vehicle,
  VehicleMaintenance,
  VehicleMaintenanceService,
  VehicleService,
  VehicleStatus,
} from '@nexus/core';
import { forkJoin, map, switchMap } from 'rxjs';
import { HeaderComponent } from '../../../shared/header/header.component';
import { CurrencyPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { DateFieldComponent } from '../../../shared/components/date-field/date-field.component';
import { cardCollapseAnimation } from '../../../core/animations/card-collapse.animation';

interface DriverCommissionEntry {
  driver: Driver;
  commissions: { commission: Commission; issueDate: Date }[];
}

interface VehicleSummaryRow {
  plate: string;
  brandModel: string;
  status: VehicleStatus;
  tripCount: number;
  revenue: number;
  maintenanceCost: number;
}

interface DriverSummaryRow {
  name: string;
  status: DriverStatus;
  tripCount: number;
  commissionPending: number;
  commissionPaid: number;
}

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-fleet-report',
    templateUrl: './fleet-report.component.html',
    styleUrl: './fleet-report.component.scss',
    imports: [
        HeaderComponent,
        CurrencyPipe,
        TranslatePipe,
        NgClass,
        FormsModule,
        DateFieldComponent,
    ],
    animations: [cardCollapseAnimation],
})
export class FleetReportComponent implements OnInit {
  loading = false;
  showFilters = false;
  filterStartDate: string | null = null;
  filterEndDate: string | null = null;

  totalVehicles = 0;
  availableVehicles = 0;
  blockedVehicles = 0;
  totalDrivers = 0;
  activeDrivers = 0;
  totalTrips = 0;
  totalRevenue = 0;
  totalMaintenanceCost = 0;
  totalCommissionPending = 0;
  totalCommissionPaid = 0;

  vehicleRows: VehicleSummaryRow[] = [];
  driverRows: DriverSummaryRow[] = [];

  private allVehicles: Vehicle[] = [];
  private allTrips: Trip[] = [];
  private allMaintenances: VehicleMaintenance[] = [];
  private allDrivers: Driver[] = [];
  private allDriverCommissions: DriverCommissionEntry[] = [];

  constructor(
    private driverService: DriverService,
    private tripService: TripService,
    private serviceOrderService: ServiceOrderService,
    private vehicleMaintenanceService: VehicleMaintenanceService,
    private vehicleService: VehicleService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  applyFilters(): void {
    const trips = this.allTrips.filter(
      (t) => !!t.vehicleId && this.isInDateRange(t.date),
    );
    const maintenances = this.allMaintenances.filter((m) =>
      this.isInDateRange(m.scheduledDate),
    );
    const driverCommissions = this.allDriverCommissions.map(
      ({ driver, commissions }) => ({
        driver,
        commissions: commissions
          .filter((c) => this.isInDateRange(c.issueDate))
          .map((c) => c.commission),
      }),
    );

    this.buildSummary(
      this.allVehicles,
      trips,
      maintenances,
      this.allDrivers,
      driverCommissions,
    );
  }

  clearFilters(): void {
    this.filterStartDate = null;
    this.filterEndDate = null;
    this.applyFilters();
  }

  private isInDateRange(date: Date | string | null | undefined): boolean {
    if (!this.filterStartDate && !this.filterEndDate) {
      return true;
    }
    if (!date) {
      return false;
    }
    const itemDate = new Date(date).toISOString().slice(0, 10);
    if (this.filterStartDate) {
      const startDate = new Date(this.filterStartDate).toISOString().slice(0, 10);
      if (itemDate < startDate) {
        return false;
      }
    }
    if (this.filterEndDate) {
      const endDate = new Date(this.filterEndDate).toISOString().slice(0, 10);
      if (itemDate > endDate) {
        return false;
      }
    }
    return true;
  }

  private load(): void {
    this.loading = true;

    forkJoin({
      vehicles: this.vehicleService.getAll(),
      trips: this.tripService.getAll(),
      maintenances: this.vehicleMaintenanceService.getAll(),
      drivers: this.driverService.getAll(),
    })
      .pipe(
        map(({ vehicles, trips, maintenances, drivers }) => ({
          vehicles: vehicles.data ?? [],
          trips: trips.data ?? [],
          maintenances: maintenances.data ?? [],
          drivers: drivers.data ?? [],
        })),
        switchMap(({ vehicles, trips, maintenances, drivers }) =>
          forkJoin(
            drivers.length
              ? drivers.map((driver) =>
                  this.serviceOrderService.getByDriver(driver.id).pipe(
                    map((response) => ({
                      driver,
                      commissions: (response.data ?? [])
                        .filter((so) => !!so.commission)
                        .map((so) => ({
                          commission: so.commission as Commission,
                          issueDate: so.issueDate,
                        })),
                    })),
                  ),
                )
              : [],
          ).pipe(
            map((driverCommissions) => ({
              vehicles,
              trips,
              maintenances,
              drivers,
              driverCommissions,
            })),
          ),
        ),
      )
      .subscribe(({ vehicles, trips, maintenances, drivers, driverCommissions }) => {
        this.allVehicles = vehicles;
        this.allTrips = trips;
        this.allMaintenances = maintenances;
        this.allDrivers = drivers;
        this.allDriverCommissions = driverCommissions;
        this.applyFilters();
        this.loading = false;
      });
  }

  private buildSummary(
    vehicles: Vehicle[],
    trips: Trip[],
    maintenances: VehicleMaintenance[],
    drivers: Driver[],
    driverCommissions: { driver: Driver; commissions: Commission[] }[],
  ): void {
    this.totalVehicles = vehicles.length;
    this.availableVehicles = vehicles.filter(
      (v) => v.status === VehicleStatus.Available,
    ).length;
    this.blockedVehicles = vehicles.filter((v) => v.status === VehicleStatus.Blocked).length;

    this.totalTrips = trips.length;
    this.totalRevenue = trips.reduce((sum, t) => sum + (t.totalPrice ?? 0), 0);
    this.totalMaintenanceCost = maintenances.reduce((sum, m) => sum + (m.cost ?? 0), 0);

    const vehicleMap = new Map<string, VehicleSummaryRow>();
    for (const vehicle of vehicles) {
      vehicleMap.set(vehicle.id, {
        plate: vehicle.plate,
        brandModel: `${vehicle.brand ?? ''} ${vehicle.model ?? ''}`.trim(),
        status: vehicle.status,
        tripCount: 0,
        revenue: 0,
        maintenanceCost: 0,
      });
    }
    for (const trip of trips) {
      const row = trip.vehicleId ? vehicleMap.get(trip.vehicleId) : undefined;
      if (row) {
        row.tripCount += 1;
        row.revenue += trip.totalPrice ?? 0;
      }
    }
    for (const maintenance of maintenances) {
      const row = vehicleMap.get(maintenance.vehicleId);
      if (row) {
        row.maintenanceCost += maintenance.cost ?? 0;
      }
    }
    this.vehicleRows = Array.from(vehicleMap.values()).sort(
      (a, b) => b.revenue - a.revenue,
    );

    this.totalDrivers = drivers.length;
    this.activeDrivers = drivers.filter((d) => d.status === DriverStatus.Active).length;

    this.driverRows = driverCommissions.map(({ driver, commissions }) => {
      const pending = commissions
        .filter((c) => c.status === CommissionStatus.Pending)
        .reduce((sum, c) => sum + c.amount, 0);
      const paid = commissions
        .filter((c) => c.status === CommissionStatus.Paid)
        .reduce((sum, c) => sum + c.amount, 0);

      return {
        name: driver.name,
        status: driver.status,
        tripCount: commissions.length,
        commissionPending: pending,
        commissionPaid: paid,
      };
    });

    this.totalCommissionPending = this.driverRows.reduce(
      (sum, r) => sum + r.commissionPending,
      0,
    );
    this.totalCommissionPaid = this.driverRows.reduce((sum, r) => sum + r.commissionPaid, 0);
  }
}
