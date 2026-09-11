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
    public class VehiclesController : Controller
    {
        /// <summary>
        /// VehicleService object created to access the service model.
        /// </summary>
        private readonly IVehicleService _vehicleService;

        /// <summary>
        /// VehiclesController constructor create to initialize the "_vehicleService" using Dependency Injection.
        /// </summary>
        /// <param name="vehicleService">IVehicleService object used to initialize the internal variable using Dependency Injection.</param>
        public VehiclesController(IVehicleService vehicleService)
        {
            _vehicleService = vehicleService;
        }

        /// <summary>
        /// Add vehicle on database
        /// </summary>
        /// <param name="vehicle">Object to be added</param>
        /// <returns></returns>
        [HttpPost]
        [Route("Add")]
        public async Task<IActionResult> Add(Vehicle vehicle)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _vehicleService.Add(vehicle);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Update vehicle available on database
        /// </summary>
        /// <param name="vehicle">Object to be updated</param>
        /// <returns></returns>
        [HttpPut]
        [Route("Update")]
        public async Task<IActionResult> Update([FromBody] Vehicle vehicle)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _vehicleService.Update(vehicle);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Remove vehicle when it is identified on database
        /// </summary>
        /// <param name="vehicle">Object to be removed</param>
        /// <returns></returns>
        [HttpDelete]
        [Route("Remove")]
        public async Task<IActionResult> Remove([FromBody] Vehicle vehicle)
        {
            var webApiResponse = await _vehicleService.Remove(vehicle);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get all vehicles available on database
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        [Route("GetAll")]
        public async Task<IActionResult> GetAll()
        {
            var webApiResponse = await _vehicleService.FindAll();
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Server-side paged/sorted/filtered listing for the Vehicles grid.
        /// </summary>
        /// <param name="request">The requested page, sort and quick-filter text.</param>
        [HttpGet]
        [Route("GetAllPaged")]
        public async Task<IActionResult> GetAllPaged([FromQuery] PagedRequest request)
        {
            var webApiResponse = await _vehicleService.FindAllPaged(request);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get vehicle by id
        /// </summary>
        /// <param name="vehicleId">Vehicle id to be used in the search</param>
        /// <returns></returns>
        [HttpGet]
        [Route("GetById/{vehicleId}")]
        public async Task<IActionResult> GetById(Guid? vehicleId)
        {
            var webApiResponse = await _vehicleService.FindById(vehicleId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get vehicle by plate
        /// </summary>
        /// <param name="plate">Plate to be used in the search</param>
        /// <returns></returns>
        [HttpGet]
        [Route("GetByPlate/{plate}")]
        public async Task<IActionResult> GetByPlate(string plate)
        {
            var webApiResponse = await _vehicleService.FindByPlate(plate);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get only vehicles currently available to be assigned to a trip
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        [Route("GetAvailable")]
        public async Task<IActionResult> GetAvailable()
        {
            var webApiResponse = await _vehicleService.FindAvailable();
            return Ok(webApiResponse);
        }
    }
}
