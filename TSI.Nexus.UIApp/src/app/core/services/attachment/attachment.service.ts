import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { ApiService, ApiType, Attachment, WebApiResponse } from '@nexus/core';

@Injectable({ providedIn: 'root' })
export class AttachmentService {
  private _baseEndPoint = ApiType.Attachments;
  private _attachmentChangedSubject = new BehaviorSubject<void>(undefined);
  attachmentChanged$ = this._attachmentChangedSubject.asObservable();

  constructor(private apiService: ApiService) {}

  getById(id: string): Observable<WebApiResponse<Attachment>> {
    return this.apiService.get<WebApiResponse<Attachment>>(
      `${this._baseEndPoint}/getById/${id}`,
    );
  }

  getByBusinessPartnerId(
    businessPartnerId: string,
  ): Observable<WebApiResponse<Attachment[]>> {
    return this.apiService.get<WebApiResponse<Attachment[]>>(
      `${this._baseEndPoint}/getByBusinessPartnerId/${businessPartnerId}`,
    );
  }

  getByOrderId(orderId: string): Observable<WebApiResponse<Attachment[]>> {
    return this.apiService.get<WebApiResponse<Attachment[]>>(
      `${this._baseEndPoint}/getByOrderId/${orderId}`,
    );
  }

  getByPurchaseOrderId(
    purchaseOrderId: string,
  ): Observable<WebApiResponse<Attachment[]>> {
    return this.apiService.get<WebApiResponse<Attachment[]>>(
      `${this._baseEndPoint}/getByPurchaseOrderId/${purchaseOrderId}`,
    );
  }

  getByTripId(tripId: string): Observable<WebApiResponse<Attachment[]>> {
    return this.apiService.get<WebApiResponse<Attachment[]>>(
      `${this._baseEndPoint}/getByTripId/${tripId}`,
    );
  }

  getByTransactionId(
    transactionId: string,
  ): Observable<WebApiResponse<Attachment[]>> {
    return this.apiService.get<WebApiResponse<Attachment[]>>(
      `${this._baseEndPoint}/getByTransactionId/${transactionId}`,
    );
  }

  getByPaymentId(paymentId: string): Observable<WebApiResponse<Attachment[]>> {
    return this.apiService.get<WebApiResponse<Attachment[]>>(
      `${this._baseEndPoint}/getByPaymentId/${paymentId}`,
    );
  }

  getByProductId(productId: string): Observable<WebApiResponse<Attachment[]>> {
    return this.apiService.get<WebApiResponse<Attachment[]>>(
      `${this._baseEndPoint}/getByProductId/${productId}`,
    );
  }

  getByVehicleId(vehicleId: string): Observable<WebApiResponse<Attachment[]>> {
    return this.apiService.get<WebApiResponse<Attachment[]>>(
      `${this._baseEndPoint}/getByVehicleId/${vehicleId}`,
    );
  }

  getByDriverId(driverId: string): Observable<WebApiResponse<Attachment[]>> {
    return this.apiService.get<WebApiResponse<Attachment[]>>(
      `${this._baseEndPoint}/getByDriverId/${driverId}`,
    );
  }

  getByVehicleMaintenanceId(
    vehicleMaintenanceId: string,
  ): Observable<WebApiResponse<Attachment[]>> {
    return this.apiService.get<WebApiResponse<Attachment[]>>(
      `${this._baseEndPoint}/getByVehicleMaintenanceId/${vehicleMaintenanceId}`,
    );
  }

  getByUserId(userId: string): Observable<WebApiResponse<Attachment[]>> {
    return this.apiService.get<WebApiResponse<Attachment[]>>(
      `${this._baseEndPoint}/getByUserId/${userId}`,
    );
  }

  add(
    attachment: Attachment,
    overridePath?: string,
  ): Observable<WebApiResponse<Attachment>> {
    const formData = this.buildFormData(attachment);
    if (overridePath) {
      formData.append('overridePath', overridePath);
    }
    return this.apiService
      .post<WebApiResponse<Attachment>>(`${this._baseEndPoint}/add`, formData)
      .pipe(tap(() => this._attachmentChangedSubject.next()));
  }

  update(
    attachment: Attachment,
    overridePath?: string,
  ): Observable<WebApiResponse<Attachment>> {
    const formData = this.buildFormData(attachment);
    if (overridePath) {
      formData.append('overridePath', overridePath);
    }
    return this.apiService
      .put<WebApiResponse<Attachment>>(`${this._baseEndPoint}/update`, formData)
      .pipe(tap(() => this._attachmentChangedSubject.next()));
  }

  delete(id: string): Observable<WebApiResponse<Attachment>> {
    return this.apiService
      .delete<
        WebApiResponse<Attachment>
      >(`${this._baseEndPoint}/delete/${id}`, null)
      .pipe(tap(() => this._attachmentChangedSubject.next()));
  }

  downloadFile(id: string): Observable<Blob> {
    return this.apiService.getBlob(`${this._baseEndPoint}/getFileById/${id}`);
  }

  private buildFormData(attachment: Attachment): FormData {
    const fd = new FormData();
    if (attachment.id) fd.append('id', attachment.id);
    if (attachment.file)
      fd.append('file', attachment.file, attachment.file.name);
    if (attachment.businessPartnerId)
      fd.append('businessPartnerId', attachment.businessPartnerId);
    if (attachment.orderId) fd.append('orderId', attachment.orderId);
    if (attachment.purchaseOrderId)
      fd.append('purchaseOrderId', attachment.purchaseOrderId);
    if (attachment.tripId) fd.append('tripId', attachment.tripId);
    if (attachment.transactionId)
      fd.append('transactionId', attachment.transactionId);
    if (attachment.paymentId) fd.append('paymentId', attachment.paymentId);
    if (attachment.productId) fd.append('productId', attachment.productId);
    if (attachment.vehicleId) fd.append('vehicleId', attachment.vehicleId);
    if (attachment.driverId) fd.append('driverId', attachment.driverId);
    if (attachment.vehicleMaintenanceId)
      fd.append('vehicleMaintenanceId', attachment.vehicleMaintenanceId);
    if (attachment.userId) fd.append('userId', attachment.userId);
    return fd;
  }
}
