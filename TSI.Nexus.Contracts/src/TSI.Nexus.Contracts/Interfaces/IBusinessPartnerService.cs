using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Contracts.Interfaces
{
    public interface IBusinessPartnerService
    {
        /// <summary>
        /// Remove a BusinessPartner based on the object received.
        /// </summary>
        /// <param name="businessPartnerDto">The businessPartner DTO object to be removed.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<BusinessPartnerDto>> Remove(BusinessPartnerDto businessPartnerDto);

        /// <summary>
        /// Method responsible to get all registers available on the businessPartner database based on the type informed.
        /// </summary>
        /// <returns>All registers found on the businessPartner database.</returns>
        Task<WebApiResponse<IEnumerable<BusinessPartnerDto>>> FindAllByType(
            BusinessPartnerType businessPartnerType
        );

        /// <summary>
        /// Server-side paged/sorted/filtered listing for the Clients/Suppliers grid.
        /// </summary>
        /// <param name="businessPartnerType">Whether to list Clients or Suppliers.</param>
        /// <param name="request">The requested page, sort and quick-filter text.</param>
        Task<WebApiResponse<PagedResult<BusinessPartnerDto>>> FindAllByTypePaged(
            BusinessPartnerType businessPartnerType,
            PagedRequest request
        );

        /// <summary>
        /// Method responsible to get only one BusinessPartner based on the ID received as parameter.
        /// </summary>
        /// <param name="id">The ID to be used on the search.</param>
        /// <returns>One BusinessPartner object according to the ID defined as parameter.</returns>
        Task<WebApiResponse<BusinessPartnerDto>> FindById(Guid? id);

        /// <summary>
        /// Should find a list of people based on the email received as parameter.
        /// </summary>
        /// <param name="email">The Email to be used on the search.</param>
        /// <returns>A list of people that has the Email equal to the one that was received as parameter.</returns>
        Task<WebApiResponse<BusinessPartnerDto>> FindByEmail(string email);
    }
}
