import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Fixed row-count heuristic rather than measuring actual rendered row heights: report rows are
// short, single-line table cells (not paragraph text like the letterhead documents), so their
// height is predictable enough that a tuned constant is simpler and safer than dynamic
// measurement. Bump this down if a future column ever wraps to multiple lines and overflows a
// page in practice.
const ROWS_PER_PAGE = 30;

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
 * ROWS_PER_PAGE-sized pages up front and each page is captured independently, exactly like
 * downloadLetterheadPdf does for orçamentos/pedidos/contratos. This keeps every capture a normal,
 * bounded page size regardless of how many rows the report matches.
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
    const rowChunks: string[][] = [];
    for (let i = 0; i < input.rowsHtml.length; i += ROWS_PER_PAGE) {
      rowChunks.push(input.rowsHtml.slice(i, i + ROWS_PER_PAGE));
    }
    if (rowChunks.length === 0) {
      // No rows matched the filters - still produce a single page with just headers/totals
      // rather than an empty PDF.
      rowChunks.push([]);
    }

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
