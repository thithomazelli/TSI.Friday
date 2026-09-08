using System.Text.RegularExpressions;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using PdfSharpCore.Drawing;
using PdfSharpCore.Pdf;
using OpenXmlBreak = DocumentFormat.OpenXml.Wordprocessing.Break;
using OpenXmlParagraph = DocumentFormat.OpenXml.Wordprocessing.Paragraph;
using OpenXmlTable = DocumentFormat.OpenXml.Wordprocessing.Table;

namespace TSI.Nexus.Services.DocumentRendering
{
    /// <summary>
    /// Reads a .docx template (paragraphs, tables, runs, inline images - the subset described in
    /// docs/spec-7-templates-docx-pdf-vetorial.md section 3.2) and draws it vectorially into a PDF
    /// with PdfSharpCore - no rasterization, no external process. Replaces the old
    /// html2canvas-based pipeline (letterhead-pdf.ts) that used to run in the browser; this now
    /// runs once, server-side, per PDF request.
    ///
    /// All internal measurements are in PDF points (PdfSharpCore's native unit for
    /// XGraphics/XFont); millimeter inputs (page layout constants, image sizes read from the
    /// .docx) are converted to points once, at the boundary.
    /// </summary>
    public static class DocxPdfRenderer
    {
        private const double PageWidthMm = 210;
        private const double PageHeightMm = 297;
        private const double SideMarginMm = 18;
        // Measured directly against the letterhead artwork (assets/letterhead-a4.jpg): its top
        // banner's lowest point within the text column (18-192mm from the left) reaches ~43.1mm
        // from the top, and its bottom decorative wave's highest point reaches ~47mm from the
        // bottom - these margins clear both with a small safety buffer so text never overlaps the
        // printed art, no matter which page it falls on.
        private const double TopMarginMm = 46;
        private const double BottomMarginMm = 50;
        private const double DefaultFontSizePt = 10;
        private const double LineHeightFactor = 1.3;
        private const double ParagraphSpacingPt = 7;
        private const double TableSpacingPt = 10;
        private const double ImageSpacingPt = 6;
        private const double ColumnGapPt = 14;

        private static readonly Regex TokenRegex = new(@"\{\{(\w+)\}\}", RegexOptions.Compiled);
        private static readonly Regex WholeTokenRegex = new(@"^\{\{(\w+)\}\}$", RegexOptions.Compiled);

        private static double MmToPt(double mm) => mm * 72.0 / 25.4;

        public static byte[] Render(DocxPdfInput input, byte[]? letterheadBytes)
        {
            using var templateStream = new MemoryStream(input.TemplateBytes);
            using var wordDoc = WordprocessingDocument.Open(templateStream, false);
            var mainPart =
                wordDoc.MainDocumentPart
                ?? throw new InvalidOperationException("O template .docx não tem MainDocumentPart.");
            var body =
                mainPart.Document.Body
                ?? throw new InvalidOperationException("O template .docx não tem corpo de documento.");

            using var state = new RenderState(letterheadBytes);

            foreach (var element in body.Elements())
            {
                if (element is OpenXmlParagraph paragraph)
                {
                    RenderParagraphElement(state, paragraph, input, mainPart);
                }
                else if (element is OpenXmlTable table)
                {
                    RenderTable(state, table, input, mainPart);
                }
            }

            using var output = new MemoryStream();
            state.Document.Save(output);
            return output.ToArray();
        }

        #region Paragraph parsing (OOXML -> RunInfo)

        private sealed class RunInfo
        {
            public string Text = string.Empty;
            public bool Bold;
            public bool Italic;
            public double SizePt = DefaultFontSizePt;
            public bool IsPageBreak;
            public bool IsLineBreak;
            public byte[]? ImageBytes;
            public double ImageWidthMm;
        }

