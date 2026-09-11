using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models.DTOs;

namespace TSI.Nexus.WebAPI.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class PurchaseOrdersController : Controller
    {
        /// <summary>
        /// PurchaseOrderService object created to access the service model.
        /// </summary>
        private readonly IPurchaseOrderService _purchaseOrderService;

        /// <summary>
        /// PurchaseOrdersController constructor create to initialize the "_purchaseOrderService" using Dependency Injection.
        /// </summary>
        /// <param name="purchaseOrderService">IPurchaseOrderService object used to initialize the internal variable using Dependency Injection.</param>
        public PurchaseOrdersController(IPurchaseOrderService purchaseOrderService)
        {
            _purchaseOrderService = purchaseOrderService;
        }

        /// <summary>
        /// Add purchase order on database
        /// </summary>
        /// <param name="purchaseOrderDto">Object to be added</param>
        [HttpPost]
        [Route("Add")]
        public async Task<IActionResult> Add([FromBody] PurchaseOrderDto purchaseOrderDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _purchaseOrderService.Add(purchaseOrderDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Update purchase order available on database
        /// </summary>
        /// <param name="purchaseOrderDto">Object to be updated</param>
        [HttpPut]
        [Route("Update")]
        public async Task<IActionResult> Update([FromBody] PurchaseOrderDto purchaseOrderDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _purchaseOrderService.Update(purchaseOrderDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Remove purchase order when it is identified on database
        /// </summary>
        /// <param name="purchaseOrderDto">Object to be removed</param>
        [HttpDelete]
        [Route("Remove")]
        public async Task<IActionResult> Remove([FromBody] PurchaseOrderDto purchaseOrderDto)
        {
            var webApiResponse = await _purchaseOrderService.Remove(purchaseOrderDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get all purchase orders available on database
        /// </summary>
        [HttpGet]
        [Route("GetAll")]
        public async Task<IActionResult> GetAll()
        {
            var webApiResponse = await _purchaseOrderService.FindAll();
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Server-side paged/sorted/filtered listing for the Purchase Orders grid.
        /// </summary>
        /// <param name="request">The requested page, sort, date-range/status and quick-filter text.</param>
        [HttpGet]
        [Route("GetAllPaged")]
        public async Task<IActionResult> GetAllPaged([FromQuery] PagedRequest request)
        {
            var webApiResponse = await _purchaseOrderService.FindAllPaged(request);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get purchase order by id
        /// </summary>
        /// <param name="purchaseOrderId">PurchaseOrder id to be used in the search</param>
        [HttpGet]
        [Route("GetById/{purchaseOrderId}")]
        public async Task<IActionResult> GetById(Guid? purchaseOrderId)
        {
            var webApiResponse = await _purchaseOrderService.FindById(purchaseOrderId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get purchase orders by businessPartner id
        /// </summary>
        /// <param name="businessPartnerId">BusinessPartner id to be used in the search</param>
        [HttpGet]
        [Route("GetByBusinessPartnerId/{businessPartnerId}")]
        public async Task<IActionResult> GetByBusinessPartnerId(Guid? businessPartnerId)
        {
            var webApiResponse = await _purchaseOrderService.FindByBusinessPartnerId(
                businessPartnerId
            );
            return Ok(webApiResponse);
        }
    }
}
