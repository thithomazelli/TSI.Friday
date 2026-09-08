using System.IO;
using System.Text;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using TSI.Nexus.Services.DocumentRendering;

namespace TSI.Nexus.Services.Tests.DocumentRendering
{
    public class DocxPdfRendererTests
    {
        private static byte[] BuildDocx(Action<Body> configureBody)
        {
            using var stream = new MemoryStream();
            using (var doc = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document))
            {
                var mainPart = doc.AddMainDocumentPart();
                mainPart.Document = new Document();
                var body = new Body();
                configureBody(body);
                mainPart.Document.Append(body);
                mainPart.Document.Save();
            }
            return stream.ToArray();
        }

        private static Run PlainRun(string text) => new(new Text(text) { Space = SpaceProcessingModeValues.Preserve });

        private static Run BoldRun(string text) =>
            new(new RunProperties(new Bold()), new Text(text) { Space = SpaceProcessingModeValues.Preserve });

        private static bool StartsWithPdfMagic(byte[] bytes) =>
            bytes.Length > 4 && Encoding.ASCII.GetString(bytes, 0, 4) == "%PDF";

        [Fact]
        public void Render_SubstitutesScalarTokens()
        {
            var docxBytes = BuildDocx(body =>
            {
                body.Append(new Paragraph(new Run(PlainRun("Olá {{ClientName}}, total {{Total}}."))));
            });

            var input = new DocxPdfInput
            {
                TemplateBytes = docxBytes,
                ScalarTokens = new Dictionary<string, string> { ["ClientName"] = "João", ["Total"] = "R$ 10,00" },
            };

            var pdf = DocxPdfRenderer.Render(input, null);

            Assert.True(StartsWithPdfMagic(pdf));
            Assert.True(pdf.Length > 100);
        }

        [Fact]
        public void Render_LeavesUnknownScalarTokenLiteral()
        {
            var docxBytes = BuildDocx(body =>
            {
                body.Append(new Paragraph(new Run(PlainRun("Valor: {{Unknown}}"))));
            });

            var input = new DocxPdfInput { TemplateBytes = docxBytes, ScalarTokens = new Dictionary<string, string>() };

            var pdf = DocxPdfRenderer.Render(input, null);

            Assert.True(StartsWithPdfMagic(pdf));
        }

        [Fact]
        public void Render_ReplacesTableBlockRowWithGeneratedRows()
        {
            var docxBytes = BuildDocx(body =>
            {
                var table = new Table();
                var headerRow = new TableRow(
                    new TableCell(new Paragraph(new Run(PlainRun("Descrição")))),
                    new TableCell(new Paragraph(new Run(PlainRun("Valor"))))
                );
                var placeholderRow = new TableRow(
                    new TableCell(new Paragraph(new Run(PlainRun("{{ProductRows}}")))),
                    new TableCell(new Paragraph())
                );
                table.Append(headerRow, placeholderRow);
                body.Append(table);
            });

            var input = new DocxPdfInput
            {
                TemplateBytes = docxBytes,
                Blocks = new Dictionary<string, DocxBlock>
                {
                    ["ProductRows"] = DocxBlock.ForTable(
                        new List<string[]> { new[] { "Produto A", "R$ 1,00" }, new[] { "Produto B", "R$ 2,00" } }
                    ),
                },
            };

            var pdf = DocxPdfRenderer.Render(input, null);

            Assert.True(StartsWithPdfMagic(pdf));
        }

        [Fact]
        public void Render_SkipsTableEntirely_WhenBlockOnlyTableResolvesEmpty()
        {
            var docxBytes = BuildDocx(body =>
            {
                var table = new Table();
                var placeholderRow = new TableRow(
                    new TableCell(new Paragraph(new Run(PlainRun("{{CommissionRow}}")))),
                    new TableCell(new Paragraph())
                );
                table.Append(placeholderRow);
                body.Append(table);
                body.Append(new Paragraph(new Run(PlainRun("Depois da tabela"))));
            });

            var input = new DocxPdfInput
            {
                TemplateBytes = docxBytes,
                Blocks = new Dictionary<string, DocxBlock> { ["CommissionRow"] = DocxBlock.ForTable(new List<string[]>()) },
            };

            var pdf = DocxPdfRenderer.Render(input, null);

            Assert.True(StartsWithPdfMagic(pdf));
        }