        private static List<RunInfo> ParseRuns(OpenXmlParagraph paragraph, MainDocumentPart mainPart)
        {
            var result = new List<RunInfo>();
            foreach (var run in paragraph.Elements<Run>())
            {
                var rPr = run.RunProperties;
                var bold = rPr?.Bold != null && (rPr.Bold.Val is null || rPr.Bold.Val.Value);
                var italic = rPr?.Italic != null && (rPr.Italic.Val is null || rPr.Italic.Val.Value);
                var sizePt = DefaultFontSizePt;
                if (rPr?.FontSize?.Val?.Value is string szStr && int.TryParse(szStr, out var half))
                {
                    sizePt = half / 2.0;
                }

                foreach (var child in run.ChildElements)
                {
                    if (child is Text t)
                    {
                        result.Add(new RunInfo { Text = t.Text, Bold = bold, Italic = italic, SizePt = sizePt });
                    }
                    else if (child is OpenXmlBreak br)
                    {
                        var isPage = br.Type?.Value == BreakValues.Page;
                        result.Add(
                            new RunInfo
                            {
                                IsPageBreak = isPage,
                                IsLineBreak = !isPage,
                                Bold = bold,
                                Italic = italic,
                                SizePt = sizePt,
                            }
                        );
                    }
                    else if (child is Drawing drawing)
                    {
                        var image = ExtractImage(drawing, mainPart);
                        if (image != null)
                        {
                            result.Add(
                                new RunInfo
                                {
                                    ImageBytes = image.Value.Bytes,
                                    ImageWidthMm = image.Value.WidthMm,
                                    Bold = bold,
                                    Italic = italic,
                                    SizePt = sizePt,
                                }
                            );
                        }
                    }
                }
            }
            return result;
        }

        private static (byte[] Bytes, double WidthMm)? ExtractImage(Drawing drawing, MainDocumentPart mainPart)
        {
            var blip = drawing.Descendants<DocumentFormat.OpenXml.Drawing.Blip>().FirstOrDefault();
            if (blip?.Embed?.Value == null)
            {
                return null;
            }
            if (mainPart.GetPartById(blip.Embed.Value) is not ImagePart imagePart)
            {
                return null;
            }

            using var stream = imagePart.GetStream();
            using var memoryStream = new MemoryStream();
            stream.CopyTo(memoryStream);
            var bytes = memoryStream.ToArray();

            var extent = drawing
                .Descendants<DocumentFormat.OpenXml.Drawing.Wordprocessing.Extent>()
                .FirstOrDefault();
            const double emuPerMm = 36000;
            var widthMm = extent?.Cx?.Value is long cx && cx > 0 ? cx / emuPerMm : 30;
            return (bytes, widthMm);
        }

        private static string FlattenText(IEnumerable<RunInfo> runs) =>
            string.Concat(runs.Where(r => !string.IsNullOrEmpty(r.Text)).Select(r => r.Text));

        #endregion

        #region Scalar token substitution

        private static List<RunInfo> SubstituteScalars(List<RunInfo> runs, Dictionary<string, string> tokens)
        {
            var fastPass = runs.Select(r =>
                {
                    if (string.IsNullOrEmpty(r.Text))
                    {
                        return r;
                    }
                    var replaced = TokenRegex.Replace(
                        r.Text,
                        m => tokens.TryGetValue(m.Groups[1].Value, out var v) ? v : m.Value
                    );
                    return replaced == r.Text
                        ? r
                        : new RunInfo
                        {
                            Text = replaced,
                            Bold = r.Bold,
                            Italic = r.Italic,
                            SizePt = r.SizePt,
                        };
                })
                .ToList();

            return MergeSplitTokens(fastPass, tokens);
        }

        private static bool IsIncompleteToken(string text)
        {
            var openIdx = text.LastIndexOf("{{", StringComparison.Ordinal);
            if (openIdx == -1)
            {
                return false;
            }
            return text.IndexOf("}}", openIdx, StringComparison.Ordinal) == -1;
        }

