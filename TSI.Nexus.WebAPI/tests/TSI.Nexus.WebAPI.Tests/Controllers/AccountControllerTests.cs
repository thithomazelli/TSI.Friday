using System.Security.Claims;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;
using TSI.Nexus.WebAPI.Controllers;

namespace TSI.Nexus.WebAPI.Tests.Controllers
{
    public class AccountControllerTests
    {
        private readonly AccountController _controller;
        private readonly Mock<IUserManagerService> _userManagerServiceMock;
        private readonly Mock<IWebHostEnvironment> _envMock;

        public AccountControllerTests()
        {
            _userManagerServiceMock = new Mock<IUserManagerService>();
            _envMock = new Mock<IWebHostEnvironment>();
            _envMock.Setup(_ => _.EnvironmentName).Returns("Production");
            _controller = new AccountController(_userManagerServiceMock.Object, _envMock.Object);
        }

        private void SetUser(string name = null, string userId = null)
        {
            var claims = new List<Claim>();
            if (name != null)
                claims.Add(new Claim(ClaimTypes.Name, name));
            if (userId != null)
                claims.Add(new Claim(ClaimTypes.NameIdentifier, userId));

            var identity = new ClaimsIdentity(claims, "TestAuthType");
            var claimsPrincipal = new ClaimsPrincipal(identity);

            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = claimsPrincipal },
            };
        }

        // Login/RefreshUserToken only reach into Response.Cookies when the DTO actually carries a
        // JWT (see SetAuthCookieAndStripToken's early-out) - the tests above don't set a
        // ControllerContext at all, which is fine as long as that early-out holds. These two do
        // carry a JWT, so they need a real HttpContext for Response.Cookies.Append to write into.
        private void SetHttpContextWithoutUser()
        {
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext(),
            };
        }

        [Fact]
        public async Task AccountController_RefreshUserToken_ShouldReturnUserDto_WhenUserHasNameClaim()
        {
            // Arrange
            SetUser(name: "joao.silva");
            var expectedResult = new UserDto { Id = "1", UserName = "joao.silva" };

            _userManagerServiceMock
                .Setup(_ => _.RefreshUserToken("joao.silva"))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.RefreshUserToken();

            // Assert
            Assert.Equal(expectedResult, result.Value);
            _userManagerServiceMock.Verify(_ => _.RefreshUserToken("joao.silva"), Times.Once);
        }

        [Fact]
        public async Task AccountController_RefreshUserToken_ShouldUseEmptyUserName_WhenUserHasNoNameClaim()
        {
            // Arrange
            SetUser();
            var expectedResult = new UserDto { Id = "1" };

            _userManagerServiceMock
                .Setup(_ => _.RefreshUserToken(string.Empty))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.RefreshUserToken();

            // Assert
            Assert.Equal(expectedResult, result.Value);
            _userManagerServiceMock.Verify(_ => _.RefreshUserToken(string.Empty), Times.Once);
        }

        [Fact]
        public async Task AccountController_Login_ShouldReturnUserDto_WhenCredentialsAreValid()
        {
            // Arrange
            var loginDto = new LoginDto { UserName = "joao.silva", Password = "123456" };
            var expectedResult = new UserDto { Id = "1", UserName = "joao.silva" };

            _userManagerServiceMock.Setup(_ => _.Login(loginDto)).ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.Login(loginDto);

            // Assert
            Assert.Equal(expectedResult, result.Value);
            _userManagerServiceMock.Verify(_ => _.Login(loginDto), Times.Once);
        }

        [Fact]
        public async Task AccountController_Login_ShouldMoveJwtIntoHttpOnlyCookie_AndStripItFromBody()
        {
            // Arrange
            SetHttpContextWithoutUser();
            var loginDto = new LoginDto { UserName = "joao.silva", Password = "123456" };
            var expiresAt = DateTime.UtcNow.AddMinutes(15);
            var expectedResult = new UserDto
            {
                Id = "1",
                UserName = "joao.silva",
                JWT = "raw-jwt-value",
                TokenExpiresAtUtc = expiresAt,
            };
            _userManagerServiceMock.Setup(_ => _.Login(loginDto)).ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.Login(loginDto);

            // Assert - the client never sees the raw token in the response body...
            Assert.Null(result.Value!.JWT);
            // ...it only travels in the httpOnly Set-Cookie header instead.
            var setCookie = _controller.Response.Headers.SetCookie.ToString();
            Assert.Contains("nexus_auth=raw-jwt-value", setCookie);
            Assert.Contains("httponly", setCookie, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("samesite=strict", setCookie, StringComparison.OrdinalIgnoreCase);
            // Secure in Production (the fixture's default environment) - see the Development test
            // below for why this flips off there.
            Assert.Contains("secure", setCookie, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task AccountController_Login_ShouldNotSetSecureCookie_WhenEnvironmentIsDevelopment()
        {
            // Arrange - ng serve's dev proxy (proxy.conf.json) makes the SPA and this API look
            // same-origin over plain http locally; a Secure cookie would never be stored by the
            // browser over that connection, so Development relaxes it - Production/Homolog never do.
            _envMock.Setup(_ => _.EnvironmentName).Returns("Development");
            SetHttpContextWithoutUser();
            var loginDto = new LoginDto { UserName = "joao.silva", Password = "123456" };
            var expectedResult = new UserDto
            {
                Id = "1",
                UserName = "joao.silva",
                JWT = "raw-jwt-value",
                TokenExpiresAtUtc = DateTime.UtcNow.AddMinutes(15),
            };
            _userManagerServiceMock.Setup(_ => _.Login(loginDto)).ReturnsAsync(expectedResult);

            // Act
            await _controller.Login(loginDto);

            // Assert
            var setCookie = _controller.Response.Headers.SetCookie.ToString();
            Assert.DoesNotContain("secure", setCookie, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("httponly", setCookie, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task AccountController_Login_ShouldNotTouchCookies_WhenServiceReturnsNoJwt()
        {
            // Arrange - e.g. an Unauthorized() result from the service still deserializes to a
            // UserDto-shaped ActionResult with a null Value, or a DTO with no JWT set; either way
            // there must be nothing to cookie-ify, and this must not touch Response at all (no
            // ControllerContext is set up here, so touching Response would throw).
            var loginDto = new LoginDto { UserName = "joao.silva", Password = "wrong" };
            var expectedResult = new UserDto { Id = "1", UserName = "joao.silva" };
            _userManagerServiceMock.Setup(_ => _.Login(loginDto)).ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.Login(loginDto);

            // Assert
            Assert.Equal(expectedResult, result.Value);
        }

        [Fact]
        public async Task AccountController_RefreshUserToken_ShouldMoveJwtIntoHttpOnlyCookie_AndStripItFromBody()
        {
            // Arrange
            SetUser(name: "joao.silva");
            var expiresAt = DateTime.UtcNow.AddMinutes(15);
            var expectedResult = new UserDto
            {
                Id = "1",
                UserName = "joao.silva",
                JWT = "renewed-jwt-value",
                TokenExpiresAtUtc = expiresAt,
            };
            _userManagerServiceMock
                .Setup(_ => _.RefreshUserToken("joao.silva"))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.RefreshUserToken();

            // Assert
            Assert.Null(result.Value!.JWT);
            var setCookie = _controller.Response.Headers.SetCookie.ToString();
            Assert.Contains("nexus_auth=renewed-jwt-value", setCookie);
        }

        [Fact]
        public void AccountController_Logout_ShouldExpireAuthCookie()
        {
            // Arrange
            SetHttpContextWithoutUser();

            // Act
            var result = _controller.Logout();

            // Assert
            Assert.IsType<OkResult>(result);
            var setCookie = _controller.Response.Headers.SetCookie.ToString();
            Assert.Contains("nexus_auth=", setCookie);
            // Cookies.Delete() re-appends the cookie with an already-past expiration, which is how
            // ASP.NET Core actually clears an httpOnly cookie client-side can't touch directly.
            Assert.Contains("expires=", setCookie, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task AccountController_UpdatePreferences_ShouldReturnOkWithResponse_WhenUserHasNameIdentifierClaim()
        {
            // Arrange
            SetUser(userId: "1");
            var model = new UpdatePreferencesDto { Theme = "dark", Language = "pt-BR" };
            var expectedResult = new WebApiResponse<UserDto>
            {
                Data = new UserDto { Id = "1", Theme = "dark", Language = "pt-BR" },
                Status = ResponseStatus.Success,
                Message = "Preferências atualizadas com sucesso.",
            };

            _userManagerServiceMock
                .Setup(_ => _.UpdatePreferences("1", model))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.UpdatePreferences(model);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<UserDto>>(okResult.Value);
            Assert.Equal(ResponseStatus.Success, response.Status);

            _userManagerServiceMock.Verify(_ => _.UpdatePreferences("1", model), Times.Once);
        }

        [Fact]
        public async Task AccountController_UpdatePreferences_ShouldUseEmptyUserId_WhenUserHasNoNameIdentifierClaim()
        {
            // Arrange
            SetUser();
            var model = new UpdatePreferencesDto { Theme = "light" };
            var expectedResult = new WebApiResponse<UserDto>
            {
                Data = null,
                Status = ResponseStatus.Error,
                Message = "Usuário não encontrado",
            };

            _userManagerServiceMock
                .Setup(_ => _.UpdatePreferences(string.Empty, model))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.UpdatePreferences(model);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<UserDto>>(okResult.Value);
            Assert.Equal(ResponseStatus.Error, response.Status);

            _userManagerServiceMock.Verify(
                _ => _.UpdatePreferences(string.Empty, model),
                Times.Once
            );
        }

        [Fact]
        public async Task AccountController_Register_ShouldReturnWebApiResponse_WhenCalled()
        {
            // Arrange
            var model = new RegisterDto
            {
                FirstName = "Joao",
                LastName = "Silva",
                Email = "joao@tsi.com.br",
                Password = "123456",
            };
            var expectedResult = new WebApiResponse<User>
            {
                Data = new User { Id = "1" },
                Status = ResponseStatus.Success,
                Message = "Usuário cadastrado com sucesso.",
            };

            _userManagerServiceMock.Setup(_ => _.Register(model)).ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.Register(model);

            // Assert
            Assert.Equal(expectedResult, result.Value);
            _userManagerServiceMock.Verify(_ => _.Register(model), Times.Once);
        }

        [Fact]
        public async Task AccountController_Register_ShouldStripRole_WhenCallerSuppliesOne()
        {
            // Arrange - a public/anonymous self-registration can never choose its own role; only
            // UsersController.Add (Admin/Master-gated) may set Role on a new user.
            var model = new RegisterDto
            {
                FirstName = "Joao",
                LastName = "Silva",
                Email = "joao@tsi.com.br",
                Password = "123456",
                Role = "Master",
            };
            var expectedResult = new WebApiResponse<User>
            {
                Data = new User { Id = "1" },
                Status = ResponseStatus.Success,
            };
            _userManagerServiceMock
                .Setup(_ => _.Register(It.Is<RegisterDto>(m => m.Role == null)))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.Register(model);

            // Assert
            Assert.Null(model.Role);
            _userManagerServiceMock.Verify(
                _ => _.Register(It.Is<RegisterDto>(m => m.Role == null)),
                Times.Once
            );
        }

        [Fact]
        public async Task AccountController_ConfirmEmail_ShouldReturnActionResultFromService_WhenCalled()
        {
            // Arrange
            var model = new ConfirmEmailDto { Token = "token", Email = "joao@tsi.com.br" };
            _userManagerServiceMock.Setup(_ => _.ConfirmEmail(model)).ReturnsAsync(new OkResult());

            // Act
            var result = await _controller.ConfirmEmail(model);

            // Assert
            Assert.IsType<OkResult>(result);
            _userManagerServiceMock.Verify(_ => _.ConfirmEmail(model), Times.Once);
        }

        [Fact]
        public async Task AccountController_ResendEmailConfirmation_ShouldReturnActionResultFromService_WhenCalled()
        {
            // Arrange
            const string email = "joao@tsi.com.br";
            _userManagerServiceMock
                .Setup(_ => _.ResendEmailConfirmation(email))
                .ReturnsAsync(new OkResult());

            // Act
            var result = await _controller.ResendEmailConfirmation(email);

            // Assert
            Assert.IsType<OkResult>(result);
            _userManagerServiceMock.Verify(_ => _.ResendEmailConfirmation(email), Times.Once);
        }

        [Fact]
        public async Task AccountController_ForgotUsernameOrPassword_ShouldReturnActionResultFromService_WhenCalled()
        {
            // Arrange
            const string email = "joao@tsi.com.br";
            _userManagerServiceMock
                .Setup(_ => _.ForgotUsernameOrPassword(email))
                .ReturnsAsync(new OkResult());

            // Act
            var result = await _controller.ForgotUsernameOrPassword(email);

            // Assert
            Assert.IsType<OkResult>(result);
            _userManagerServiceMock.Verify(_ => _.ForgotUsernameOrPassword(email), Times.Once);
        }

        [Fact]
        public async Task AccountController_ResetPassword_ShouldReturnActionResultFromService_WhenCalled()
        {
            // Arrange
            var model = new ResetPasswordDto
            {
                Email = "joao@tsi.com.br",
                NewPassword = "654321",
            };
            _userManagerServiceMock
                .Setup(_ => _.ResetPassword(model))
                .ReturnsAsync(new OkResult());

            // Act
            var result = await _controller.ResetPassword(model);

            // Assert
            Assert.IsType<OkResult>(result);
            _userManagerServiceMock.Verify(_ => _.ResetPassword(model), Times.Once);
        }
    }
}
