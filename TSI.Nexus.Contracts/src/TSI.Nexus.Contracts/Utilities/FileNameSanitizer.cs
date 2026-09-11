namespace TSI.Nexus.Contracts.Utilities
{
    /// <summary>
    /// Sanitizes a user-supplied file name before it touches the file system. Uses an allow-list
    /// of safe characters instead of denying the OS's own "invalid" list - on Linux that list is
    /// just '\0' and '/', so anything else (control characters, exotic Unicode, homoglyphs) would
    /// pass through untouched. Shared by AttachmentService and PhotoService, which previously each
    /// had their own copy of the weaker denylist version.
    /// </summary>
    public static class FileNameSanitizer
    {
        private const int MaxLength = 200;

        /// <summary>
        /// Returns a version of <paramref name="fileName"/> containing only ASCII letters,
        /// digits, '-', '_', '.' and spaces - every other character is replaced with '_'. Leading
        /// dots/spaces are stripped (hidden-file tricks, Windows trailing-space/dot quirks) and
        /// any ".." left behind is collapsed, since a traversal segment has no other meaning once
        /// the path separators around it are already gone. Falls back to "file" if nothing safe
        /// is left, and truncates to a sane maximum length.
        /// </summary>
        public static string Sanitize(string? fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName))
            {
                return "file";
            }

            var sanitized = new System.Text.StringBuilder(fileName.Length);
            foreach (var c in fileName)
            {
                sanitized.Append(char.IsAsciiLetterOrDigit(c) || c is '-' or '_' or '.' or ' ' ? c : '_');
            }

            var result = sanitized.ToString().Trim('.', ' ');
            while (result.Contains(".."))
            {
                result = result.Replace("..", "_");
            }

            if (result.Length > MaxLength)
            {
                result = result[..MaxLength];
            }

            return string.IsNullOrWhiteSpace(result) ? "file" : result;
        }
    }
}
