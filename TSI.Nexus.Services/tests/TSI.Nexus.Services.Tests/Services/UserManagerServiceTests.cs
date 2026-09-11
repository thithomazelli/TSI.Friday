using System.Linq.Expressions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;
using TSI.Nexus.Services.Tests.Services.Helpers;

namespace TSI.Nexus.Services.Tests.Services
{
    public class UserManagerServiceTests
    {
        private readonly Mock<IJwtService> _jwtService;
        private readonly Mock<UserManager<User>> _userManager;
        private readonly Mock<RoleManager<IdentityRole>> _roleManager;
        private readonly Mock<SignInManager<User>> _signInManager;
        private readonly Mock<IEmailService> _emailService;
        private readonly Mock<IConfiguration> _configuration;
        private readonly Mock<IRepository<User>> _repository;
        private readonly Mock<ILogService> _logService;
        private readonly UserManagerService _service;

        public UserManagerServiceTests()
        {
            var store = new Mock<IUserStore<User>>();
            _userManager = new Mock<UserManager<User>>(
                store.Object,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
            );

            var contextAccessor = new Mock<IHttpContextAccessor>();
            var claimsFactory = new Mock<IUserClaimsPrincipalFactory<User>>();
            var identityOptions = Options.Create(new IdentityOptions());
            var signInLogger = new Mock<ILogger<SignInManager<User>>>();
            var schemes = new Mock<IAuthenticationSchemeProvider>();
            var confirmation = new Mock<IUserConfirmation<User>>();
            _signInManager = new Mock<SignInManager<User>>(
                _userManager.Object,
                contextAccessor.Object,
                claimsFactory.Object,
                identityOptions,
                signInLogger.Object,
                schemes.Object,
                confirmation.Object
            );

            _jwtService = new Mock<IJwtService>();
            _jwtService.Setup(_ => _.CreateJWT(It.IsAny<User>(), It.IsAny<IEnumerable<string>>())).Returns("jwt-token");
            _emailService = new Mock<IEmailService>();
            _emailService.Setup(_ => _.SendEmailAsync(It.IsAny<EmailSendDto>())).ReturnsAsync(true);
            _configuration = new Mock<IConfiguration>();
            _repository = new Mock<IRepository<User>>();
            _logService = new Mock<ILogService>();

            _userManager.Setup(_ => _.GetRolesAsync(It.IsAny<User>())).ReturnsAsync(new List<string> { "User" });

            var roleStore = new Mock<IRoleStore<IdentityRole>>();
            _roleManager = new Mock<RoleManager<IdentityRole>>(roleStore.Object, null, null, null, null);
            _roleManager.Setup(_ => _.Roles).Returns(new List<IdentityRole>().AsQueryable());

            _service = new UserManagerService(
                _jwtService.Object,
                _signInManager.Object,
                _userManager.Object,
                _roleManager.Object,
                _emailService.Object,
                _configuration.Object,
                _repository.Object,
                _logService.Object
            );
        }

        #region Login

        [Fact]
        public async Task Login_ShouldReturnUserDtoWithJwt_WhenCredentialsAreValid()
        {
            // Arrange
            var user = new User { UserName = "user1", Email = "user1@test.com", EmailConfirmed = true };
            _userManager.Setup(_ => _.FindByNameAsync("user1")).ReturnsAsync(user);
            _signInManager
                .Setup(_ => _.CheckPasswordSignInAsync(user, "pass", true))
                .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.Success);

            // Act
            var result = await _service.Login(new LoginDto { UserName = "user1", Password = "pass" });

            // Assert
            Assert.Equal("jwt-token", result.Value!.JWT);
        }

        [Fact]
        public async Task Login_ShouldReturnUnauthorized_WhenUserIsNotFound()
        {
            // Arrange
            _userManager.Setup(_ => _.FindByNameAsync("missing")).ReturnsAsync((User)null!);

            // Act
            var result = await _service.Login(new LoginDto { UserName = "missing", Password = "pass" });

            // Assert
            Assert.IsType<UnauthorizedObjectResult>(result.Result);
        }

