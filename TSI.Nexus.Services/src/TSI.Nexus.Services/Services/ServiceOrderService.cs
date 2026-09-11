using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class ServiceOrderService : IServiceOrderService
    {
        #region Properties

        private readonly IRepository<ServiceOrder> _repository;
        private readonly IRepository<Commission> _commissionRepository;
        private readonly IRepository<Driver> _driverRepository;
        private readonly ISequenceService _sequenceService;
        private readonly IFeatureToggleService _featureToggleService;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        public ServiceOrderService(
            IRepository<ServiceOrder> repository,
            IRepository<Commission> commissionRepository,
            IRepository<Driver> driverRepository,
            ISequenceService sequenceService,
            IFeatureToggleService featureToggleService,
            ILogService logService
        )
        {
            _repository = repository;
            _commissionRepository = commissionRepository;
            _driverRepository = driverRepository;
            _sequenceService = sequenceService;
            _featureToggleService = featureToggleService;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<ServiceOrder>> Add(ServiceOrder serviceOrder)
        {
            WebApiResponse<ServiceOrder> result = new();

            try
            {
                if (string.IsNullOrEmpty(serviceOrder.Number))
                {
                    serviceOrder.Number = await BuildNextNumberAsync();
                }

                await _repository.AddAsync(serviceOrder);

                result.Data = serviceOrder;
                result.Status = ResponseStatus.Success;
                result.Message = $"Ordem de Serviço {serviceOrder.Number} cadastrada com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "ServiceOrderService.Add", serviceOrder);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar a Ordem de Serviço na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<ServiceOrder>> Update(ServiceOrder serviceOrder)
        {
            WebApiResponse<ServiceOrder> result = new();

            try
            {
                if (
                    serviceOrder.Status == ServiceOrderStatus.Completed
                    && serviceOrder.CompletionDate == null
                )
                {
                    serviceOrder.CompletionDate = DateTime.UtcNow;
                }

                await _repository.UpdateAsync(serviceOrder);

                result.Data = serviceOrder;
                result.Status = ResponseStatus.Success;
                result.Message = $"Ordem de Serviço {serviceOrder.Number} atualizada com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "ServiceOrderService.Update", serviceOrder);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar a Ordem de Serviço na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<ServiceOrder>> Remove(ServiceOrder serviceOrder)
        {
            WebApiResponse<ServiceOrder> result = new();

            try
            {
                await _repository.RemoveAsync(serviceOrder);

                result.Data = serviceOrder;
                result.Status = ResponseStatus.Success;
                result.Message = $"Ordem de Serviço {serviceOrder.Number} removida com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "ServiceOrderService.Remove", serviceOrder);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover a Ordem de Serviço da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<ServiceOrder>> FindById(Guid? id)
        {
            WebApiResponse<ServiceOrder> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.ServiceOrder, FeatureToggleKeys.FleetModule))
                {
                    result.Data = null;
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhuma Ordem de Serviço com o ID {id} foi encontrada";
                    return result;
                }

                result.Data = await _repository.GetByIdAsync(id, s => s.Commission);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Ordem de Serviço {result.Data.Number} encontrada com sucesso"
                        : $"Nenhuma Ordem de Serviço com o ID {id} foi encontrada";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "ServiceOrderService.FindById", id);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Ordem de Serviço na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<ServiceOrder>>> FindByDriver(Guid driverId)
        {
            WebApiResponse<IEnumerable<ServiceOrder>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.ServiceOrder, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                result.Data = await _repository.QueryAsync(
                    _ => _.DriverId == driverId,
                    s => s.Commission
                );
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "ServiceOrderService.FindByDriver", driverId);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Ordem de Serviço na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<ServiceOrder>> GenerateForTrip(Trip trip)
        {
            WebApiResponse<ServiceOrder> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.ServiceOrder, FeatureToggleKeys.FleetModule))
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message =
                        "Não é possível gerar Ordem de Serviço: o módulo de Frota está desabilitado.";
                    return result;
                }

                if (trip.DriverId == null || trip.DriverId == Guid.Empty)
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message =
                        "Não é possível gerar Ordem de Serviço: a viagem não tem motorista vinculado.";
                    return result;
                }

                if (await _repository.AnyAsync(_ => _.TripId == trip.Id))
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message = "Já existe uma Ordem de Serviço gerada para esta viagem.";
                    return result;
                }

                var driver = await _driverRepository.GetByIdAsync(trip.DriverId.Value);

                if (driver == null)
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message = "Motorista vinculado à viagem não foi encontrado.";
                    return result;
                }

                var serviceOrder = new ServiceOrder
                {
                    Number = await BuildNextNumberAsync(),
                    TripId = trip.Id,
                    DriverId = trip.DriverId.Value,
                    VehicleId = trip.VehicleId,
                    IssueDate = DateTime.UtcNow,
                    CompletionDate = DateTime.UtcNow,
                    Description = $"OS gerada automaticamente para a viagem {trip.TripNumber}.",
                    Status = ServiceOrderStatus.Completed,
                };

                await _repository.AddAsync(serviceOrder);

                var commission = new Commission
                {
                    ServiceOrderId = serviceOrder.Id,
                    DriverId = driver.Id,
                    Percentage = driver.CommissionPercentage,
                    BaseAmount = trip.TotalPrice,
                    Amount = trip.TotalPrice * driver.CommissionPercentage / 100m,
                    Status = CommissionStatus.Pending,
                };

                await _commissionRepository.AddAsync(commission);

                serviceOrder.Commission = commission;

                result.Data = serviceOrder;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"Ordem de Serviço {serviceOrder.Number} e comissão de {commission.Amount:C} geradas automaticamente.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "ServiceOrderService.GenerateForTrip", trip);

                result.Status = ResponseStatus.Error;
                result.Message = $"Não foi possível gerar a Ordem de Serviço automaticamente.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        private async Task<string> BuildNextNumberAsync()
        {
            var next = await _sequenceService.GetNextValue("ServiceOrderNumberSeq");
            return $"OS-{next:D5}";
        }

        #endregion Private methods
    }
}
