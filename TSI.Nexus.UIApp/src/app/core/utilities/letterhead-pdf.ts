import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { SERODIO_COMPANY } from './document-branding';

/**
 * Wraps one or more page fragments (already-built inner HTML) with Serodio's letterhead
 * background repeated on every page, and the shared print styles used by every exported
 * document (contrato, ordem de serviço, orçamento) so they all look like they came from the
 * same template the company already uses on paper.
 */
export function buildLetterheadDocument(pagesHtml: string[]): string {
  const pages = pagesHtml
    .map(
      (page, index) => `
        <div class="pdf-page" style="${index > 0 ? 'page-break-before: always;' : ''}">
          ${page}
        </div>
      `,
    )
    .join('');

  return `
    <div class="pdf-letterhead-root">
      <style>
        .pdf-letterhead-root {
          font-family: Arial, Helvetica, sans-serif;
          color: #1a1a1a;
        }
        .pdf-letterhead-root .pdf-page {
          width: 210mm;
          min-height: 297mm;
          background-image: url('${SERODIO_COMPANY.letterheadPath}');
          background-size: 210mm 297mm;
          background-repeat: no-repeat;
          background-position: top left;
          padding: 42mm 18mm 32mm 18mm;
          font-size: 11px;
          line-height: 1.5;
          position: relative;
          box-sizing: border-box;
        }
        .pdf-letterhead-root h1 {
          text-align: center;
          font-size: 14px;
          margin: 0 0 12px;
        }
        .pdf-letterhead-root h2 {
          font-size: 12px;
          margin: 14px 0 6px;
          text-transform: uppercase;
        }
        .pdf-letterhead-root p {
          margin: 0 0 8px;
          text-align: justify;
        }
        .pdf-letterhead-root .clause-title {
          font-weight: bold;
        }
        .pdf-letterhead-root table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
        }
        .pdf-letterhead-root table th,
        .pdf-letterhead-root table td {
          border: 1px solid #999;
          padding: 4px 6px;
          font-size: 10px;
          text-align: left;
        }
        .pdf-letterhead-root table th {
          background: #f0f0f0;
        }
        .pdf-letterhead-root .doc-number {
          text-align: right;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .pdf-letterhead-root .signature-block {
          margin-top: 34px;
          display: flex;
          justify-content: space-between;
        }
        .pdf-letterhead-root .signature-column {
          width: 46%;
          text-align: center;
        }
        .pdf-letterhead-root .signature-line {
          border-top: 1px solid #333;
          margin-top: 4px;
          padding-top: 4px;
          font-size: 10px;
        }
        .pdf-letterhead-root .signature-image {
          max-height: 32px;
          margin-bottom: -6px;
        }
      </style>
      ${pages}
    </div>
  `;
}

/**
 * Waits for every <img> inside the container to finish loading (or fail), so html2canvas doesn't
 * capture a page before its images have decoded.
 */
function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

/**
 * Paints the letterhead JPEG once onto its own canvas, sized to exactly match how html2canvas
 * will size a `.pdf-page` element (measured from a throwaway blank page, at the same `scale`) -
 * this is later drawn under each page's own content canvas instead of every page independently
 * asking html2canvas to decode and repaint the same 400KB+ background image via CSS. That
 * redundant per-page decode+paint was the single largest cost in a multi-page export: it was
 * being paid once per page for a background that's byte-for-byte identical every time.
 */
