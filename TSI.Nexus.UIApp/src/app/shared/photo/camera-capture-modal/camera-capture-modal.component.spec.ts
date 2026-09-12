import { ElementRef } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { CameraCaptureModalComponent } from './camera-capture-modal.component';

describe('CameraCaptureModalComponent', () => {
  let dialogRefMock: { close: ReturnType<typeof vi.fn> };
  let component: CameraCaptureModalComponent;
  let originalMediaDevices: MediaDevices;

  function videoRef(overrides: Partial<HTMLVideoElement> = {}): ElementRef<HTMLVideoElement> {
    return {
      nativeElement: { videoWidth: 640, videoHeight: 480, play: vi.fn().mockResolvedValue(undefined), ...overrides },
    } as unknown as ElementRef<HTMLVideoElement>;
  }

  function canvasRef(overrides: Partial<HTMLCanvasElement> = {}): ElementRef<HTMLCanvasElement> {
    const ctx = { drawImage: vi.fn() };
    return {
      nativeElement: {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(ctx),
        toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock'),
        toBlob: (cb: (blob: Blob | null) => void) => cb(new Blob(['x'], { type: 'image/png' })),
        ...overrides,
      },
    } as unknown as ElementRef<HTMLCanvasElement>;
  }

  beforeEach(() => {
    originalMediaDevices = navigator.mediaDevices;
    dialogRefMock = { close: vi.fn() };
    component = new CameraCaptureModalComponent(dialogRefMock as unknown as MatDialogRef<CameraCaptureModalComponent>);
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: originalMediaDevices, configurable: true });
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngAfterViewInit / camera startup', () => {
    it('closes the modal when the browser has no getUserMedia support', async () => {
      Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });

      await component.ngAfterViewInit();

      expect(dialogRefMock.close).toHaveBeenCalled();
    });

    it('starts the stream and attaches it to the video element on success', async () => {
      const tracks = [{ stop: vi.fn() }];
      const stream = { getTracks: () => tracks } as unknown as MediaStream;
      const getUserMedia = vi.fn().mockResolvedValue(stream);
      Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
      component.videoEl = videoRef();

      await component.ngAfterViewInit();

      expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'user' }, audio: false });
      expect(component.videoEl.nativeElement.srcObject).toBe(stream);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('closes the modal when getUserMedia rejects', async () => {
      const getUserMedia = vi.fn().mockRejectedValue(new Error('denied'));
      Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
      vi.spyOn(console, 'error').mockImplementation(() => {});
      component.videoEl = videoRef();

      await component.ngAfterViewInit();

      expect(dialogRefMock.close).toHaveBeenCalled();
    });
  });

  describe('capture', () => {
    it('does nothing when the video/canvas refs are missing', () => {
      expect(() => component.capture()).not.toThrow();
      expect(component.capturedDataUrl).toBeNull();
    });

    it('draws the current frame and stores the resulting data URL', () => {
      component.videoEl = videoRef();
      component.canvasEl = canvasRef();

      component.capture();

      expect(component.capturedDataUrl).toBe('data:image/png;base64,mock');
    });

    it('falls back to 1280x720 when the video has no reported dimensions yet', () => {
      component.videoEl = videoRef({ videoWidth: 0, videoHeight: 0 });
      component.canvasEl = canvasRef();

      component.capture();

      expect(component.canvasEl.nativeElement.width).toBe(1280);
      expect(component.canvasEl.nativeElement.height).toBe(720);
    });
  });

  describe('retake', () => {
    it('clears the captured preview', () => {
      component.videoEl = videoRef();
      component.canvasEl = canvasRef();
      component.capture();

      component.retake();

      expect(component.capturedDataUrl).toBeNull();
    });
  });

  describe('confirm', () => {
    it('does nothing when nothing has been captured', () => {
      component.confirm();

      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('closes the dialog with a File built from the captured blob', () => {
      component.videoEl = videoRef();
      component.canvasEl = canvasRef();
      component.capture();

      component.confirm();

      expect(dialogRefMock.close).toHaveBeenCalledWith(expect.any(File));
      const file = dialogRefMock.close.mock.calls[0][0] as File;
      expect(file.type).toBe('image/png');
    });
  });

  describe('close', () => {
    it('stops the camera stream and closes the dialog', async () => {
      const tracks = [{ stop: vi.fn() }];
      const stream = { getTracks: () => tracks } as unknown as MediaStream;
      const getUserMedia = vi.fn().mockResolvedValue(stream);
      Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
      component.videoEl = videoRef();
      await component.ngAfterViewInit();

      component.close();

      expect(tracks[0].stop).toHaveBeenCalled();
      expect(dialogRefMock.close).toHaveBeenCalledWith();
    });
  });

  describe('ngOnDestroy', () => {
    it('stops any active camera stream', async () => {
      const tracks = [{ stop: vi.fn() }];
      const stream = { getTracks: () => tracks } as unknown as MediaStream;
      const getUserMedia = vi.fn().mockResolvedValue(stream);
      Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
      component.videoEl = videoRef();
      await component.ngAfterViewInit();

      component.ngOnDestroy();

      expect(tracks[0].stop).toHaveBeenCalled();
    });
  });
});
