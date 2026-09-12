import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BusinessPartnerDetailsPageComponent } from './business-partner-details-page.component';

describe('BusinessPartnerDetailsPageComponent', () => {
  let component: BusinessPartnerDetailsPageComponent;
  let fixture: ComponentFixture<BusinessPartnerDetailsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [BusinessPartnerDetailsPageComponent],
}).compileComponents();

    fixture = TestBed.createComponent(BusinessPartnerDetailsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
