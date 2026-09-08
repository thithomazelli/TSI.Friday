using FluentAssertions;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Models;

namespace TSI.Nexus.Contracts.Tests.Models
{
    public class DocumentTemplateTests
    {
        [Fact]
        public void Properties_CanBeSetAndRetrieved()
        {
            var template = new DocumentTemplate
            {
                Type = DocumentTemplateType.Quote,
                Name = "Modelo de orçamento",
                FileName = "quote-template.docx",
            };

            template.Type.Should().Be(DocumentTemplateType.Quote);
            template.Name.Should().Be("Modelo de orçamento");
            template.FileName.Should().Be("quote-template.docx");
        }

        [Fact]
        public void DefaultConstructor_LeavesDefaultsIntact()
        {
            var template = new DocumentTemplate();

            template.Name.Should().BeEmpty();
            template.FileName.Should().BeEmpty();
        }
    }
}
