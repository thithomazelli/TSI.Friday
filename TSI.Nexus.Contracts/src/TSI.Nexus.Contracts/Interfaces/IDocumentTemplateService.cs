using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Contracts.Interfaces
{
    /// <summary>
    /// Defines methods for managing the editable document templates (Orçamento, Contrato, OS,
    /// Pedido de Venda) used to generate PDFs. Templates are .docx files with placeholders that
    /// Admin users can download, edit in Word and re-upload.
    /// </summary>
    public interface IDocumentTemplateService
    {
        /// <summary>
        /// Add a new DocumentTemplate based on the object received.
        /// </summary>
        /// <param name="documentTemplate">The document template object defined.</param>
        /// <returns>Return an WebApiResponse with the results for this operation.</returns>
        Task<WebApiResponse<DocumentTemplate>> Add(DocumentTemplate documentTemplate);

        /// <summary>
        /// Update a DocumentTemplate based on the object received.
        /// </summary>
        /// <param name="documentTemplate">The document template object updated.</param>
        /// <returns>Return an WebApiResponse with the results for this operation.</returns>
        Task<WebApiResponse<DocumentTemplate>> Update(DocumentTemplate documentTemplate);

        /// <summary>
        /// Remove a DocumentTemplate based on the object received.
        /// </summary>
        /// <param name="documentTemplate">The document template object to be removed.</param>
        /// <returns>Return an WebApiResponse with the results for this operation.</returns>
        Task<WebApiResponse<DocumentTemplate>> Remove(DocumentTemplate documentTemplate);

        /// <summary>
        /// Method responsible to get only one DocumentTemplate based on the ID received as parameter.
        /// </summary>
        /// <param name="id">The ID to be used on the search.</param>
        /// <returns>One DocumentTemplate object according to the ID defined as parameter.</returns>
        Task<WebApiResponse<DocumentTemplate>> FindById(Guid? id);

        /// <summary>
        /// Method responsible to get all registers available on the document template database.
        /// </summary>
        /// <returns>All registers found on the document template database.</returns>
        Task<WebApiResponse<IEnumerable<DocumentTemplate>>> FindAll();

        /// <summary>
        /// Method responsible to get the single DocumentTemplate registered for the given type.
        /// </summary>
        /// <param name="type">The DocumentTemplateType to be used on the search.</param>
        /// <returns>The DocumentTemplate registered for the given type.</returns>
        Task<WebApiResponse<DocumentTemplate>> FindByType(DocumentTemplateType type);

        /// <summary>
        /// Replaces the on-disk .docx file (and the FileName metadata) for the given type from an
        /// uploaded file. The file itself is stored at a fixed name per type - the upload
        /// overwrites it - not the uploaded file's own name, which is kept only as metadata.
        /// </summary>
        /// <param name="type">The DocumentTemplateType being replaced.</param>
        /// <param name="fileName">The uploaded file's original name.</param>
        /// <param name="content">The uploaded .docx file's raw bytes.</param>
        /// <returns>The updated DocumentTemplate.</returns>
        Task<WebApiResponse<DocumentTemplate>> UploadContent(
            DocumentTemplateType type,
            string fileName,
            byte[] content
        );

        /// <summary>
        /// Reads the current .docx file's raw bytes for the given type from disk.
        /// </summary>
        /// <param name="type">The DocumentTemplateType to be read.</param>
        /// <returns>The file's bytes, or null if no file exists for this type yet.</returns>
        Task<byte[]?> GetFileBytes(DocumentTemplateType type);
    }
}
