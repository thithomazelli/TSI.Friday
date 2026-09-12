import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

export type AppTheme = 'light' | 'dark';

const STORAGE_KEY = 'app-theme';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly _theme = signal<AppTheme>(this.readInitialTheme());

  readonly theme$: Observable<AppTheme> = toObservable(this._theme);

  get current(): AppTheme {
    return this._theme();
  }

  constructor() {
    this.apply(this.current);
  }

  /** Applies a theme locally (DOM + localStorage) without touching the backend. */
  apply(theme: AppTheme): void {
    document.documentElement.setAttribute('data-bs-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage errors (private browsing, quota, etc.)
    }
    this._theme.set(theme);
  }

  toggle(): AppTheme {
    const next: AppTheme = this.current === 'dark' ? 'light' : 'dark';
    this.apply(next);
    return next;
  }

  private readInitialTheme(): AppTheme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch {
      // ignore storage errors
    }
    return 'light';
  }
}
