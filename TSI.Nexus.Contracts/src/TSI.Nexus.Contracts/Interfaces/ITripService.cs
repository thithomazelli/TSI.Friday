using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Contracts.Interfaces
{
    public interface ITripService
    {
        /// <summary>
        /// Add a new Trip based on the object received.
        /// </summary>
        /// <param name="tripDto">The trip DTO object defined.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<TripDto>> Add(TripDto tripDto);

        /// <summary>
        /// Update a Trip based on the object received.
        /// </summary>
        /// <param name="tripDto">The trip DTO object updated.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<TripDto>> Update(TripDto tripDto);

        /// <summary>
        /// Remove a Trip based on the object received.
        /// </summary>
        /// <param name="tripDto">The trip DTO object to be removed.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<TripDto>> Remove(TripDto tripDto);

        /// <summary>
        /// Method responsible to get all registers available on The trip database.
        /// </summary>
        /// <returns>All registers found on The trip database.</returns>
        Task<WebApiResponse<IEnumerable<TripDto>>> FindAll();

        /// <summary>
        /// Method responsible to return one page of Trips (ag-Grid Infinite Row Model), for the
        /// main Trips listing screen - which otherwise would load the entire table on every visit.
        /// </summary>
        /// <param name="request">The requested page, sort and quick-filter text.</param>
        /// <returns>One page of Trips plus the total row count.</returns>
        Task<WebApiResponse<PagedResult<TripDto>>> FindAllPaged(PagedRequest request);

        /// <summary>
        /// Method responsible to get only one Trip based on the ID received as parameter.
        /// </summary>
        /// <param name="id">The ID to be used on the search.</param>
        /// <returns>One Trip object according to the ID defined as parameter.</returns>
        Task<WebApiResponse<TripDto>> FindById(Guid? id);

        /// <summary>
        /// Should find a Trip that based on the TripNumber received as parameter.
        /// </summary>
        /// <param name="tripNumber">The TripNumber to be used on the search.</param>
        /// <returns>One Trip object according to the TripNumber defined as parameter.</returns>
        Task<WebApiResponse<TripDto>> FindByTripNumber(string tripNumber);

        /// <summary>
        /// Method responsible to get a list of Trips based on the BusinessPartnerID received as parameter.
        /// </summary>
        /// <param name="businessPartnerId">The ID to be used on the search.</param>
        /// <returns>List of trip according to the BusinessPartnerID defined as parameter.</returns>
        Task<WebApiResponse<IEnumerable<TripDto>>> FindByBusinessPartnerId(
            Guid? businessPartnerId
        );

        /// <summary>
        /// Method responsible to get a list of Trips based on the DriverID received as parameter.
        /// </summary>
        /// <param name="driverId">The ID to be used on the search.</param>
        /// <returns>List of trip according to the DriverID defined as parameter.</returns>
        Task<WebApiResponse<IEnumerable<TripDto>>> FindByDriverId(Guid? driverId);

        /// <summary>
        /// Method responsible to get a list of Trips based on the VehicleID received as parameter.
        /// </summary>
        /// <param name="vehicleId">The ID to be used on the search.</param>
        /// <returns>List of trip according to the VehicleID defined as parameter.</returns>
        Task<WebApiResponse<IEnumerable<TripDto>>> FindByVehicleId(Guid? vehicleId);
    }
}
