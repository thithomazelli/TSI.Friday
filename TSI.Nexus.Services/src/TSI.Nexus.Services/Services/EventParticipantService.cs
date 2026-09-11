using AutoMapper;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class EventParticipantService : IEventParticipantService
    {
        #region Properties

        private readonly IRepository<EventParticipant> _repository;
        private readonly IRepository<User> _userRepository;
        private readonly IMapper _mapper;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        public EventParticipantService(
            IRepository<EventParticipant> repository,
            IRepository<User> userRepository,
            IMapper mapper,
            ILogService logService
        )
        {
            _repository = repository;
            _userRepository = userRepository;
            _mapper = mapper;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<EventParticipantDto>> Add(
            EventParticipantDto eventParticipantDto
        )
        {
            WebApiResponse<EventParticipantDto> result = new();

            try
            {
                var hasUser = !string.IsNullOrEmpty(eventParticipantDto.UserId);
                var hasContact =
                    !string.IsNullOrEmpty(eventParticipantDto.Name)
                    || !string.IsNullOrEmpty(eventParticipantDto.Email);

                if (!hasUser && !hasContact)
                {
                    result.Status = ResponseStatus.Error;
                    result.Message =
                        "Informe um usuário cadastrado ou o nome/e-mail do participante.";
                    return result;
                }

                var entity = _mapper.Map<EventParticipant>(eventParticipantDto);
                await _repository.AddAsync(entity);

                eventParticipantDto.Id = entity.Id;

                if (hasUser)
                {
                    var user = await _userRepository.GetByIdAsync(eventParticipantDto.UserId);
                    eventParticipantDto.DisplayName = $"{user.FirstName} {user.LastName}".Trim();
                }
                else
                {
                    eventParticipantDto.DisplayName =
                        eventParticipantDto.Name ?? eventParticipantDto.Email;
                }

                result.Data = eventParticipantDto;
                result.Status = ResponseStatus.Success;
                result.Message = "Participante adicionado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "EventParticipantService.Add", eventParticipantDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível adicionar o participante na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<EventParticipantDto>> Remove(
            EventParticipantDto eventParticipantDto
        )
        {
            WebApiResponse<EventParticipantDto> result = new();

            try
            {
                var existing = await _repository.GetByIdAsync(eventParticipantDto.Id);

                await _repository.RemoveAsync(existing);

                result.Data = eventParticipantDto;
                result.Status = ResponseStatus.Success;
                result.Message = "Participante removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "EventParticipantService.Remove",
                    eventParticipantDto
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o participante da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<
            WebApiResponse<IEnumerable<EventParticipantDto>>
        > FindByEventId(Guid? eventId)
        {
            WebApiResponse<IEnumerable<EventParticipantDto>> result = new();

            try
            {
                var items = await _repository.QueryAsync(p => p.EventId == eventId);
                var dtos = _mapper.Map<IEnumerable<EventParticipantDto>>(items).ToList();

                var userIds = dtos
                    .Where(p => !string.IsNullOrEmpty(p.UserId))
                    .Select(p => p.UserId)
                    .Distinct()
                    .ToList();

                if (userIds.Count > 0)
                {
                    var users = await _userRepository.QueryAsync(u => userIds.Contains(u.Id));
                    var userNames = users.ToDictionary(
                        u => u.Id,
                        u => $"{u.FirstName} {u.LastName}".Trim()
                    );

                    foreach (var dto in dtos)
                    {
                        if (
                            !string.IsNullOrEmpty(dto.UserId)
                            && userNames.TryGetValue(dto.UserId, out var name)
                        )
                        {
                            dto.DisplayName = name;
                        }
                    }
                }

                result.Data = dtos;
                result.Status = ResponseStatus.Success;
                result.Message = $"{dtos.Count} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "EventParticipantService.FindByEventId", eventId);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os participantes do evento.";
            }

            return result;
        }

        #endregion Public methods
    }
}
