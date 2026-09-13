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

    it('destroys every chart, swallowing individual chart errors', () => {
      const component = new HomeComponent();
      const destroySpy = vi.fn();
      (component as any).charts = [
        { destroy: destroySpy },
        { destroy: () => { throw new Error('boom'); } },
        {},
      ];

      expect(() => component.ngOnDestroy()).not.toThrow();

      expect(destroySpy).toHaveBeenCalled();
      expect((component as any).charts).toEqual([]);
    });

    it('unlistens the tooltip mousemove handler and clears the reference', () => {
      const component = new HomeComponent();
      const unlistenSpy = vi.fn();
      (component as any).tipMousemoveUnlisten = unlistenSpy;

      component.ngOnDestroy();

      expect(unlistenSpy).toHaveBeenCalled();
      expect((component as any).tipMousemoveUnlisten).toBeNull();
    });

    it('does not throw when unlistening the tooltip mousemove handler errors', () => {
      const component = new HomeComponent();
      (component as any).tipMousemoveUnlisten = () => { throw new Error('boom'); };

      expect(() => component.ngOnDestroy()).not.toThrow();
      expect((component as any).tipMousemoveUnlisten).toBeNull();
    });

    it('removes the tooltip element from the document body and clears the reference', () => {
      const component = new HomeComponent();
      const tipEl = document.createElement('div');
      document.body.appendChild(tipEl);
      (component as any).tipEl = tipEl;

      component.ngOnDestroy();

      expect(document.body.contains(tipEl)).toBe(false);
      expect((component as any).tipEl).toBeNull();
    });

    it('does not try to remove the tooltip element when it is not attached to the body', () => {
      const component = new HomeComponent();
      const tipEl = document.createElement('div');
      const otherParent = document.createElement('div');
      otherParent.appendChild(tipEl);
      (component as any).tipEl = tipEl;

      expect(() => component.ngOnDestroy()).not.toThrow();

      expect((component as any).tipEl).toBeNull();
    });

    it('does not throw when removing the tooltip element errors', () => {
      const component = new HomeComponent();
      const tipEl = document.createElement('div');
      document.body.appendChild(tipEl);
      Object.defineProperty(tipEl, 'parentElement', {
        get: () => {
          throw new Error('boom');
        },
      });
      (component as any).tipEl = tipEl;

      expect(() => component.ngOnDestroy()).not.toThrow();
      document.body.removeChild(tipEl);
    });
  });

  describe('resize handler (via addResizeListener)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('calls updateOptions when available on a chart', async () => {
      const component = new HomeComponent();
      const updateOptionsSpy = vi.fn();
      await component.ngAfterViewInit();
      (component as any).charts = [{ updateOptions: updateOptionsSpy }];

      window.dispatchEvent(new Event('resize'));

      expect(updateOptionsSpy).toHaveBeenCalledWith({}, true, true);
      component.ngOnDestroy();
    });

    it('falls back to render() when updateOptions is not available', async () => {
      const component = new HomeComponent();
      const renderSpy = vi.fn();
      await component.ngAfterViewInit();
      (component as any).charts = [{ render: renderSpy }];

      window.dispatchEvent(new Event('resize'));

      expect(renderSpy).toHaveBeenCalled();
      component.ngOnDestroy();
    });

    it('does nothing for a chart with neither updateOptions nor render', async () => {
      const component = new HomeComponent();
      await component.ngAfterViewInit();
      (component as any).charts = [{}];

      expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();
      component.ngOnDestroy();
    });

    it('swallows errors thrown while updating an individual chart', async () => {
      const component = new HomeComponent();
      await component.ngAfterViewInit();
      (component as any).charts = [
        {
          updateOptions: () => {
            throw new Error('boom');
          },
        },
      ];

      expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();

      component.ngOnDestroy();
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
