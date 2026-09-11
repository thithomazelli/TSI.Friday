using System.Linq.Expressions;
using AutoMapper;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class EventService : IEventService
    {
        #region Properties

        private readonly IRepository<Event> _repository;
        private readonly IRepository<User> _userRepository;
        private readonly ICurrentUserService _currentUserService;
        private readonly IMapper _mapper;
        private readonly ILogService _logService;

        // Every navigation the DTO needs to compute EventTypeName/Color, CreatedByUserName and
        // LinkedEntityType/Label - shared by every Find* method below. Participants.User is
        // deliberately not here (the generic repository's Include helper has no ThenInclude
        // support); participant display names are resolved separately in
        // ResolveParticipantNamesAsync.
        private static readonly Expression<Func<Event, object>>[] _includes =
        {
            e => e.EventType,
            e => e.CreatedByUser,
            e => e.BusinessPartner,
            e => e.Quote,
            e => e.Order,
            e => e.PurchaseOrder,
            e => e.Trip,
            e => e.Transaction,
            e => e.Payment,
            e => e.Vehicle,
            e => e.Driver,
            e => e.VehicleMaintenance,
            e => e.FuelLog,
            e => e.Participants,
        };

        #endregion Properties

        #region Public methods

        public EventService(
            IRepository<Event> repository,
            IRepository<User> userRepository,
            ICurrentUserService currentUserService,
            IMapper mapper,
            ILogService logService
        )
        {
            _repository = repository;
            _userRepository = userRepository;
            _currentUserService = currentUserService;
            _mapper = mapper;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<EventDto>> Add(EventDto eventDto)
        {
            WebApiResponse<EventDto> result = new();

            try
            {
                if (!HasAnyLink(eventDto))
                {
                    result.Status = ResponseStatus.Error;
                    result.Message =
                        "Selecione ao menos um cliente, pedido, transação, viagem ou outra entidade pra vincular o evento.";
                    return result;
                }

                // Always the logged-in user - never trust a CreatedByUserId sent by the client.
                eventDto.CreatedByUserId = _currentUserService.GetUserId();

                var entity = _mapper.Map<Event>(eventDto);
                await _repository.AddAsync(entity);

                eventDto.Id = entity.Id;
                result.Data = eventDto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Evento {eventDto.Title} cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "EventService.Add", eventDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o Evento {eventDto?.Title} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<EventDto>> Update(EventDto eventDto)
        {
            WebApiResponse<EventDto> result = new();

            try
            {
                if (!HasAnyLink(eventDto))
                {
                    result.Status = ResponseStatus.Error;
                    result.Message =
                        "Selecione ao menos um cliente, pedido, transação, viagem ou outra entidade pra vincular o evento.";
                    return result;
                }

                var entity = _mapper.Map<Event>(eventDto);
                await _repository.UpdateAsync(entity);

                result.Data = eventDto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Evento {eventDto.Title} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "EventService.Update", eventDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do Evento {eventDto?.Title} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<EventDto>> Remove(EventDto eventDto)
        {
            WebApiResponse<EventDto> result = new();

            try
            {
                var existing = await _repository.GetByIdAsync(eventDto.Id);

                await _repository.RemoveAsync(existing);

                result.Data = eventDto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Evento {eventDto.Title} removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "EventService.Remove", eventDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o Evento {eventDto?.Title} da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<EventDto>>> FindAll()
        {
            // asNoTracking: true - every Find* method here is a pure read mapped to a DTO, never
            // saved back; skipping change tracking matters more here than elsewhere given how wide
            // the shared _includes graph is.
            var items = await _repository.GetAllAsync(true, _includes);
            return await ToResponseAsync(items);
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<EventDto>> FindById(Guid? id)
        {
            WebApiResponse<EventDto> result = new();

            try
            {
                var item = await _repository.GetByIdAsync(id, true, _includes);
                result.Data = _mapper.Map<EventDto>(item);
                if (result.Data != null)
                {
                    await ResolveParticipantNamesAsync(new[] { result.Data });
                }
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Evento {result.Data.Title} encontrado com sucesso"
                        : $"Nenhum Evento com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "EventService.FindById", id);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Eventos na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<EventDto>>> FindByUserId(string userId)
        {
            var items = await _repository.QueryAsync(
                e => e.CreatedByUserId == userId || e.Participants.Any(p => p.UserId == userId),
                true,
                _includes
            );
            return await ToResponseAsync(items);
        }

        /// <inheritdoc />
        public async Task<
            WebApiResponse<IEnumerable<EventDto>>
        > FindByBusinessPartnerId(Guid? businessPartnerId)
        {
            var items = await _repository.QueryAsync(
                e =>
                    e.BusinessPartnerId == businessPartnerId
                    || (e.Order != null && e.Order.BusinessPartnerId == businessPartnerId)
                    || (
                        e.PurchaseOrder != null
                        && e.PurchaseOrder.BusinessPartnerId == businessPartnerId
                    )
                    || (e.Quote != null && e.Quote.BusinessPartnerId == businessPartnerId)
                    || (e.Trip != null && e.Trip.BusinessPartnerId == businessPartnerId)
                    || (
                        e.Transaction != null
                        && e.Transaction.BusinessPartnerId == businessPartnerId
                    )
                    || (e.Payment != null && e.Payment.BusinessPartnerId == businessPartnerId),
                true,
                _includes
            );
            return await ToResponseAsync(items);
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<EventDto>>> FindByQuoteId(Guid? quoteId)
        {
            var items = await _repository.QueryAsync(e => e.QuoteId == quoteId, true, _includes);
            return await ToResponseAsync(items);
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<EventDto>>> FindByOrderId(Guid? orderId)
        {
            var items = await _repository.QueryAsync(
                e =>
                    e.OrderId == orderId
                    || (e.Transaction != null && e.Transaction.OrderId == orderId)
                    || (e.Payment != null && e.Payment.OrderId == orderId),
                true,
                _includes
            );
            return await ToResponseAsync(items);
        }

        /// <inheritdoc />
        public async Task<
            WebApiResponse<IEnumerable<EventDto>>
        > FindByPurchaseOrderId(Guid? purchaseOrderId)
        {
            var items = await _repository.QueryAsync(
                e =>
                    e.PurchaseOrderId == purchaseOrderId
                    || (e.Transaction != null && e.Transaction.PurchaseOrderId == purchaseOrderId)
                    || (e.Payment != null && e.Payment.PurchaseOrderId == purchaseOrderId),
                true,
                _includes
            );
            return await ToResponseAsync(items);
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<EventDto>>> FindByTripId(Guid? tripId)
        {
            var items = await _repository.QueryAsync(
                e =>
                    e.TripId == tripId
                    || (e.Transaction != null && e.Transaction.TripId == tripId)
                    || (e.Payment != null && e.Payment.TripId == tripId),
                true,
                _includes
            );
            return await ToResponseAsync(items);
        }

        /// <inheritdoc />
        public async Task<
            WebApiResponse<IEnumerable<EventDto>>
        > FindByTransactionId(Guid? transactionId)
        {
            var items = await _repository.QueryAsync(
                e =>
                    e.TransactionId == transactionId
                    || (e.Payment != null && e.Payment.TransactionId == transactionId),
                true,
                _includes
            );
            return await ToResponseAsync(items);
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<EventDto>>> FindByPaymentId(Guid? paymentId)
        {
            var items = await _repository.QueryAsync(e => e.PaymentId == paymentId, true, _includes);
            return await ToResponseAsync(items);
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<EventDto>>> FindByVehicleId(Guid? vehicleId)
        {
            var items = await _repository.QueryAsync(e => e.VehicleId == vehicleId, true, _includes);
            return await ToResponseAsync(items);
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<EventDto>>> FindByDriverId(Guid? driverId)
        {
            var items = await _repository.QueryAsync(e => e.DriverId == driverId, true, _includes);
            return await ToResponseAsync(items);
        }

        /// <inheritdoc />
        public async Task<
            WebApiResponse<IEnumerable<EventDto>>
        > FindByVehicleMaintenanceId(Guid? vehicleMaintenanceId)
        {
            var items = await _repository.QueryAsync(
                e => e.VehicleMaintenanceId == vehicleMaintenanceId,
                true,
                _includes
            );
            return await ToResponseAsync(items);
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<EventDto>>> FindByFuelLogId(Guid? fuelLogId)
        {
            var items = await _repository.QueryAsync(e => e.FuelLogId == fuelLogId, true, _includes);
            return await ToResponseAsync(items);
        }

        #endregion Public methods

        #region Private methods

        private static bool HasAnyLink(EventDto eventDto) =>
            eventDto.BusinessPartnerId != null
            || eventDto.QuoteId != null
            || eventDto.OrderId != null
            || eventDto.PurchaseOrderId != null
            || eventDto.TripId != null
            || eventDto.TransactionId != null
            || eventDto.PaymentId != null
            || eventDto.VehicleId != null
            || eventDto.DriverId != null
            || eventDto.VehicleMaintenanceId != null
            || eventDto.FuelLogId != null;

        private async Task<WebApiResponse<IEnumerable<EventDto>>> ToResponseAsync(
            IEnumerable<Event> items
        )
        {
            WebApiResponse<IEnumerable<EventDto>> result = new();

            try
            {
                var dtos = _mapper.Map<IEnumerable<EventDto>>(items).ToList();
                await ResolveParticipantNamesAsync(dtos);

                result.Data = dtos;
                result.Status = ResponseStatus.Success;
                result.Message = $"{dtos.Count} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "EventService.ToResponseAsync", null);
                result.Status = ResponseStatus.Error;
                result.Message = $"Não foi possível acessar os registros de Eventos.";
            }

            return result;
        }

        // Participants.User isn't eager-loaded (see _includes comment), so participant display
        // names for system users are resolved here with one batched lookup instead of N+1 queries.
        private async Task ResolveParticipantNamesAsync(IEnumerable<EventDto> events)
        {
            var userIds = events
                .SelectMany(e => e.Participants)
                .Where(p => !string.IsNullOrEmpty(p.UserId))
                .Select(p => p.UserId)
                .Distinct()
                .ToList();

            if (userIds.Count == 0)
            {
                return;
            }

            var users = await _userRepository.QueryAsync(u => userIds.Contains(u.Id), true);
            var userNames = users.ToDictionary(u => u.Id, u => $"{u.FirstName} {u.LastName}".Trim());

            foreach (var eventDto in events)
            {
                foreach (var participant in eventDto.Participants)
                {
                    if (
                        !string.IsNullOrEmpty(participant.UserId)
                        && userNames.TryGetValue(participant.UserId, out var name)
                    )
                    {
                        participant.DisplayName = name;
                    }
                }
            }
        }

        #endregion Private methods
    }
}
