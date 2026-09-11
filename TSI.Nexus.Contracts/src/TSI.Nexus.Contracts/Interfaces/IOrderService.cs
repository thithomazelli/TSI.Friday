using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Contracts.Interfaces
{
    public interface IOrderService
    {
        /// <summary>
        /// Add a new Order based on the object received.
        /// </summary>
        /// <param name="orderDto">The order DTO object defined.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<OrderDto>> Add(OrderDto orderDto);

        /// <summary>
        /// Update a Order based on the object received.
        /// </summary>
        /// <param name="orderDto">The order DTO object updated.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<OrderDto>> Update(OrderDto orderDto);

        /// <summary>
        /// Remove a Order based on the object received.
        /// </summary>
        /// <param name="orderDto">The order DTO object to be removed.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<OrderDto>> Remove(OrderDto orderDto);

        /// <summary>
        /// Method responsible to get all registers available on The order database.
        /// </summary>
        /// <returns>All registers found on The order database.</returns>
        Task<WebApiResponse<IEnumerable<OrderDto>>> FindAll();

        /// <summary>
        /// Method responsible to get only one Order based on the ID received as parameter.
        /// </summary>
        /// <param name="id">The ID to be used on the search.</param>
        /// <returns>One Order object according to the ID defined as parameter.</returns>
        Task<WebApiResponse<OrderDto>> FindById(Guid? id);

        /// <summary>
        /// Method responsible to return one page of Orders (ag-Grid Infinite Row Model), for the
        /// main Orders listing screen - which otherwise would load the entire table on every visit.
        /// </summary>
        /// <param name="request">The requested page, sort, quick-filter and date/status filters.</param>
        /// <returns>One page of Orders plus the total row count.</returns>
        Task<WebApiResponse<PagedResult<OrderDto>>> FindAllPaged(PagedRequest request);

        /// <summary>
        /// Should find a Order that based on the OrderNumber received as parameter.
        /// </summary>
        /// <param name="orderNumber">The OrderNumber to be used on the search.</param>
        /// <returns>One Order object according to the OrderNumber defined as parameter.</returns>
        Task<WebApiResponse<OrderDto>> FindByOrderNumber(string orderNumber);

        /// <summary>
        /// Method responsible to get a list of Orders based on the BusinessPartnerID received as parameter.
        /// </summary>
        /// <param name="businessPartnerId">The ID to be used on the search.</param>
        /// <returns>List of order according to the BusinessPartnerID defined as parameter.</returns>
        Task<WebApiResponse<IEnumerable<OrderDto>>> FindByBusinessPartnerId(
            Guid? businessPartnerId
        );

        /// <summary>
        /// Method responsible to get a list of Orders based on the ProductID received as parameter.
        /// </summary>
        /// <param name="productId">The ID to be used on the search.</param>
        /// <returns>List of order according to the ProductID defined as parameter.</returns>
        Task<WebApiResponse<IEnumerable<OrderDto>>> FindByProductId(Guid? productId);
    }
}
