using System;
using System.Collections.Generic;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Contracts.Interfaces
{
    public interface IPaymentService
    {
        /// <summary>
        /// Add a new Payment based on the object received.
        /// </summary>
        /// <param name="PaymentDto">The payment object defined.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<PaymentDto>> Add(PaymentDto paymentDto);

        /// <summary>
        /// Update an Payment based on the object received.
        /// </summary>
        /// <param name="paymentDto">The payment object updated.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<PaymentDto>> Update(PaymentDto paymentDto);

        /// <summary>
        /// Remove an Payment based on the object received.
        /// </summary>
        /// <param name="paymentDto">The payment object to be removed.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<PaymentDto>> Remove(PaymentDto paymentDto);

        /// <summary>
        /// Method responsible to get all registers available on the payment database.
        /// </summary>
        /// <returns>All registers found on the payment database.</returns>
        Task<WebApiResponse<IEnumerable<PaymentDto>>> FindAll();

        /// <summary>
        /// Method responsible to get only one Payment based on the ID received as parameter.
        /// </summary>
        /// <param name="id">The ID to be used on the search.</param>
        /// <returns>One payment object according to the ID defined as parameter.</returns>
        Task<WebApiResponse<PaymentDto>> FindById(Guid? id);

        /// <summary>
        /// Method responsible to return one page of Payments (ag-Grid Infinite Row Model), for the
        /// main Payments listing screen - which otherwise would load the entire table on every visit.
        /// </summary>
        /// <param name="request">The requested page, sort, quick-filter and date/status/type filters.</param>
        /// <returns>One page of Payments plus the total row count.</returns>
        Task<WebApiResponse<PagedResult<PaymentDto>>> FindAllPaged(PagedRequest request);

        /// <summary>
        /// Method responsible to get a list of Payments based on the TransactionID received as parameter.
        /// </summary>
        /// <param name="transactionId">The ID to be used on the search.</param>
        /// <returns>List of payments according to the TransactionID defined as parameter.</returns>
        Task<WebApiResponse<IEnumerable<PaymentDto>>> FindByTransactionId(Guid? transactionId);

        /// <summary>
        /// Method responsible to get a list of Payments based on the BusinessPartnerID received as parameter.
        /// </summary>
        /// <param name="businessPartnerId">The ID to be used on the search.</param>
        /// <returns>List of payments according to the BusinessPartnerID defined as parameter.</returns>
        Task<WebApiResponse<IEnumerable<PaymentDto>>> FindByBusinessPartnerId(
            Guid? businessPartnerId
        );

        /// <summary>
        /// Method responsible to get a list of Payments based on the OrderID received as parameter.
        /// </summary>
        /// <param name="orderId">The ID to be used on the search.</param>
        /// <returns>List of payments according to the OrderID defined as parameter.</returns>
        Task<WebApiResponse<IEnumerable<PaymentDto>>> FindByOrderId(Guid? orderId);

        /// <summary>
        /// Method responsible to get a list of Payments based on the PurchaseOrderID received as parameter.
        /// </summary>
        /// <param name="purchaseOrderId">The ID to be used on the search.</param>
        /// <returns>List of payments according to the PurchaseOrderID defined as parameter.</returns>
        Task<WebApiResponse<IEnumerable<PaymentDto>>> FindByPurchaseOrderId(Guid? purchaseOrderId);

        /// <summary>
        /// Method responsible to get a list of Payments based on the TripID received as parameter.
        /// </summary>
        /// <param name="tripId">The ID to be used on the search.</param>
        /// <returns>List of payments according to the TripID defined as parameter.</returns>
        Task<WebApiResponse<IEnumerable<PaymentDto>>> FindByTripId(Guid? tripId);

        /// <summary>
        /// Method responsible to get a list of Payments based on the DriverId received as parameter.
        /// </summary>
        /// <param name="driverId">The ID to be used on the search.</param>
        /// <returns>List of payments according to the DriverId defined as parameter.</returns>
        Task<WebApiResponse<IEnumerable<PaymentDto>>> FindByDriverId(Guid? driverId);

        /// <summary>
        /// Method responsible to get Payments considered delayed/overdue for notifications.
        /// Rules: status == Delayed OR (status != Approved && Date < today) — compare dates using only day/month/year (UTC).
        /// </summary>
        Task<WebApiResponse<IEnumerable<PaymentDto>>> FindDelayed();

        /// <summary>
        /// Get payments history aggregated by month. Optional start/end (query).
        /// </summary>
        /// <param name="start">Optional start date (inclusive).</param>
        /// <param name="end">Optional end date (inclusive).</param>
        /// <returns></returns>
        Task<WebApiResponse<JsonObject>> GetPaymentsHistory(
            DateTime? start = null,
            DateTime? end = null
        );

        /// <summary>
        /// Get transactions grouped by category summing payments for each category.
        /// </summary>
        /// <param name="type">Optional PaymentType to filter. If null returns both types.</param>
        /// <param name="start">Optional start date (inclusive).</param>
        /// <param name="end">Optional end date (inclusive).</param>
        /// <returns>WebApiResponse with a JsonObject containing grouped results.</returns>
        Task<WebApiResponse<JsonObject>> GetPaymentsGroupByCategory(
            PaymentType? type = null,
            DateTime? start = null,
            DateTime? end = null
        );
    }
}
