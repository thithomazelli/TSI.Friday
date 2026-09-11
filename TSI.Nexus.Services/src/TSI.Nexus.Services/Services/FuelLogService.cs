using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class FuelLogService : IFuelLogService
    {
        #region Properties

        private readonly IRepository<FuelLog> _repository;
        private readonly IRepository<Vehicle> _vehicleRepository;
        private readonly IFeatureToggleService _featureToggleService;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        public FuelLogService(
            IRepository<FuelLog> repository,
            IRepository<Vehicle> vehicleRepository,
            IFeatureToggleService featureToggleService,
            ILogService logService
        )
        {
            _repository = repository;
            _vehicleRepository = vehicleRepository;
            _featureToggleService = featureToggleService;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<FuelLog>> Add(FuelLog fuelLog)
        {
            WebApiResponse<FuelLog> result = new();

            try
            {
                if (fuelLog.TotalCost == 0 && fuelLog.Liters > 0 && fuelLog.PricePerLiter > 0)
                {
                    fuelLog.TotalCost = fuelLog.Liters * fuelLog.PricePerLiter;
                }

                await _repository.AddAsync(fuelLog);
                await SyncVehicleOdometerAsync(fuelLog.VehicleId, fuelLog.Odometer);

                result.Data = fuelLog;
                result.Status = ResponseStatus.Success;
                result.Message = "Abastecimento cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "FuelLogService.Add", fuelLog);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o abastecimento na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<FuelLog>> Update(FuelLog fuelLog)
        {
            WebApiResponse<FuelLog> result = new();

            try
            {
                await _repository.UpdateAsync(fuelLog);

                result.Data = fuelLog;
                result.Status = ResponseStatus.Success;
                result.Message = "Abastecimento atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "FuelLogService.Update", fuelLog);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar o abastecimento na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<FuelLog>> Remove(FuelLog fuelLog)
        {
            WebApiResponse<FuelLog> result = new();

            try
            {
                await _repository.RemoveAsync(fuelLog);

                result.Data = fuelLog;
                result.Status = ResponseStatus.Success;
                result.Message = "Abastecimento removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "FuelLogService.Remove", fuelLog);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o abastecimento da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<FuelLog>>> FindAll()
        {
            WebApiResponse<IEnumerable<FuelLog>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.FuelLog, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                result.Data = await _repository.GetAllAsync(f => f.Vehicle);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "FuelLogService.FindAll", null);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de abastecimento na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<FuelLog>> FindById(Guid? id)
        {
            WebApiResponse<FuelLog> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.FuelLog, FeatureToggleKeys.FleetModule))
                {
                    result.Data = null;
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhum abastecimento com o ID {id} foi encontrado";
                    return result;
                }

                result.Data = await _repository.GetByIdAsync(id);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? "Abastecimento encontrado com sucesso"
                        : $"Nenhum abastecimento com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "FuelLogService.FindById", id);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de abastecimento na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<FuelLog>>> FindByVehicle(Guid vehicleId)
        {
            WebApiResponse<IEnumerable<FuelLog>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.FuelLog, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                result.Data = await _repository.QueryAsync(_ => _.VehicleId == vehicleId);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "FuelLogService.FindByVehicle", vehicleId);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de abastecimento na base de dados.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        /// <summary>
        /// Keeps Vehicle.Odometer in sync with the highest reading registered in a fuel log, so the
        /// vehicle's current mileage is always available for maintenance scheduling decisions.
        /// </summary>
        private async Task SyncVehicleOdometerAsync(Guid vehicleId, int odometer)
        {
            if (odometer <= 0)
            {
                return;
            }

            var vehicle = await _vehicleRepository.GetByIdAsync(vehicleId);

            if (vehicle != null && odometer > vehicle.Odometer)
            {
                vehicle.Odometer = odometer;
                await _vehicleRepository.UpdateAsync(vehicle);
            }
        }

        #endregion Private methods
    }
}