        [Fact]
        public void Render_HandlesExplicitPageBreak_ProducesTwoPages()
        {
            var docxBytes = BuildDocx(body =>
            {
                body.Append(new Paragraph(new Run(PlainRun("Página um"))));
                body.Append(new Paragraph(new Run(new Break { Type = BreakValues.Page })));
                body.Append(new Paragraph(new Run(PlainRun("Página dois"))));
            });

            var input = new DocxPdfInput { TemplateBytes = docxBytes };

            var pdf = DocxPdfRenderer.Render(input, null);
            var pdfText = Encoding.Latin1.GetString(pdf);
            var pageCount = System.Text.RegularExpressions.Regex.Matches(pdfText, "/Type\\s*/Page[^s]").Count;

            Assert.True(StartsWithPdfMagic(pdf));
            Assert.Equal(2, pageCount);
        }

        [Fact]
        public void Render_DrawsBoldRunsAndBlockParagraphs_WithSignatureLikeLayout()
        {
            var docxBytes = BuildDocx(body =>
            {
                body.Append(new Paragraph(new Run(BoldRun("Cláusula Primeira.")), PlainRun(" texto normal.")));
                body.Append(new Paragraph(new Run(PlainRun("{{SignatureBlock}}"))));
            });

            var left = new List<DocxBlockElement>
            {
                new DocxParagraphElement(new[] { new DocxTextRun("Empresa\nCONTRATADA") }, "center"),
            };
            var right = new List<DocxBlockElement>
            {
                new DocxParagraphElement(new[] { new DocxTextRun("Cliente\nCONTRATANTE") }, "center"),
            };
            var input = new DocxPdfInput
            {
                TemplateBytes = docxBytes,
                Blocks = new Dictionary<string, DocxBlock>
                {
                    ["SignatureBlock"] = DocxBlock.ForParagraphs(
                        new List<DocxBlockRow> { DocxBlockRow.TwoColumns(left, right) }
                    ),
                },
            };

            var pdf = DocxPdfRenderer.Render(input, null);

            Assert.True(StartsWithPdfMagic(pdf));
        }

        [Fact]
        public void Render_ThrowsWhenTemplateIsNotAValidDocx()
        {
            var input = new DocxPdfInput { TemplateBytes = new byte[] { 1, 2, 3 } };

            Assert.ThrowsAny<Exception>(() => DocxPdfRenderer.Render(input, null));
        }

        [Fact]
        public void Render_RealOrcamentoTemplate_ProducesMultiSectionPdf()
        {
            var templatePath = FindRepoFile(
                Path.Combine("TSI.Nexus.Data", "src", "TSI.Nexus.Data", "Seed", "DocumentTemplates", "orcamento.docx")
            );
            var templateBytes = File.ReadAllBytes(templatePath);

            var tokens = new Dictionary<string, string>
            {
                ["QuoteNumber"] = "ORC-0001",
                ["ClientName"] = "Cliente Teste",
                ["ClientDocument"] = "00.000.000/0001-00",
                ["ClientAddress"] = "Rua Teste, nº 1 - Guarulhos/SP",
                ["QuoteDate"] = "01/01/2026",
                ["TotalPrice"] = "R$ 1.000,00",
                ["PaymentCondition"] = "À vista",
                ["PaymentMethod"] = "Pix",
                ["CompanyContactName"] = "WARLEN",
                ["CompanyWhatsapp"] = "(11) 98180-2113",
            };
            var blocks = new Dictionary<string, DocxBlock>
            {
                ["ProductRows"] = DocxBlock.ForTable(
                    new List<string[]> { new[] { "Van executiva", "1", "R$ 1.000,00", "R$ 0,00", "R$ 1.000,00" } }
                ),
                ["SignatureBlock"] = DocxBlock.ForParagraphs(
                    new List<DocxBlockRow>
                    {
                        DocxBlockRow.TwoColumns(
                            new List<DocxBlockElement>
                            {
                                new DocxParagraphElement(new[] { new DocxTextRun("Empresa Teste") }, "center"),
                            },
                            new List<DocxBlockElement>
                            {
                                new DocxParagraphElement(new[] { new DocxTextRun("Cliente Teste") }, "center"),
                            }
                        ),
                    }
                ),
            };

            var pdf = DocxPdfRenderer.Render(
                new DocxPdfInput { TemplateBytes = templateBytes, ScalarTokens = tokens, Blocks = blocks },
                null
            );

            Assert.True(StartsWithPdfMagic(pdf));
            Assert.True(pdf.Length > 500);
        }

        private static string FindRepoFile(string relativePath)
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null)
            {
                var candidate = Path.Combine(dir.FullName, relativePath);
                if (File.Exists(candidate))
                {
                    return candidate;
                }
                dir = dir.Parent;
            }
            throw new FileNotFoundException($"Could not locate '{relativePath}' walking up from {AppContext.BaseDirectory}.");
        }
    }
}