        /// <summary>
        /// Fixes a {{Token}} the fast pass couldn't resolve because Word split it across multiple
        /// adjacent runs (typically from autocorrect while an Admin edits the template by hand) -
        /// merges just the text runs needed to complete the token, using the first run's style for
        /// the whole merged span. Stops (leaves the token literally unresolved) if a non-text run
        /// (an image or line break) sits in the middle of the split token - a pathological case
        /// none of our own templates produce.
        /// </summary>
        private static List<RunInfo> MergeSplitTokens(List<RunInfo> runs, Dictionary<string, string> tokens)
        {
            var result = new List<RunInfo>();
            var i = 0;
            while (i < runs.Count)
            {
                var run = runs[i];
                if (!string.IsNullOrEmpty(run.Text) && IsIncompleteToken(run.Text))
                {
                    var mergedText = run.Text;
                    var j = i + 1;
                    var ok = true;
                    while (j < runs.Count && IsIncompleteToken(mergedText))
                    {
                        if (string.IsNullOrEmpty(runs[j].Text))
                        {
                            ok = false;
                            break;
                        }
                        mergedText += runs[j].Text;
                        j++;
                    }
                    if (ok)
                    {
                        var substituted = TokenRegex.Replace(
                            mergedText,
                            m => tokens.TryGetValue(m.Groups[1].Value, out var v) ? v : m.Value
                        );
                        result.Add(
                            new RunInfo
                            {
                                Text = substituted,
                                Bold = run.Bold,
                                Italic = run.Italic,
                                SizePt = run.SizePt,
                            }
                        );
                        i = j;
                        continue;
                    }
                }
                result.Add(run);
                i++;
            }
            return result;
        }

        #endregion

        #region Element rendering

        private static void RenderParagraphElement(
            RenderState state,
            OpenXmlParagraph paragraph,
            DocxPdfInput input,
            MainDocumentPart mainPart
        )
        {
            var runs = ParseRuns(paragraph, mainPart);
            if (runs.Any(r => r.IsPageBreak))
            {
                state.NewPage();
                return;
            }

            var plainText = FlattenText(runs).Trim();
            var blockMatch = WholeTokenRegex.Match(plainText);
            if (blockMatch.Success && input.Blocks.TryGetValue(blockMatch.Groups[1].Value, out var block))
            {
                if (block.ParagraphRows != null)
                {
                    foreach (var row in block.ParagraphRows)
                    {
                        state.DrawBlockRow(row);
                    }
                }
                return;
            }

            var align = GetAlignment(paragraph);
            var substituted = SubstituteScalars(runs, input.ScalarTokens);
            if (substituted.Count == 0)
            {
                return;
            }
            state.DrawParagraph(substituted, align, state.FullRegion);
        }

        private static string GetAlignment(OpenXmlParagraph paragraph)
        {
            var val = paragraph.ParagraphProperties?.Justification?.Val?.Value;
            if (val == JustificationValues.Center)
            {
                return "center";
            }
            if (val == JustificationValues.Right)
            {
                return "right";
            }
            return "left";
        }

        private static void RenderTable(
            RenderState state,
            OpenXmlTable table,
            DocxPdfInput input,
            MainDocumentPart mainPart
        )
        {
            var rows = table.Elements<TableRow>().ToList();
            if (rows.Count == 0)
            {
                return;
            }

            string[]? headerTexts = null;
            var bodyRows = new List<string[]>();
            var firstRowIsBlockOnly = false;

            for (var r = 0; r < rows.Count; r++)
            {
                var cells = rows[r].Elements<TableCell>().ToList();
                var cellPlainTexts = cells
                    .Select(c =>
                        FlattenText(c.Elements<OpenXmlParagraph>().SelectMany(p => ParseRuns(p, mainPart))).Trim()
                    )
                    .ToArray();

                var firstCellTrimmed = cellPlainTexts.Length > 0 ? cellPlainTexts[0] : string.Empty;
                var blockMatch = WholeTokenRegex.Match(firstCellTrimmed);

                if (blockMatch.Success && input.Blocks.TryGetValue(blockMatch.Groups[1].Value, out var block))
                {
                    if (r == 0)
                    {
                        firstRowIsBlockOnly = true;
                    }
                    if (block.TableRows != null)
                    {
                        bodyRows.AddRange(block.TableRows);
                    }
                    continue;
                }

                var substitutedTexts = cellPlainTexts
                    .Select(t => TokenRegex.Replace(t, m => input.ScalarTokens.TryGetValue(m.Groups[1].Value, out var v) ? v : m.Value))
                    .ToArray();

                if (r == 0)
                {
                    headerTexts = substitutedTexts;
                }
                else
                {
                    bodyRows.Add(substitutedTexts);
                }
            }

            if (firstRowIsBlockOnly && bodyRows.Count == 0)
            {
                // The whole table was just a block placeholder (e.g. {{CommissionRow}}) that
                // resolved to nothing - skip it entirely rather than drawing an empty shell.
                return;
            }

            state.DrawTable(headerTexts, bodyRows);
        }

        #endregion

        #region PDF drawing state

