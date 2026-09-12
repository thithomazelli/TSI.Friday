import { ActivatedRoute } from '@angular/router';
import { AgendaComponent } from './agenda.component';

describe('AgendaComponent', () => {
  function createComponent(queryParams: Record<string, string> = {}) {
    const activatedRouteMock = {
      snapshot: { queryParamMap: { get: (key: string) => queryParams[key] ?? null } },
    };
    return new AgendaComponent(activatedRouteMock as unknown as ActivatedRoute);
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('defaults onlyMine to false when the query param is absent', () => {
    const component = createComponent();
    component.ngOnInit();

    expect(component.onlyMine).toBe(false);
  });

  it('sets onlyMine to true when the query param is "true"', () => {
    const component = createComponent({ onlyMine: 'true' });
    component.ngOnInit();

    expect(component.onlyMine).toBe(true);
  });

  it('sets onlyMine to false for any other query param value', () => {
    const component = createComponent({ onlyMine: 'yes' });
    component.ngOnInit();

    expect(component.onlyMine).toBe(false);
  });
});
