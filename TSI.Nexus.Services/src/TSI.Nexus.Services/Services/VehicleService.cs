using System.Linq.Expressions;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class VehicleService : IVehicleService
    {
        #region Properties

        /// <summary>
        /// Repository object created to access the Vehicle registers on database using EntityFramework.
        /// </summary>
        private readonly IRepository<Vehicle> _repository;
        private readonly IRepository<Trip> _tripRepository;
        private readonly IFeatureToggleService _featureToggleService;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        /// <summary>
        /// VehicleService constructor created to initialize the "_repository" using Dependency Injection.
        /// </summary>
        public VehicleService(
            IRepository<Vehicle> repository,
            IRepository<Trip> tripRepository,
            IFeatureToggleService featureToggleService,
            ILogService logService
        )
        {
            _repository = repository;
            _tripRepository = tripRepository;
            _featureToggleService = featureToggleService;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Vehicle>> Add(Vehicle vehicle)
        {
            WebApiResponse<Vehicle> result = new();

            try
            {
                var duplicatedMessage = await CheckIfVehicleIsDuplicatedAndGetErrorMessage(vehicle);

                if (!string.IsNullOrEmpty(duplicatedMessage))
                {
                    result.Status = ResponseStatus.Error;
                    result.Message = duplicatedMessage;
                    return result;
                }

                await _repository.AddAsync(vehicle);

                result.Data = vehicle;
                result.Status = ResponseStatus.Success;
                result.Message = $"Veículo {vehicle.Plate} cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "VehicleService.Add", vehicle);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o Veículo {vehicle.Plate} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Vehicle>> Update(Vehicle vehicle)
        {
            WebApiResponse<Vehicle> result = new();

            try
            {
                var duplicatedMessage = await CheckIfVehicleIsDuplicatedAndGetErrorMessage(vehicle);

                if (!string.IsNullOrEmpty(duplicatedMessage))
                {
                    var ex = new Exception(duplicatedMessage);
                    _logService.LogException(ex, "VehicleService.Update", vehicle);

                    result.Status = ResponseStatus.Error;
                    result.Message = duplicatedMessage;
                    return result;
                }

                await _repository.UpdateAsync(vehicle);

                result.Data = vehicle;
                result.Status = ResponseStatus.Success;
                result.Message = $"Veículo {vehicle.Plate} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "VehicleService.Update", vehicle);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do Veículo {vehicle.Plate} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Vehicle>> Remove(Vehicle vehicle)
        {
            WebApiResponse<Vehicle> result = new();

            try
            {
                if (await _tripRepository.AnyAsync(_ => _.VehicleId == vehicle.Id))
                {
                    var message =
                        $"Veículo {vehicle.Plate} não pode ser removido pois está vinculado à uma ou mais viagens.";
                    var ex = new Exception(message);
                    _logService.LogException(ex, "VehicleService.Remove", vehicle);

                    result.Data = vehicle;
                    result.Status = ResponseStatus.Warning;
                    result.Message = message;
                    return result;
                }

                await _repository.RemoveAsync(vehicle);

                result.Data = vehicle;
                result.Status = ResponseStatus.Success;
                result.Message = $"Veículo {vehicle.Plate} removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "VehicleService.Remove", vehicle);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o Veículo {vehicle.Plate} da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<Vehicle>>> FindAll()
        {
            WebApiResponse<IEnumerable<Vehicle>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Vehicle, FeatureToggleKeys.FleetModule))
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
                _logService.LogException(ex, "VehicleService.FindAll", null);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Veículos na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PagedResult<Vehicle>>> FindAllPaged(PagedRequest request)
        {
            WebApiResponse<PagedResult<Vehicle>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Vehicle, FeatureToggleKeys.FleetModule))
                {
                    result.Data = new PagedResult<Vehicle> { Items = [], TotalCount = 0 };
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                var filter = BuildFilter(request);
                var orderBy = BuildOrderBy(request);

                var (vehicles, totalCount) = await _repository.GetPagedAsync(
                    skip: (Math.Max(request.Page, 1) - 1) * Math.Max(request.PageSize, 1),
                    take: Math.Max(request.PageSize, 1),
                    filter: filter,
                    orderBy: orderBy,
                    asNoTracking: true
                );

                result.Data = new PagedResult<Vehicle> { Items = vehicles, TotalCount = totalCount };
                result.Status = ResponseStatus.Success;
                result.Message = $"{totalCount} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "VehicleService.FindAllPaged", request);
                result.Status = ResponseStatus.Error;
                result.Message = "Não foi possível acessar os registros de Veículos na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Vehicle>> FindById(Guid? id)
        {
            WebApiResponse<Vehicle> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Vehicle, FeatureToggleKeys.FleetModule))
                {
                    result.Data = null;
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhum Veículo com o ID {id} foi encontrado";
                    return result;
                }

                result.Data = await _repository.GetByIdAsync(id);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Veículo {result.Data.Plate} encontrado com sucesso"
                        : $"Nenhum Veículo com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "VehicleService.FindById", id);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Veículos na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Vehicle>> FindByPlate(string plate)
        {
            WebApiResponse<Vehicle> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Vehicle, FeatureToggleKeys.FleetModule))
                {
                    result.Data = null;
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhum Veículo com placa {plate} foi encontrado";
                    return result;
                }

                result.Data = await _repository.FirstOrDefaultAsync(_ => _.Plate.Equals(plate));
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Veículo {result.Data.Plate} encontrado com sucesso"
                        : $"Nenhum Veículo com placa {plate} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "VehicleService.FindByPlate", plate);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Veículos na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<Vehicle>>> FindAvailable()
        {
            WebApiResponse<IEnumerable<Vehicle>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Vehicle, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                result.Data = await _repository.QueryAsync(_ =>
                    _.Status == VehicleStatus.Available
                );
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "VehicleService.FindAvailable", null);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Veículos na base de dados.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        /// <summary>
        /// Known sort fields exposed by the Vehicles grid, mapped to the Vehicle property they
        /// sort by - an unrecognized SortField (or none) falls back to the repository's own
        /// default (CreateDate) ordering.
        /// </summary>
        private static readonly Dictionary<string, Expression<Func<Vehicle, object>>> SortMap = new()
        {
            ["plate"] = v => v.Plate,
            ["brand"] = v => v.Brand,
            ["model"] = v => v.Model,
            ["seatCapacity"] = v => v.SeatCapacity,
            ["type"] = v => v.Type,
            ["status"] = v => v.Status,
            ["pricePerKm"] = v => v.PricePerKm,
            ["dailyRate"] = v => v.DailyRate,
        };

        /// <summary>
        /// Quick filter OR's across the grid's own visible text columns.
        /// </summary>
        private static Expression<Func<Vehicle, bool>> BuildFilter(PagedRequest request)
        {
            var quickFilter = request.QuickFilter;
            var hasQuickFilter = !string.IsNullOrWhiteSpace(quickFilter);

            return v =>
                !hasQuickFilter
                || v.Plate.Contains(quickFilter)
                || v.Brand.Contains(quickFilter)
                || v.Model.Contains(quickFilter);
        }

        private static Func<IQueryable<Vehicle>, IOrderedQueryable<Vehicle>> BuildOrderBy(
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
        /// Should verify if the Vehicle is already being registered on the database.
        /// </summary>
        /// <param name="vehicle">The Vehicle object that is being added or updated.</param>
        /// <returns>The error message when Vehicle is duplicated. Otherwise an empty string.</returns>
        private async Task<string> CheckIfVehicleIsDuplicatedAndGetErrorMessage(Vehicle vehicle)
        {
            if (await IsPlateDuplicated(vehicle))
            {
                return $"Já existe um Veículo cadastrado com a placa {vehicle.Plate}.";
            }

            return string.Empty;
        }

        /// <summary>
        /// Should verify if the Vehicle plate is already being used by another register on the database.
        /// </summary>
        /// <param name="vehicle">The Vehicle object that is being added or updated.</param>
        /// <returns>True when the Plate is duplicated; Otherwise false.</returns>
        private Task<bool> IsPlateDuplicated(Vehicle vehicle)
        {
            return _repository.AnyAsync(_ =>
                _.Id != vehicle.Id && !string.IsNullOrEmpty(_.Plate) && _.Plate == vehicle.Plate
            );
        }

        #endregion Private methods
    }
}
