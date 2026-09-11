import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';

// Without this, a backend that never responds (hung request, dead connection) just leaves the
// caller pending forever with no feedback - the request silently "disappears" rather than
// failing, which is exactly what reads as unexplained slowness during navigation.
const REQUEST_TIMEOUT_MS = 30_000;

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  constructor(private httpClient: HttpClient) {}

  get<T>(apiUrl: string, headers?: HttpHeaders): Observable<T> {
    return this.httpClient
      .get<T>(`${environment.appUrl}/api/${apiUrl}`, { headers, withCredentials: true })
      .pipe(timeout(REQUEST_TIMEOUT_MS));
  }

  // Separate from get<T>() because a binary response (here, a generated PDF) can't go through
  // HttpClient's default JSON parsing - responseType: 'blob' is what tells it to hand back the
  // raw bytes instead of trying (and failing) to JSON.parse them.
  getBlob(apiUrl: string): Observable<Blob> {
    return this.httpClient
      .get(`${environment.appUrl}/api/${apiUrl}`, { responseType: 'blob', withCredentials: true })
      .pipe(timeout(REQUEST_TIMEOUT_MS));
  }

  post<T>(apiUrl: string, model: any): Observable<T> {
    return this.httpClient
      .post<T>(`${environment.appUrl}/api/${apiUrl}`, model, { withCredentials: true })
      .pipe(timeout(REQUEST_TIMEOUT_MS));
  }

  put<T>(apiUrl: string, model: any): Observable<T> {
    return this.httpClient
      .put<T>(`${environment.appUrl}/api/${apiUrl}`, model, { withCredentials: true })
      .pipe(timeout(REQUEST_TIMEOUT_MS));
  }

  delete<T>(apiUrl: string, model: any): Observable<T> {
    return this.httpClient
      .delete<T>(`${environment.appUrl}/api/${apiUrl}`, { body: model, withCredentials: true })
      .pipe(timeout(REQUEST_TIMEOUT_MS));
  }
}
