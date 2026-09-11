using System.Linq.Expressions;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class DriverService : IDriverService
    {
        #region Properties

        private readonly IRepository<Driver> _repository;
        private readonly IRepository<Trip> _tripRepository;
        private readonly IFeatureToggleService _featureToggleService;
        private readonly IAlertConfigService _alertConfigService;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        public DriverService(
            IRepository<Driver> repository,
            IRepository<Trip> tripRepository,
            IFeatureToggleService featureToggleService,
            IAlertConfigService alertConfigService,
            ILogService logService
        )
        {
            _repository = repository;
            _tripRepository = tripRepository;
            _featureToggleService = featureToggleService;
            _alertConfigService = alertConfigService;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Driver>> Add(Driver driver)
        {
            WebApiResponse<Driver> result = new();

            try
            {
                var duplicatedMessage = await CheckIfDriverIsDuplicatedAndGetErrorMessage(driver);

                if (!string.IsNullOrEmpty(duplicatedMessage))
                {
                    result.Status = ResponseStatus.Error;
                    result.Message = duplicatedMessage;
                    return result;
                }

                await _repository.AddAsync(driver);

                result.Data = driver;
                result.Status = ResponseStatus.Success;
                result.Message = $"Motorista {driver.Name} cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "DriverService.Add", driver);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o Motorista {driver.Name} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Driver>> Update(Driver driver)
        {
            WebApiResponse<Driver> result = new();

            try
            {
                var duplicatedMessage = await CheckIfDriverIsDuplicatedAndGetErrorMessage(driver);

                if (!string.IsNullOrEmpty(duplicatedMessage))
                {
                    var ex = new Exception(duplicatedMessage);
                    _logService.LogException(ex, "DriverService.Update", driver);

                    result.Status = ResponseStatus.Error;
                    result.Message = duplicatedMessage;
                    return result;
                }

                await _repository.UpdateAsync(driver);

                result.Data = driver;
                result.Status = ResponseStatus.Success;
                result.Message = $"Motorista {driver.Name} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "DriverService.Update", driver);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do Motorista {driver.Name} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Driver>> Remove(Driver driver)
        {
            WebApiResponse<Driver> result = new();

            try
            {
                if (await _tripRepository.AnyAsync(_ => _.DriverId == driver.Id))
                {
                    var message =
                        $"Motorista {driver.Name} não pode ser removido pois está vinculado à uma ou mais viagens.";
                    var ex = new Exception(message);
                    _logService.LogException(ex, "DriverService.Remove", driver);

                    result.Data = driver;
                    result.Status = ResponseStatus.Warning;
                    result.Message = message;
                    return result;
                }

                await _repository.RemoveAsync(driver);

                result.Data = driver;
                result.Status = ResponseStatus.Success;
                result.Message = $"Motorista {driver.Name} removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "DriverService.Remove", driver);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o Motorista {driver.Name} da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<Driver>>> FindAll()
        {
            WebApiResponse<IEnumerable<Driver>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Driver, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                result.Data = await _repository.GetAllAsync();
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "DriverService.FindAll", null);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Motoristas na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PagedResult<Driver>>> FindAllPaged(PagedRequest request)
        {
            WebApiResponse<PagedResult<Driver>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Driver, FeatureToggleKeys.FleetModule))
                {
                    result.Data = new PagedResult<Driver> { Items = [], TotalCount = 0 };
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                var filter = BuildFilter(request);
                var orderBy = BuildOrderBy(request);

                var (drivers, totalCount) = await _repository.GetPagedAsync(
                    skip: (Math.Max(request.Page, 1) - 1) * Math.Max(request.PageSize, 1),
                    take: Math.Max(request.PageSize, 1),
                    filter: filter,
                    orderBy: orderBy,
                    asNoTracking: true
                );

                result.Data = new PagedResult<Driver> { Items = drivers, TotalCount = totalCount };
                result.Status = ResponseStatus.Success;
                result.Message = $"{totalCount} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "DriverService.FindAllPaged", request);
                result.Status = ResponseStatus.Error;
                result.Message = "Não foi possível acessar os registros de Motoristas na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Driver>> FindById(Guid? id)
        {
            WebApiResponse<Driver> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Driver, FeatureToggleKeys.FleetModule))
                {
                    result.Data = null;
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhum Motorista com o ID {id} foi encontrado";
                    return result;
                }

                result.Data = await _repository.GetByIdAsync(id);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Motorista {result.Data.Name} encontrado com sucesso"
                        : $"Nenhum Motorista com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "DriverService.FindById", id);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Motoristas na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Driver>> FindBySocialSecurityCard(
            string socialSecurityCard
        )
        {
            WebApiResponse<Driver> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Driver, FeatureToggleKeys.FleetModule))
                {
                    result.Data = null;
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhum Motorista com CPF {socialSecurityCard} foi encontrado";
                    return result;
                }

                result.Data = await _repository.FirstOrDefaultAsync(_ =>
                    _.SocialSecurityCard.Equals(socialSecurityCard)
                );
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Motorista {result.Data.Name} encontrado com sucesso"
                        : $"Nenhum Motorista com CPF {socialSecurityCard} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "DriverService.FindBySocialSecurityCard",
                    socialSecurityCard
                );

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Motoristas na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<Driver>>> FindActive()
        {
            WebApiResponse<IEnumerable<Driver>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Driver, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                result.Data = await _repository.QueryAsync(_ => _.Status == DriverStatus.Active);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "DriverService.FindActive", null);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Motoristas na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<Driver>>> FindWithExpiringLicense(
            int daysAhead
        )
        {
            WebApiResponse<IEnumerable<Driver>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Driver, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                if (!await _alertConfigService.IsEnabledAsync(AlertConfigKeys.DriverLicenseExpiry))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                var threshold = DateTime.UtcNow.Date.AddDays(daysAhead);

                result.Data = await _repository.QueryAsync(_ =>
                    _.LicenseExpiryDate.Date <= threshold
                );
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "DriverService.FindWithExpiringLicense", daysAhead);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Motoristas na base de dados.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        /// <summary>
        /// Known sort fields exposed by the Drivers grid, mapped to the Driver property they
        /// sort by - an unrecognized SortField (or none) falls back to the repository's own
        /// default (CreateDate) ordering.
        /// </summary>
        private static readonly Dictionary<string, Expression<Func<Driver, object>>> SortMap = new()
        {
            ["name"] = d => d.Name,
            ["socialSecurityCard"] = d => d.SocialSecurityCard,
            ["licenseNumber"] = d => d.LicenseNumber,
            ["licenseCategory"] = d => d.LicenseCategory,
            ["licenseExpiryDate"] = d => d.LicenseExpiryDate,
            ["employmentType"] = d => d.EmploymentType,
            ["status"] = d => d.Status,
        };

        /// <summary>
        /// Quick filter OR's across the grid's own visible text columns.
        /// </summary>
        private static Expression<Func<Driver, bool>> BuildFilter(PagedRequest request)
        {
            var quickFilter = request.QuickFilter;
            var hasQuickFilter = !string.IsNullOrWhiteSpace(quickFilter);

            return d =>
                !hasQuickFilter
                || d.Name.Contains(quickFilter)
                || d.SocialSecurityCard.Contains(quickFilter)
                || d.LicenseNumber.Contains(quickFilter);
        }

        private static Func<IQueryable<Driver>, IOrderedQueryable<Driver>> BuildOrderBy(
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

        /// <summary>
        /// Should verify if the Driver is already being registered on the database.
        /// </summary>
        /// <param name="driver">The Driver object that is being added or updated.</param>
        /// <returns>The error message when Driver is duplicated. Otherwise an empty string.</returns>
        private async Task<string> CheckIfDriverIsDuplicatedAndGetErrorMessage(Driver driver)
        {
            if (await IsSocialSecurityCardDuplicated(driver))
            {
                return $"Já existe um Motorista cadastrado com o CPF {driver.SocialSecurityCard}.";
            }

            return string.Empty;
        }

        /// <summary>
        /// Should verify if the Driver CPF is already being used by another register on the database.
        /// </summary>
        /// <param name="driver">The Driver object that is being added or updated.</param>
        /// <returns>True when the CPF is duplicated; Otherwise false.</returns>
        private Task<bool> IsSocialSecurityCardDuplicated(Driver driver)
        {
            return _repository.AnyAsync(_ =>
                _.Id != driver.Id
                && !string.IsNullOrEmpty(_.SocialSecurityCard)
                && _.SocialSecurityCard == driver.SocialSecurityCard
            );
        }

        #endregion Private methods
    }
}
