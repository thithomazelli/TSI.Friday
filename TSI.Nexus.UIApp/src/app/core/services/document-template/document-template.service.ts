import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ApiService,
  ApiType,
  DocumentTemplate,
  DocumentTemplateType,
  WebApiResponse,
} from '@nexus/core';

@Injectable({
  providedIn: 'root',
})
export class DocumentTemplateService {
  private _baseEndPoint = ApiType.DocumentTemplates;

  constructor(private apiService: ApiService) {}

  getAll(): Observable<WebApiResponse<DocumentTemplate[]>> {
    return this.apiService.get<WebApiResponse<DocumentTemplate[]>>(
      `${this._baseEndPoint}/getAll`,
    );
  }

  getByType(
    type: DocumentTemplateType,
  ): Observable<WebApiResponse<DocumentTemplate>> {
    return this.apiService.get<WebApiResponse<DocumentTemplate>>(
      `${this._baseEndPoint}/getByType/${type}`,
    );
  }

  download(type: DocumentTemplateType): Observable<Blob> {
    return this.apiService.getBlob(`${this._baseEndPoint}/download/${type}`);
  }

  upload(
    type: DocumentTemplateType,
    file: File,
  ): Observable<WebApiResponse<DocumentTemplate>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.apiService.post<WebApiResponse<DocumentTemplate>>(
      `${this._baseEndPoint}/upload/${type}`,
      formData,
    );
  }
}
