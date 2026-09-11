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
    public class BusinessPartnersController : Controller
    {
        /// <summary>
        /// BusinessPartnerService object created to access the service model.
        /// </summary>
        private readonly IBusinessPartnerService _businessPartnerService;

        /// <summary>
        /// BusinessPartnersController constructor create to initialize the "_businessPartnerService" using Dependency Injection.
        /// </summary>
        /// <param name="businessPartnerService ">IBusinessPartnerService object used to initialize the internal variable using Dependency Injection.</param>
        public BusinessPartnersController(IBusinessPartnerService businessPartnerService)
        {
            _businessPartnerService = businessPartnerService;
        }

        /// <summary>
        /// Remove businessPartner when it is identified on database
        /// </summary>
        /// <param name="businessPartner">Object to be removed</param>
        [HttpDelete]
        [Route("Remove")]
        public async Task<IActionResult> Remove([FromBody] BusinessPartnerDto businessPartner)
        {
            var webApiResponse = await _businessPartnerService.Remove(businessPartner);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get all clients available on database
        /// </summary>
        /// <returns>List of all clients from database</returns>
        [HttpGet]
        [Route("GetAllClients")]
        public async Task<IActionResult> GetAllClients()
        {
            var webApiResponse = await _businessPartnerService.FindAllByType(
                BusinessPartnerType.Client
            );
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get all suppliers available on database
        /// </summary>
        /// <returns>List of all clients from database</returns>
        [HttpGet]
        [Route("GetAllSuppliers")]
        public async Task<IActionResult> GetAllSuppliers()
        {
            var webApiResponse = await _businessPartnerService.FindAllByType(
                BusinessPartnerType.Supplier
            );
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Server-side paged/sorted/filtered listing of Clients for the Clients grid.
        /// </summary>
        /// <param name="request">The requested page, sort and quick-filter text.</param>
        [HttpGet]
        [Route("GetAllClientsPaged")]
        public async Task<IActionResult> GetAllClientsPaged([FromQuery] PagedRequest request)
        {
            var webApiResponse = await _businessPartnerService.FindAllByTypePaged(
                BusinessPartnerType.Client,
                request
            );
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Server-side paged/sorted/filtered listing of Suppliers for the Suppliers grid.
        /// </summary>
        /// <param name="request">The requested page, sort and quick-filter text.</param>
        [HttpGet]
        [Route("GetAllSuppliersPaged")]
        public async Task<IActionResult> GetAllSuppliersPaged([FromQuery] PagedRequest request)
        {
            var webApiResponse = await _businessPartnerService.FindAllByTypePaged(
                BusinessPartnerType.Supplier,
                request
            );
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get businessPartner by id
        /// </summary>
        /// <param name="businessPartnerId">BusinessPartner id to be used in the search</param>
        /// <returns>The businessPartner object based on the id informed</returns>
        [HttpGet]
        [Route("GetById/{businessPartnerId}")]
        public async Task<IActionResult> GetById(Guid? businessPartnerId)
        {
            var webApiResponse = await _businessPartnerService.FindById(businessPartnerId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get businessPartner by email
        /// </summary>
        /// <param name="email">Email to be used in the search</param>
        /// <returns>The businessPartner object based on the email informed</returns>
        [HttpGet]
        [Route("GetByEmail/{email}")]
        public async Task<IActionResult> GetByEmail(string email)
        {
            var webApiResponse = await _businessPartnerService.FindByEmail(email);
            return Ok(webApiResponse);
        }
    }
}
