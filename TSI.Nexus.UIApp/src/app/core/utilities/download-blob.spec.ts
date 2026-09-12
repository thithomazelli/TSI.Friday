import { downloadBlob, triggerBlobDownload } from './download-blob';

describe('triggerBlobDownload', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLSpy = vi
      .spyOn(window.URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url') as unknown as ReturnType<typeof vi.fn>;
    revokeObjectURLSpy = vi.spyOn(window.URL, 'revokeObjectURL') as unknown as ReturnType<typeof vi.fn>;
    clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      set href(_: string) {},
      set download(_: string) {},
      click: clickSpy,
    } as unknown as HTMLAnchorElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an object URL, triggers a click on an anchor, and returns the URL', () => {
    const blob = new Blob(['content']);
    const url = triggerBlobDownload(blob, 'file.pdf');

    expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();
    expect(url).toBe('blob:mock-url');
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
  });
});

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockReturnValue({
      set href(_: string) {},
      set download(_: string) {},
      click: vi.fn(),
    } as unknown as HTMLAnchorElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('revokes the object URL after triggering the download', () => {
    const blob = new Blob(['content']);
    downloadBlob(blob, 'file.pdf');

    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
