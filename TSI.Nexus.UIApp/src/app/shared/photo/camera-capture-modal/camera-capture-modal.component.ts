import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { NgIf } from '@angular/common';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-camera-capture-modal',
  templateUrl: './camera-capture-modal.component.html',
  styleUrl: './camera-capture-modal.component.scss',
  imports: [NgIf, TranslatePipe],
})
export class CameraCaptureModalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('videoEl')
  videoEl!: ElementRef<HTMLVideoElement>;

  @ViewChild('canvasEl')
  canvasEl!: ElementRef<HTMLCanvasElement>;

  capturedDataUrl: string | null = null;

  private capturedBlob: Blob | null = null;
  private mediaStream?: MediaStream;

  constructor(public dialogRef: MatDialogRef<CameraCaptureModalComponent>) {}

  ngAfterViewInit(): void {
    this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  capture(): void {
    const video = this.videoEl?.nativeElement;
    const canvas = this.canvasEl?.nativeElement;
    if (!video || !canvas) return;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    this.capturedDataUrl = canvas.toDataURL('image/png');
    canvas.toBlob((blob) => {
      this.capturedBlob = blob;
    }, 'image/png');
  }

  // Lets the user discard a shot they don't like and go back to the live preview
  // without reopening the whole modal / re-requesting camera permission.
  retake(): void {
    this.capturedDataUrl = null;
    this.capturedBlob = null;
  }

  confirm(): void {
    if (!this.capturedBlob) return;
    const file = new File([this.capturedBlob], `webcam-${Date.now()}.png`, {
      type: 'image/png',
    });
    this.stopCamera();
    this.dialogRef.close(file);
  }

  close(): void {
    this.stopCamera();
    this.dialogRef.close();
  }

  private async startCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.close();
      return;
    }
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      const videoElRef = this.videoEl?.nativeElement;
      if (!videoElRef) return;
      videoElRef.srcObject = this.mediaStream;
      await videoElRef.play();
    } catch (err) {
      console.error('Camera start failed', err);
      this.close();
    }
  }

  private stopCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = undefined;
    }
  }
}
