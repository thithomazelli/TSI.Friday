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
    public class QuotesController : Controller
    {
        /// <summary>
        /// QuoteService object created to access the service model.
        /// </summary>
        private readonly IQuoteService _quoteService;
        private readonly IDocumentPdfGenerationService _documentPdfGenerationService;

        /// <summary>
        /// QuotesController constructor create to initialize the "_quoteService" using Dependency Injection.
        /// </summary>
        /// <param name="quoteService">IQuoteService object used to initialize the internal variable using Dependency Injection.</param>
        /// <param name="documentPdfGenerationService">IDocumentPdfGenerationService object used to generate the Orçamento PDF.</param>
        public QuotesController(
            IQuoteService quoteService,
            IDocumentPdfGenerationService documentPdfGenerationService
        )
        {
            _quoteService = quoteService;
            _documentPdfGenerationService = documentPdfGenerationService;
        }

        /// <summary>
        /// Add quote on database
        /// </summary>
        /// <param name="quoteDto">Object to be added</param>
        [HttpPost]
        [Route("Add")]
        public async Task<IActionResult> Add([FromBody] QuoteDto quoteDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _quoteService.Add(quoteDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Update quote available on database
        /// </summary>
        /// <param name="quoteDto">Object to be updated</param>
        [HttpPut]
        [Route("Update")]
        public async Task<IActionResult> Update([FromBody] QuoteDto quoteDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _quoteService.Update(quoteDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Convert a quote into an order. Validates product availability and delegates creation to OrderService.
        /// Returns warning if some products lack stock so UI can prompt user.
        /// </summary>
        /// <param name="quoteDto">Quote DTO with QuoteItems to convert</param>
        [HttpPost]
        [Route("ConvertToOrder")]
        public async Task<IActionResult> ConvertToOrder([FromBody] QuoteDto quoteDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _quoteService.ConvertToOrder(quoteDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Convert a quote of type Trip into a trip, delegating creation to TripService.
        /// </summary>
        /// <param name="quoteDto">Quote DTO to convert</param>
        [HttpPost]
        [Route("ConvertToTrip")]
        public async Task<IActionResult> ConvertToTrip([FromBody] QuoteDto quoteDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _quoteService.ConvertToTrip(quoteDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Remove quote when it is identified on database
        /// </summary>
        /// <param name="quoteDto">Object to be removed</param>
        [HttpDelete]
        [Route("Remove")]
        public async Task<IActionResult> Remove([FromBody] QuoteDto quoteDto)
        {
            var webApiResponse = await _quoteService.Remove(quoteDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get all quotes available on database
        /// </summary>
        [HttpGet]
        [Route("GetAll")]
        public async Task<IActionResult> GetAll()
        {
            var webApiResponse = await _quoteService.FindAll();
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get quote by id
        /// </summary>
        /// <param name="quoteId">Quote id to be used in the search</param>
        [HttpGet]
        [Route("GetById/{quoteId}")]
        public async Task<IActionResult> GetById(Guid? quoteId)
        {
            var webApiResponse = await _quoteService.FindById(quoteId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get quote by quote number
        /// </summary>
        /// <param name="quoteNumber">Quote number to be used in the search</param>
        [HttpGet]
        [Route("GetByQuoteNumber/{quoteNumber}")]
        public async Task<IActionResult> GetByQuoteNumber(string quoteNumber)
        {
            var webApiResponse = await _quoteService.FindByQuoteNumber(quoteNumber);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get quotes by businessPartner id
        /// </summary>
        /// <param name="businessPartnerId">BusinessPartner id to be used in the search</param>
        [HttpGet]
        [Route("GetByBusinessPartnerId/{businessPartnerId}")]
        public async Task<IActionResult> GetByBusinessPartnerId(Guid? businessPartnerId)
        {
            var webApiResponse = await _quoteService.FindByBusinessPartnerId(businessPartnerId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get quotes by product id
        /// </summary>
        /// <param name="productId">Product id to be used in the search</param>
        [HttpGet]
        [Route("GetByProductId/{productId}")]
        public async Task<IActionResult> GetByProductId(Guid? productId)
        {
            var webApiResponse = await _quoteService.FindByProductId(productId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Generates the Orçamento PDF for the given quote
        /// </summary>
        /// <param name="quoteId">Quote id to generate the PDF for</param>
        [HttpGet]
        [Route("{quoteId}/Pdf")]
        public async Task<IActionResult> Pdf(Guid quoteId)
        {
            var pdfBytes = await _documentPdfGenerationService.GenerateQuotePdf(quoteId);
            if (pdfBytes == null)
            {
                return NotFound($"Orçamento {quoteId} não encontrado.");
            }

            return File(pdfBytes, "application/pdf");
        }
    }
}
