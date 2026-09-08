export * from './web-api-response.model';
export * from './format-utils';
export * from './document-branding';
export * from './download-blob';

// report-pdf.ts is deliberately NOT re-exported here: it pulls in jsPDF/html2canvas (~1MB), and
// this barrel is imported by @nexus/core, which nearly every service in the app imports.
// Re-exporting it would drag those libraries into the app's initial bundle for everyone, even
// though downloadReportPdf() is only ever called from the Relatórios "Gerar PDF" button - that
// call site imports it directly via a dynamic import() instead. The other 4 letterhead documents
// (Orçamento, Pedido de Venda, Contrato, OS) no longer render client-side at all - PDF generation
// for those moved server-side (DocumentPdfGenerationService); see docs/spec-7-templates-docx-pdf-vetorial.md.
