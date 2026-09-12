import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { ApiService, ApiType } from '@nexus/core';

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private _photoEndPoint = ApiType.Photos;
  private readonly _photo = signal<{ photoPath: string; userId?: string }>({
    photoPath: '',
  });
  readonly photo$: Observable<{ photoPath: string; userId?: string }> = toObservable(this._photo);

  constructor(private apiService: ApiService) {}

  updateUserPhoto(photoPath: string, userId?: string): void {
    this._photo.set({ photoPath, userId });
  }

  /** POST photos/UploadPhoto — atualiza o atributo photo na entidade */
  uploadPhoto(entity: string, entityId: string, file: File): Observable<any> {
    const fd = new FormData();
    fd.append('entity', entity);
    fd.append('entityId', entityId);
    fd.append('file', file, file.name);
    return this.apiService.post<any>(`${this._photoEndPoint}/uploadPhoto`, fd);
  }

  /** POST photos/UploadPhoto sem arquivo — limpa o campo photo na entidade */
  removePhoto(entity: string, entityId: string): Observable<any> {
    const fd = new FormData();
    fd.append('entity', entity);
    fd.append('entityId', entityId);
    return this.apiService.post<any>(`${this._photoEndPoint}/uploadPhoto`, fd);
  }

  /** GET photos/GetPhoto?entity=...&entityId=...&fileName=... — retorna o blob da imagem */
  getPhoto(
    entity: string,
    entityId: string,
    fileName: string,
  ): Observable<Blob> {
    const query = new URLSearchParams({ entity, entityId, fileName }).toString();
    return this.apiService.getBlob(`${this._photoEndPoint}/getPhoto?${query}`);
  }
}
