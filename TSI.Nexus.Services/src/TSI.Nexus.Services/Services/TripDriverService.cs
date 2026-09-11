using AutoMapper;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class TripDriverService : ITripDriverService
    {
        #region Properties

        private readonly IRepository<TripDriver> _repository;
        private readonly IRepository<Trip> _tripRepository;
        private readonly IRepository<Payment> _paymentRepository;
        private readonly IMapper _mapper;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        public TripDriverService(
            IRepository<TripDriver> repository,
            IRepository<Trip> tripRepository,
            IRepository<Payment> paymentRepository,
            IMapper mapper,
            ILogService logService
        )
        {
            _repository = repository;
            _tripRepository = tripRepository;
            _paymentRepository = paymentRepository;
            _mapper = mapper;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TripDriverDto>> Add(TripDriverDto tripDriverDto)
        {
            WebApiResponse<TripDriverDto> result = new();

            try
            {
                var trip = await _tripRepository.GetByIdAsync(tripDriverDto.TripId);
                if (trip == null)
                {
                    result.Status = ResponseStatus.Error;
                    result.Message = "Viagem não encontrada para associar o motorista.";
                    return result;
                }

                var alreadyLinked = await _repository.AnyAsync(td =>
                    td.TripId == tripDriverDto.TripId && td.DriverId == tripDriverDto.DriverId
                );
                if (alreadyLinked)
                {
                    result.Status = ResponseStatus.Error;
                    result.Message = "Este motorista já está associado a esta viagem.";
                    return result;
                }

                var entity = _mapper.Map<TripDriver>(tripDriverDto);
                entity.PaymentId = null;
                await _repository.AddAsync(entity);

                var payment = BuildExpensePayment(trip, entity, tripDriverDto.DriverName);
                await _paymentRepository.AddAsync(payment);

                entity.PaymentId = payment.Id;
                await _repository.UpdateAsync(entity);

                tripDriverDto.Id = entity.Id;
                tripDriverDto.PaymentId = payment.Id;
                result.Data = tripDriverDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"Motorista {tripDriverDto.DriverName} associado à Viagem {trip.TripNumber} com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripDriverService.Add", tripDriverDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível associar o motorista {tripDriverDto?.DriverName} à viagem.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TripDriverDto>> Update(TripDriverDto tripDriverDto)
        {
            WebApiResponse<TripDriverDto> result = new();

            try
            {
                var existing = await _repository.GetByIdAsync(tripDriverDto.Id);
                if (existing == null)
                {
                    result.Status = ResponseStatus.Error;
                    result.Message = "Registro de motorista da viagem não encontrado.";
                    return result;
                }

                existing.Amount = tripDriverDto.Amount;
                await _repository.UpdateAsync(existing);

                if (existing.PaymentId != null)
                {
                    var payment = await _paymentRepository.GetByIdAsync(existing.PaymentId);
                    if (payment != null)
                    {
                        payment.Price = tripDriverDto.Amount;
                        await _paymentRepository.UpdateAsync(payment);
                    }
                }

                tripDriverDto.PaymentId = existing.PaymentId;
                result.Data = tripDriverDto;
                result.Status = ResponseStatus.Success;
                result.Message = "Valor do motorista atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripDriverService.Update", tripDriverDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar o valor do motorista.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TripDriverDto>> Remove(TripDriverDto tripDriverDto)
        {
            WebApiResponse<TripDriverDto> result = new();

            try
            {
                var existing = await _repository.GetByIdAsync(tripDriverDto.Id);
                if (existing == null)
                {
                    result.Status = ResponseStatus.Error;
                    result.Message = "Registro de motorista da viagem não encontrado.";
                    return result;
                }

                var paymentId = existing.PaymentId;
                await _repository.RemoveAsync(existing);

                if (paymentId != null)
                {
                    var payment = await _paymentRepository.GetByIdAsync(paymentId);
                    if (payment != null)
                    {
                        await _paymentRepository.RemoveAsync(payment);
                    }
                }

                result.Data = tripDriverDto;
                result.Status = ResponseStatus.Success;
                result.Message = "Motorista removido da viagem com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripDriverService.Remove", tripDriverDto);
                result.Status = ResponseStatus.Error;
                result.Message = $"Não foi possível remover o motorista da viagem.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<TripDriverDto>>> FindByTripId(Guid? tripId)
        {
            WebApiResponse<IEnumerable<TripDriverDto>> result = new();

            try
            {
                var items = await _repository.QueryAsync(
                    td => td.TripId == tripId,
                    td => td.Trip,
                    td => td.Driver
                );
                result.Data = _mapper.Map<IEnumerable<TripDriverDto>>(items);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripDriverService.FindByTripId", tripId);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os motoristas da Viagem {tripId}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<TripDriverDto>>> FindByDriverId(Guid? driverId)
        {
            WebApiResponse<IEnumerable<TripDriverDto>> result = new();

            try
            {
                var items = await _repository.QueryAsync(
                    td => td.DriverId == driverId,
                    td => td.Trip,
                    td => td.Driver
                );
                result.Data = _mapper.Map<IEnumerable<TripDriverDto>>(items);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripDriverService.FindByDriverId", driverId);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar as viagens do Motorista {driverId}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TripDriverDto>> FindById(Guid? id)
        {
            WebApiResponse<TripDriverDto> result = new();

            try
            {
                var item = await _repository.GetByIdAsync(id, td => td.Trip, td => td.Driver);
                result.Data = _mapper.Map<TripDriverDto>(item);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? "Motorista da viagem encontrado com sucesso"
                        : $"Nenhum registro de motorista da viagem com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripDriverService.FindById", id);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar o registro de motorista da viagem.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        private static Payment BuildExpensePayment(Trip trip, TripDriver tripDriver, string driverName)
        {
            return new Payment
            {
                Id = Guid.NewGuid(),
                Type = PaymentType.Outgoing,
                Status = PaymentStatus.Pending,
                Condition = PaymentCondition.FullPayment,
                Method = PaymentMethod.Cash,
                Category = "Motorista",
                Date = trip.Date,
                Description = $"Pagamento Motorista - {driverName} - Viagem {trip.TripNumber}",
                PaymentNumber = 1,
                Price = tripDriver.Amount,
                TransactionId = trip.TransactionId,
                TripId = trip.Id,
                DriverId = tripDriver.DriverId,
            };
        }

        #endregion Private methods
    }
}
