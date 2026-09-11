using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Contracts.Interfaces
{
    /// <summary>
    /// Defines the contract for user management services, including login, registration, and account recovery.
    /// </summary>
    public interface IUserManagerService
    {
        /// <summary>
        /// Authenticates a user and generates a token for accessing the system.
        /// </summary>
        /// <param name="model">The login details, including username and password.</param>
        /// <returns>
        /// An <see cref="ActionResult{T}"/> containing the authenticated user's details and token if successful.
        /// </returns>
        Task<ActionResult<UserDto>> Login(LoginDto model);

        /// <summary>
        /// Registers a new user in the system.
        /// </summary>
        /// <param name="model">The registration details, including username, email, and password.</param>
        /// <returns>
        /// An <see cref="IActionResult"/> indicating the result of the registration process.
        /// </returns>
        Task<ActionResult<WebApiResponse<User>>> Register(RegisterDto model);

        /// <summary>
        /// Refreshes the authentication token for a user.
        /// </summary>
        /// <param name="userName">The username of the user requesting a token refresh.</param>
        /// <returns>
        /// An <see cref="ActionResult{T}"/> containing the refreshed token and user details.
        /// </returns>
        Task<ActionResult<UserDto>> RefreshUserToken(string userName);

        /// <summary>
        /// Confirms a user's email address using a confirmation token.
        /// </summary>
        /// <param name="model">The email confirmation details, including user ID and token.</param>
        /// <returns>
        /// An <see cref="IActionResult"/> indicating the result of the email confirmation process.
        /// </returns>
        Task<IActionResult> ConfirmEmail(ConfirmEmailDto model);

        /// <summary>
        /// Resends the email confirmation link to the specified email address.
        /// </summary>
        /// <param name="email">The email address to which the confirmation link will be sent.</param>
        /// <returns>
        /// An <see cref="IActionResult"/> indicating the result of the resend operation.
        /// </returns>
        Task<IActionResult> ResendEmailConfirmation(string email);

        /// <summary>
        /// Initiates the process to recover a forgotten username or reset a password.
        /// </summary>
        /// <param name="email">The email address associated with the user's account.</param>
        /// <returns>
        /// An <see cref="IActionResult"/> indicating the result of the recovery process.
        /// </returns>
        Task<IActionResult> ForgotUsernameOrPassword(string email);

        /// <summary>
        ///
        /// </summary>
        /// <param name="model"></param>
        /// <returns></returns>
        Task<IActionResult> ResetPassword(ResetPasswordDto model);

        /// <summary>
        /// Update an User based on the object received.
        /// </summary>
        /// <param name="user">The user object updated.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<UserDto>> Update(User user);

        /// <summary>
        /// Updates the authenticated user's own theme/language preferences.
        /// </summary>
        /// <param name="userId">Id of the authenticated user, resolved from the JWT claim.</param>
        /// <param name="model">The new theme/language values.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<UserDto>> UpdatePreferences(string userId, UpdatePreferencesDto model);

        /// <summary>
        /// Remove an User based on the object received.
        /// </summary>
        /// <param name="user">The user object to be removed.</param>
        /// <returns>Return an WebApiReponse with the results for this operation.</returns>
        Task<WebApiResponse<UserDto>> Remove(User user);

        /// <summary>
        /// Method responsible to get all registers available in the Users database.
        /// </summary>
        /// <returns>All registers found in the Users database.</returns>
        Task<WebApiResponse<IEnumerable<UserDto>>> FindAll();

        /// <summary>
        /// Server-side paged/sorted/filtered listing for the Users grid.
        /// </summary>
        /// <param name="request">The requested page, sort and quick-filter text.</param>
        /// <returns>A single page of Users matching the request.</returns>
        Task<WebApiResponse<PagedResult<UserDto>>> FindAllPaged(PagedRequest request);

        /// <summary>
        /// Method responsible to get only one User based in the ID received as parameter.
        /// </summary>
        /// <param name="id">The ID to be used on the search.</param>
        /// <returns>One User object according to the ID defined as parameter.</returns>
        Task<WebApiResponse<UserDto>> FindById(string id);
    }
}
