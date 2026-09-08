namespace TSI.Nexus.Contracts.Enums
{
    public enum DocumentTemplateType
    {
        Quote,
        Contract,
        ServiceOrder,
        SalesOrder,

        /// <summary>
        /// The JPG background artwork (header/footer band, QR code, contact info) drawn behind
        /// every page of every generated document - not a .docx, so it's handled as an image
        /// upload wherever the other types are handled as .docx (see DocumentTemplatesController
        /// and DocumentTemplateService.ResolveFilePath).
        /// </summary>
        Letterhead,
    }
}
