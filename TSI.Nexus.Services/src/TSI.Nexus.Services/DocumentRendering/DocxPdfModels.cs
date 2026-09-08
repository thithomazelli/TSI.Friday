namespace TSI.Nexus.Services.DocumentRendering
{
    /// <summary>
    /// One placeholder-driven document to render: the raw .docx template bytes, the scalar
    /// {{Token}} substitutions, and the block substitutions ({{ProductRows}}, {{SignatureBlock}}
    /// etc.) built from the entity's real data - mirrors what quote-documents.ts/trip-documents.ts/
    /// order-documents.ts used to build as HTML on the frontend.
    /// </summary>
    public sealed class DocxPdfInput
    {
        public byte[] TemplateBytes { get; set; } = System.Array.Empty<byte>();

        public Dictionary<string, string> ScalarTokens { get; set; } = new();

        /// <summary>Keyed by block name without braces (e.g. "ProductRows", "SignatureBlock").</summary>
        public Dictionary<string, DocxBlock> Blocks { get; set; } = new();
    }

    /// <summary>
    /// A block substitution is either a set of table rows (replaces a single placeholder table
    /// row) or a set of paragraph-block rows (replaces a standalone placeholder paragraph) - never
    /// both on the same instance.
    /// </summary>
    public sealed class DocxBlock
    {
        /// <summary>Each inner list is one row's cell texts, same column count as the header.</summary>
        public List<string[]>? TableRows { get; set; }

        public List<DocxBlockRow>? ParagraphRows { get; set; }

        public static DocxBlock ForTable(List<string[]> rows) => new() { TableRows = rows };

        public static DocxBlock ForParagraphs(List<DocxBlockRow> rows) => new() { ParagraphRows = rows };
    }

    /// <summary>
    /// One row of a paragraph block. "Right" empty means the row is a single full-width element
    /// (a heading, a plain paragraph); both sides populated lays the content out in two columns
    /// side by side (used for the company/client signature block) - stacked underneath each other
    /// otherwise reads the same as the two-column CSS layout it replaces.
    /// </summary>
    public sealed class DocxBlockRow
    {
        public List<DocxBlockElement> Left { get; set; } = new();

        public List<DocxBlockElement> Right { get; set; } = new();

        public static DocxBlockRow FullWidth(DocxBlockElement element) =>
            new() { Left = new List<DocxBlockElement> { element } };

        public static DocxBlockRow TwoColumns(
            IEnumerable<DocxBlockElement> left,
            IEnumerable<DocxBlockElement> right
        ) => new() { Left = left.ToList(), Right = right.ToList() };
    }

    public abstract class DocxBlockElement { }

    public sealed class DocxTextRun
    {
        public string Text { get; set; } = string.Empty;

        public bool Bold { get; set; }

        public bool Italic { get; set; }

        public DocxTextRun() { }

        public DocxTextRun(string text, bool bold = false, bool italic = false)
        {
            Text = text;
            Bold = bold;
            Italic = italic;
        }
    }

    public sealed class DocxParagraphElement : DocxBlockElement
    {
        public List<DocxTextRun> Runs { get; set; } = new();

        /// <summary>"left", "center" or "right".</summary>
        public string Align { get; set; } = "left";

        public DocxParagraphElement() { }

        public DocxParagraphElement(IEnumerable<DocxTextRun> runs, string align = "left")
        {
            Runs = runs.ToList();
            Align = align;
        }
    }

    public sealed class DocxImageElement : DocxBlockElement
    {
        public byte[] ImageBytes { get; set; } = System.Array.Empty<byte>();

        public double WidthMm { get; set; } = 30;

        public DocxImageElement() { }

        public DocxImageElement(byte[] imageBytes, double widthMm)
        {
            ImageBytes = imageBytes;
            WidthMm = widthMm;
        }
    }
}
