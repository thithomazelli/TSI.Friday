import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BusinessPartnerDetailsModalComponent } from './business-partner-details-modal.component';

describe('BusinessPartnerDetailsModalComponent', () => {
  let component: BusinessPartnerDetailsModalComponent;
  let fixture: ComponentFixture<BusinessPartnerDetailsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [BusinessPartnerDetailsModalComponent],
}).compileComponents();

    fixture = TestBed.createComponent(BusinessPartnerDetailsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
