using System;
using System.Collections.Generic;

namespace TSI.Nexus.Contracts.Models.DTOs
{
    /// <summary>
    /// Request shape for a server-side paged listing (ag-Grid Infinite Row Model). Bound from
    /// query string parameters on a "GetAllPaged" endpoint. StartDate/EndDate/Statuses/Types mirror
    /// the date-range + status(/type) filter panel every one of these listing screens already had
    /// client-side - moved server-side alongside the rest of the query so switching to pagination
    /// doesn't drop that filtering down to whatever page happens to be loaded. Not every consumer
    /// uses every field (Types, for instance, only means something to Transactions); a service
    /// simply ignores what doesn't apply to its entity.
    /// </summary>
    public class PagedRequest
    {
        public int Page { get; set; } = 1;

        public int PageSize { get; set; } = 50;

        public string SortField { get; set; }

        public bool SortDescending { get; set; }

        public string QuickFilter { get; set; }

        public DateTime? StartDate { get; set; }

        public DateTime? EndDate { get; set; }

        public List<string> Statuses { get; set; }

        public List<string> Types { get; set; }
    }
}
