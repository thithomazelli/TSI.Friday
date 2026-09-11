using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Contracts.Interfaces
{
    public interface IQuoteService
    {
        /// <summary>
        /// Add a new Quote based on the object received.
        /// </summary>
        /// <param name="quoteDto">The quote DTO object defined.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<QuoteDto>> Add(QuoteDto quoteDto);

        /// <summary>
        /// Update a Quote based on the object received.
        /// </summary>
        /// <param name="quoteDto">The quote DTO object updated.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<QuoteDto>> Update(QuoteDto quoteDto);

        /// <summary>
        /// Remove a Quote based on the object received.
        /// </summary>
        /// <param name="quoteDto">The quote DTO object to be removed.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<QuoteDto>> Remove(QuoteDto quoteDto);

        /// <summary>
        /// Method responsible to get all registers available on The quote database.
        /// </summary>
        /// <returns>All registers found on The quote database.</returns>
        Task<WebApiResponse<IEnumerable<QuoteDto>>> FindAll();

        /// <summary>
        /// Method responsible to return one page of Quotes (ag-Grid Infinite Row Model), for the
        /// main Quotes listing screen - which otherwise would load the entire table on every visit.
        /// </summary>
        /// <param name="request">The requested page, sort, quick-filter and date/status filters.</param>
        /// <returns>One page of Quotes plus the total row count.</returns>
        Task<WebApiResponse<PagedResult<QuoteDto>>> FindAllPaged(PagedRequest request);

        /// <summary>
        /// Method responsible to get only one Quote based on the ID received as parameter.
        /// </summary>
        /// <param name="id">The ID to be used on the search.</param>
        /// <returns>One Quote object according to the ID defined as parameter.</returns>
        Task<WebApiResponse<QuoteDto>> FindById(Guid? id);

        /// <summary>
        /// Should find a Quote that based on the QuoteNumber received as parameter.
        /// </summary>
        /// <param name="quoteNumber">The QuoteNumber to be used on the search.</param>
        /// <returns>One Quote object according to the QuoteNumber defined as parameter.</returns>
        Task<WebApiResponse<QuoteDto>> FindByQuoteNumber(string quoteNumber);

        /// <summary>
        /// Method responsible to get a list of Quotes based on the BusinessPartnerID received as parameter.
        /// </summary>
        /// <param name="businessPartnerId">The ID to be used on the search.</param>
        /// <returns>List of quote according to the BusinessPartnerID defined as parameter.</returns>
        Task<WebApiResponse<IEnumerable<QuoteDto>>> FindByBusinessPartnerId(
            Guid? businessPartnerId
        );

        /// <summary>
        /// Method responsible to get a list of Quotes based on the ProductID received as parameter.
        /// </summary>
        /// <param name="productId">The ID to be used on the search.</param>
        /// <returns>List of quote according to the ProductID defined as parameter.</returns>
        Task<WebApiResponse<IEnumerable<QuoteDto>>> FindByProductId(Guid? productId);

        /// <summary>
        /// Convert a Quote into an Order. Checks product availability for sale/rental products before conversion.
        /// If some products are out of stock, returns a warning with details so the UI may prompt the user.
        /// Otherwise calls OrderService.Add() to create the order and returns the converted Quote (status updated to Converted).
        /// </summary>
        Task<WebApiResponse<QuoteDto>> ConvertToOrder(QuoteDto quoteDto);

        /// <summary>
        /// Convert a Quote of type Trip into a Trip. Trip has no line items, so there is no
        /// stock check - calls TripService.Add() to create the trip and returns the converted
        /// Quote (status updated to Converted).
        /// </summary>
        Task<WebApiResponse<QuoteDto>> ConvertToTrip(QuoteDto quoteDto);
    }
}
