import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import {
  ApiService,
  ApiType,
  FeatureToggle,
  FeatureToggleKeys,
  WebApiResponse,
} from '@nexus/core';

@Injectable({
  providedIn: 'root',
})
export class FeatureFlagService {
  private _baseEndPoint = ApiType.FeatureToggles;

  // null means "not loaded yet" - kept out of every consumer-facing stream (see toggles$ below)
  // so a module stays out of the DOM until the real toggle set arrives, instead of a guessed
  // default (enabled or disabled) flashing on screen first. Single source of truth for every
  // consumer (sidebar, navbar, every module tab across the app) - the state itself only exists
  // once, in this signal, no matter how many places read it.
  private readonly _toggles = signal<FeatureToggle[] | null>(null);

  /**
   * Observable view of the loaded toggle set, skipping the not-loaded-yet state entirely - built
   * once, in the injection context of this service's own construction (a requirement of
   * toObservable()), and reused by every isEnabled() call rather than each building its own.
   */
  private readonly toggles$: Observable<FeatureToggle[]> = toObservable(this._toggles).pipe(
    filter((toggles): toggles is FeatureToggle[] => toggles !== null),
  );

  constructor(private apiService: ApiService) {
    this.load();
  }

  private load(): void {
    this.apiService
      .get<WebApiResponse<FeatureToggle[]>>(`${this._baseEndPoint}/getAll`)
      .subscribe((response) => this._toggles.set(response.data ?? []));
  }

  refresh(): void {
    this.load();
  }

  /**
   * Returns whether the module identified by key is enabled. Fails open (true) when the toggle
   * isn't registered, so a slow/failed request never hides an unrelated module by accident - the
   * same fail-open policy used server-side. Emits nothing until the toggle set has loaded once
   * (see toggles$) - callers gate visibility on that (e.g. *ngIf="... | async", which treats "no
   * emission yet" as falsy) rather than on a guessed default, which is what used to let disabled
   * modules flash visible before the real state arrived.
   */
  isEnabled(key: string): Observable<boolean> {
    return this.toggles$.pipe(
      map((toggles) => {
        const toggle = toggles.find((t) => t.key === key);
        return toggle ? toggle.enabled !== false : true;
      }),
    );
  }

  isFleetModuleEnabled(): Observable<boolean> {
    return this.isEnabled(FeatureToggleKeys.FleetModule);
  }

  setEnabled(key: string, enabled: boolean): Observable<WebApiResponse<FeatureToggle>> {
    return this.apiService
      .put<WebApiResponse<FeatureToggle>>(
        `${this._baseEndPoint}/setEnabled/${key}/${enabled}`,
        null,
      )
      .pipe(tap(() => this.refresh()));
  }

  getAll(): Observable<WebApiResponse<FeatureToggle[]>> {
    return this.apiService.get<WebApiResponse<FeatureToggle[]>>(
      `${this._baseEndPoint}/getAll`,
    );
  }
}