        private sealed class Region
        {
            public double XPt;
            public double WidthPt;
        }

        private sealed class RenderState : IDisposable
        {
            public PdfDocument Document { get; } = new();

            private PdfPage _page;
            private XGraphics _gfx;
            private double _cursorYPt;
            private readonly XImage? _letterheadImage;
            private readonly Dictionary<(bool Bold, bool Italic, double Size), XFont> _fontCache = new();

            private static readonly double PageWidthPt = MmToPt(PageWidthMm);
            private static readonly double PageHeightPt = MmToPt(PageHeightMm);
            private static readonly double SideMarginPt = MmToPt(SideMarginMm);
            private static readonly double TopMarginPt = MmToPt(TopMarginMm);
            private static readonly double BottomMarginPt = MmToPt(BottomMarginMm);

            public Region FullRegion => new() { XPt = SideMarginPt, WidthPt = PageWidthPt - 2 * SideMarginPt };

            public RenderState(byte[]? letterheadBytes)
            {
                if (letterheadBytes is { Length: > 0 })
                {
                    var bytesCopy = letterheadBytes;
                    _letterheadImage = XImage.FromStream(() => new MemoryStream(bytesCopy));
                }
                _page = CreatePage();
                _gfx = XGraphics.FromPdfPage(_page);
                DrawLetterhead();
                _cursorYPt = TopMarginPt;
            }

            private PdfPage CreatePage()
            {
                var page = Document.AddPage();
                page.Width = XUnit.FromPoint(PageWidthPt);
                page.Height = XUnit.FromPoint(PageHeightPt);
                return page;
            }

            private void DrawLetterhead()
            {
                if (_letterheadImage == null)
                {
                    return;
                }
                _gfx.DrawImage(_letterheadImage, 0, 0, PageWidthPt, PageHeightPt);
            }

            public void NewPage()
            {
                _gfx.Dispose();
                _page = CreatePage();
                _gfx = XGraphics.FromPdfPage(_page);
                DrawLetterhead();
                _cursorYPt = TopMarginPt;
            }

            public void EnsureSpace(double neededPt)
            {
                if (_cursorYPt + neededPt > PageHeightPt - BottomMarginPt)
                {
                    NewPage();
                }
            }

            private XFont FontFor(bool bold, bool italic, double sizePt)
            {
                var key = (bold, italic, sizePt);
                if (_fontCache.TryGetValue(key, out var cached))
                {
                    return cached;
                }
                var style = XFontStyle.Regular;
                if (bold)
                {
                    style |= XFontStyle.Bold;
                }
                if (italic)
                {
                    style |= XFontStyle.Italic;
                }
                var font = new XFont("Arial", sizePt, style);
                _fontCache[key] = font;
                return font;
            }

            private static IEnumerable<string> SplitPreservingSpaces(string text) =>
                Regex.Split(text, @"(\s+)").Where(s => s.Length > 0);