        [Fact]
        public async Task Login_ShouldReturnUnauthorized_WhenEmailIsNotConfirmed()
        {
            // Arrange
            var user = new User { UserName = "user1", EmailConfirmed = false };
            _userManager.Setup(_ => _.FindByNameAsync("user1")).ReturnsAsync(user);

            // Act
            var result = await _service.Login(new LoginDto { UserName = "user1", Password = "pass" });

            // Assert
            Assert.IsType<UnauthorizedObjectResult>(result.Result);
        }

        [Fact]
        public async Task Login_ShouldReturnUnauthorized_WhenPasswordIsInvalid()
        {
            // Arrange
            var user = new User { UserName = "user1", EmailConfirmed = true };
            _userManager.Setup(_ => _.FindByNameAsync("user1")).ReturnsAsync(user);
            _signInManager
                .Setup(_ => _.CheckPasswordSignInAsync(user, "wrong", true))
                .ReturnsAsync(Microsoft.AspNetCore.Identity.SignInResult.Failed);

            // Act
            var result = await _service.Login(new LoginDto { UserName = "user1", Password = "wrong" });

            // Assert
            Assert.IsType<UnauthorizedObjectResult>(result.Result);
        }

        [Fact]
        public async Task Login_ShouldThrow_WhenUserManagerThrows()
        {
            // Arrange
            _userManager.Setup(_ => _.FindByNameAsync(It.IsAny<string>())).ThrowsAsync(new Exception("boom"));

            // Act & Assert
            await Assert.ThrowsAsync<Exception>(
                () => _service.Login(new LoginDto { UserName = "user1", Password = "pass" })
            );
            _logService.Verify(
                _ => _.LogException(It.IsAny<Exception>(), "UserManagerService.Login", It.IsAny<LoginDto>()),
                Times.Once
            );
        }

        #endregion

        #region RefreshUserToken

        [Fact]
        public async Task RefreshUserToken_ShouldReturnUserDto_WhenUserIsFound()
        {
            // Arrange
            var user = new User { UserName = "user1" };
            _userManager.Setup(_ => _.FindByNameAsync("user1")).ReturnsAsync(user);

            // Act
            var result = await _service.RefreshUserToken("user1");

            // Assert
            Assert.Equal("jwt-token", result.Value!.JWT);
        }

        [Fact]
        public async Task RefreshUserToken_ShouldReturnUnauthorized_WhenUserIsNotFound()
        {
            // Arrange
            _userManager.Setup(_ => _.FindByNameAsync("missing")).ReturnsAsync((User)null!);

            // Act
            var result = await _service.RefreshUserToken("missing");

            // Assert
            Assert.IsType<UnauthorizedObjectResult>(result.Result);
        }

        #endregion

        #region Register

        private void SetupUsersQueryable(params User[] users)
        {
            _userManager.Setup(_ => _.Users).Returns(new TestAsyncEnumerable<User>(users));
        }

