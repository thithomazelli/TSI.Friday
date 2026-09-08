/**
 * Triggers a browser download of a Blob under the given file name - the standard
 * createObjectURL/anchor-click dance, shared by every PDF-download flow (quote/order/trip details
 * pages, document-templates admin screen) instead of repeating it at each call site.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