            /// <summary>
            /// Word-wraps and draws a sequence of mixed-style runs as a single paragraph, honoring
            /// the runs' own bold/italic/size, breaking lines both on natural word-wrap and on
            /// explicit line-break markers, and drawing any inline image on its own line. Pagination
            /// happens per line via EnsureSpace, exactly like the original client-side design.
            /// </summary>
            public void DrawParagraph(List<RunInfo> runs, string align, Region region)
            {
                var lineTokens = new List<(string Text, bool Bold, bool Italic, double SizePt, double WidthPt)>();
                var lineWidthPt = 0.0;

                void FlushLine()
                {
                    while (lineTokens.Count > 0 && string.IsNullOrWhiteSpace(lineTokens[^1].Text))
                    {
                        lineWidthPt -= lineTokens[^1].WidthPt;
                        lineTokens.RemoveAt(lineTokens.Count - 1);
                    }
                    if (lineTokens.Count == 0)
                    {
                        return;
                    }

                    var maxSizePt = lineTokens.Max(t => t.SizePt);
                    var lineHeightPt = maxSizePt * LineHeightFactor;
                    EnsureSpace(lineHeightPt);

                    var x = region.XPt;
                    if (align == "center")
                    {
                        x = region.XPt + (region.WidthPt - lineWidthPt) / 2;
                    }
                    else if (align == "right")
                    {
                        x = region.XPt + (region.WidthPt - lineWidthPt);
                    }

                    var baselineY = _cursorYPt + maxSizePt * 0.85;
                    foreach (var token in lineTokens)
                    {
                        var font = FontFor(token.Bold, token.Italic, token.SizePt);
                        _gfx.DrawString(token.Text, font, XBrushes.Black, x, baselineY);
                        x += token.WidthPt;
                    }
                    _cursorYPt += lineHeightPt;
                    lineTokens.Clear();
                    lineWidthPt = 0;
                }

                foreach (var run in runs)
                {
                    if (run.IsLineBreak)
                    {
                        FlushLine();
                        continue;
                    }
                    if (run.ImageBytes != null)
                    {
                        FlushLine();
                        DrawImageElement(new DocxImageElement(run.ImageBytes, run.ImageWidthMm), region);
                        continue;
                    }
                    if (string.IsNullOrEmpty(run.Text))
                    {
                        continue;
                    }

                    var font = FontFor(run.Bold, run.Italic, run.SizePt);
                    foreach (var word in SplitPreservingSpaces(run.Text))
                    {
                        var widthPt = _gfx.MeasureString(word, font).Width;
                        var isWhitespace = string.IsNullOrWhiteSpace(word);
                        if (lineTokens.Count > 0 && lineWidthPt + widthPt > region.WidthPt && !isWhitespace)
                        {
                            FlushLine();
                        }
                        if (lineTokens.Count == 0 && isWhitespace)
                        {
                            continue;
                        }
                        lineTokens.Add((word, run.Bold, run.Italic, run.SizePt, widthPt));
                        lineWidthPt += widthPt;
                    }
                }
                FlushLine();
                _cursorYPt += ParagraphSpacingPt;
            }

            public void DrawImageElement(DocxImageElement image, Region region)
            {
                var widthPt = MmToPt(image.WidthMm);
                using var stream = new MemoryStream(image.ImageBytes);
                var xImage = XImage.FromStream(() => new MemoryStream(image.ImageBytes));
                var heightPt = widthPt * xImage.PixelHeight / xImage.PixelWidth;

                EnsureSpace(heightPt);
                _gfx.DrawImage(xImage, region.XPt, _cursorYPt, widthPt, heightPt);
                _cursorYPt += heightPt + ImageSpacingPt;
            }

            /// <summary>
            /// Draws one row of a paragraph block - either a single full-width element, or two
            /// elements side by side (used by the company/client signature block, replacing the CSS
            /// two-column layout of the old HTML template).
            /// </summary>
            public void DrawBlockRow(DocxBlockRow row)
            {
                if (row.Right.Count == 0)
                {
                    foreach (var element in row.Left)
                    {
                        DrawBlockElement(element, FullRegion);
                    }
                    return;
                }

                var columnWidthPt = (FullRegion.WidthPt - ColumnGapPt) / 2;
                var leftRegion = new Region { XPt = FullRegion.XPt, WidthPt = columnWidthPt };
                var rightRegion = new Region
                {
                    XPt = FullRegion.XPt + columnWidthPt + ColumnGapPt,
                    WidthPt = columnWidthPt,
                };

                var startY = _cursorYPt;
                foreach (var element in row.Left)
                {
                    DrawBlockElement(element, leftRegion);
                }
                var leftEndY = _cursorYPt;

                _cursorYPt = startY;
                foreach (var element in row.Right)
                {
                    DrawBlockElement(element, rightRegion);
                }
                var rightEndY = _cursorYPt;

                _cursorYPt = Math.Max(leftEndY, rightEndY);
            }

            private void DrawBlockElement(DocxBlockElement element, Region region)
            {
                switch (element)
                {
                    case DocxParagraphElement paragraph:
                        // A block-built run's text may contain literal "\n" markers (e.g. the
                        // signature block's "LEGAL NAME\nCONTRATADA") - split those into an
                        // explicit forced line break, since plain "\n" would otherwise just be
                        // treated as ordinary wrappable whitespace by SplitPreservingSpaces.
                        var runs = new List<RunInfo>();
                        foreach (var r in paragraph.Runs)
                        {
                            var parts = r.Text.Split('\n');
                            for (var i = 0; i < parts.Length; i++)
                            {
                                if (i > 0)
                                {
                                    runs.Add(new RunInfo { IsLineBreak = true, Bold = r.Bold, Italic = r.Italic, SizePt = DefaultFontSizePt });
                                }
                                runs.Add(
                                    new RunInfo
                                    {
                                        Text = parts[i],
                                        Bold = r.Bold,
                                        Italic = r.Italic,
                                        SizePt = DefaultFontSizePt,
                                    }
                                );
                            }
                        }
                        DrawParagraph(runs, paragraph.Align, region);
                        break;
                    case DocxImageElement image:
                        DrawImageElement(image, region);
                        break;
                }
            }

