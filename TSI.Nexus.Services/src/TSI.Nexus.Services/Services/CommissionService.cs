using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class CommissionService : ICommissionService
    {
        #region Properties

        private readonly IRepository<Commission> _repository;
        private readonly IFeatureToggleService _featureToggleService;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        public CommissionService(
            IRepository<Commission> repository,
            IFeatureToggleService featureToggleService,
            ILogService logService
        )
        {
            _repository = repository;
            _featureToggleService = featureToggleService;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Commission>> Update(Commission commission)
        {
            WebApiResponse<Commission> result = new();

            try
            {
                if (commission.Status == CommissionStatus.Paid && commission.PaidDate == null)
                {
                    commission.PaidDate = DateTime.UtcNow;
                }

                await _repository.UpdateAsync(commission);

                result.Data = commission;
                result.Status = ResponseStatus.Success;
                result.Message = "Comissão atualizada com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "CommissionService.Update", commission);

                result.Status = ResponseStatus.Error;
                result.Message = $"Não foi possível atualizar a comissão na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Commission>> FindById(Guid? id)
        {
            WebApiResponse<Commission> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Commission, FeatureToggleKeys.FleetModule))
                {
                    result.Data = null;
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhuma comissão com o ID {id} foi encontrada";
                    return result;
                }

                result.Data = await _repository.GetByIdAsync(id);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? "Comissão encontrada com sucesso"
                        : $"Nenhuma comissão com o ID {id} foi encontrada";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "CommissionService.FindById", id);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de comissão na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<Commission>>> FindByDriver(Guid driverId)
        {
            WebApiResponse<IEnumerable<Commission>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Commission, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                result.Data = await _repository.QueryAsync(_ => _.DriverId == driverId);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "CommissionService.FindByDriver", driverId);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de comissão na base de dados.";
            }

            return result;
        }

        #endregion Public methods
    }
}
