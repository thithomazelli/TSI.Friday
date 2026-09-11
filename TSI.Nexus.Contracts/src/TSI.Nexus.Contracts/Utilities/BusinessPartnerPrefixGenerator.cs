using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace TSI.Nexus.Contracts.Utilities
{
    /// <summary>
    /// Builds the 3-letter prefix (e.g. "SIL" from "Silva Transportes") used by Quote/Order/
    /// PurchaseOrder/Trip numbering - shared so the 4 services that generate a document number stay
    /// consistent instead of drifting apart with independently copied logic.
    /// </summary>
    public static class BusinessPartnerPrefixGenerator
    {
        public static string BuildPrefixFromBusinessPartnerName(string businessPartnerName)
        {
            // Remove non-letter characters and whitespace, keep only A-Z letters
            var cleaned = string.Empty;
            if (!string.IsNullOrWhiteSpace(businessPartnerName))
            {
                cleaned = Regex.Replace(businessPartnerName.Normalize(), "[^A-Za-z]", string.Empty);
                cleaned = cleaned.ToUpperInvariant();
            }

            var letters = cleaned ?? string.Empty;

            char GetRandomLetter()
            {
                var rnd = System.Random.Shared;
                return (char)('A' + rnd.Next(0, 26));
            }

            string prefix;

            if (letters.Length >= 3)
            {
                var first = letters[0];
                var middle = letters[letters.Length / 2];
                var last = letters[letters.Length - 1];
                prefix = string.Concat(first, middle, last);
            }
            else
            {
                var chars = new List<char>();
                for (int i = 0; i < letters.Length; i++)
                    chars.Add(letters[i]);

                while (chars.Count < 3)
                    chars.Add(GetRandomLetter());

                prefix = new string(chars.ToArray());
            }

            return prefix;
        }
    }
}
