using System;
using System.Collections.Generic;

namespace TSI.Nexus.Contracts.Utilities
{
    /// <summary>
    /// Parses a list of raw strings (e.g. from a PagedRequest.Statuses/Types query parameter) into
    /// the given enum type, silently skipping any value that doesn't match a member - the grid only
    /// ever sends values it already knows about (its own status/type checkbox labels), so an
    /// unrecognized one is ignored rather than surfaced as an error.
    /// </summary>
    public static class EnumListParser
    {
        public static List<TEnum> Parse<TEnum>(List<string> values)
            where TEnum : struct, Enum
        {
            var result = new List<TEnum>();

            if (values == null)
            {
                return result;
            }

            foreach (var value in values)
            {
                if (Enum.TryParse<TEnum>(value, ignoreCase: true, out var parsed))
                {
                    result.Add(parsed);
                }
            }

            return result;
        }
    }
}
