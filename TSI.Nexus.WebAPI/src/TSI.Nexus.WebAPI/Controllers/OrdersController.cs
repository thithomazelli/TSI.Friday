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
    public class OrdersController : Controller
    {
        /// <summary>
        /// OrderService object created to access the service model.
        /// </summary>
        private readonly IOrderService _orderService;
        private readonly IDocumentPdfGenerationService _documentPdfGenerationService;

        /// <summary>
        /// OrdersController constructor create to initialize the "_orderService" using Dependency Injection.
        /// </summary>
        /// <param name="orderService">IOrderService object used to initialize the internal variable using Dependency Injection.</param>
        /// <param name="documentPdfGenerationService">IDocumentPdfGenerationService object used to generate the Pedido de Venda PDF.</param>
        public OrdersController(
            IOrderService orderService,
            IDocumentPdfGenerationService documentPdfGenerationService
        )
        {
            _orderService = orderService;
            _documentPdfGenerationService = documentPdfGenerationService;
        }

        /// <summary>
        /// Add order on database
        /// </summary>
        /// <param name="orderDto">Object to be added</param>
        [HttpPost]
        [Route("Add")]
        public async Task<IActionResult> Add([FromBody] OrderDto orderDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _orderService.Add(orderDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Update order available on database
        /// </summary>
        /// <param name="orderDto">Object to be updated</param>
        [HttpPut]
        [Route("Update")]
        public async Task<IActionResult> Update([FromBody] OrderDto orderDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _orderService.Update(orderDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Remove order when it is identified on database
        /// </summary>
        /// <param name="orderDto">Object to be removed</param>
        [HttpDelete]
        [Route("Remove")]
        public async Task<IActionResult> Remove([FromBody] OrderDto orderDto)
        {
            var webApiResponse = await _orderService.Remove(orderDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get all orders available on database
        /// </summary>
        [HttpGet]
        [Route("GetAll")]
        public async Task<IActionResult> GetAll()
        {
            var webApiResponse = await _orderService.FindAll();
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get one page of orders (ag-Grid Infinite Row Model), for the main Orders listing screen.
        /// </summary>
        /// <param name="request">The requested page, sort, quick-filter and date/status filters.</param>
        [HttpGet]
        [Route("GetAllPaged")]
        public async Task<IActionResult> GetAllPaged([FromQuery] PagedRequest request)
        {
            var webApiResponse = await _orderService.FindAllPaged(request);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get order by id
        /// </summary>
        /// <param name="orderId">Order id to be used in the search</param>
        [HttpGet]
        [Route("GetById/{orderId}")]
        public async Task<IActionResult> GetById(Guid? orderId)
        {
            var webApiResponse = await _orderService.FindById(orderId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get order by order number
        /// </summary>
        /// <param name="orderNumber">Order number to be used in the search</param>
        [HttpGet]
        [Route("GetByOrderNumber/{orderNumber}")]
        public async Task<IActionResult> GetByOrderNumber(string orderNumber)
        {
            var webApiResponse = await _orderService.FindByOrderNumber(orderNumber);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get orders by businessPartner id
        /// </summary>
        /// <param name="businessPartnerId">BusinessPartner id to be used in the search</param>
        [HttpGet]
        [Route("GetByBusinessPartnerId/{businessPartnerId}")]
        public async Task<IActionResult> GetByBusinessPartnerId(Guid? businessPartnerId)
        {
            var webApiResponse = await _orderService.FindByBusinessPartnerId(businessPartnerId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get orders by product id
        /// </summary>
        /// <param name="productId">Product id to be used in the search</param>
        [HttpGet]
        [Route("GetByProductId/{productId}")]
        public async Task<IActionResult> GetByProductId(Guid? productId)
        {
            var webApiResponse = await _orderService.FindByProductId(productId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Generates the Pedido de Venda PDF for the given order
        /// </summary>
        /// <param name="orderId">Order id to generate the PDF for</param>
        [HttpGet]
        [Route("{orderId}/Pdf")]
        public async Task<IActionResult> Pdf(Guid orderId)
        {
            var pdfBytes = await _documentPdfGenerationService.GenerateSalesOrderPdf(orderId);
            if (pdfBytes == null)
            {
                return NotFound($"Pedido {orderId} não encontrado.");
            }

            return File(pdfBytes, "application/pdf");
        }
    }
}
