import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  it('should create', () => {
    expect(new HomeComponent()).toBeTruthy();
  });

  describe('ngAfterViewInit / ngOnDestroy', () => {
    it('registers a resize listener and removes it on destroy', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const component = new HomeComponent();

      await component.ngAfterViewInit();
      expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));

      component.ngOnDestroy();
      expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it('does not throw when destroyed without ever calling ngAfterViewInit', () => {
      const component = new HomeComponent();
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('toggleFilters', () => {
    it('flips showFilters', () => {
      const component = new HomeComponent();
      expect(component.showFilters).toBe(false);
      component.toggleFilters();
      expect(component.showFilters).toBe(true);
    });
  });

  describe('clearFilters', () => {
    it('resets the date range', () => {
      const component = new HomeComponent();
      component.filterStartDate = new Date();
      component.filterEndDate = new Date();

      component.clearFilters();

      expect(component.filterStartDate).toBeNull();
      expect(component.filterEndDate).toBeNull();
    });
  });
});
