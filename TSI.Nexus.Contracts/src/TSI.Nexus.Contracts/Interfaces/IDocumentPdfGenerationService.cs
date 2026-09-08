using System;
using System.Threading.Tasks;

namespace TSI.Nexus.Contracts.Interfaces
{
    /// <summary>
    /// Generates the letterhead PDFs (Orçamento, Pedido de Venda, Contrato, Ordem de Serviço) from
    /// their .docx templates (IDocumentTemplateService) and the record's own data - the
    /// server-side replacement for the client-side html2canvas pipeline described in
    /// docs/spec-7-templates-docx-pdf-vetorial.md. Each method loads the entity (and whatever
    /// related records the document needs - business partner, vehicle, driver, trip legs...),
    /// builds the same scalar/block substitutions the Angular document builders used to build as
    /// HTML, and renders the result vectorially via DocumentRendering.DocxPdfRenderer.
    /// </summary>
    public interface IDocumentPdfGenerationService
    {
        /// <summary>Generates the Orçamento PDF for the given Quote. Null if the quote doesn't exist.</summary>
        Task<byte[]?> GenerateQuotePdf(Guid quoteId);

        /// <summary>Generates the Pedido de Venda PDF for the given Order. Null if the order doesn't exist.</summary>
        Task<byte[]?> GenerateSalesOrderPdf(Guid orderId);

        /// <summary>Generates the Contrato PDF for the given Trip. Null if the trip doesn't exist.</summary>
        Task<byte[]?> GenerateContractPdf(Guid tripId);

        /// <summary>Generates the Ordem de Serviço PDF for the given Trip. Null if the trip doesn't exist.</summary>
        Task<byte[]?> GenerateServiceOrderPdf(Guid tripId);
    }
}
