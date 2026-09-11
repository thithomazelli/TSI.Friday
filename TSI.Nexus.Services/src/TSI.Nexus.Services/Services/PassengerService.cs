using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class PassengerService : IPassengerService
    {
        #region Properties

        private readonly IRepository<Passenger> _repository;
        private readonly IFeatureToggleService _featureToggleService;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        public PassengerService(
            IRepository<Passenger> repository,
            IFeatureToggleService featureToggleService,
            ILogService logService
        )
        {
            _repository = repository;
            _featureToggleService = featureToggleService;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Passenger>> Add(Passenger passenger)
        {
            WebApiResponse<Passenger> result = new();

            try
            {
                await _repository.AddAsync(passenger);

                result.Data = passenger;
                result.Status = ResponseStatus.Success;
                result.Message = $"Passageiro {passenger.Name} cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PassengerService.Add", passenger);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o Passageiro {passenger.Name} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<Passenger>>> AddRange(
            IEnumerable<Passenger> passengers
        )
        {
            WebApiResponse<IEnumerable<Passenger>> result = new();
            var passengerList = passengers?.ToList() ?? new List<Passenger>();

            try
            {
                await _repository.AddRangeAsync(passengerList);

                result.Data = passengerList;
                result.Status = ResponseStatus.Success;
                result.Message = $"{passengerList.Count} passageiro(s) importado(s) com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PassengerService.AddRange", passengerList);

                result.Status = ResponseStatus.Error;
                result.Message = $"Não foi possível importar a lista de passageiros.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Passenger>> Update(Passenger passenger)
        {
            WebApiResponse<Passenger> result = new();

            try
            {
                await _repository.UpdateAsync(passenger);

                result.Data = passenger;
                result.Status = ResponseStatus.Success;
                result.Message = $"Passageiro {passenger.Name} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PassengerService.Update", passenger);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do Passageiro {passenger.Name} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Passenger>> Remove(Passenger passenger)
        {
            WebApiResponse<Passenger> result = new();

            try
            {
                await _repository.RemoveAsync(passenger);

                result.Data = passenger;
                result.Status = ResponseStatus.Success;
                result.Message = $"Passageiro {passenger.Name} removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PassengerService.Remove", passenger);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o Passageiro {passenger.Name} da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Passenger>> FindById(Guid? id)
        {
            WebApiResponse<Passenger> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Passenger, FeatureToggleKeys.FleetModule))
                {
                    result.Data = null;
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhum Passageiro com o ID {id} foi encontrado";
                    return result;
                }

                result.Data = await _repository.GetByIdAsync(id);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Passageiro {result.Data.Name} encontrado com sucesso"
                        : $"Nenhum Passageiro com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PassengerService.FindById", id);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Passageiros na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<Passenger>>> FindByTrip(Guid tripId)
        {
            WebApiResponse<IEnumerable<Passenger>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Passenger, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                result.Data = await _repository.QueryAsync(_ => _.TripId == tripId);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PassengerService.FindByTrip", tripId);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Passageiros na base de dados.";
            }

            return result;
        }

        #endregion Public methods
    }
}
