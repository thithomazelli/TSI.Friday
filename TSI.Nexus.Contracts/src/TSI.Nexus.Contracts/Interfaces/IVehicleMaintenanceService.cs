using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Contracts.Interfaces
{
    public interface IVehicleMaintenanceService
    {
        /// <summary>
        /// Add a new VehicleMaintenance based on the object received. When the maintenance is added
        /// with a Scheduled/InProgress status the related Vehicle is automatically moved to
        /// InMaintenance so it cannot be assigned to a trip while service is pending.
        /// </summary>
        /// <param name="maintenance">The maintenance object defined.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<VehicleMaintenance>> Add(VehicleMaintenance maintenance);

        /// <summary>
        /// Update a VehicleMaintenance based on the object received. Completing or cancelling a
        /// maintenance automatically releases the related Vehicle back to Available when it has
        /// no other pending (InProgress/Overdue) maintenance.
        /// </summary>
        /// <param name="maintenance">The maintenance object updated.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<VehicleMaintenance>> Update(VehicleMaintenance maintenance);

        /// <summary>
        /// Remove a VehicleMaintenance based on the object received.
        /// </summary>
        /// <param name="maintenance">The maintenance object to be removed.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<VehicleMaintenance>> Remove(VehicleMaintenance maintenance);

        /// <summary>
        /// Method responsible to get all registers available on the VehicleMaintenance database.
        /// </summary>
        /// <returns>All registers found on the VehicleMaintenance database.</returns>
        Task<WebApiResponse<IEnumerable<VehicleMaintenance>>> FindAll();

        /// <summary>
        /// Server-side paged/sorted/filtered listing for the Vehicle Maintenances grid.
        /// </summary>
        /// <param name="request">The requested page, sort and quick-filter text.</param>
        Task<WebApiResponse<PagedResult<VehicleMaintenance>>> FindAllPaged(PagedRequest request);

        /// <summary>
        /// Method responsible to get only one VehicleMaintenance based on the ID received as parameter.
        /// </summary>
        /// <param name="id">The ID to be used on the search.</param>
        /// <returns>One VehicleMaintenance object according to the ID defined as parameter.</returns>
        Task<WebApiResponse<VehicleMaintenance>> FindById(Guid? id);

        /// <summary>
        /// Method responsible to get all maintenance records for a given Vehicle.
        /// </summary>
        /// <param name="vehicleId">The Vehicle ID to be used on the search.</param>
        /// <returns>All maintenance records found for the Vehicle.</returns>
        Task<WebApiResponse<IEnumerable<VehicleMaintenance>>> FindByVehicle(Guid vehicleId);
    }
}
