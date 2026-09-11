using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Contracts.Interfaces
{
    public interface IVehicleService
    {
        /// <summary>
        /// Add a new Vehicle based on the object received.
        /// </summary>
        /// <param name="vehicle">The vehicle object defined.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<Vehicle>> Add(Vehicle vehicle);

        /// <summary>
        /// Update a Vehicle based on the object received.
        /// </summary>
        /// <param name="vehicle">The vehicle object updated.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<Vehicle>> Update(Vehicle vehicle);

        /// <summary>
        /// Remove a Vehicle based on the object received.
        /// </summary>
        /// <param name="vehicle">The vehicle object to be removed.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<Vehicle>> Remove(Vehicle vehicle);

        /// <summary>
        /// Method responsible to get all registers available on the Vehicle database.
        /// </summary>
        /// <returns>All registers found on the Vehicle database.</returns>
        Task<WebApiResponse<IEnumerable<Vehicle>>> FindAll();

        /// <summary>
        /// Server-side paged/sorted/filtered listing for the Vehicles grid (ag-Grid Infinite Row
        /// Model) - unlike FindAll(), used only by the main listing screen.
        /// </summary>
        /// <param name="request">The requested page, sort and quick-filter text.</param>
        Task<WebApiResponse<PagedResult<Vehicle>>> FindAllPaged(PagedRequest request);

        /// <summary>
        /// Method responsible to get only one Vehicle based on the ID received as parameter.
        /// </summary>
        /// <param name="id">The ID to be used on the search.</param>
        /// <returns>One Vehicle object according to the ID defined as parameter.</returns>
        Task<WebApiResponse<Vehicle>> FindById(Guid? id);

        /// <summary>
        /// Should find a Vehicle based on the Plate received as parameter.
        /// </summary>
        /// <param name="plate">The Plate to be used on the search.</param>
        /// <returns>One Vehicle object according to the Plate defined as parameter.</returns>
        Task<WebApiResponse<Vehicle>> FindByPlate(string plate);

        /// <summary>
        /// Method responsible to get all Vehicles that are currently available (not blocked/in maintenance/inactive).
        /// </summary>
        /// <returns>All available Vehicles.</returns>
        Task<WebApiResponse<IEnumerable<Vehicle>>> FindAvailable();
    }
}
