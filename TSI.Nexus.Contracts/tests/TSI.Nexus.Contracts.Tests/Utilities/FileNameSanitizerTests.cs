using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Contracts.Tests.Utilities
{
    public class FileNameSanitizerTests
    {
        [Fact]
        public void Sanitize_ShouldKeepSafeCharacters_Unchanged()
        {
            var result = FileNameSanitizer.Sanitize("Contrato-Cliente_2024 v2.docx");

            Assert.Equal("Contrato-Cliente_2024 v2.docx", result);
        }

        [Fact]
        public void Sanitize_ShouldReplaceAccentedAndNonAsciiCharacters_WithUnderscore()
        {
            var result = FileNameSanitizer.Sanitize("Contrato Joao a cafe.docx".Replace('o', 'õ'));

            Assert.DoesNotContain('õ', result);
        }

        [Fact]
        public void Sanitize_ShouldReplacePathSeparators_PreventingTraversal()
        {
            var result = FileNameSanitizer.Sanitize("../../etc/passwd");

            Assert.DoesNotContain("/", result);
            Assert.DoesNotContain("..", result);
        }

        [Fact]
        public void Sanitize_ShouldReplaceControlCharacters()
        {
            var input = "evil" + char.MinValue + "name.txt";

            var result = FileNameSanitizer.Sanitize(input);

            Assert.Equal("evil_name.txt", result);
        }

        [Fact]
        public void Sanitize_ShouldStripLeadingDotsAndSpaces()
        {
            var result = FileNameSanitizer.Sanitize("  ...hidden.txt");

            Assert.Equal("hidden.txt", result);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Sanitize_ShouldReturnFallback_WhenInputIsNullOrWhitespace(string? input)
        {
            var result = FileNameSanitizer.Sanitize(input);

            Assert.Equal("file", result);
        }

        [Fact]
        public void Sanitize_ShouldReturnFallback_WhenOnlyDotsAndSpacesRemain()
        {
            var result = FileNameSanitizer.Sanitize("...   ...");

            Assert.Equal("file", result);
        }

        [Fact]
        public void Sanitize_ShouldTruncate_WhenLongerThanMaxLength()
        {
            var longName = new string('a', 500) + ".txt";

            var result = FileNameSanitizer.Sanitize(longName);

            Assert.True(result.Length <= 200);
        }
    }
}
