using TSI.Nexus.Contracts.Enums;

namespace TSI.Nexus.Contracts.Models
{
    /// <summary>
    /// Metadata for an editable document template - the actual .docx bytes live on disk (fixed
    /// file name per <see cref="Type"/>, resolved via IDocumentTemplateService), not in this row.
    /// </summary>
    public class DocumentTemplate : BaseModel
    {
        public DocumentTemplateType Type { get; set; }

        public string Name { get; set; } = string.Empty;

        public string FileName { get; set; } = string.Empty;

        public DocumentTemplate() { }
    }
}
