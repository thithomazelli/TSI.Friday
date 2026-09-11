using System.Collections.Generic;

namespace TSI.Nexus.Contracts.Models.DTOs
{
    /// <summary>
    /// Response shape for a server-side paged listing (ag-Grid Infinite Row Model): one page of
    /// items plus the total row count across all pages, so the grid knows when to stop asking for
    /// more.
    /// </summary>
    public class PagedResult<T>
    {
        public IEnumerable<T> Items { get; set; } = new List<T>();

        public int TotalCount { get; set; }
    }
}
