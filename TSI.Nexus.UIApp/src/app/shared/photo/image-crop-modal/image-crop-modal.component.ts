import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  NgZone,
  OnDestroy,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  ImageCroppedEvent,
  ImageCropperComponent,
  ImageTransform,
} from 'ngx-image-cropper';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

export interface ImageCropModalData {
  source: File;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-image-crop-modal',
  templateUrl: './image-crop-modal.component.html',
  styleUrl: './image-crop-modal.component.scss',
  imports: [ImageCropperComponent, TranslatePipe],
})
export class ImageCropModalComponent implements AfterViewInit, OnDestroy {
  source: File;
  // translateUnit 'px' matters beyond just the unit label: ngx-image-cropper's
  // drag handler adds the raw mouse-pixel delta straight onto translateH/V
  // with no scaling - under the default '%' unit that raw number is then
  // read as a percentage of the image's own box width, so 1px of mouse
  // movement became ~1% of ~470px (~4-5px of visual movement, badly
  // over-sensitive). 'px' makes that same raw delta mean literally 1px,
  // giving a natural 1:1 drag.
  transform: ImageTransform = { scale: 1, translateUnit: 'px' };
  zoom = 1;

  // Starts smaller than the canvas so allowMoveImage's outside-the-box drag
  // has somewhere to land before the photo loads; measure() (see below)
  // resizes this to hug the canvas's shorter dimension once the real size is
  // known.
  frameSize = 300;

  private readonly minZoom = 1;
  private readonly maxZoom = 3;
  private readonly zoomStep = 0.25;
  private croppedBlob: Blob | null = null;

  // The photo's own on-screen size (in CSS px) at scale 1, captured once it
  // loads - used by clampTransform to work out how far the image can pan
  // before the frame would no longer be fully covered.
  private baseImgWidth = 0;
  private baseImgHeight = 0;
  private resizeObserver?: ResizeObserver;

  constructor(
    public dialogRef: MatDialogRef<ImageCropModalComponent>,
    @Inject(MAT_DIALOG_DATA) public dialogData: ImageCropModalData,
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly ngZone: NgZone,
  ) {
    this.source = dialogData.source;
  }

  // A one-off measurement (e.g. off imageLoaded) races the library's own
  // post-load layout pass (it resizes the wrapper's auto height to the
  // photo's aspect ratio, sizes the cropper, etc.) and can read stale
  // dimensions. A ResizeObserver instead re-measures every time the wrapper's
  // box actually changes size - including its first layout - so frameSize and
  // the pan bounds below always reflect the real, settled canvas.
  ngAfterViewInit(): void {
    const wrapper = this.elementRef.nativeElement.querySelector('.cropper-wrapper');
    if (!wrapper) return;
    this.resizeObserver = new ResizeObserver(() => this.ngZone.run(() => this.measure()));
    this.resizeObserver.observe(wrapper);
    // The dialog's own open animation resizes/repositions its panel over time,
    // which can make the wrapper's very first ResizeObserver firings land
    // mid-animation - afterOpened() only fires once that animation has
    // actually finished, so re-measuring there catches the real settled size
    // even if the observer itself went quiet before the animation was done.
    this.dialogRef.afterOpened().subscribe(() => this.measure());
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  private measure(): void {
    const img = this.elementRef.nativeElement.querySelector('.ngx-ic-source-image');
    if (img) {
      const rect = img.getBoundingClientRect();
      if (rect.width && rect.height) {
        this.baseImgWidth = rect.width;
        this.baseImgHeight = rect.height;
      }
    }
    // Fill the shorter of the canvas's own dimensions AND the photo's own
    // rendered dimensions - the library silently clamps a static crop size
    // that exceeds the visible image's bounds on just one axis, which turns
    // a "circle" into a squashed ellipse if frameSize is sized off the
    // (square) canvas alone while a non-square photo renders shorter than it
    // on one side. The 8px inset keeps the dashed outline from getting
    // clipped by the canvas's own overflow:hidden.
    const wrapper = this.elementRef.nativeElement.querySelector('.cropper-wrapper');
    if (wrapper) {
      const wrapperRect = wrapper.getBoundingClientRect();
      if (wrapperRect.width && wrapperRect.height && this.baseImgWidth && this.baseImgHeight) {
        const shorterSide = Math.min(
          wrapperRect.width,
          wrapperRect.height,
          this.baseImgWidth,
          this.baseImgHeight,
        );
        this.frameSize = Math.max(60, shorterSide - 8);
      }
    }
  }

  // Fires on every crop-area interaction (drag, resize, zoom) since autoCrop
  // defaults to true - we just cache the latest result, the user only commits
  // it by clicking "Definir nova foto".
  onImageCropped(event: ImageCroppedEvent): void {
    this.croppedBlob = event.blob ?? null;
  }

  // allowMoveImage lets the user drag the photo (outside the crop box) to pan
  // it, which the library reports back only through this event - we must fold
  // it into `transform`, or the next zoom change (which spreads `transform`)
  // would silently reset the user's pan back to center.
  onTransformChange(transform: ImageTransform): void {
    this.transform = this.clampTransform(transform);
    this.zoom = this.transform.scale ?? this.zoom;
  }

  onZoomChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.setZoom(value);
  }

  onWheelZoom(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.05 : -0.05;
    this.setZoom(this.zoom + delta);
  }

  onZoomStep(direction: 1 | -1): void {
    this.setZoom(this.zoom + direction * this.zoomStep);
  }

  confirm(): void {
    if (!this.croppedBlob) return;
    this.dialogRef.close(this.croppedBlob);
  }

  close(): void {
    this.dialogRef.close();
  }

  private setZoom(value: number): void {
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, value));
    // Re-clamp on every zoom change too, not just after a drag: zooming back
    // out shrinks the image, so a pan that was valid at a higher zoom can
    // leave the frame partially uncovered once the image is smaller again.
    this.transform = this.clampTransform({ ...this.transform, scale: this.zoom });
  }

  // Keeps the crop frame fully covered by the image: with translateUnit 'px',
  // translateH/V are literal pixel offsets, so the max allowed pan at a given
  // zoom is simply half of however much the scaled image overflows the frame.
  private clampTransform(transform: ImageTransform): ImageTransform {
    if (!this.baseImgWidth || !this.baseImgHeight) {
      return { ...transform, translateUnit: 'px' };
    }
    const scale = transform.scale ?? this.zoom;
    const maxH = Math.max(0, (this.baseImgWidth * scale - this.frameSize) / 2);
    const maxV = Math.max(0, (this.baseImgHeight * scale - this.frameSize) / 2);
    const translateH = Math.min(maxH, Math.max(-maxH, transform.translateH ?? 0));
    const translateV = Math.min(maxV, Math.max(-maxV, transform.translateV ?? 0));
    return { ...transform, translateH, translateV, translateUnit: 'px' };
  }
}
