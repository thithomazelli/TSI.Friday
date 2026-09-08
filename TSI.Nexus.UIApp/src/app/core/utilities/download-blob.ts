/**
 * Triggers a browser download of a Blob under the given file name - the standard
 * createObjectURL/anchor-click dance, shared by every PDF-download flow (quote/order/trip details
 * pages, document-templates admin screen) instead of repeating it at each call site.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = triggerBlobDownload(blob, fileName);
  window.URL.revokeObjectURL(url);
}

/**
 * Same download trigger as downloadBlob(), but returns the object URL instead of revoking it
 * immediately - for callers that also want to offer an "open file" link (see PdfProgressComponent)
 * after the download completes. The caller is responsible for revoking the URL once it's no longer
 * needed (PdfProgressComponent does this when its modal closes).
 */
export function triggerBlobDownload(blob: Blob, fileName: string): string {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  return url;
}
