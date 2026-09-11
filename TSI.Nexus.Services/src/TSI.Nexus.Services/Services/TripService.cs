using System.Linq.Expressions;
using System.Text.RegularExpressions;
using AutoMapper;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class TripService : ITripService
    {
        #region Properties

        /// <summary>
        /// TripService constructor created to initialize the "_repository" using Dependency Injection.
        /// </summary>
        private readonly IRepository<Trip> _repository;
        private readonly IRepository<Vehicle> _vehicleRepository;
        private readonly ITransactionService _transactionService;
        private readonly IServiceOrderService _serviceOrderService;
        private readonly ISequenceService _sequenceService;
        private readonly ICurrentUserService _currentUserService;
        private readonly IFeatureToggleService _featureToggleService;
        private readonly IMapper _mapper;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        /// <summary>
        /// TripService constructor created to initialize the "_repository" using Dependency Injection.
        /// </summary>
        /// <param name="repository">IRepository<Trip> object used to initialize the internal variable using Dependency Injection.</param>
        public TripService(
            IRepository<Trip> repository,
            IRepository<Vehicle> vehicleRepository,
            ITransactionService transactionService,
            IServiceOrderService serviceOrderService,
            ISequenceService sequenceService,
            ICurrentUserService currentUserService,
            IFeatureToggleService featureToggleService,
            IMapper mapper,
            ILogService logService
        )
        {
            _repository = repository;
            _vehicleRepository = vehicleRepository;
            _transactionService = transactionService;
            _serviceOrderService = serviceOrderService;
            _sequenceService = sequenceService;
            _currentUserService = currentUserService;
            _featureToggleService = featureToggleService;
            _mapper = mapper;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TripDto>> Add(TripDto tripDto)
        {
            WebApiResponse<TripDto> result = new();

            try
            {
                var prefix = BuildPrefixFromBusinessPartnerName(tripDto.BusinessPartnerName);
                var next = await _sequenceService.GetNextValue("TripNumberSeq");
                tripDto.TripNumber = $"{prefix}-V{next:D5}";

                var tripEntity = _mapper.Map<Trip>(tripDto);

                var vehicleAssignmentMessage = await ApplyVehicleAssignmentAndGetErrorMessage(
                    tripEntity
                );
                if (!string.IsNullOrEmpty(vehicleAssignmentMessage))
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message = vehicleAssignmentMessage;
                    return result;
                }

                // tripEntity gets re-mapped from tripDto further down (once the Transaction has an
                // Id), so carry the vehicle-rate price computed above into the DTO or it would be
                // overwritten back to whatever the client originally sent.
                tripDto.Price = tripEntity.Price;

                // Save Transaction first (if provided) so we can assign TransactionId to Trip before saving Trip
                var transactionResult = new WebApiResponse<TransactionDto>();

                var transactionDto = tripDto.Transaction;
                if (transactionDto != null)
                {
                    transactionDto.TripNumber = tripDto.TripNumber;
                    transactionDto.Description = $"Transação da Viagem - {tripDto.TripNumber}";
                    transactionResult = await _transactionService.Add(transactionDto);
                    tripDto.Transaction = null;
                    tripDto.TransactionId = transactionResult.Data?.Id ?? null;
                }
                else if (tripDto.TransactionId != null)
                {
                    // If TransactionId was provided without full Transaction data, we can try to fetch it to ensure it exists
                    transactionResult = await _transactionService.FindById(
                        tripDto.TransactionId.Value
                    );
                    if (
                        transactionResult.Status == ResponseStatus.Success
                        && transactionResult.Data != null
                    )
                    {
                        tripDto.TransactionId = transactionResult.Data.Id;
                    }
                }

                tripEntity = _mapper.Map<Trip>(tripDto);

                await _repository.AddAsync(tripEntity);

                // Update Transaction
                if (transactionResult?.Data != null)
                {
                    transactionResult.Data.TripId = tripEntity.Id;
                    await _transactionService.UpdateTripId(transactionResult.Data);
                }

                // prepare response DTO
                var responseDto = _mapper.Map<TripDto>(tripEntity);

                result.Data = responseDto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Viagem {tripDto.TripNumber} cadastrada com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripService.Add", tripDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar a Viagem {tripDto?.TripNumber} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TripDto>> Update(TripDto tripDto)
        {
            WebApiResponse<TripDto> result = new();

            try
            {
                var tripEntity = _mapper.Map<Trip>(tripDto);

                var ownershipMessage = await GetOwnershipErrorMessageByTripId(tripEntity.Id);
                if (!string.IsNullOrEmpty(ownershipMessage))
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message = ownershipMessage;
                    return result;
                }

                var vehicleAssignmentMessage = await ApplyVehicleAssignmentAndGetErrorMessage(
                    tripEntity
                );
                if (!string.IsNullOrEmpty(vehicleAssignmentMessage))
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message = vehicleAssignmentMessage;
                    return result;
                }

                var previousTrips = await _repository.QueryAsync(t => t.Id == tripEntity.Id);
                var previousStatus = previousTrips.FirstOrDefault()?.Status;

                await _repository.UpdateAsync(tripEntity);

                if (
                    previousStatus.HasValue
                    && previousStatus.Value != OrderStatus.Closed
                    && tripEntity.Status == OrderStatus.Closed
                    && tripEntity.DriverId.HasValue
                )
                {
                    await _serviceOrderService.GenerateForTrip(tripEntity);
                }

                if (tripDto.Transaction != null)
                {
                    var transactionDto = tripDto.Transaction;
                    transactionDto.TripId = tripEntity.Id;

                    var updRes = await _transactionService.Update(transactionDto);
                    if (updRes.Status == ResponseStatus.Success && updRes.Data != null)
                    {
                        tripDto.Transaction = updRes.Data;
                    }
                }

                result.Data = _mapper.Map<TripDto>(tripEntity);
                result.Data.Transaction = tripDto.Transaction;

                result.Status = ResponseStatus.Success;
                result.Message = $"Viagem {tripDto.TripNumber} atualizada com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripService.Update", tripDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados da Viagem {tripDto?.TripNumber} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TripDto>> Remove(TripDto tripDto)
        {
            WebApiResponse<TripDto> result = new();

            try
            {
                var tripEntity = await _repository.GetByIdAsync(
                    tripDto.Id,
                    t => t.TripLegs,
                    t => t.Passengers,
                    p => p.Transaction
                );

                if (tripEntity == null)
                {
                    _logService.LogException(
                        new Exception($"Viagem {tripDto.TripNumber} não encontrada."),
                        "TripService.Remove",
                        tripDto
                    );
                    result.Data = null;
                    result.Status = ResponseStatus.Error;
                    result.Message = $"Viagem {tripDto.TripNumber} não encontrada.";
                    return result;
                }

                var ownershipMessage = GetOwnershipErrorMessage(tripEntity.CreateUserId);
                if (!string.IsNullOrEmpty(ownershipMessage))
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message = ownershipMessage;
                    return result;
                }

                await _repository.RemoveAsync(tripEntity);

                var transactionDto = _mapper.Map<TransactionDto>(tripEntity.Transaction);
                await _transactionService.Remove(transactionDto);

                result.Data = tripDto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Viagem {tripDto.TripNumber} removida com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripService.Remove", tripDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover a Viagem {tripDto?.TripNumber} da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<TripDto>>> FindAll()
        {
            WebApiResponse<IEnumerable<TripDto>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Trip, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                // asNoTracking: true - this is a pure list/grid read, never saved back.
                var trips = await _repository.GetAllAsync(
                    true,
                    t => t.BusinessPartner,
                    t => t.Vehicle,
                    t => t.Driver,
                    t => t.Transaction,
                    p => p.Payments
                );

                result.Data = _mapper.Map<IEnumerable<TripDto>>(trips);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripService.FindAll", null);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Viagens na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PagedResult<TripDto>>> FindAllPaged(PagedRequest request)
        {
            WebApiResponse<PagedResult<TripDto>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Trip, FeatureToggleKeys.FleetModule))
                {
                    result.Data = new PagedResult<TripDto> { Items = [], TotalCount = 0 };
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                var filter = BuildFilter(request);
                var orderBy = BuildOrderBy(request);

                var (trips, totalCount) = await _repository.GetPagedAsync(
                    skip: (Math.Max(request.Page, 1) - 1) * Math.Max(request.PageSize, 1),
                    take: Math.Max(request.PageSize, 1),
                    filter: filter,
                    orderBy: orderBy,
                    asNoTracking: true,
                    includes: [t => t.BusinessPartner, t => t.Vehicle, t => t.Driver]
                );

                result.Data = new PagedResult<TripDto>
                {
                    Items = _mapper.Map<IEnumerable<TripDto>>(trips),
                    TotalCount = totalCount,
                };
                result.Status = ResponseStatus.Success;
                result.Message = $"{totalCount} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripService.FindAllPaged", request);
                result.Status = ResponseStatus.Error;
                result.Message = "Não foi possível acessar os registros de Viagens na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TripDto>> FindById(Guid? id)
        {
            WebApiResponse<TripDto> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Trip, FeatureToggleKeys.FleetModule))
                {
                    result.Data = null;
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhuma Viagem com o ID {id} foi encontrada";
                    return result;
                }

                var trip = await _repository.GetByIdAsync(
                    id,
                    t => t.BusinessPartner,
                    t => t.Vehicle,
                    t => t.Driver,
                    t => t.Transaction,
                    p => p.Transaction.Payments
                );

                if (trip != null)
                {
                    var ownershipMessage = GetOwnershipErrorMessage(trip.CreateUserId);
                    if (!string.IsNullOrEmpty(ownershipMessage))
                    {
                        result.Status = ResponseStatus.Warning;
                        result.Message = ownershipMessage;
                        return result;
                    }
                }

                result.Data = _mapper.Map<TripDto>(trip);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Viagem {result.Data.TripNumber} encontrada com sucesso"
                        : $"Nenhuma Viagem com o ID {id} foi encontrada";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripService.FindById", id);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Viagens na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TripDto>> FindByTripNumber(string tripNumber)
        {
            WebApiResponse<TripDto> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Trip, FeatureToggleKeys.FleetModule))
                {
                    result.Data = null;
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhuma Viagem com o número {tripNumber} foi encontrada";
                    return result;
                }

                var trip = await _repository.FirstOrDefaultAsync(
                    t => t.TripNumber == tripNumber,
                    t => t.BusinessPartner,
                    t => t.Vehicle,
                    t => t.Driver,
                    p => p.Transaction
                );

                result.Data = _mapper.Map<TripDto>(trip);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Viagem {result.Data.TripNumber} encontrada com sucesso"
                        : $"Nenhuma Viagem com o número {tripNumber} foi encontrada";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripService.FindByTripNumber", tripNumber);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível buscar a Viagem pelo número {tripNumber}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<TripDto>>> FindByBusinessPartnerId(
            Guid? businessPartnerId
        )
        {
            WebApiResponse<IEnumerable<TripDto>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Trip, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                var trips = await _repository.QueryAsync(
                    t => t.BusinessPartnerId == businessPartnerId,
                    t => t.BusinessPartner,
                    t => t.Vehicle,
                    t => t.Driver,
                    p => p.Transaction
                );
                result.Data = _mapper.Map<IEnumerable<TripDto>>(trips);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "TripService.FindByBusinessPartnerId",
                    businessPartnerId
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar as Viagens do BusinessPartner {businessPartnerId}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<TripDto>>> FindByDriverId(Guid? driverId)
        {
            WebApiResponse<IEnumerable<TripDto>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Trip, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                // A Trip can have any number of drivers now (see TripDriver) - match on the
                // junction instead of the legacy single Trip.DriverId column.
                var trips = await _repository.QueryAsync(
                    t => t.TripDrivers.Any(td => td.DriverId == driverId),
                    t => t.BusinessPartner,
                    t => t.Vehicle,
                    t => t.Driver,
                    p => p.Transaction
                );
                result.Data = _mapper.Map<IEnumerable<TripDto>>(trips);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripService.FindByDriverId", driverId);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar as Viagens do Motorista {driverId}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<TripDto>>> FindByVehicleId(Guid? vehicleId)
        {
            WebApiResponse<IEnumerable<TripDto>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.Trip, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                var trips = await _repository.QueryAsync(
                    t => t.VehicleId == vehicleId,
                    t => t.BusinessPartner,
                    t => t.Vehicle,
                    t => t.Driver,
                    p => p.Transaction
                );
                result.Data = _mapper.Map<IEnumerable<TripDto>>(trips);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TripService.FindByVehicleId", vehicleId);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar as Viagens do Veículo {vehicleId}.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        /// <summary>
        /// Known sort fields exposed by the Trips grid, mapped to the Trip property they sort by -
        /// the grid only ever sends a column id it already knows about, so an unrecognized
        /// SortField (or none) falls back to the repository's own default (CreateDate) ordering.
        /// </summary>
        private static readonly Dictionary<string, Expression<Func<Trip, object>>> SortMap = new()
        {
            ["tripNumber"] = t => t.TripNumber,
            ["businessPartnerName"] = t => t.BusinessPartner.Name,
            ["route"] = t => t.Route,
            ["vehiclePlate"] = t => t.Vehicle.Plate,
            ["driverName"] = t => t.Driver.Name,
            ["totalPrice"] = t => t.TotalPrice,
            ["date"] = t => t.Date,
            ["status"] = t => t.Status,
        };

        /// <summary>
        /// Combines the quick filter (OR across the grid's own visible text columns), the
        /// date-range filter and the status filter - the same date-range + status checkbox panel
        /// the Trips list already had client-side, now applied server-side alongside pagination so
        /// switching pages doesn't drop it back to whatever page happens to be loaded.
        /// </summary>
        private static Expression<Func<Trip, bool>> BuildFilter(PagedRequest request)
        {
            var quickFilter = request.QuickFilter;
            var hasQuickFilter = !string.IsNullOrWhiteSpace(quickFilter);
            var startDate = request.StartDate?.Date;
            var endDate = request.EndDate?.Date;
            var statuses = EnumListParser.Parse<OrderStatus>(request.Statuses);
            var hasStatusFilter = statuses.Count > 0;

            return t =>
                (!hasQuickFilter
                    || t.TripNumber.Contains(quickFilter)
                    || t.Route.Contains(quickFilter)
                    || t.BusinessPartner.Name.Contains(quickFilter))
                && (startDate == null || t.CreateDate.Date >= startDate)
                && (endDate == null || t.CreateDate.Date <= endDate)
                && (!hasStatusFilter || statuses.Contains(t.Status));
        }

        private static Func<IQueryable<Trip>, IOrderedQueryable<Trip>> BuildOrderBy(PagedRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.SortField) || !SortMap.TryGetValue(request.SortField, out var keySelector))
            {
                return null;
            }

            return request.SortDescending
                ? q => q.OrderByDescending(keySelector)
                : q => q.OrderBy(keySelector);
        }

        /// <summary>
        /// Returns an error message when the current user is neither the creator of the Trip nor
        /// an Admin. Admins and requests with no resolvable current user (e.g. system/background
        /// jobs) always pass through.
        /// </summary>
        private string GetOwnershipErrorMessage(string createUserId)
        {
            if (_currentUserService == null || _currentUserService.IsInRole("Admin"))
            {
                return string.Empty;
            }

            var currentUserId = _currentUserService.GetUserId();

            if (string.IsNullOrEmpty(currentUserId) || string.IsNullOrEmpty(createUserId))
            {
                return string.Empty;
            }

            return createUserId == currentUserId
                ? string.Empty
                : "Você não tem permissão para acessar esta Viagem, pois foi criada por outro usuário.";
        }

        /// <summary>
        /// Looks up the Trip's original creator on the database and validates ownership. Used
        /// before Update, where the entity mapped from the incoming DTO has no CreateUserId yet.
        /// </summary>
        private async Task<string> GetOwnershipErrorMessageByTripId(Guid tripId)
        {
            if (_currentUserService == null || _currentUserService.IsInRole("Admin"))
            {
                return string.Empty;
            }

            var existingTrips = await _repository.QueryAsync(t => t.Id == tripId);
            var existing = existingTrips.FirstOrDefault();

            return existing == null ? string.Empty : GetOwnershipErrorMessage(existing.CreateUserId);
        }

        /// <summary>
        /// Validates that the Vehicle assigned to a Trip is available (not blocked by overdue
        /// maintenance nor inactive) and, when a distance/daily count is informed, calculates the
        /// trip Price from the Vehicle's price-per-km and daily rate.
        /// </summary>
        /// <param name="trip">The Trip entity being added or updated.</param>
        /// <returns>An error message when the Vehicle cannot be assigned; otherwise an empty string.</returns>
        private async Task<string> ApplyVehicleAssignmentAndGetErrorMessage(Trip trip)
        {
            if (trip.VehicleId == null || trip.VehicleId == Guid.Empty)
            {
                return string.Empty;
            }

            var vehicles = await _vehicleRepository.QueryAsync(v => v.Id == trip.VehicleId);
            var vehicle = vehicles.FirstOrDefault();

            if (vehicle == null)
            {
                return "Veículo selecionado não foi encontrado.";
            }

            if (vehicle.Status == VehicleStatus.Blocked)
            {
                return $"O veículo {vehicle.Plate} está bloqueado por manutenção vencida e não pode ser vinculado a uma viagem.";
            }

            if (vehicle.Status == VehicleStatus.Inactive)
            {
                return $"O veículo {vehicle.Plate} está inativo e não pode ser vinculado a uma viagem.";
            }

            if (trip.DistanceKm > 0 || trip.DailyCount > 0)
            {
                trip.Price = (vehicle.PricePerKm * trip.DistanceKm) + (vehicle.DailyRate * trip.DailyCount);
            }

            return string.Empty;
        }

        private static string BuildPrefixFromBusinessPartnerName(string businessPartnerName)
        {
            // Remove non-letter characters and whitespace, keep only A-Z letters
            var cleaned = string.Empty;
            if (!string.IsNullOrWhiteSpace(businessPartnerName))
            {
                cleaned = Regex.Replace(businessPartnerName.Normalize(), "[^A-Za-z]", string.Empty);
                cleaned = cleaned.ToUpperInvariant();
            }

            var letters = cleaned ?? string.Empty;

            char GetRandomLetter()
            {
                var rnd = Random.Shared;
                return (char)('A' + rnd.Next(0, 26));
            }

            string prefix;

            if (letters.Length >= 3)
            {
                var first = letters[0];
                var middle = letters[letters.Length / 2];
                var last = letters[letters.Length - 1];
                prefix = string.Concat(first, middle, last);
            }
            else
            {
                var chars = new List<char>();
                for (int i = 0; i < letters.Length; i++)
                    chars.Add(letters[i]);

                while (chars.Count < 3)
                    chars.Add(GetRandomLetter());

                prefix = new string(chars.ToArray());
            }

            return prefix;
        }

        #endregion Private methods
    }
}
