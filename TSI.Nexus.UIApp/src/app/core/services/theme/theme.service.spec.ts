import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-bs-theme');
    TestBed.configureTestingModule({});
  });

  function createService(): ThemeService {
    return TestBed.inject(ThemeService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('defaults to light when nothing is stored', () => {
    const service = createService();

    expect(service.current).toBe('light');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
  });

  it('reads the stored theme on construction', () => {
    localStorage.setItem('app-theme', 'dark');

    const service = createService();

    expect(service.current).toBe('dark');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
  });

  it('ignores an invalid stored value and falls back to light', () => {
    localStorage.setItem('app-theme', 'purple');

    const service = createService();

    expect(service.current).toBe('light');
  });

  it('apply sets the DOM attribute, persists to localStorage, and updates current/theme$', () => {
    const service = createService();
    let latest: string | undefined;
    service.theme$.subscribe((t) => (latest = t));
    TestBed.flushEffects();

    service.apply('dark');
    TestBed.flushEffects();

    expect(service.current).toBe('dark');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
    expect(localStorage.getItem('app-theme')).toBe('dark');
    expect(latest).toBe('dark');
  });

  it('toggle flips between light and dark and returns the new value', () => {
    const service = createService();

    expect(service.current).toBe('light');
    expect(service.toggle()).toBe('dark');
    expect(service.current).toBe('dark');
    expect(service.toggle()).toBe('light');
    expect(service.current).toBe('light');
  });
});
