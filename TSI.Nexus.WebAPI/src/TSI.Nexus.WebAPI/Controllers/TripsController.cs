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
    public class TripsController : Controller
    {
        /// <summary>
        /// TripService object created to access the service model.
        /// </summary>
        private readonly ITripService _tripService;
        private readonly IDocumentPdfGenerationService _documentPdfGenerationService;

        /// <summary>
        /// TripsController constructor create to initialize the "_tripService" using Dependency Injection.
        /// </summary>
        /// <param name="tripService">ITripService object used to initialize the internal variable using Dependency Injection.</param>
        /// <param name="documentPdfGenerationService">IDocumentPdfGenerationService object used to generate the Contrato/Ordem de Serviço PDFs.</param>
        public TripsController(
            ITripService tripService,
            IDocumentPdfGenerationService documentPdfGenerationService
        )
        {
            _tripService = tripService;
            _documentPdfGenerationService = documentPdfGenerationService;
        }

        /// <summary>
        /// Add trip on database
        /// </summary>
        /// <param name="tripDto">Object to be added</param>
        [HttpPost]
        [Route("Add")]
        public async Task<IActionResult> Add([FromBody] TripDto tripDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _tripService.Add(tripDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Update trip available on database
        /// </summary>
        /// <param name="tripDto">Object to be updated</param>
        [HttpPut]
        [Route("Update")]
        public async Task<IActionResult> Update([FromBody] TripDto tripDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _tripService.Update(tripDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Remove trip when it is identified on database
        /// </summary>
        /// <param name="tripDto">Object to be removed</param>
        [HttpDelete]
        [Route("Remove")]
        public async Task<IActionResult> Remove([FromBody] TripDto tripDto)
        {
            var webApiResponse = await _tripService.Remove(tripDto);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get all trips available on database
        /// </summary>
        [HttpGet]
        [Route("GetAll")]
        public async Task<IActionResult> GetAll()
        {
            var webApiResponse = await _tripService.FindAll();
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get trip by id
        /// </summary>
        /// <param name="tripId">Trip id to be used in the search</param>
        [HttpGet]
        [Route("GetById/{tripId}")]
        public async Task<IActionResult> GetById(Guid? tripId)
        {
            var webApiResponse = await _tripService.FindById(tripId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get trip by trip number
        /// </summary>
        /// <param name="tripNumber">Trip number to be used in the search</param>
        [HttpGet]
        [Route("GetByTripNumber/{tripNumber}")]
        public async Task<IActionResult> GetByTripNumber(string tripNumber)
        {
            var webApiResponse = await _tripService.FindByTripNumber(tripNumber);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get trips by businessPartner id
        /// </summary>
        /// <param name="businessPartnerId">BusinessPartner id to be used in the search</param>
        [HttpGet]
        [Route("GetByBusinessPartnerId/{businessPartnerId}")]
        public async Task<IActionResult> GetByBusinessPartnerId(Guid? businessPartnerId)
        {
            var webApiResponse = await _tripService.FindByBusinessPartnerId(businessPartnerId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get trips by driver id
        /// </summary>
        /// <param name="driverId">Driver id to be used in the search</param>
        [HttpGet]
        [Route("GetByDriverId/{driverId}")]
        public async Task<IActionResult> GetByDriverId(Guid? driverId)
        {
            var webApiResponse = await _tripService.FindByDriverId(driverId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get trips by vehicle id
        /// </summary>
        /// <param name="vehicleId">Vehicle id to be used in the search</param>
        [HttpGet]
        [Route("GetByVehicleId/{vehicleId}")]
        public async Task<IActionResult> GetByVehicleId(Guid? vehicleId)
        {
            var webApiResponse = await _tripService.FindByVehicleId(vehicleId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Generates the Contrato de Fretamento PDF for the given trip
        /// </summary>
        /// <param name="tripId">Trip id to generate the PDF for</param>
        [HttpGet]
        [Route("{tripId}/ContractPdf")]
        public async Task<IActionResult> ContractPdf(Guid tripId)
        {
            var pdfBytes = await _documentPdfGenerationService.GenerateContractPdf(tripId);
            if (pdfBytes == null)
            {
                return NotFound($"Viagem {tripId} não encontrada.");
            }

            return File(pdfBytes, "application/pdf");
        }

        /// <summary>
        /// Generates the Ordem de Serviço PDF for the given trip
        /// </summary>
        /// <param name="tripId">Trip id to generate the PDF for</param>
        [HttpGet]
        [Route("{tripId}/ServiceOrderPdf")]
        public async Task<IActionResult> ServiceOrderPdf(Guid tripId)
        {
            var pdfBytes = await _documentPdfGenerationService.GenerateServiceOrderPdf(tripId);
            if (pdfBytes == null)
            {
                return NotFound($"Viagem {tripId} não encontrada.");
            }

            return File(pdfBytes, "application/pdf");
        }
    }
}
