import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { PT_BR } from '../../i18n/pt-br';
import { EN } from '../../i18n/en';
import { ES } from '../../i18n/es';

export type AppLanguage = 'pt-BR' | 'en' | 'es';

const STORAGE_KEY = 'app-language';
const DEFAULT_LANGUAGE: AppLanguage = 'pt-BR';

const DICTIONARIES: Record<AppLanguage, Record<string, unknown>> = {
  'pt-BR': PT_BR,
  en: EN,
  es: ES,
};

/**
 * Minimal in-house i18n service - keyed dictionaries per supported language, no external
 * dependency. Scope so far: sidebar navigation, navbar/profile dropdown and the preferences
 * panel; the rest of the app's hardcoded pt-BR strings migrate incrementally.
 */
@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  private readonly _language = signal<AppLanguage>(this.readInitialLanguage());

  readonly language$: Observable<AppLanguage> = toObservable(this._language);

  get current(): AppLanguage {
    return this._language();
  }

  constructor() {
    this.applyDocumentLang(this.current);
  }

  use(language: AppLanguage): void {
    this._language.set(language);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore storage errors
    }
    this.applyDocumentLang(language);
  }

  /**
   * Resolves a key to its translated string. Pass `params` to substitute `{name}` placeholders
   * in the resolved value, e.g. instant('GRID.EDIT_ENTITY', { entity: t('SIDEBAR.CLIENTS') }).
   */
  instant(key: string, params?: Record<string, string>): string {
    const dictionary = DICTIONARIES[this.current] ?? DICTIONARIES[DEFAULT_LANGUAGE];
    const value = this.resolveKey(dictionary, key);
    const resolved = typeof value === 'string' ? value : key;
    if (!params) {
      return resolved;
    }
    return resolved.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? params[name] : match,
    );
  }

  private resolveKey(dictionary: Record<string, unknown>, key: string): unknown {
    return key
      .split('.')
      .reduce<unknown>(
        (acc, segment) =>
          acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined,
        dictionary,
      );
  }

  private applyDocumentLang(language: AppLanguage): void {
    document.documentElement.setAttribute('lang', language);
  }

  private readInitialLanguage(): AppLanguage {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'pt-BR' || stored === 'en' || stored === 'es') {
        return stored;
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_LANGUAGE;
  }
}
