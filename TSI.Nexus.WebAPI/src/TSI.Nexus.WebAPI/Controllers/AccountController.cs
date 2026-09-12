using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.WebAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AccountController : ControllerBase
    {
        private const string AuthCookieName = "nexus_auth";

        private readonly IUserManagerService _userManagerService;

        public AccountController(IUserManagerService userManagerService)
        {
            _userManagerService = userManagerService;
        }

        [Authorize]
        [HttpGet("refresh-user-token")]
        public async Task<ActionResult<UserDto>> RefreshUserToken()
        {
            var userName = User.FindFirst(ClaimTypes.Name)?.Value ?? string.Empty;
            var result = await _userManagerService.RefreshUserToken(userName);
            SetAuthCookieAndStripToken(result.Value);
            return result;
        }

        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        [HttpPost("login")]
        public async Task<ActionResult<UserDto>> Login(LoginDto model)
        {
            var result = await _userManagerService.Login(model);
            SetAuthCookieAndStripToken(result.Value);
            return result;
        }

        /// <summary>
        /// Clears the httpOnly auth cookie. The client-side session state is cleared
        /// unconditionally regardless of whether this succeeds, so this accepts anonymous calls
        /// and never fails - there's nothing sensitive in deleting a cookie the browser already
        /// owns, even with an expired or missing token.
        /// </summary>
        [AllowAnonymous]
        [HttpPost("logout")]
        public IActionResult Logout()
        {
            Response.Cookies.Delete(AuthCookieName);
            return Ok();
        }

        /// <summary>
        /// Updates the authenticated user's own theme/language preferences (profile dropdown or
        /// profile page). Always targets the caller's own account, never another user's.
        /// </summary>
        [Authorize]
        [HttpPut("preferences")]
        public async Task<IActionResult> UpdatePreferences(UpdatePreferencesDto model)
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? string.Empty;
            var webApiResponse = await _userManagerService.UpdatePreferences(userId, model);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Public self-registration. Unlike UsersController.Add (Admin/Master only), the caller
        /// here is anonymous, so any client-supplied Role is discarded - otherwise anyone could
        /// register their own account straight into the Master role.
        /// </summary>
        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        [HttpPost("register")]
        public async Task<ActionResult<WebApiResponse<User>>> Register(RegisterDto model)
        {
            model.Role = null;
            return await _userManagerService.Register(model);
        }

        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        [HttpPut("confirm-email")]
        public async Task<IActionResult> ConfirmEmail(ConfirmEmailDto model)
        {
            return await _userManagerService.ConfirmEmail(model);
        }

        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        [HttpPost("resend-email-confirmation/{email}")]
        public async Task<IActionResult> ResendEmailConfirmation(string email)
        {
            return await _userManagerService.ResendEmailConfirmation(email);
        }

        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        [HttpPost("forgot-username-or-password/{email}")]
        public async Task<IActionResult> ForgotUsernameOrPassword(string email)
        {
            return await _userManagerService.ForgotUsernameOrPassword(email);
        }

        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        [HttpPut("reset-password")]
        public async Task<IActionResult> ResetPassword(ResetPasswordDto model)
        {
            return await _userManagerService.ResetPassword(model);
        }

        /// <summary>
        /// Moves a freshly issued JWT out of the response body and into an httpOnly cookie, so a
        /// future XSS in the SPA has no JS-readable token to steal. The DTO keeps
        /// <see cref="UserDto.TokenExpiresAtUtc"/> so the client can still schedule its own
        /// renewal/auto-logout timer without ever holding the raw token.
        /// </summary>
        private void SetAuthCookieAndStripToken(UserDto? user)
        {
            if (string.IsNullOrEmpty(user?.JWT))
            {
                return;
            }

            Response.Cookies.Append(
                AuthCookieName,
                user.JWT,
                new CookieOptions
                {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.Strict,
                    Expires = user.TokenExpiresAtUtc.HasValue
                        ? new DateTimeOffset(user.TokenExpiresAtUtc.Value, TimeSpan.Zero)
                        : null,
                }
            );

            user.JWT = null;
        }
    }
}
