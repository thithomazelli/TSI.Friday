using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.WebAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        private readonly IUserManagerService _userManagerService;
        private readonly ICurrentUserService _currentUserService;

        public UsersController(
            IUserManagerService userManagerService,
            ICurrentUserService currentUserService
        )
        {
            _userManagerService = userManagerService;
            _currentUserService = currentUserService;
        }

        private bool CallerIsAdminOrMaster() =>
            _currentUserService.IsInRole("Admin") || _currentUserService.IsInRole("Master");

        /// <summary>
        /// Add a new user. Only Master may create another Master account - an Admin creating a
        /// user with Role "Master" would otherwise be able to grant themselves (via a second
        /// account) the one privilege level above their own.
        /// </summary>
        /// <param name="model">Registration data for the new user</param>
        [HttpPost("add")]
        [Authorize(Roles = "Admin,Master")]
        public async Task<ActionResult<WebApiResponse<User>>> Add(RegisterDto model)
        {
            if (
                !_currentUserService.IsInRole("Master")
                && string.Equals(model.Role, "Master", System.StringComparison.OrdinalIgnoreCase)
            )
            {
                return Forbid();
            }

            return await _userManagerService.Register(model);
        }

        /// <summary>
        /// Update user available on database. A caller may always update their own profile; only
        /// Admin/Master may update someone else's, and only Admin/Master may change a Role -
        /// a non-privileged caller editing their own profile has any Role in the payload ignored.
        /// Only Master may grant the Master role itself - an Admin attempting to set Role to
        /// "Master" (on themselves or anyone else) is forbidden.
        /// </summary>
        /// <param name="user">Object to be updated</param>
        /// <returns></returns>
        [HttpPut]
        [Route("Update")]
        [Authorize]
        public async Task<IActionResult> Update([FromBody] User user)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            if (!CallerIsAdminOrMaster())
            {
                if (user.Id != _currentUserService.GetUserId())
                {
                    return Forbid();
                }

                user.Role = null;
            }
            else if (
                !_currentUserService.IsInRole("Master")
                && string.Equals(user.Role, "Master", System.StringComparison.OrdinalIgnoreCase)
            )
            {
                return Forbid();
            }

            var webApiResponse = await _userManagerService.Update(user);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Remove user when it is identified on database
        /// </summary>
        /// <param name="user">Object to be removed</param>
        /// <returns></returns>
        [HttpDelete]
        [Route("Remove")]
        [Authorize(Roles = "Admin,Master")]
        public async Task<IActionResult> Remove([FromBody] User user)
        {
            var webApiResponse = await _userManagerService.Remove(user);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get all users available on database
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        [Route("GetAll")]
        [Authorize(Roles = "Admin,Master")]
        public async Task<IActionResult> GetAll()
        {
            var webApiResponse = await _userManagerService.FindAll();
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get user by id. A caller may always fetch their own profile; only Admin/Master may
        /// fetch someone else's.
        /// </summary>
        /// <param name="userId">User id to be used in the search</param>
        /// <returns></returns>
        [HttpGet]
        [Route("GetById/{userId}")]
        [Authorize]
        public async Task<IActionResult> GetById(string userId)
        {
            if (!CallerIsAdminOrMaster() && userId != _currentUserService.GetUserId())
            {
                return Forbid();
            }

            var webApiResponse = await _userManagerService.FindById(userId);
            return Ok(webApiResponse);
        }
    }
}
