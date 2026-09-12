import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GridComponent } from './grid.component';

describe('GridComponent', () => {
  let component: GridComponent<unknown>;
  let fixture: ComponentFixture<GridComponent<unknown>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [GridComponent]
})
    .compileComponents();

    fixture = TestBed.createComponent<GridComponent<unknown>>(GridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
