using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class QuoteTripLegService : IQuoteTripLegService
    {
        #region Properties

        private readonly IRepository<QuoteTripLeg> _repository;
        private readonly IFeatureToggleService _featureToggleService;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        public QuoteTripLegService(
            IRepository<QuoteTripLeg> repository,
            IFeatureToggleService featureToggleService,
            ILogService logService
        )
        {
            _repository = repository;
            _featureToggleService = featureToggleService;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<QuoteTripLeg>> Add(QuoteTripLeg quoteTripLeg)
        {
            WebApiResponse<QuoteTripLeg> result = new();

            try
            {
                await _repository.AddAsync(quoteTripLeg);

                result.Data = quoteTripLeg;
                result.Status = ResponseStatus.Success;
                result.Message = "Trecho do itinerário cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteTripLegService.Add", quoteTripLeg);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o trecho do itinerário na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<QuoteTripLeg>> Update(QuoteTripLeg quoteTripLeg)
        {
            WebApiResponse<QuoteTripLeg> result = new();

            try
            {
                await _repository.UpdateAsync(quoteTripLeg);

                result.Data = quoteTripLeg;
                result.Status = ResponseStatus.Success;
                result.Message = "Trecho do itinerário atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteTripLegService.Update", quoteTripLeg);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar o trecho do itinerário na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<QuoteTripLeg>> Remove(QuoteTripLeg quoteTripLeg)
        {
            WebApiResponse<QuoteTripLeg> result = new();

            try
            {
                await _repository.RemoveAsync(quoteTripLeg);

                result.Data = quoteTripLeg;
                result.Status = ResponseStatus.Success;
                result.Message = "Trecho do itinerário removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteTripLegService.Remove", quoteTripLeg);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o trecho do itinerário da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<QuoteTripLeg>> FindById(Guid? id)
        {
            WebApiResponse<QuoteTripLeg> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.QuoteTripLeg, FeatureToggleKeys.FleetModule))
                {
                    result.Data = null;
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhum trecho do itinerário com o ID {id} foi encontrado";
                    return result;
                }

                result.Data = await _repository.GetByIdAsync(id);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? "Trecho do itinerário encontrado com sucesso"
                        : $"Nenhum trecho do itinerário com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteTripLegService.FindById", id);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de trechos de itinerário na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<QuoteTripLeg>>> FindByQuoteTrip(Guid quoteTripId)
        {
            WebApiResponse<IEnumerable<QuoteTripLeg>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.QuoteTripLeg, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                var legs = await _repository.QueryAsync(_ => _.QuoteTripId == quoteTripId);
                result.Data = legs.OrderBy(l => l.SequenceNumber);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteTripLegService.FindByQuoteTrip", quoteTripId);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de trechos de itinerário na base de dados.";
            }

            return result;
        }

        #endregion Public methods
    }
}
