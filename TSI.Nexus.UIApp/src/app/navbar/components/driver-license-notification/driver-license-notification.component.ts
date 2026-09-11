import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Driver, DriverService, ModalService, WebApiResponse } from '@nexus/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { DriverDetailsModalComponent } from '../../../drivers/components/driver-details-modal/driver-details-modal.component';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-driver-license-notification',
    templateUrl: './driver-license-notification.component.html',
    styleUrl: './driver-license-notification.component.scss',
    imports: [
        NgIf,
        NgFor,
        RouterLink,
        DatePipe,
        TranslatePipe,
    ],
})
export class DriverLicenseNotificationComponent implements OnInit {
  drivers: Driver[] = [];
  total = 0;

  constructor(
    private driverService: DriverService,
    private modalService: ModalService,
  ) {}

  ngOnInit(): void {
    this.driverService
      .getExpiringLicenses()
      .subscribe((response: WebApiResponse<Driver[]>) => {
        this.drivers = response?.data || [];
        this.total = this.drivers.length;
      });
  }

  get showBadge(): boolean {
    return this.total > 0;
  }

  isExpired(driver: Driver): boolean {
    return new Date(driver.licenseExpiryDate) < new Date();
  }

  openDriver(driver: Driver): void {
    this.modalService.showTemplateModal(DriverDetailsModalComponent, {
      isEdit: true,
      id: driver.id,
      data: driver,
    });
  }
}
