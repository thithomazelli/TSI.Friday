using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;

namespace TSI.Nexus.WebAPI.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class DriversController : Controller
    {
        /// <summary>
        /// DriverService object created to access the service model.
        /// </summary>
        private readonly IDriverService _driverService;
        private readonly IAlertConfigService _alertConfigService;

        /// <summary>
        /// DriversController constructor create to initialize the "_driverService" using Dependency Injection.
        /// </summary>
        /// <param name="driverService">IDriverService object used to initialize the internal variable using Dependency Injection.</param>
        /// <param name="alertConfigService">Used to resolve the configured lead time when the caller doesn't pass one explicitly.</param>
        public DriversController(IDriverService driverService, IAlertConfigService alertConfigService)
        {
            _driverService = driverService;
            _alertConfigService = alertConfigService;
        }

        /// <summary>
        /// Add driver on database
        /// </summary>
        /// <param name="driver">Object to be added</param>
        /// <returns></returns>
        [HttpPost]
        [Route("Add")]
        public async Task<IActionResult> Add(Driver driver)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _driverService.Add(driver);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Update driver available on database
        /// </summary>
        /// <param name="driver">Object to be updated</param>
        /// <returns></returns>
        [HttpPut]
        [Route("Update")]
        public async Task<IActionResult> Update([FromBody] Driver driver)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _driverService.Update(driver);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Remove driver when it is identified on database
        /// </summary>
        /// <param name="driver">Object to be removed</param>
        /// <returns></returns>
        [HttpDelete]
        [Route("Remove")]
        public async Task<IActionResult> Remove([FromBody] Driver driver)
        {
            var webApiResponse = await _driverService.Remove(driver);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get all drivers available on database
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        [Route("GetAll")]
        public async Task<IActionResult> GetAll()
        {
            var webApiResponse = await _driverService.FindAll();
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Server-side paged/sorted/filtered listing for the Drivers grid.
        /// </summary>
        /// <param name="request">The requested page, sort and quick-filter text.</param>
        [HttpGet]
        [Route("GetAllPaged")]
        public async Task<IActionResult> GetAllPaged([FromQuery] PagedRequest request)
        {
            var webApiResponse = await _driverService.FindAllPaged(request);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get driver by id
        /// </summary>
        /// <param name="driverId">Driver id to be used in the search</param>
        /// <returns></returns>
        [HttpGet]
        [Route("GetById/{driverId}")]
        public async Task<IActionResult> GetById(Guid? driverId)
        {
            var webApiResponse = await _driverService.FindById(driverId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get driver by CPF (social security card)
        /// </summary>
        /// <param name="socialSecurityCard">CPF to be used in the search</param>
        /// <returns></returns>
        [HttpGet]
        [Route("GetBySocialSecurityCard/{socialSecurityCard}")]
        public async Task<IActionResult> GetBySocialSecurityCard(string socialSecurityCard)
        {
            var webApiResponse = await _driverService.FindBySocialSecurityCard(socialSecurityCard);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get only drivers currently active and able to be assigned to a trip
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        [Route("GetActive")]
        public async Task<IActionResult> GetActive()
        {
            var webApiResponse = await _driverService.FindActive();
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get drivers whose CNH is expired or expiring within the given number of days. When
        /// omitted, the lead time configured for the "DriverLicenseExpiry" alert is used
        /// (60 days by default - see <see cref="TSI.Nexus.Contracts.Models.AlertConfigKeys"/>).
        /// </summary>
        [HttpGet]
        [Route("GetExpiringLicenses")]
        public async Task<IActionResult> GetExpiringLicenses([FromQuery] int? daysAhead = null)
        {
            var effectiveDaysAhead =
                daysAhead
                ?? await _alertConfigService.GetThresholdDaysAsync(
                    AlertConfigKeys.DriverLicenseExpiry,
                    60
                );
            var webApiResponse = await _driverService.FindWithExpiringLicense(effectiveDaysAhead);
            return Ok(webApiResponse);
        }
    }
}
