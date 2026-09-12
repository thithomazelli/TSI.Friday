import { ElementRef, NgZone } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ImageCroppedEvent } from 'ngx-image-cropper';
import { ImageCropModalComponent, ImageCropModalData } from './image-crop-modal.component';

describe('ImageCropModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn>; afterOpened: ReturnType<typeof vi.fn> };
  let elementRefMock: ElementRef<HTMLElement>;
  let ngZone: NgZone;
  let source: File;

  function createComponent(dialogData?: ImageCropModalData) {
    source = new File(['x'], 'photo.png', { type: 'image/png' });
    dialogRefMock = { close: vi.fn(), afterOpened: vi.fn().mockReturnValue(of(undefined)) };
    elementRefMock = { nativeElement: document.createElement('div') };
    ngZone = { run: (fn: () => void) => fn() } as unknown as NgZone;

    return new ImageCropModalComponent(
      dialogRefMock as unknown as MatDialogRef<ImageCropModalComponent>,
      dialogData ?? { source },
      elementRefMock,
      ngZone,
    );
  }

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create with the source file from dialogData', () => {
    const component = createComponent();
    expect(component.source).toBe(source);
  });

  it('starts at zoom 1 with a 300px default frame size', () => {
    const component = createComponent();
    expect(component.zoom).toBe(1);
    expect(component.frameSize).toBe(300);
  });

  describe('onImageCropped', () => {
    it('caches the cropped blob for later confirm()', () => {
      const component = createComponent();
      const blob = new Blob(['x']);

      component.onImageCropped({ blob } as ImageCroppedEvent);

      component.confirm();
      expect(dialogRefMock.close).toHaveBeenCalledWith(blob);
    });

    it('caches null when the event has no blob', () => {
      const component = createComponent();

      component.onImageCropped({} as ImageCroppedEvent);
      component.confirm();

      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });
  });

  describe('confirm', () => {
    it('does nothing when nothing has been cropped yet', () => {
      const component = createComponent();

      component.confirm();

      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('closes the dialog with no result', () => {
      const component = createComponent();

      component.close();

      expect(dialogRefMock.close).toHaveBeenCalledWith();
    });
  });

  describe('zoom controls', () => {
    it('onZoomChange reads the input value and clamps it into range', () => {
      const component = createComponent();
      const event = { target: { value: '10' } } as unknown as Event;

      component.onZoomChange(event);

      expect(component.zoom).toBe(3);
    });

    it('does not zoom below the minimum of 1', () => {
      const component = createComponent();
      const event = { target: { value: '0' } } as unknown as Event;

      component.onZoomChange(event);

      expect(component.zoom).toBe(1);
    });

    it('onWheelZoom zooms in on scroll-up and prevents default', () => {
      const component = createComponent();
      const event = { deltaY: -10, preventDefault: vi.fn() } as unknown as WheelEvent;

      component.onWheelZoom(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(component.zoom).toBeCloseTo(1.05);
    });

    it('onWheelZoom zooms out on scroll-down', () => {
      const component = createComponent();
      component.zoom = 2;
      const event = { deltaY: 10, preventDefault: vi.fn() } as unknown as WheelEvent;

      component.onWheelZoom(event);

      expect(component.zoom).toBeCloseTo(1.95);
    });

    it('onZoomStep steps zoom by the configured increment in either direction', () => {
      const component = createComponent();

      component.onZoomStep(1);
      expect(component.zoom).toBeCloseTo(1.25);

      component.onZoomStep(-1);
      expect(component.zoom).toBeCloseTo(1);
    });
  });

  describe('onTransformChange / pan clamping', () => {
    it('passes through translate values unchanged before the image has been measured', () => {
      const component = createComponent();

      component.onTransformChange({ scale: 1, translateH: 999, translateV: -999 });

      expect(component.transform.translateH).toBe(999);
      expect(component.transform.translateV).toBe(-999);
      expect(component.transform.translateUnit).toBe('px');
    });

    it('clamps the pan so the image cannot uncover the crop frame', () => {
      const component = createComponent();
      // Simulate a measured 500x500 image with a 200px frame at scale 1: max pan is
      // (500*1 - 200) / 2 = 150px on each axis.
      (component as unknown as { baseImgWidth: number }).baseImgWidth = 500;
      (component as unknown as { baseImgHeight: number }).baseImgHeight = 500;
      component.frameSize = 200;

      component.onTransformChange({ scale: 1, translateH: 999, translateV: -999 });

      expect(component.transform.translateH).toBe(150);
      expect(component.transform.translateV).toBe(-150);
    });

    it('updates zoom to match the new transform scale', () => {
      const component = createComponent();

      component.onTransformChange({ scale: 2.5 });

      expect(component.zoom).toBe(2.5);
    });

    it('keeps the current zoom when the transform carries no scale', () => {
      const component = createComponent();
      component.zoom = 1.75;

      component.onTransformChange({ translateH: 0, translateV: 0 });

      expect(component.zoom).toBe(1.75);
    });

    it('falls back to the current zoom/translate values once measured, when the transform omits them', () => {
      const component = createComponent();
      (component as unknown as { baseImgWidth: number }).baseImgWidth = 500;
      (component as unknown as { baseImgHeight: number }).baseImgHeight = 500;
      component.frameSize = 200;
      component.zoom = 1;

      component.onTransformChange({});

      // scale ?? this.zoom -> 1; translateH/V ?? 0 -> already-centered pan needs no clamping.
      expect(component.transform.translateH).toBe(0);
      expect(component.transform.translateV).toBe(0);
    });
  });

  describe('ngAfterViewInit', () => {
    it('does nothing when the cropper wrapper is not in the DOM yet', () => {
      const component = createComponent();

      expect(() => component.ngAfterViewInit()).not.toThrow();
      expect((component as unknown as { resizeObserver?: unknown }).resizeObserver).toBeUndefined();
    });

    it('observes the wrapper and re-measures after the dialog finishes opening', () => {
      const component = createComponent();
      const wrapper = document.createElement('div');
      wrapper.className = 'cropper-wrapper';
      elementRefMock.nativeElement.appendChild(wrapper);

      component.ngAfterViewInit();

      expect((component as unknown as { resizeObserver?: { observe: unknown } }).resizeObserver).toBeTruthy();
      expect(dialogRefMock.afterOpened).toHaveBeenCalled();
    });
  });

  describe('measure (via ngAfterViewInit -> afterOpened)', () => {
    it('reads the rendered image and wrapper sizes to compute the frame size', () => {
      const component = createComponent();
      const wrapper = document.createElement('div');
      wrapper.className = 'cropper-wrapper';
      const img = document.createElement('img');
      img.className = 'ngx-ic-source-image';
      wrapper.appendChild(img);
      elementRefMock.nativeElement.appendChild(wrapper);

      vi.spyOn(img, 'getBoundingClientRect').mockReturnValue({
        width: 400,
        height: 300,
      } as DOMRect);
      vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
        width: 500,
        height: 500,
      } as DOMRect);

      component.ngAfterViewInit();

      // shorterSide = min(500, 500, 400, 300) = 300; frameSize = max(60, 300 - 8) = 292.
      expect(component.frameSize).toBe(292);
    });

    it('leaves frameSize unchanged when the image has not rendered with real dimensions yet', () => {
      const component = createComponent();
      const wrapper = document.createElement('div');
      wrapper.className = 'cropper-wrapper';
      const img = document.createElement('img');
      img.className = 'ngx-ic-source-image';
      wrapper.appendChild(img);
      elementRefMock.nativeElement.appendChild(wrapper);
      // jsdom's default getBoundingClientRect() returns all-zero dimensions.

      const before = component.frameSize;
      component.ngAfterViewInit();

      expect(component.frameSize).toBe(before);
    });

    it('does not throw when the wrapper has no source image yet', () => {
      const component = createComponent();
      const wrapper = document.createElement('div');
      wrapper.className = 'cropper-wrapper';
      elementRefMock.nativeElement.appendChild(wrapper);

      expect(() => component.ngAfterViewInit()).not.toThrow();
    });

    it('does nothing when there is no wrapper to measure at all', () => {
      const component = createComponent();

      expect(() => (component as unknown as { measure: () => void }).measure()).not.toThrow();
    });

    it('re-measures whenever the resize observer fires', () => {
      let capturedCallback: (() => void) | undefined;
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(cb: () => void) {
            capturedCallback = cb;
          }
          observe = vi.fn();
          disconnect = vi.fn();
        },
      );
      const component = createComponent();
      const wrapper = document.createElement('div');
      wrapper.className = 'cropper-wrapper';
      elementRefMock.nativeElement.appendChild(wrapper);

      component.ngAfterViewInit();

      expect(() => capturedCallback!()).not.toThrow();
    });
  });

  describe('ngOnDestroy', () => {
    it('disconnects the resize observer if one was attached', () => {
      const component = createComponent();
      const disconnect = vi.fn();
      (component as unknown as { resizeObserver: { disconnect: () => void } }).resizeObserver = { disconnect };

      component.ngOnDestroy();

      expect(disconnect).toHaveBeenCalled();
    });

    it('does not throw when no resize observer was ever attached', () => {
      const component = createComponent();
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});