        [Fact]
        public async Task Register_ShouldReturnBadRequest_WhenEmailAlreadyExists()
        {
            // Arrange
            SetupUsersQueryable(new User { Email = "dup@test.com" });
            var model = new RegisterDto
            {
                FirstName = "A",
                LastName = "B",
                Email = "dup@test.com",
                Password = "123456",
            };

            // Act
            var result = await _service.Register(model);

            // Assert
            Assert.IsType<BadRequestObjectResult>(result.Result);
            _userManager.Verify(_ => _.CreateAsync(It.IsAny<User>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Register_ShouldReturnBadRequest_WhenCreateFails()
        {
            // Arrange
            SetupUsersQueryable();
            var model = new RegisterDto
            {
                FirstName = "A",
                LastName = "B",
                Email = "new@test.com",
                Password = "123456",
            };
            _userManager
                .Setup(_ => _.CreateAsync(It.IsAny<User>(), model.Password))
                .ReturnsAsync(IdentityResult.Failed(new IdentityError { Description = "bad password" }));

            // Act
            var result = await _service.Register(model);

            // Assert
            Assert.IsType<BadRequestObjectResult>(result.Result);
        }

        [Fact]
        public async Task Register_ShouldAssignRoleAndSendConfirmation_WhenModelIsValid()
        {
            // Arrange
            SetupUsersQueryable();
            var model = new RegisterDto
            {
                FirstName = "A",
                LastName = "B",
                Email = "new@test.com",
                Password = "123456",
                Role = "Admin",
            };
            _userManager
                .Setup(_ => _.CreateAsync(It.IsAny<User>(), model.Password))
                .ReturnsAsync(IdentityResult.Success);
            _userManager
                .Setup(_ => _.AddToRoleAsync(It.IsAny<User>(), "Admin"))
                .ReturnsAsync(IdentityResult.Success);
            _userManager
                .Setup(_ => _.GenerateEmailConfirmationTokenAsync(It.IsAny<User>()))
                .ReturnsAsync("token");

            // Act
            var result = await _service.Register(model);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result.Result);
            var response = Assert.IsType<WebApiResponse<User>>(okResult.Value);
            Assert.Equal(ResponseStatus.Success, response.Status);
            _userManager.Verify(_ => _.AddToRoleAsync(It.IsAny<User>(), "Admin"), Times.Once);
            _emailService.Verify(_ => _.SendEmailAsync(It.IsAny<EmailSendDto>()), Times.Once);
        }

        [Fact]
        public async Task Register_ShouldStillSucceed_WhenAddToRoleThrows()
        {
            // Arrange
            SetupUsersQueryable();
            var model = new RegisterDto
            {
                FirstName = "A",
                LastName = "B",
                Email = "new@test.com",
                Password = "123456",
                Role = "Admin",
            };
            _userManager
                .Setup(_ => _.CreateAsync(It.IsAny<User>(), model.Password))
                .ReturnsAsync(IdentityResult.Success);
            _userManager
                .Setup(_ => _.AddToRoleAsync(It.IsAny<User>(), "Admin"))
                .ThrowsAsync(new Exception("role error"));
            _userManager
                .Setup(_ => _.GenerateEmailConfirmationTokenAsync(It.IsAny<User>()))
                .ReturnsAsync("token");

            // Act
            var result = await _service.Register(model);

            // Assert
            Assert.IsType<OkObjectResult>(result.Result);
            _logService.Verify(
                _ => _.LogException(It.IsAny<Exception>(), "UserManagerService.Register.AddRole", model),
                Times.Once
            );
        }

        [Fact]
        public async Task Register_ShouldReturnBadRequest_WhenSendConfirmEmailFails()
        {
            // Arrange
            SetupUsersQueryable();
            var model = new RegisterDto
            {
                FirstName = "A",
                LastName = "B",
                Email = "new@test.com",
                Password = "123456",
            };
            _userManager
                .Setup(_ => _.CreateAsync(It.IsAny<User>(), model.Password))
                .ReturnsAsync(IdentityResult.Success);
            _userManager
                .Setup(_ => _.GenerateEmailConfirmationTokenAsync(It.IsAny<User>()))
                .ReturnsAsync("token");
            _emailService.Setup(_ => _.SendEmailAsync(It.IsAny<EmailSendDto>())).ReturnsAsync(false);

            // Act
            var result = await _service.Register(model);

            // Assert
            Assert.IsType<BadRequestObjectResult>(result.Result);
        }

        [Fact]
        public async Task Register_ShouldThrow_WhenUserManagerThrowsOutsideInnerBlocks()
        {
            // Arrange
            _userManager.Setup(_ => _.Users).Throws(new Exception("boom"));
            var model = new RegisterDto
            {
                FirstName = "A",
                LastName = "B",
                Email = "new@test.com",
                Password = "123456",
            };

            // Act & Assert
            await Assert.ThrowsAsync<Exception>(() => _service.Register(model));
        }

        #endregion

        #region ConfirmEmail

        [Fact]
        public async Task ConfirmEmail_ShouldReturnUnauthorized_WhenUserIsNotFound()
        {
            // Arrange
            _userManager.Setup(_ => _.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync((User)null!);

            // Act
            var result = await _service.ConfirmEmail(new ConfirmEmailDto { Email = "x@test.com", Token = "tok" });

            // Assert
            Assert.IsType<UnauthorizedObjectResult>(result);
        }

        [Fact]
        public async Task ConfirmEmail_ShouldReturnOk_WhenAlreadyConfirmed()
        {
            // Arrange
            var user = new User { Email = "x@test.com", EmailConfirmed = true };
            _userManager.Setup(_ => _.FindByEmailAsync("x@test.com")).ReturnsAsync(user);

            // Act
            var result = await _service.ConfirmEmail(new ConfirmEmailDto { Email = "x@test.com", Token = "tok" });

            // Assert
            Assert.IsType<OkObjectResult>(result);
        }

        [Fact]
        public async Task ConfirmEmail_ShouldReturnOk_WhenTokenIsValid()
        {
            // Arrange
            var user = new User { Email = "x@test.com", EmailConfirmed = false };
            _userManager.Setup(_ => _.FindByEmailAsync("x@test.com")).ReturnsAsync(user);
            var encodedToken = Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlEncode(
                System.Text.Encoding.UTF8.GetBytes("decoded-token")
            );
            _userManager
                .Setup(_ => _.ConfirmEmailAsync(user, "decoded-token"))
                .ReturnsAsync(IdentityResult.Success);

            // Act
            var result = await _service.ConfirmEmail(
                new ConfirmEmailDto { Email = "x@test.com", Token = encodedToken }
            );

            // Assert
            Assert.IsType<OkObjectResult>(result);
        }

        [Fact]
        public async Task ConfirmEmail_ShouldReturnBadRequest_WhenTokenIsInvalid()
        {
            // Arrange
            var user = new User { Email = "x@test.com", EmailConfirmed = false };
            _userManager.Setup(_ => _.FindByEmailAsync("x@test.com")).ReturnsAsync(user);
            var encodedToken = Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlEncode(
                System.Text.Encoding.UTF8.GetBytes("decoded-token")
            );
            _userManager
                .Setup(_ => _.ConfirmEmailAsync(user, "decoded-token"))
                .ReturnsAsync(IdentityResult.Failed(new IdentityError { Description = "invalid" }));

            // Act
            var result = await _service.ConfirmEmail(
                new ConfirmEmailDto { Email = "x@test.com", Token = encodedToken }
            );

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task ConfirmEmail_ShouldThrow_WhenFindByEmailThrows()
        {
            // Arrange
            _userManager.Setup(_ => _.FindByEmailAsync(It.IsAny<string>())).ThrowsAsync(new Exception("boom"));

            // Act & Assert
            await Assert.ThrowsAsync<Exception>(
                () => _service.ConfirmEmail(new ConfirmEmailDto { Email = "x@test.com", Token = "tok" })
            );
        }

        #endregion

        #region ResendEmailConfirmation

        [Fact]
        public async Task ResendEmailConfirmation_ShouldReturnBadRequest_WhenEmailIsEmpty()
        {
            // Act
            var result = await _service.ResendEmailConfirmation("");

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task ResendEmailConfirmation_ShouldReturnUnauthorized_WhenUserIsNotFound()
        {
            // Arrange
            _userManager.Setup(_ => _.FindByEmailAsync("x@test.com")).ReturnsAsync((User)null!);

            // Act
            var result = await _service.ResendEmailConfirmation("x@test.com");

            // Assert
            Assert.IsType<UnauthorizedObjectResult>(result);
        }

        [Fact]
        public async Task ResendEmailConfirmation_ShouldReturnBadRequest_WhenAlreadyConfirmed()
        {
            // Arrange
            var user = new User { Email = "x@test.com", EmailConfirmed = true };
            _userManager.Setup(_ => _.FindByEmailAsync("x@test.com")).ReturnsAsync(user);

            // Act
            var result = await _service.ResendEmailConfirmation("x@test.com");

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task ResendEmailConfirmation_ShouldReturnOk_WhenSendSucceeds()
        {
            // Arrange
            var user = new User { Email = "x@test.com", EmailConfirmed = false };
            _userManager.Setup(_ => _.FindByEmailAsync("x@test.com")).ReturnsAsync(user);
            _userManager
                .Setup(_ => _.GenerateEmailConfirmationTokenAsync(user))
                .ReturnsAsync("token");

            // Act
            var result = await _service.ResendEmailConfirmation("x@test.com");

            // Assert
            Assert.IsType<OkObjectResult>(result);
        }

        [Fact]
        public async Task ResendEmailConfirmation_ShouldReturnBadRequest_WhenSendFails()
        {
            // Arrange
            var user = new User { Email = "x@test.com", EmailConfirmed = false };
            _userManager.Setup(_ => _.FindByEmailAsync("x@test.com")).ReturnsAsync(user);
            _userManager
                .Setup(_ => _.GenerateEmailConfirmationTokenAsync(user))
                .ReturnsAsync("token");
            _emailService.Setup(_ => _.SendEmailAsync(It.IsAny<EmailSendDto>())).ReturnsAsync(false);

            // Act
            var result = await _service.ResendEmailConfirmation("x@test.com");

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        #endregion

        #region ForgotUsernameOrPassword

        [Fact]
        public async Task ForgotUsernameOrPassword_ShouldReturnBadRequest_WhenEmailIsEmpty()
        {
            // Act
            var result = await _service.ForgotUsernameOrPassword("");

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task ForgotUsernameOrPassword_ShouldReturnUnauthorized_WhenUserIsNotFound()
        {
            // Arrange
            _userManager.Setup(_ => _.FindByEmailAsync("x@test.com")).ReturnsAsync((User)null!);

            // Act
            var result = await _service.ForgotUsernameOrPassword("x@test.com");

            // Assert
            Assert.IsType<UnauthorizedObjectResult>(result);
        }

        [Fact]
        public async Task ForgotUsernameOrPassword_ShouldReturnBadRequest_WhenEmailIsNotConfirmed()
        {
            // Arrange
            var user = new User { Email = "x@test.com", EmailConfirmed = false };
            _userManager.Setup(_ => _.FindByEmailAsync("x@test.com")).ReturnsAsync(user);

            // Act
            var result = await _service.ForgotUsernameOrPassword("x@test.com");

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task ForgotUsernameOrPassword_ShouldReturnOk_WhenSendSucceeds()
        {
            // Arrange
            var user = new User { Email = "x@test.com", EmailConfirmed = true };
            _userManager.Setup(_ => _.FindByEmailAsync("x@test.com")).ReturnsAsync(user);
            _userManager.Setup(_ => _.GeneratePasswordResetTokenAsync(user)).ReturnsAsync("token");

            // Act
            var result = await _service.ForgotUsernameOrPassword("x@test.com");

            // Assert
            Assert.IsType<OkObjectResult>(result);
        }

        [Fact]
        public async Task ForgotUsernameOrPassword_ShouldReturnBadRequest_WhenSendFails()
        {
            // Arrange
            var user = new User { Email = "x@test.com", EmailConfirmed = true };
            _userManager.Setup(_ => _.FindByEmailAsync("x@test.com")).ReturnsAsync(user);
            _userManager.Setup(_ => _.GeneratePasswordResetTokenAsync(user)).ReturnsAsync("token");
            _emailService.Setup(_ => _.SendEmailAsync(It.IsAny<EmailSendDto>())).ReturnsAsync(false);

            // Act
            var result = await _service.ForgotUsernameOrPassword("x@test.com");

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        #endregion

        #region ResetPassword

        [Fact]
        public async Task ResetPassword_ShouldReturnUnauthorized_WhenUserIsNotFound()
        {
            // Arrange
            _userManager.Setup(_ => _.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync((User)null!);

            // Act
            var result = await _service.ResetPassword(
                new ResetPasswordDto { Email = "x@test.com", NewPassword = "123456", Token = "tok" }
            );

            // Assert
            Assert.IsType<UnauthorizedObjectResult>(result);
        }

        [Fact]
        public async Task ResetPassword_ShouldReturnBadRequest_WhenEmailIsNotConfirmed()
        {
            // Arrange
            var user = new User { Email = "x@test.com", EmailConfirmed = false };
            _userManager.Setup(_ => _.FindByEmailAsync("x@test.com")).ReturnsAsync(user);

            // Act
            var result = await _service.ResetPassword(
                new ResetPasswordDto { Email = "x@test.com", NewPassword = "123456", Token = "tok" }
            );

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task ResetPassword_ShouldReturnOk_WhenTokenIsValid()
        {
            // Arrange
            var user = new User { Email = "x@test.com", EmailConfirmed = true };
            _userManager.Setup(_ => _.FindByEmailAsync("x@test.com")).ReturnsAsync(user);
            var encodedToken = Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlEncode(
                System.Text.Encoding.UTF8.GetBytes("decoded-token")
            );
            _userManager
                .Setup(_ => _.ResetPasswordAsync(user, "decoded-token", "123456"))
                .ReturnsAsync(IdentityResult.Success);

            // Act
            var result = await _service.ResetPassword(
                new ResetPasswordDto { Email = "x@test.com", NewPassword = "123456", Token = encodedToken }
            );

            // Assert
            Assert.IsType<OkObjectResult>(result);
        }

        [Fact]
        public async Task ResetPassword_ShouldReturnBadRequest_WhenTokenIsInvalid()
        {
            // Arrange
            var user = new User { Email = "x@test.com", EmailConfirmed = true };
            _userManager.Setup(_ => _.FindByEmailAsync("x@test.com")).ReturnsAsync(user);
            var encodedToken = Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlEncode(
                System.Text.Encoding.UTF8.GetBytes("decoded-token")
            );
            _userManager
                .Setup(_ => _.ResetPasswordAsync(user, "decoded-token", "123456"))
                .ReturnsAsync(IdentityResult.Failed(new IdentityError { Description = "invalid token" }));

            // Act
            var result = await _service.ResetPassword(
                new ResetPasswordDto { Email = "x@test.com", NewPassword = "123456", Token = encodedToken }
            );

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task ResetPassword_ShouldReturnBadRequest_WhenTokenIsNotValidBase64Url()
        {
            // Arrange - a caller cannot bypass token validation by sending garbage instead of an
            // e-mailed token; WebEncoders.Base64UrlDecode throws FormatException on malformed input,
            // which must be caught the same as any other invalid-token case, not bubble up as a 500.
            var user = new User { Email = "x@test.com", EmailConfirmed = true };
            _userManager.Setup(_ => _.FindByEmailAsync("x@test.com")).ReturnsAsync(user);

            // Act
            var result = await _service.ResetPassword(
                new ResetPasswordDto { Email = "x@test.com", NewPassword = "123456", Token = "not-a-token!!" }
            );

            // Assert
            Assert.IsType<BadRequestObjectResult>(result);
            _userManager.Verify(
                _ => _.ResetPasswordAsync(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<string>()),
                Times.Never
            );
        }

        #endregion

        #region Update

        [Fact]
        public async Task Update_ShouldReturnError_WhenEmailIsEmpty()
        {
            // Arrange
            var user = new User { Id = "1", Email = "" };

            // Act
            var result = await _service.Update(user);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal("Email inválido", result.Message);
        }

        [Fact]
        public async Task Update_ShouldReturnError_WhenEmailIsDuplicated()
        {
            // Arrange
            var user = new User { Id = "1", Email = "dup@test.com" };
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<User, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _service.Update(user);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal("Já existe um usuário cadastrado com o email informado", result.Message);
        }

        [Fact]
        public async Task Update_ShouldUpdateUserFields_WhenNoRoleProvided()
        {
            // Arrange
            var existing = new User { Id = "1", Email = "old@test.com", FirstName = "Old", LastName = "Name" };
            var user = new User { Id = "1", Email = "new@test.com", FirstName = "New", LastName = "Surname" };
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<User, bool>>>()))
                .ReturnsAsync(false);
            _repository.Setup(_ => _.GetByIdAsync("1")).ReturnsAsync(existing);

            // Act
            var result = await _service.Update(user);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("new@test.com", existing.Email);
            Assert.Equal("New", existing.FirstName);
            _repository.Verify(_ => _.UpdateAsync(existing), Times.Once);
            _userManager.Verify(_ => _.GetRolesAsync(It.IsAny<User>()), Times.Once);
        }

        [Fact]
        public async Task Update_ShouldAddRoleAndRemoveOthers_WhenRoleIsProvidedAndChanged()
        {
            // Arrange
            var existing = new User { Id = "1", Email = "old@test.com" };
            var user = new User { Id = "1", Email = "old@test.com", Role = "Admin" };
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<User, bool>>>()))
                .ReturnsAsync(false);
            _repository.Setup(_ => _.GetByIdAsync("1")).ReturnsAsync(existing);
            _userManager
                .Setup(_ => _.GetRolesAsync(existing))
                .ReturnsAsync(new List<string> { "User" });
            _userManager
                .Setup(_ => _.AddToRoleAsync(existing, "Admin"))
                .ReturnsAsync(IdentityResult.Success);
            _userManager
                .Setup(_ => _.RemoveFromRoleAsync(existing, "User"))
                .ReturnsAsync(IdentityResult.Success);

            // Act
            var result = await _service.Update(user);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _userManager.Verify(_ => _.AddToRoleAsync(existing, "Admin"), Times.Once);
            _userManager.Verify(_ => _.RemoveFromRoleAsync(existing, "User"), Times.Once);
        }

        [Fact]
        public async Task Update_ShouldIgnoreRemovalFailure_WhenRemoveFromRoleThrows()
        {
            // Arrange
            var existing = new User { Id = "1", Email = "old@test.com" };
            var user = new User { Id = "1", Email = "old@test.com", Role = "Admin" };
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<User, bool>>>()))
                .ReturnsAsync(false);
            _repository.Setup(_ => _.GetByIdAsync("1")).ReturnsAsync(existing);
            _userManager
                .Setup(_ => _.GetRolesAsync(existing))
                .ReturnsAsync(new List<string> { "User" });
            _userManager
                .Setup(_ => _.AddToRoleAsync(existing, "Admin"))
                .ReturnsAsync(IdentityResult.Success);
            _userManager
                .Setup(_ => _.RemoveFromRoleAsync(existing, "User"))
                .ThrowsAsync(new Exception("remove failed"));

            // Act
            var result = await _service.Update(user);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
        }

        [Fact]
        public async Task Update_ShouldLogAndContinue_WhenRoleHandlingThrows()
        {
            // Arrange
            var existing = new User { Id = "1", Email = "old@test.com" };
            var user = new User { Id = "1", Email = "old@test.com", Role = "Admin" };
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<User, bool>>>()))
                .ReturnsAsync(false);
            _repository.Setup(_ => _.GetByIdAsync("1")).ReturnsAsync(existing);
            // Throws only on the first call (inside role handling); the second call, made while
            // building the returned DTO, succeeds normally.
            _userManager
                .SetupSequence(_ => _.GetRolesAsync(existing))
                .ThrowsAsync(new Exception("role read error"))
                .ReturnsAsync(new List<string> { "User" });

            // Act
            var result = await _service.Update(user);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _logService.Verify(
                _ => _.LogException(It.IsAny<Exception>(), "UserManagerService.Update.RoleHandling", user),
                Times.Once
            );
        }

        [Fact]
        public async Task Update_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var user = new User { Id = "1", Email = "old@test.com" };
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<User, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Update(user);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        #endregion

        #region UpdatePreferences

        [Fact]
        public async Task UpdatePreferences_ShouldReturnError_WhenUserIsNotFound()
        {
            // Arrange
            _repository.Setup(_ => _.GetByIdAsync("1")).ReturnsAsync((User)null!);

            // Act
            var result = await _service.UpdatePreferences("1", new UpdatePreferencesDto { Theme = "dark" });

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal("Usuário não encontrado.", result.Message);
        }

        [Fact]
        public async Task UpdatePreferences_ShouldUpdateThemeAndLanguage_WhenUserIsFound()
        {
            // Arrange
            var existing = new User { Id = "1" };
            _repository.Setup(_ => _.GetByIdAsync("1")).ReturnsAsync(existing);

            // Act
            var result = await _service.UpdatePreferences(
                "1",
                new UpdatePreferencesDto { Theme = "dark", Language = "en" }
            );

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("dark", existing.Theme);
            Assert.Equal("en", existing.Language);
            _repository.Verify(_ => _.UpdateAsync(existing), Times.Once);
        }

        [Fact]
        public async Task UpdatePreferences_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository.Setup(_ => _.GetByIdAsync("1")).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.UpdatePreferences("1", new UpdatePreferencesDto());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        #endregion

        #region Remove

        [Fact]
        public async Task Remove_ShouldReturnError_WhenUserIsNotFound()
        {
            // Arrange
            var user = new User { Id = "1", UserName = "user1" };
            _userManager.Setup(_ => _.FindByIdAsync("1")).ReturnsAsync((User)null!);

            // Act
            var result = await _service.Remove(user);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal("Usuário não encontrado.", result.Message);
        }

        [Fact]
        public async Task Remove_ShouldRemoveUser_WhenUserIsFound()
        {
            // Arrange
            var user = new User { Id = "1", UserName = "user1" };
            var existing = new User { Id = "1", UserName = "user1" };
            _userManager.Setup(_ => _.FindByIdAsync("1")).ReturnsAsync(existing);

            // Act
            var result = await _service.Remove(user);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _repository.Verify(_ => _.RemoveAsync(existing), Times.Once);
        }

        [Fact]
        public async Task Remove_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var user = new User { Id = "1", UserName = "user1" };
            _userManager.Setup(_ => _.FindByIdAsync("1")).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Remove(user);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        #endregion

        #region FindAll / FindById

        [Fact]
        public async Task FindAll_ShouldReturnMappedUsers_WhenRepositorySucceeds()
        {
            // Arrange
            var users = new List<User> { new() { Id = "1" }, new() { Id = "2" } };
            _repository.Setup(_ => _.GetAllAsync(true)).ReturnsAsync(users);

            // Act
            var result = await _service.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(2, result.Data!.Count());
        }

        [Fact]
        public async Task FindAll_ShouldAssignRole_WhenUserBelongsToARole()
        {
            // Arrange
            var users = new List<User> { new() { Id = "1" }, new() { Id = "2" } };
            _repository.Setup(_ => _.GetAllAsync(true)).ReturnsAsync(users);

            var adminRole = new IdentityRole("Admin") { Id = "role-admin" };
            _roleManager.Setup(_ => _.Roles).Returns(new List<IdentityRole> { adminRole }.AsQueryable());
            _userManager
                .Setup(_ => _.GetUsersInRoleAsync("Admin"))
                .ReturnsAsync(new List<User> { users[0] });

            // Act
            var result = await _service.FindAll();

            // Assert
            var dtos = result.Data!.ToList();
            Assert.Equal("Admin", dtos.Single(d => d.Id == "1").Role);
            Assert.Null(dtos.Single(d => d.Id == "2").Role);
        }

        [Fact]
        public async Task FindAll_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository.Setup(_ => _.GetAllAsync(true)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task FindById_ShouldReturnUser_WhenFound()
        {
            // Arrange
            var user = new User { Id = "1", UserName = "user1" };
            _repository.Setup(_ => _.GetByIdAsync("1")).ReturnsAsync(user);

            // Act
            var result = await _service.FindById("1");

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("Usuário user1 encontrado com sucesso", result.Message);
        }

        [Fact]
        public async Task FindById_ShouldReturnError_WhenNotFound()
        {
            // Arrange - unlike most other services, FindById here has no null-check before
            // building the DTO (see CreateApplicationUserDto), so a missing user surfaces as a
            // NullReferenceException caught by the outer try/catch rather than a
            // "not found" Success/no-data response. Documented here as current behavior; see the
            // final report for this finding.
            _repository.Setup(_ => _.GetByIdAsync("missing")).ReturnsAsync((User)null!);

            // Act
            var result = await _service.FindById("missing");

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            _logService.Verify(
                _ => _.LogException(It.IsAny<Exception>(), "UserManagerService.FindById", "missing"),
                Times.Once
            );
        }

        [Fact]
        public async Task FindById_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository.Setup(_ => _.GetByIdAsync("1")).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.FindById("1");

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        #endregion
    }
}
