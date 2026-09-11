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
    public class VehicleMaintenancesController : Controller
    {
        private readonly IVehicleMaintenanceService _vehicleMaintenanceService;

        public VehicleMaintenancesController(IVehicleMaintenanceService vehicleMaintenanceService)
        {
            _vehicleMaintenanceService = vehicleMaintenanceService;
        }

        /// <summary>
        /// Add vehicle maintenance on database
        /// </summary>
        /// <param name="maintenance">Object to be added</param>
        /// <returns></returns>
        [HttpPost]
        [Route("Add")]
        public async Task<IActionResult> Add(VehicleMaintenance maintenance)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _vehicleMaintenanceService.Add(maintenance);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Update vehicle maintenance available on database
        /// </summary>
        /// <param name="maintenance">Object to be updated</param>
        /// <returns></returns>
        [HttpPut]
        [Route("Update")]
        public async Task<IActionResult> Update([FromBody] VehicleMaintenance maintenance)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _vehicleMaintenanceService.Update(maintenance);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Remove vehicle maintenance when it is identified on database
        /// </summary>
        /// <param name="maintenance">Object to be removed</param>
        /// <returns></returns>
        [HttpDelete]
        [Route("Remove")]
        public async Task<IActionResult> Remove([FromBody] VehicleMaintenance maintenance)
        {
            var webApiResponse = await _vehicleMaintenanceService.Remove(maintenance);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get all vehicle maintenances available on database
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        [Route("GetAll")]
        public async Task<IActionResult> GetAll()
        {
            var webApiResponse = await _vehicleMaintenanceService.FindAll();
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Server-side paged/sorted/filtered listing for the Vehicle Maintenances grid.
        /// </summary>
        /// <param name="request">The requested page, sort and quick-filter text.</param>
        [HttpGet]
        [Route("GetAllPaged")]
        public async Task<IActionResult> GetAllPaged([FromQuery] PagedRequest request)
        {
            var webApiResponse = await _vehicleMaintenanceService.FindAllPaged(request);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get vehicle maintenance by id
        /// </summary>
        /// <param name="maintenanceId">Maintenance id to be used in the search</param>
        /// <returns></returns>
        [HttpGet]
        [Route("GetById/{maintenanceId}")]
        public async Task<IActionResult> GetById(Guid? maintenanceId)
        {
            var webApiResponse = await _vehicleMaintenanceService.FindById(maintenanceId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get all maintenance records for a given vehicle
        /// </summary>
        /// <param name="vehicleId">Vehicle id to be used in the search</param>
        /// <returns></returns>
        [HttpGet]
        [Route("GetByVehicle/{vehicleId}")]
        public async Task<IActionResult> GetByVehicle(Guid vehicleId)
        {
            var webApiResponse = await _vehicleMaintenanceService.FindByVehicle(vehicleId);
            return Ok(webApiResponse);
        }
    }
}
