using System.Linq.Expressions;
using System.Text;
using AutoMapper;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class UserManagerService : ControllerBase, IUserManagerService
    {
        #region Properties

        private readonly IJwtService _jwtService;
        private readonly SignInManager<User> _signInManager;
        private readonly UserManager<User> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly IEmailService _emailService;
        private readonly IConfiguration _config;
        private readonly ILogService _logService;

        /// <summary>
        /// Repository object created to access the Users registers on database using EntityFramework.
        /// </summary>
        private readonly IRepository<User> _repository;

        #endregion Properties

        #region Public methods

        public UserManagerService(
            IJwtService jwtService,
            SignInManager<User> signInManager,
            UserManager<User> userManager,
            RoleManager<IdentityRole> roleManager,
            IEmailService emailService,
            IConfiguration config,
            IRepository<User> repository,
            ILogService logService
        )
        {
            _jwtService = jwtService;
            _signInManager = signInManager;
            _userManager = userManager;
            _roleManager = roleManager;
            _emailService = emailService;
            _config = config;
            _repository = repository;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<ActionResult<UserDto>> Login(LoginDto model)
        {
            try
            {
                var user = await _userManager.FindByNameAsync(model.UserName);

                if (user == null)
                {
                    return Unauthorized("E-mail ou senha inválidos.");
                }

                if (user.EmailConfirmed == false)
                {
                    return Unauthorized("Por favor, confirme o seu e-mail.");
                }

                // lockoutOnFailure: true - paired with the Lockout options configured in
                // Program.cs, so repeated wrong-password attempts against this account eventually
                // lock it instead of being retried forever. The response stays the same generic
                // "E-mail ou senha inválidos." either way (SignInResult.Succeeded is false whether
                // the password was wrong or the account is now locked), so this doesn't leak
                // lockout status to the caller.
                var result = await _signInManager.CheckPasswordSignInAsync(
                    user,
                    model.Password,
                    true
                );
                if (!result.Succeeded)
                {
                    return Unauthorized("E-mail ou senha inválidos.");
                }

                return await CreateApplicationUserDto(user);
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "UserManagerService.Login", model);
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<ActionResult<UserDto>> RefreshUserToken(string userName)
        {
            try
            {
                var user = await _userManager.FindByNameAsync(userName);

                if (user == null)
                {
                    return Unauthorized("Usuário não foi encontrado.");
                }

                return await CreateApplicationUserDto(user);
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "UserManagerService.RefreshUserToken", userName);
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<ActionResult<WebApiResponse<User>>> Register(RegisterDto model)
        {
            try
            {
                if (await CheckEmailExistisAsync(model.Email))
                {
                    var message =
                        $"Já existe uma conta com o e-mail {model.Email}. Por favor, tente com outro endereço.";
                    _logService.LogException(
                        new Exception(message),
                        "UserManagerService.Register",
                        model
                    );
                    return BadRequest(message);
                }

                var userToAdd = new User
                {
                    FirstName = model.FirstName,
                    LastName = model.LastName,
                    UserName = model.Email,
                    Email = model.Email,
                };

                var result = await _userManager.CreateAsync(userToAdd, model.Password);

                if (!result.Succeeded)
                {
                    return BadRequest(result.Errors);
                }

                // assign role if provided
                if (!string.IsNullOrEmpty(model.Role))
                {
                    try
                    {
                        var roleResult = await _userManager.AddToRoleAsync(userToAdd, model.Role);
                        if (!roleResult.Succeeded)
                        {
                            // log but don't fail the entire registration
                        }
                    }
                    catch (Exception ex)
                    {
                        _logService.LogException(ex, "UserManagerService.Register.AddRole", model);
                    }
                }

                try
                {
                    if (!(await SendConfirmEmailAsync(userToAdd)))
                    {
                        throw new Exception();
                    }

                    return Ok(
                        new WebApiResponse<User>
                        {
                            Data = userToAdd,
                            Status = ResponseStatus.Success,
                            Message = "Usuário cadastrado com sucesso.",
                        }
                    );
                }
                catch (Exception ex)
                {
                    _logService.LogException(
                        ex,
                        "UserManagerService.Register.SendConfirmEmail",
                        userToAdd
                    );
                    return BadRequest(
                        $"Falha ao enviar o e-mail. Por favor, contate o administrador."
                    );
                }
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "UserManagerService.Register", model);
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<IActionResult> ConfirmEmail(ConfirmEmailDto model)
        {
            try
            {
                var user = await _userManager.FindByEmailAsync(model.Email);

                if (user == null)
                {
                    return Unauthorized("Este endereço de e-mail ainda não foi cadastrado.");
                }

                if (user.EmailConfirmed)
                {
                    return Ok(
                        new JsonResult(
                            new
                            {
                                title = "E-mail confirmado",
                                message = "Seu e-mail foi confirmado com sucesso. Você pode entrar agora.",
                            }
                        )
                    );
                }

                try
                {
                    var decodedTokenBytes = WebEncoders.Base64UrlDecode(model.Token);
                    var decodedToken = Encoding.UTF8.GetString(decodedTokenBytes);

                    var result = await _userManager.ConfirmEmailAsync(user, decodedToken);

                    if (!result.Succeeded)
                    {
                        throw new Exception("Token inválido. Por favor, tente novamente.");
                    }

                    return Ok(
                        new JsonResult(
                            new
                            {
                                title = "E-mail confirmado",
                                message = "Seu e-mail foi confirmado com sucesso. Você pode entrar agora.",
                            }
                        )
                    );
                }
                catch (Exception ex)
                {
                    _logService.LogException(ex, "UserManagerService.ConfirmEmail", model);
                    return BadRequest(
                        $"Falha ao confirmar o e-mail. Por favor, contate o administrador."
                    );
                }
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "UserManagerService.ConfirmEmail", model);
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<IActionResult> ResendEmailConfirmation(string email)
        {
            try
            {
                if (string.IsNullOrEmpty(email))
                {
                    return BadRequest("E-mail inválido.");
                }

                var user = await _userManager.FindByEmailAsync(email);

                if (user == null)
                {
                    return Unauthorized("Este endereço de e-mail ainda não foi cadastrado.");
                }

                if (user.EmailConfirmed)
                {
                    return BadRequest(
                        "Seu endereço de e-mail foi já está confirmado. Por favor, entre na sua conta."
                    );
                }

                try
                {
                    if (!(await SendConfirmEmailAsync(user)))
                    {
                        throw new Exception();
                    }

                    return Ok(
                        new JsonResult(
                            new
                            {
                                title = "Confirmação enviada",
                                message = "Por favor, confirme seu endereço de e-mail",
                            }
                        )
                    );
                }
                catch (Exception ex)
                {
                    _logService.LogException(
                        ex,
                        "UserManagerService.ResendEmailConfirmation.Send",
                        email
                    );
                    return BadRequest(
                        $"Falha ao enviar o e-mail. Por favor, contate o administrador."
                    );
                }
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "UserManagerService.ResendEmailConfirmation", email);
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<IActionResult> ForgotUsernameOrPassword(string email)
        {
            try
            {
                if (string.IsNullOrEmpty(email))
                {
                    return BadRequest("E-mail inválido.");
                }

                var user = await _userManager.FindByEmailAsync(email);

                if (user == null)
                {
                    return Unauthorized("Este endereço de e-mail ainda não foi cadastrado.");
                }

                if (!user.EmailConfirmed)
                {
                    return BadRequest("Por favor, confirme o seu endereço de e-mail primeiro.");
                }

                try
                {
                    if (!(await SendForgotUsernameOrPasswordEmail(user)))
                    {
                        throw new Exception();
                    }

                    return Ok(
                        new JsonResult(
                            new
                            {
                                title = "E-mail de redefinição enviado",
                                message = "Por favor, verifique o seu endereço de e-mail.",
                            }
                        )
                    );
                }
                catch (Exception ex)
                {
                    _logService.LogException(
                        ex,
                        "UserManagerService.ForgotUsernameOrPassword.Send",
                        email
                    );
                    return BadRequest(
                        $"Falha ao enviar o e-mail. Por favor, contate o administrador."
                    );
                }
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "UserManagerService.ForgotUsernameOrPassword", email);
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<IActionResult> ResetPassword(ResetPasswordDto model)
        {
            try
            {
                var user = await _userManager.FindByEmailAsync(model.Email);

                if (user == null)
                {
                    return Unauthorized("Este endereço de e-mail ainda não foi cadastrado.");
                }

                if (!user.EmailConfirmed)
                {
                    return BadRequest("Por favor, confirme seu endereço de e-mail primeiro.");
                }

                try
                {
                    // The token must be the one actually e-mailed to the user by
                    // ForgotUsernameOrPassword/SendForgotUsernameOrPasswordEmail (decoded the same
                    // way ConfirmEmail decodes its token) - generating a fresh token here instead
                    // of validating the caller's would let anyone reset any account's password
                    // just by knowing its e-mail address.
                    var decodedTokenBytes = WebEncoders.Base64UrlDecode(model.Token);
                    var decodedToken = Encoding.UTF8.GetString(decodedTokenBytes);

                    var result = await _userManager.ResetPasswordAsync(
                        user,
                        decodedToken,
                        model.NewPassword
                    );

                    if (!result.Succeeded)
                    {
                        throw new Exception("Token inválido. Por favor, tente novamente.");
                    }

                    return Ok(
                        new JsonResult(
                            new
                            {
                                title = "Senha redefinida",
                                message = "Sua senha foi redefinida com sucesso.",
                            }
                        )
                    );
                }
                catch (Exception ex)
                {
                    _logService.LogException(ex, "UserManagerService.ResetPassword", model);
                    return BadRequest(
                        $"Falha ao redefinir senha. Por favor, contate o administrador."
                    );
                }
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "UserManagerService.ResetPassword", model);
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<UserDto>> Update(User user)
        {
            var result = new WebApiResponse<UserDto>();

            try
            {
                if (string.IsNullOrEmpty(user.Email))
                {
                    var message = "Email inválido";
                    _logService.LogException(
                        new Exception(message),
                        "UserManagerService.Update",
                        user
                    );
                    result.Status = ResponseStatus.Error;
                    result.Message = message;
                    return result;
                }

                var userDuplicatedMessage = await _repository.AnyAsync(_ =>
                    _.Id != user.Id && _.Email == user.Email.ToLower()
                );

                if (userDuplicatedMessage)
                {
                    var message = "Já existe um usuário cadastrado com o email informado";
                    _logService.LogException(
                        new Exception(message),
                        "UserManagerService.Update",
                        user
                    );
                    result.Status = ResponseStatus.Error;
                    result.Message = message;
                    return result;
                }

                var userToUpdate = await _repository.GetByIdAsync(user.Id);
                userToUpdate.Email = user.Email;
                userToUpdate.FirstName = user.FirstName;
                userToUpdate.LastName = user.LastName;

                await _repository.UpdateAsync(userToUpdate);

                // Handle role updates if a role was provided in the payload
                if (!string.IsNullOrEmpty(user.Role))
                {
                    try
                    {
                        var currentRoles = await _userManager.GetRolesAsync(userToUpdate);

                        // If the desired role is not present, add it
                        if (!currentRoles.Contains(user.Role))
                        {
                            var addRoleResult = await _userManager.AddToRoleAsync(
                                userToUpdate,
                                user.Role
                            );
                            if (!addRoleResult.Succeeded)
                            {
                                // Log or aggregate errors as needed; do not fail the whole update
                            }
                        }

                        // Remove any other roles the user had (keeping single-role model)
                        foreach (var existing in currentRoles)
                        {
                            if (existing != user.Role)
                            {
                                try
                                {
                                    await _userManager.RemoveFromRoleAsync(userToUpdate, existing);
                                }
                                catch
                                {
                                    // ignore individual removal failures
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logService.LogException(
                            ex,
                            "UserManagerService.Update.RoleHandling",
                            user
                        );
                    }
                }

                result.Data = await CreateApplicationUserDto(userToUpdate, false);
                result.Status = ResponseStatus.Success;
                result.Message = $"Usuário {user.UserName} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "UserManagerService.Update", user);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do usuário {user.UserName} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<UserDto>> UpdatePreferences(
            string userId,
            UpdatePreferencesDto model
        )
        {
            var result = new WebApiResponse<UserDto>();

            try
            {
                var userToUpdate = await _repository.GetByIdAsync(userId);
                if (userToUpdate == null)
                {
                    result.Status = ResponseStatus.Error;
                    result.Message = "Usuário não encontrado.";
                    return result;
                }

                userToUpdate.Theme = model.Theme;
                userToUpdate.Language = model.Language;

                await _repository.UpdateAsync(userToUpdate);

                result.Data = await CreateApplicationUserDto(userToUpdate, false);
                result.Status = ResponseStatus.Success;
                result.Message = "Preferências atualizadas com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "UserManagerService.UpdatePreferences", userId);
                result.Status = ResponseStatus.Error;
                result.Message = $"Não foi possível atualizar as preferências.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<UserDto>> Remove(User user)
        {
            var result = new WebApiResponse<UserDto>();

            try
            {
                // Fetch the user with roles before removal
                var userToRemove = await _userManager.FindByIdAsync(user.Id);
                if (userToRemove == null)
                {
                    var message = "Usuário não encontrado.";
                    _logService.LogException(
                        new Exception(message),
                        "UserManagerService.Remove",
                        user
                    );
                    return new WebApiResponse<UserDto>
                    {
                        Status = ResponseStatus.Error,
                        Message = message,
                    };
                }

                await _repository.RemoveAsync(userToRemove);

                result.Data = await CreateApplicationUserDto(userToRemove, false);
                result.Status = ResponseStatus.Success;
                result.Message = $"Usuário {user.UserName} removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "UserManagerService.Remove", user);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o usuário {user.UserName} da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<UserDto>>> FindAll()
        {
            var result = new WebApiResponse<IEnumerable<UserDto>>();

            try
            {
                var users = await _repository.GetAllAsync(true);
                var userIdToRole = await BuildUserIdToRoleMapAsync();

                var userDtos = users
                    .Select(user => new UserDto
                    {
                        Id = user.Id,
                        UserName = user.UserName,
                        Email = user.Email,
                        EmailConfirmed = user.EmailConfirmed,
                        FirstName = user.FirstName,
                        LastName = user.LastName,
                        Photo = user.Photo,
                        Role = userIdToRole.GetValueOrDefault(user.Id),
                        Theme = user.Theme,
                        Language = user.Language,
                    })
                    .ToList();
                result.Data = userDtos;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"{(result.Data as ICollection<UserDto>)?.Count ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "UserManagerService.FindAll", null);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de usuários na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PagedResult<UserDto>>> FindAllPaged(PagedRequest request)
        {
            var result = new WebApiResponse<PagedResult<UserDto>>();

            try
            {
                var filter = BuildFilter(request);
                var orderBy = BuildOrderBy(request);

                var (users, totalCount) = await _repository.GetPagedAsync(
                    skip: (Math.Max(request.Page, 1) - 1) * Math.Max(request.PageSize, 1),
                    take: Math.Max(request.PageSize, 1),
                    filter: filter,
                    orderBy: orderBy,
                    asNoTracking: true
                );

                var userIdToRole = await BuildUserIdToRoleMapAsync();

                var userDtos = users
                    .Select(user => new UserDto
                    {
                        Id = user.Id,
                        UserName = user.UserName,
                        Email = user.Email,
                        EmailConfirmed = user.EmailConfirmed,
                        FirstName = user.FirstName,
                        LastName = user.LastName,
                        Photo = user.Photo,
                        Role = userIdToRole.GetValueOrDefault(user.Id),
                        Theme = user.Theme,
                        Language = user.Language,
                    })
                    .ToList();

                result.Data = new PagedResult<UserDto> { Items = userDtos, TotalCount = totalCount };
                result.Status = ResponseStatus.Success;
                result.Message = $"{totalCount} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "UserManagerService.FindAllPaged", request);
                result.Status = ResponseStatus.Error;
                result.Message = "Não foi possível acessar os registros de usuários na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<UserDto>> FindById(string id)
        {
            var result = new WebApiResponse<UserDto>();

            try
            {
                var user = await _repository.GetByIdAsync(id);
                result.Data = await CreateApplicationUserDto(user, false);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Usuário {result.Data.UserName} encontrado com sucesso"
                        : $"Nenhum usuário com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "UserManagerService.FindById", id);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de usuários na base de dados.";
            }

            return result;
        }

        #endregion

        #region Private Helper Methods

        /// <summary>
        /// Batches role lookups by role (a handful of roles exist, e.g. Admin/User/Master)
        /// instead of one GetRolesAsync() round-trip per user - what would otherwise be N+1
        /// queries for a list of N users is R+1, where R is the small, fixed number of roles.
        /// </summary>
        private async Task<Dictionary<string, string>> BuildUserIdToRoleMapAsync()
        {
            var userIdToRole = new Dictionary<string, string>();
            foreach (var role in _roleManager.Roles)
            {
                var usersInRole = await _userManager.GetUsersInRoleAsync(role.Name);
                foreach (var userInRole in usersInRole)
                {
                    userIdToRole[userInRole.Id] = role.Name;
                }
            }

            return userIdToRole;
        }

        /// <summary>
        /// Known sort fields exposed by the Users grid, mapped to the User property they sort
        /// by - an unrecognized SortField (or none) falls back to the repository's own default
        /// (CreateDate) ordering. "fullName" (the grid's combined first+last name column) sorts
        /// by FirstName; "role" isn't mapped since it isn't a queryable column on User itself
        /// (it's resolved afterwards from AspNetUserRoles via BuildUserIdToRoleMapAsync).
        /// </summary>
        private static readonly Dictionary<string, Expression<Func<User, object>>> SortMap = new()
        {
            ["fullName"] = u => u.FirstName,
            ["email"] = u => u.Email,
            ["emailConfirmed"] = u => u.EmailConfirmed,
        };

        /// <summary>
        /// Quick filter OR's across the grid's own visible text columns.
        /// </summary>
        private static Expression<Func<User, bool>> BuildFilter(PagedRequest request)
        {
            var quickFilter = request.QuickFilter;
            var hasQuickFilter = !string.IsNullOrWhiteSpace(quickFilter);

            return u =>
                !hasQuickFilter
                || u.FirstName.Contains(quickFilter)
                || u.LastName.Contains(quickFilter)
                || u.Email.Contains(quickFilter);
        }

        private static Func<IQueryable<User>, IOrderedQueryable<User>> BuildOrderBy(
            PagedRequest request
        )
        {
            if (
                string.IsNullOrWhiteSpace(request.SortField)
                || !SortMap.TryGetValue(request.SortField, out var keySelector)
            )
            {
                return null;
            }

            return request.SortDescending
                ? q => q.OrderByDescending(keySelector)
                : q => q.OrderBy(keySelector);
        }

        private async Task<UserDto> CreateApplicationUserDto(User user, bool includeJwt = true)
        {
            var roles = await _userManager.GetRolesAsync(user);
            var jwtToken = includeJwt ? _jwtService.CreateJWT(user, roles) : null;

            return new UserDto
            {
                Id = user.Id,
                UserName = user.UserName,
                Email = user.Email,
                EmailConfirmed = user.EmailConfirmed,
                FirstName = user.FirstName,
                LastName = user.LastName,
                JWT = jwtToken?.Token,
                TokenExpiresAtUtc = jwtToken?.ExpiresAtUtc,
                Photo = user.Photo,
                Role = roles.FirstOrDefault(),
                Theme = user.Theme,
                Language = user.Language,
            };
        }

        private async Task<bool> CheckEmailExistisAsync(string email)
        {
            return await _userManager.Users.AnyAsync(_ => _.Email == email.ToLower());
        }

        private async Task<bool> SendConfirmEmailAsync(User user)
        {
            var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
            token = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
            var url =
                $"{_config["JWT:ClientUrl"]}/{_config["Email:ConfirmationEmailPath"]}?token={token}&email={user.Email}";

            var body =
                $"<p>Olá {user.FirstName} {user.LastName}</p>"
                + "<p>Por favor, confirme o seu e-mail clicando no link à seguir.</p>"
                + $"<p><a href=\"{url}\">Confirmar e-mail</a></p>"
                + "<p>Obrigado!</p>"
                + $"<br>{_config["Email:ApplicationName"]}</p>";

            var emailSend = new EmailSendDto(user.Email, "Confirme seu e-mail", body);

            return await _emailService.SendEmailAsync(emailSend);
        }

        private async Task<bool> SendForgotUsernameOrPasswordEmail(User user)
        {
            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            token = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
            var url =
                $"{_config["JWT:ClientUrl"]}/{_config["Email:ResetPasswordPath"]}?token={token}&email={user.Email}";

            var body =
                $"<p>Olá {user.FirstName} {user.LastName}</p>"
                + $"<p>Usuário: {user.UserName}</p>"
                + "<p>Para redefinir a sua senha, por favor, clique no link à seguir.</p>"
                + $"<p><a href=\"{url}\">Redefinir senha</a></p>"
                + "<p>Obrigado!</p>"
                + $"<br>{_config["Email:ApplicationName"]}</p>";

            var emailSend = new EmailSendDto(user.Email, "Redefinir sua senha", body);

            return await _emailService.SendEmailAsync(emailSend);
        }

        #endregion
    }
}
