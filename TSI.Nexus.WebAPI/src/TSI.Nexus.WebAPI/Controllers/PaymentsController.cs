using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models.DTOs;

namespace TSI.Nexus.WebAPI.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class PaymentsController : Controller
    {
        /// <summary>
        /// PaymentService object created to access the service model.
        /// </summary>
        private readonly IPaymentService _paymentService;

        /// <summary>
        /// PaymentsController constructor create to initialize the "_paymentService" using Dependency Injection.
        /// </summary>
        /// <param name="transactionService">IPaymentService object used to initialize the internal variable using Dependency Injection.</param>
        public PaymentsController(IPaymentService transactionService)
        {
            _paymentService = transactionService;
        }

        /// <summary>
        /// Add transaction on database
        /// </summary>
        /// <param name="paymentDto">Object to be added</param>
        [HttpPost]
        [Route("Add")]
        public async Task<IActionResult> Add([FromBody] PaymentDto paymentDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _paymentService.Add(paymentDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Update transaction available on database
        /// </summary>
        /// <param name="paymentDto">Object to be updated</param>
        [HttpPut]
        [Route("Update")]
        public async Task<IActionResult> Update([FromBody] PaymentDto paymentDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _paymentService.Update(paymentDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Remove transaction when it is identified on database
        /// </summary>
        /// <param name="paymentDto">Object to be removed</param>
        [HttpDelete]
        [Route("Remove")]
        public async Task<IActionResult> Remove([FromBody] PaymentDto paymentDto)
        {
            var webApiResponse = await _paymentService.Remove(paymentDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get all transaction payments available on database
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        [Route("GetAll")]
        public async Task<IActionResult> GetAll()
        {
            var webApiResponse = await _paymentService.FindAll();
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get one page of payments (ag-Grid Infinite Row Model), for the main Payments listing screen.
        /// </summary>
        /// <param name="request">The requested page, sort, quick-filter and date/status/type filters.</param>
        [HttpGet]
        [Route("GetAllPaged")]
        public async Task<IActionResult> GetAllPaged([FromQuery] PagedRequest request)
        {
            var webApiResponse = await _paymentService.FindAllPaged(request);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get transaction payments by id
        /// </summary>
        /// <param name="transactionId">Transaction id to be used in the search</param>
        [HttpGet]
        [Route("GetById/{transactionId}")]
        public async Task<IActionResult> GetById(Guid? transactionId)
        {
            var webApiResponse = await _paymentService.FindById(transactionId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get transaction payments by transaction id
        /// </summary>
        /// <param name="transactionId">Transaction id to be used in the search</param>
        [HttpGet]
        [Route("GetByTransactionId/{transactionId}")]
        public async Task<IActionResult> GetByTransactionId(Guid? transactionId)
        {
            var webApiResponse = await _paymentService.FindByTransactionId(transactionId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get transaction payments by businessPartner id
        /// </summary>
        /// <param name="businessPartnerId">BusinessPartner id to be used in the search</param>
        [HttpGet]
        [Route("GetByBusinessPartnerId/{businessPartnerId}")]
        public async Task<IActionResult> GetByBusinessPartnerId(Guid? businessPartnerId)
        {
            var webApiResponse = await _paymentService.FindByBusinessPartnerId(businessPartnerId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get transaction payments by transaction id
        /// </summary>
        /// <param name="OrderId">Order id to be used in the search</param>
        [HttpGet]
        [Route("GetByOrderId/{orderId}")]
        public async Task<IActionResult> GetByOrderId(Guid? orderId)
        {
            var webApiResponse = await _paymentService.FindByOrderId(orderId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get transaction payments by purchase order id
        /// </summary>
        /// <param name="purchaseOrderId">Purchase order id to be used in the search</param>
        [HttpGet]
        [Route("GetByPurchaseOrderId/{purchaseOrderId}")]
        public async Task<IActionResult> GetByPurchaseOrderId(Guid? purchaseOrderId)
        {
            var webApiResponse = await _paymentService.FindByPurchaseOrderId(purchaseOrderId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get transaction payments by trip id
        /// </summary>
        /// <param name="tripId">Trip id to be used in the search</param>
        [HttpGet]
        [Route("GetByTripId/{tripId}")]
        public async Task<IActionResult> GetByTripId(Guid? tripId)
        {
            var webApiResponse = await _paymentService.FindByTripId(tripId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get transaction payments by driver id
        /// </summary>
        /// <param name="driverId">Driver id to be used in the search</param>
        [HttpGet]
        [Route("GetByDriverId/{driverId}")]
        public async Task<IActionResult> GetByDriverId(Guid? driverId)
        {
            var webApiResponse = await _paymentService.FindByDriverId(driverId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get transaction payments by transaction id
        /// </summary>
        /// <param name="OrderId">Order id to be used in the search</param>
        [HttpGet]
        [Route("GetPaymentsHistory")]
        public async Task<IActionResult> GetPaymentsHistory(
            [FromQuery] DateTime? start = null,
            [FromQuery] DateTime? end = null
        )
        {
            var webApiResponse = await _paymentService.GetPaymentsHistory(start, end);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get delayed/overdue payments for notifications
        /// </summary>
        [HttpGet]
        [Route("GetDelayed")]
        public async Task<IActionResult> GetDelayed()
        {
            var webApiResponse = await _paymentService.FindDelayed();
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get transactions grouped by category summing payments for each category
        /// </summary>
        /// <param name="type">PaymentType to filter (optional)</param>
        /// <param name="start">Optional start date (inclusive)</param>
        /// <param name="end">Optional end date (inclusive)</param>
        [HttpGet]
        [Route("GetPaymentsGroupByCategory")]
        public async Task<IActionResult> GetPaymentsGroupByCategory(
            [FromQuery] PaymentType? type = null,
            [FromQuery] DateTime? start = null,
            [FromQuery] DateTime? end = null
        )
        {
            var webApiResponse = await _paymentService.GetPaymentsGroupByCategory(type, start, end);
            return Ok(webApiResponse);
        }
    }
}