            /// <summary>
            /// Draws a simple table: an optional bold header row (light gray fill) followed by body
            /// rows, all columns equal width, cell text wrapped within its column and the row grown
            /// to fit its tallest cell. A row too tall to fit the remaining page starts a fresh page
            /// (redrawing the letterhead, matching every other page-break in this renderer).
            /// </summary>
            public void DrawTable(string[]? headerTexts, List<string[]> bodyRows)
            {
                var columnCount = headerTexts?.Length ?? bodyRows.FirstOrDefault()?.Length ?? 0;
                if (columnCount == 0)
                {
                    return;
                }

                const double cellPaddingPt = 4;
                const double tableFontSizePt = 9;
                var region = FullRegion;
                var colWidthPt = region.WidthPt / columnCount;
                var font = new XFont("Arial", tableFontSizePt, XFontStyle.Regular);
                var boldFont = new XFont("Arial", tableFontSizePt, XFontStyle.Bold);
                var lineHeightPt = tableFontSizePt * LineHeightFactor;

                void DrawRow(string[] cells, bool isHeader)
                {
                    var usedFont = isHeader ? boldFont : font;
                    var wrappedPerCell = new List<List<string>>();
                    for (var c = 0; c < columnCount; c++)
                    {
                        var text = c < cells.Length ? cells[c] : string.Empty;
                        wrappedPerCell.Add(WrapPlainText(text, usedFont, colWidthPt - 2 * cellPaddingPt));
                    }

                    var maxLines = Math.Max(1, wrappedPerCell.Max(w => w.Count));
                    var rowHeightPt = maxLines * lineHeightPt + 2 * cellPaddingPt;

                    EnsureSpace(rowHeightPt);
                    var rowTopPt = _cursorYPt;

                    if (isHeader)
                    {
                        _gfx.DrawRectangle(
                            new XSolidBrush(XColor.FromArgb(240, 240, 240)),
                            region.XPt,
                            rowTopPt,
                            region.WidthPt,
                            rowHeightPt
                        );
                    }

                    for (var c = 0; c < columnCount; c++)
                    {
                        var cellX = region.XPt + c * colWidthPt;
                        _gfx.DrawRectangle(XPens.Gray, cellX, rowTopPt, colWidthPt, rowHeightPt);
                        var lines = wrappedPerCell[c];
                        for (var li = 0; li < lines.Count; li++)
                        {
                            _gfx.DrawString(
                                lines[li],
                                usedFont,
                                XBrushes.Black,
                                cellX + cellPaddingPt,
                                rowTopPt + cellPaddingPt + (li + 1) * lineHeightPt * 0.85
                            );
                        }
                    }

                    _cursorYPt = rowTopPt + rowHeightPt;
                }

                if (headerTexts != null)
                {
                    DrawRow(headerTexts, true);
                }
                foreach (var row in bodyRows)
                {
                    DrawRow(row, false);
                }
                _cursorYPt += TableSpacingPt;
            }

            private List<string> WrapPlainText(string text, XFont font, double maxWidthPt)
            {
                var lines = new List<string>();
                var currentLine = string.Empty;
                foreach (var word in text.Split(' '))
                {
                    var candidate = currentLine.Length == 0 ? word : currentLine + " " + word;
                    if (_gfx.MeasureString(candidate, font).Width > maxWidthPt && currentLine.Length > 0)
                    {
                        lines.Add(currentLine);
                        currentLine = word;
                    }
                    else
                    {
                        currentLine = candidate;
                    }
                }
                if (currentLine.Length > 0 || lines.Count == 0)
                {
                    lines.Add(currentLine);
                }
                return lines;
            }

            public void Dispose()
            {
                _gfx.Dispose();
            }
        }

        #endregion
    }
}
