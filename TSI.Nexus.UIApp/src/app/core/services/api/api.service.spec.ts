import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiService } from './api.service';
import { environment } from '../../../../environments/environment';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('get() should hit the right URL with credentials and return the response body', () => {
    const result: unknown[] = [];
    service.get<unknown[]>('vehicles/getAll').subscribe((res) => result.push(...res));

    const req = httpMock.expectOne(`${environment.appUrl}/api/vehicles/getAll`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush([{ id: '1' }]);

    expect(result).toEqual([{ id: '1' }]);
  });

  it('post() should send the body and return the response', () => {
    let response: { id: string } | undefined;
    service.post<{ id: string }>('vehicles/add', { plate: 'ABC1234' }).subscribe((res) => {
      response = res;
    });

    const req = httpMock.expectOne(`${environment.appUrl}/api/vehicles/add`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ plate: 'ABC1234' });
    expect(req.request.withCredentials).toBe(true);
    req.flush({ id: '1' });

    expect(response).toEqual({ id: '1' });
  });

  it('put() should send the body and return the response', () => {
    let response: { id: string } | undefined;
    service.put<{ id: string }>('vehicles/update', { id: '1', plate: 'ABC1234' }).subscribe((res) => {
      response = res;
    });

    const req = httpMock.expectOne(`${environment.appUrl}/api/vehicles/update`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ id: '1', plate: 'ABC1234' });
    expect(req.request.withCredentials).toBe(true);
    req.flush({ id: '1' });

    expect(response).toEqual({ id: '1' });
  });

  it('getBlob() should request a blob response type', () => {
    let response: Blob | undefined;
    service.getBlob('documenttemplates/download/Order').subscribe((res) => {
      response = res;
    });

    const req = httpMock.expectOne(
      `${environment.appUrl}/api/documenttemplates/download/Order`,
    );
    expect(req.request.responseType).toBe('blob');
    const blob = new Blob(['fake-pdf']);
    req.flush(blob);

    expect(response).toBe(blob);
  });

  it('delete() should send the body as the request payload', () => {
    service.delete<void>('vehicles/remove', { id: '1' }).subscribe();

    const req = httpMock.expectOne(`${environment.appUrl}/api/vehicles/remove`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ id: '1' });
    req.flush(null);
  });
});
