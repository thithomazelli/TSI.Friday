using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models.DTOs;

namespace TSI.Nexus.WebAPI.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class TransactionsController : Controller
    {
        /// <summary>
        /// TransactionService object created to access the service model.
        /// </summary>
        private readonly ITransactionService _transactionService;

        /// <summary>
        /// TransactionsController constructor create to initialize the "_transactionService" using Dependency Injection.
        /// </summary>
        /// <param name="transactionService">ITransactionService object used to initialize the internal variable using Dependency Injection.</param>
        public TransactionsController(ITransactionService transactionService)
        {
            _transactionService = transactionService;
        }

        /// <summary>
        /// Add transaction on database
        /// </summary>
        /// <param name="transactionDto">Object to be added</param>
        [HttpPost]
        [Route("Add")]
        public async Task<IActionResult> Add([FromBody] TransactionDto transactionDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _transactionService.Add(transactionDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Update transaction available on database
        /// </summary>
        /// <param name="transactionDto">Object to be updated</param>
        [HttpPut]
        [Route("Update")]
        public async Task<IActionResult> Update([FromBody] TransactionDto transactionDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _transactionService.Update(transactionDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Remove transaction when it is identified on database
        /// </summary>
        /// <param name="transactionDto">Object to be removed</param>
        [HttpDelete]
        [Route("Remove")]
        public async Task<IActionResult> Remove([FromBody] TransactionDto transactionDto)
        {
            var webApiResponse = await _transactionService.Remove(transactionDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get all transactions available on database
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        [Route("GetAll")]
        public async Task<IActionResult> GetAll()
        {
            var webApiResponse = await _transactionService.FindAll();
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get one page of transactions (ag-Grid Infinite Row Model), for the main Transactions
        /// listing screen.
        /// </summary>
        /// <param name="request">The requested page, sort, quick-filter and date/status filters.</param>
        [HttpGet]
        [Route("GetAllPaged")]
        public async Task<IActionResult> GetAllPaged([FromQuery] PagedRequest request)
        {
            var webApiResponse = await _transactionService.FindAllPaged(request);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get transaction by id
        /// </summary>
        /// <param name="transactionId">Transaction id to be used in the search</param>
        [HttpGet]
        [Route("GetById/{transactionId}")]
        public async Task<IActionResult> GetById(Guid? transactionId)
        {
            var webApiResponse = await _transactionService.FindById(transactionId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get transactions by businessPartner id
        /// </summary>
        /// <param name="businessPartnerId">BusinessPartner id to be used in the search</param>
        [HttpGet]
        [Route("GetByBusinessPartnerId/{businessPartnerId}")]
        public async Task<IActionResult> GetByBusinessPartnerId(Guid? businessPartnerId)
        {
            var webApiResponse = await _transactionService.FindByBusinessPartnerId(
                businessPartnerId
            );
            return Ok(webApiResponse);
        }
    }
}
