using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class TripLegService : ITripLegService
    {
        #region Properties

        private readonly IRepository<TripLeg> _repository;
        private readonly IFeatureToggleService _featureToggleService;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        public TripLegService(
            IRepository<TripLeg> repository,
            IFeatureToggleService featureToggleService,
            ILogService logService
        )
        {
            _repository = repository;
            _featureToggleService = featureToggleService;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TripLeg>> Add(TripLeg tripLeg)
        {
            WebApiResponse<TripLeg> result = new();

            try
            {
                await _repository.AddAsync(tripLeg);

                result.Data = tripLeg;
                result.Status = ResponseStatus.Success;
                result.Message = "Trecho da viagem cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripLegService.Add", tripLeg);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o trecho da viagem na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TripLeg>> Update(TripLeg tripLeg)
        {
            WebApiResponse<TripLeg> result = new();

            try
            {
                await _repository.UpdateAsync(tripLeg);

                result.Data = tripLeg;
                result.Status = ResponseStatus.Success;
                result.Message = "Trecho da viagem atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripLegService.Update", tripLeg);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar o trecho da viagem na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TripLeg>> Remove(TripLeg tripLeg)
        {
            WebApiResponse<TripLeg> result = new();

            try
            {
                await _repository.RemoveAsync(tripLeg);

                result.Data = tripLeg;
                result.Status = ResponseStatus.Success;
                result.Message = "Trecho da viagem removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripLegService.Remove", tripLeg);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o trecho da viagem da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TripLeg>> FindById(Guid? id)
        {
            WebApiResponse<TripLeg> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.TripLeg, FeatureToggleKeys.FleetModule))
                {
                    result.Data = null;
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhum trecho da viagem com o ID {id} foi encontrado";
                    return result;
                }

                result.Data = await _repository.GetByIdAsync(id);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? "Trecho da viagem encontrado com sucesso"
                        : $"Nenhum trecho da viagem com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripLegService.FindById", id);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de trechos de viagem na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<TripLeg>>> FindByTrip(Guid tripId)
        {
            WebApiResponse<IEnumerable<TripLeg>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.TripLeg, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                var legs = await _repository.QueryAsync(_ => _.TripId == tripId);
                result.Data = legs.OrderBy(l => l.SequenceNumber);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripLegService.FindByTrip", tripId);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de trechos de viagem na base de dados.";
            }

            return result;
        }

        #endregion Public methods
    }
}
