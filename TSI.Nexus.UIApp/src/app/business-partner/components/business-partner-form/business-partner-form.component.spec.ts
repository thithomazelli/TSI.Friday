import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BusinessPartnerFormComponent } from './business-partner-form.component';

describe('BusinessPartnerFormComponent', () => {
  let component: BusinessPartnerFormComponent;
  let fixture: ComponentFixture<BusinessPartnerFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [BusinessPartnerFormComponent],
}).compileComponents();

    fixture = TestBed.createComponent(BusinessPartnerFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
