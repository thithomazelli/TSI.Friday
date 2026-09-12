import { chunkRows } from './report-pdf';

// downloadReportPdf() itself orchestrates html2canvas (real Canvas 2D rendering) and jsPDF - not
// meaningfully unit-testable under jsdom, and @angular/build:unit-test's vitest runner does not
// support vi.mock()/vi.hoisted() (even for non-relative npm packages: it throws "were defined
// outside of the module's top level scope" regardless of specifier, since the builder's own
// bundling pipeline runs ahead of vitest's mock-hoisting transform). The pagination boundary is
// the only pure logic worth isolating here; the rest is covered by manual verification of the
// report-download flow in a real browser (see docs/spec-12, Fase 5 checklist).
describe('chunkRows', () => {
  it('returns a single empty chunk for an empty input', () => {
    expect(chunkRows([], 30)).toEqual([[]]);
  });

  it('returns a single chunk when rows fit within one page', () => {
    const rows = Array.from({ length: 10 }, (_, i) => i);
    expect(chunkRows(rows, 30)).toEqual([rows]);
  });

  it('splits rows exactly divisible by the page size into full chunks with no trailing empty one', () => {
    const rows = Array.from({ length: 60 }, (_, i) => i);
    const chunks = chunkRows(rows, 30);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(30);
    expect(chunks[1]).toHaveLength(30);
  });

  it('puts the remainder in a final smaller chunk', () => {
    const rows = Array.from({ length: 65 }, (_, i) => i);
    const chunks = chunkRows(rows, 30);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(30);
    expect(chunks[1]).toHaveLength(30);
    expect(chunks[2]).toHaveLength(5);
  });

  it('preserves row order across chunks', () => {
    const rows = Array.from({ length: 35 }, (_, i) => i);
    const chunks = chunkRows(rows, 30);

    expect(chunks.flat()).toEqual(rows);
  });
});