async function buildLetterheadBackgroundCanvas(
  hiddenWrapper: HTMLElement,
  scale: number,
): Promise<HTMLCanvasElement> {
  const probeContainer = document.createElement('div');
  probeContainer.innerHTML = buildLetterheadDocument(['']);
  hiddenWrapper.appendChild(probeContainer);
  const probeElement = probeContainer.querySelector('.pdf-page') as HTMLElement;
  const rect = probeElement.getBoundingClientRect();
  hiddenWrapper.removeChild(probeContainer);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const img = new Image();
  img.src = SERODIO_COMPANY.letterheadPath;
  await new Promise<void>((resolve) => {
    if (img.complete && img.naturalWidth > 0) {
      resolve();
      return;
    }
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
  });
  if (img.naturalWidth > 0) {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

/**
 * Renders each page separately (its own html2canvas capture) and downloads the result as a PDF.
 *
 * Pages are captured individually - rather than rendering the whole multi-page document at once
 * and letting html2pdf.js slice it into pages by CSS page-break position - because that slicing
 * isn't pixel-precise: when a page's real content is a fraction taller than the nominal 297mm, the
 * overflow spills into an extra, mostly-blank page instead of just making that one page slightly
 * taller. Capturing and placing each page's canvas individually avoids that class of bug entirely:
 * a page's content is never split, and any legitimate overflow just makes that one PDF page a bit
 * taller than standard A4 instead of losing or duplicating content.
 *
 * Each page's own html2canvas capture renders only its content, with `background-image: none`
 * and a transparent canvas background (`backgroundColor: null`) - the letterhead itself is drawn
 * underneath separately from `buildLetterheadBackgroundCanvas`'s single pre-rendered canvas, so
 * the expensive JPEG decode/paint happens once for the whole document instead of once per page.
 */
export async function downloadLetterheadPdf(
  pagesHtml: string[],
  filename: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  // html2canvas measures the source element's own layout size to decide what to capture. Hiding
  // it via `position: fixed/absolute` (even off-screen) makes that measurement collapse to zero
  // height, producing a blank PDF - so instead we clip it out of view with a zero-height wrapper
  // and leave the actual content div with completely ordinary, unpositioned layout.
  const hiddenWrapper = document.createElement('div');
  hiddenWrapper.style.height = '0';
  hiddenWrapper.style.overflow = 'hidden';
  document.body.appendChild(hiddenWrapper);

  try {
    const scale = 1.5;
    const letterheadCanvas = await buildLetterheadBackgroundCanvas(hiddenWrapper, scale);

    const widthMm = 210;
    const total = pagesHtml.length;
    let pdf: jsPDF | null = null;

    for (let i = 0; i < pagesHtml.length; i++) {
      const pageContainer = document.createElement('div');
      pageContainer.innerHTML = buildLetterheadDocument([pagesHtml[i]]);
      hiddenWrapper.appendChild(pageContainer);

      await waitForImages(pageContainer);

      const pageElement = pageContainer.querySelector('.pdf-page') as HTMLElement;
      // The letterhead is composited in separately below - skip painting it here entirely.
      pageElement.style.backgroundImage = 'none';
      const contentCanvas = await html2canvas(pageElement, {
        scale,
        useCORS: true,
        backgroundColor: null,
      });
      hiddenWrapper.removeChild(pageContainer);

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = contentCanvas.width;
      finalCanvas.height = contentCanvas.height;
      const ctx = finalCanvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
      // letterheadCanvas only covers the nominal 210x297mm area - drawn top-left, it naturally
      // leaves any overflow below that (a page taller than standard A4) as plain white, matching
      // real paper run past the printed letterhead art.
      ctx.drawImage(letterheadCanvas, 0, 0);
      ctx.drawImage(contentCanvas, 0, 0);

      const heightMm = Math.max(297, (finalCanvas.height / finalCanvas.width) * widthMm);
      const imageData = finalCanvas.toDataURL('image/jpeg', 0.92);

      if (!pdf) {
        pdf = new jsPDF({ unit: 'mm', format: [widthMm, heightMm], orientation: 'portrait' });
      } else {
        pdf.addPage([widthMm, heightMm], 'portrait');
      }
      pdf.addImage(imageData, 'JPEG', 0, 0, widthMm, heightMm);

      onProgress?.(i + 1, total);
    }

    pdf?.save(filename);
  } finally {
    document.body.removeChild(hiddenWrapper);
  }
}
