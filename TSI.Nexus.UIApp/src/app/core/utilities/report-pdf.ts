import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Fixed row-count heuristic rather than measuring actual rendered row heights: report rows are
// short, single-line table cells (not paragraph text like the letterhead documents), so their
// height is predictable enough that a tuned constant is simpler and safer than dynamic
// measurement. Bump this down if a future column ever wraps to multiple lines and overflows a
// page in practice.
const ROWS_PER_PAGE = 30;

/**
 * Splits rows into fixed-size pages, always returning at least one (possibly empty) chunk so a
 * report with zero matching rows still renders a single page of headers/totals instead of none.
 * Extracted as a pure function so the pagination boundary (rows near/at a multiple of the page
 * size) can be unit tested without needing to mock html2canvas/jsPDF's real DOM/canvas rendering.
 */
export function chunkRows<T>(rows: T[], pageSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += pageSize) {
    chunks.push(rows.slice(i, i + pageSize));
  }
  return chunks.length === 0 ? [[]] : chunks;
}

export interface ReportPdfInput {
  // Full title + date-range block shown once, at the top of page 1 only.
  fullHeaderHtml: string;
  // Shown instead of fullHeaderHtml on every page after the first, so a reader flipping through a
  // printed multi-page report still knows what document/page they're on.
  continuationTitle: string;
  // <thead>...</thead> outerHTML, repeated on every page so column labels are never off-screen.
  theadHtml: string;
  // One <tr>...</tr> outerHTML per data row, already rendered (badges, links, formatted
  // currency/dates resolved to plain text/markup) - chunked into pages here.
  rowsHtml: string[];
  // Totals block outerHTML, appended only after the last page's rows.
  totalsHtml: string;
  // Builds the "Página X de Y" label for continuation-page headers, already translated.
  pageLabel: (current: number, total: number) => string;
}

function buildReportPageElement(
  headerHtml: string,
  theadHtml: string,
  rowsHtml: string[],
  totalsHtml: string | null,
): HTMLElement {
  const page = document.createElement('div');
  page.style.cssText =
    'width: 210mm; min-height: 297mm; padding: 12mm; box-sizing: border-box; ' +
    'font-family: Arial, Helvetica, sans-serif; background: #ffffff; color: #1a1a1a;';
  page.innerHTML = `
    ${headerHtml}
    <table class="table table-striped" style="width: 100%;">
      ${theadHtml}
      <tbody>${rowsHtml.join('')}</tbody>
    </table>
    ${totalsHtml ?? ''}
  `;
  return page;
}

/**
 * Renders a report as one or more A4 pages and downloads the result as a PDF.
 *
 * Unlike a single html2canvas() pass over the whole (unpaginated) report table - which forces the
 * browser to rasterize a canvas as tall as the entire filtered dataset (tens of thousands of
 * pixels for a few hundred rows, unbounded as the data grows) - rows are chunked into
 * ROWS_PER_PAGE-sized pages up front and each page is captured independently. This keeps every
 * capture a normal, bounded page size regardless of how many rows the report matches. Reports is
 * the only remaining document rendered this way client-side; the 4 letterhead documents
 * (Orçamento, Pedido de Venda, Contrato, OS) render server-side instead - see
 * docs/spec-7-templates-docx-pdf-vetorial.md.
 */
export async function downloadReportPdf(
  input: ReportPdfInput,
  filename: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  const hiddenWrapper = document.createElement('div');
  hiddenWrapper.style.height = '0';
  hiddenWrapper.style.overflow = 'hidden';
  document.body.appendChild(hiddenWrapper);

  try {
    const rowChunks = chunkRows(input.rowsHtml, ROWS_PER_PAGE);

    const widthMm = 210;
    const total = rowChunks.length;
    let pdf: jsPDF | null = null;

    for (let i = 0; i < rowChunks.length; i++) {
      const isFirst = i === 0;
      const isLast = i === rowChunks.length - 1;
      const headerHtml = isFirst
        ? input.fullHeaderHtml
        : `<div style="font-weight: bold; margin-bottom: 12px;">${input.continuationTitle} — ${input.pageLabel(i + 1, total)}</div>`;

      const pageElement = buildReportPageElement(
        headerHtml,
        input.theadHtml,
        rowChunks[i],
        isLast ? input.totalsHtml : null,
      );
      hiddenWrapper.appendChild(pageElement);

      const canvas = await html2canvas(pageElement, { scale: 1.5, useCORS: true });
      hiddenWrapper.removeChild(pageElement);

      const heightMm = Math.max(297, (canvas.height / canvas.width) * widthMm);
      const imageData = canvas.toDataURL('image/jpeg', 0.95);

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
