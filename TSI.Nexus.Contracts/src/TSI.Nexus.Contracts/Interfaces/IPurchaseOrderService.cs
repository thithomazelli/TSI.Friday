using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Contracts.Interfaces
{
    public interface IPurchaseOrderService
    {
        /// <summary>
        /// Add a new PurchaseOrder based on the object received.
        /// </summary>
        /// <param name="purchaseOrderDto">The purchase order DTO object defined.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<PurchaseOrderDto>> Add(PurchaseOrderDto purchaseOrderDto);

        /// <summary>
        /// Update a PurchaseOrder based on the object received.
        /// </summary>
        /// <param name="purchaseOrderDto">The purchase order DTO object updated.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<PurchaseOrderDto>> Update(PurchaseOrderDto purchaseOrderDto);

        /// <summary>
        /// Remove a PurchaseOrder based on the object received.
        /// </summary>
        /// <param name="purchaseOrderDto">The purchase order DTO object to be removed.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<PurchaseOrderDto>> Remove(PurchaseOrderDto purchaseOrderDto);

        /// <summary>
        /// Method responsible to get all registers available on the purchase order database.
        /// </summary>
        /// <returns>All registers found on the purchase order database.</returns>
        Task<WebApiResponse<IEnumerable<PurchaseOrderDto>>> FindAll();

        /// <summary>
        /// Server-side paged/sorted/filtered listing for the Purchase Orders grid.
        /// </summary>
        /// <param name="request">The requested page, sort, date-range/status and quick-filter text.</param>
        Task<WebApiResponse<PagedResult<PurchaseOrderDto>>> FindAllPaged(PagedRequest request);

        /// <summary>
        /// Method responsible to get only one PurchaseOrder based on the ID received as parameter.
        /// </summary>
        /// <param name="id">The ID to be used on the search.</param>
        /// <returns>One PurchaseOrder object according to the ID defined as parameter.</returns>
        Task<WebApiResponse<PurchaseOrderDto>> FindById(Guid? id);

        /// <summary>
        /// Method responsible to get a list of PurchaseOrders based on the BusinessPartnerID received as parameter.
        /// </summary>
        /// <param name="businessPartnerId">The ID to be used on the search.</param>
        /// <returns>List of purchase orders according to the BusinessPartnerID defined as parameter.</returns>
        Task<WebApiResponse<IEnumerable<PurchaseOrderDto>>> FindByBusinessPartnerId(
            Guid? businessPartnerId
        );
    }
}
