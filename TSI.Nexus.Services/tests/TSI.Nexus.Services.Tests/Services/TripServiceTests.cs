using System;
using System.Linq.Expressions;
using System.Threading.Tasks;
using AutoMapper;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;
using TSI.Nexus.IoC;

namespace TSI.Nexus.Services.Tests.Services
{
    public class TripServiceTests
    {
        private readonly TripService _tripService;
        private readonly Mock<IRepository<Trip>> _repository;
        private readonly Mock<IRepository<Vehicle>> _vehicleRepository;
        private readonly Mock<ITransactionService> _transactionService;
        private readonly Mock<IServiceOrderService> _serviceOrderService;
        private readonly Mock<ISequenceService> _sequenceService;
        private readonly Mock<ICurrentUserService> _currentUserService;
        private readonly Mock<IFeatureToggleService> _featureToggleService;
        private readonly Mock<ILogService> _logService;
        private readonly IList<TripDto> _tripListMock;
        private readonly IMapper _mapper;

        public TripServiceTests()
        {
            var config = new MapperConfiguration(
                cfg =>
                {
                    cfg.ConstructServicesUsing(type => null);
                    cfg.AddMaps(typeof(MappingProfile).Assembly);
                },
                new LoggerFactory()
            );
            _repository = new Mock<IRepository<Trip>>();
            _vehicleRepository = new Mock<IRepository<Vehicle>>();
            _transactionService = new Mock<ITransactionService>();
            _serviceOrderService = new Mock<IServiceOrderService>();
            _sequenceService = new Mock<ISequenceService>();
            _currentUserService = new Mock<ICurrentUserService>();
            _featureToggleService = new Mock<IFeatureToggleService>();
            _logService = new Mock<ILogService>();
            _mapper = config.CreateMapper();
            _tripService = new TripService(
                _repository.Object,
                _vehicleRepository.Object,
                _transactionService.Object,
                _serviceOrderService.Object,
                _sequenceService.Object,
                _currentUserService.Object,
                _featureToggleService.Object,
                _mapper,
                _logService.Object
            );

            // Default: current user is Admin, so ownership checks are bypassed unless a test overrides this.
            _currentUserService.Setup(_ => _.IsInRole("Admin")).Returns(true);

            // Default: fleet module enabled, so the toggle guard is bypassed unless a test overrides this.
            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(It.IsAny<string>()))
                .ReturnsAsync(true);
            _featureToggleService
                            .Setup(_ => _.IsEnabledAsync(It.IsAny<string>(), It.IsAny<string>()))
                            .ReturnsAsync(true);

            // Default: no vehicle found, so the vehicle-assignment check is safely skipped unless a
            // test overrides this.
            _vehicleRepository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Vehicle, bool>>>()))
                .ReturnsAsync(new List<Vehicle>());

            // Default: no previous Trip state found, so the Closed-transition auto-ServiceOrder
            // trigger and the ownership-by-id lookup are both safely skipped unless a test overrides this.
            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Trip, bool>>>()))
                .ReturnsAsync(new List<Trip>());

            _tripListMock = new List<TripDto>
            {
                new TripDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    TripNumber = "SER-V00001",
                    BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    BusinessPartnerName = "SER",
                    Transaction = new TransactionDto(),
                    TransactionId = Guid.Parse("00000000-0000-0000-0000-000000000000"),
                    QuoteNumber = string.Empty,
                },
                new TripDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    TripNumber = "THG-V00002",
                    BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    BusinessPartnerName = "THG",
                    Transaction = new TransactionDto(),
                    TransactionId = Guid.Parse("00000000-0000-0000-0000-000000000000"),
                    QuoteNumber = string.Empty,
                },
            };
        }

        [Fact]
        public async Task TripService_Add_ShouldAddTripSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var tripDto = new TripDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                TripNumber = "SER-V00001",
                BusinessPartnerName = "SER",
                Transaction = new TransactionDto(),
                QuoteNumber = string.Empty,
            };

            var transactionDto = new TransactionDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                TripId = Guid.Parse("00000000-0000-0000-0000-000000000003"),
            };

            _repository.Setup(r => r.AddAsync(It.IsAny<Trip>())).Returns(Task.CompletedTask);
            _transactionService
                .Setup(_ => _.Add(It.IsAny<TransactionDto>()))
                .ReturnsAsync(new WebApiResponse<TransactionDto> { Data = transactionDto });
            _sequenceService.Setup(_ => _.GetNextValue(It.IsAny<string>())).ReturnsAsync(1);

            // Act
            var result = await _tripService.Add(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal($"Viagem {tripDto.TripNumber} cadastrada com sucesso.", result.Message);
            _repository.Verify(r => r.AddAsync(It.IsAny<Trip>()), Times.Once);
        }

        [Fact]
        public async Task TripService_Add_ShouldReturnWarningAndNotAddTrip_WhenVehicleIsBlocked()
        {
            // Arrange
            var vehicleId = Guid.Parse("00000000-0000-0000-0000-000000000099");
            var tripDto = new TripDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                TripNumber = "SER-V00001",
                BusinessPartnerName = "SER",
                VehicleId = vehicleId,
                Transaction = new TransactionDto(),
                QuoteNumber = string.Empty,
            };

            var blockedVehicle = new Vehicle
            {
                Id = vehicleId,
                Plate = "ABC1D23",
                Status = VehicleStatus.Blocked,
            };

            _vehicleRepository.Setup(_ => _.GetByIdAsync(vehicleId)).ReturnsAsync(blockedVehicle);

            // Act
            var result = await _tripService.Add(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            Assert.Equal(
                $"O veículo {blockedVehicle.Plate} está bloqueado por manutenção vencida e não pode ser vinculado a uma viagem.",
                result.Message
            );
            _repository.Verify(r => r.AddAsync(It.IsAny<Trip>()), Times.Never);
        }

        [Fact]
        public async Task TripService_Add_ShouldCalculatePriceFromVehicleRates_WhenDistanceAndDailyCountAreInformed()
        {
            // Arrange
            var vehicleId = Guid.Parse("00000000-0000-0000-0000-000000000098");
            var tripDto = new TripDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                TripNumber = "SER-V00001",
                BusinessPartnerName = "SER",
                VehicleId = vehicleId,
                DistanceKm = 100,
                DailyCount = 2,
                Transaction = new TransactionDto(),
                QuoteNumber = string.Empty,
            };

            var availableVehicle = new Vehicle
            {
                Id = vehicleId,
                Plate = "ABC1D23",
                Status = VehicleStatus.Available,
                PricePerKm = 5.00M,
                DailyRate = 300.00M,
            };

            _vehicleRepository.Setup(_ => _.GetByIdAsync(vehicleId)).ReturnsAsync(availableVehicle);

            Trip capturedTrip = null;
            _repository
                .Setup(r => r.AddAsync(It.IsAny<Trip>()))
                .Callback<Trip>(t => capturedTrip = t)
                .Returns(Task.CompletedTask);
            _transactionService
                .Setup(_ => _.Add(It.IsAny<TransactionDto>()))
                .ReturnsAsync(
                    new WebApiResponse<TransactionDto> { Data = new TransactionDto { Id = Guid.NewGuid() } }
                );
            _sequenceService.Setup(_ => _.GetNextValue(It.IsAny<string>())).ReturnsAsync(1);

            // Act
            var result = await _tripService.Add(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(capturedTrip);
            // 100km * 5.00 + 2 daily * 300.00 = 500 + 600 = 1100
            Assert.Equal(1100.00M, capturedTrip.Price);
        }

        [Fact]
        public async Task TripService_Remove_ShouldRemoveTripSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var tripDto = _tripListMock.First();
            var tripEntity = _mapper.Map<Trip>(_tripListMock.First());

            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        It.IsAny<Guid>(),
                        t => t.TripLegs,
                        t => t.Passengers,
                        p => p.Transaction
                    )
                )
                .ReturnsAsync(tripEntity);
            _repository.Setup(r => r.RemoveAsync(It.IsAny<Trip>())).Returns(Task.CompletedTask);

            // Act
            var result = await _tripService.Remove(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal($"Viagem {tripDto.TripNumber} removida com sucesso.", result.Message);
            _repository.Verify(r => r.RemoveAsync(It.IsAny<Trip>()), Times.Once);
        }

        [Fact]
        public async Task TripService_Remove_ShouldReturnWarningAndNotRemove_WhenTripBelongsToAnotherUserAndCurrentUserIsNotAdmin()
        {
            // Arrange
            var tripDto = _tripListMock.First();
            var tripEntity = _mapper.Map<Trip>(_tripListMock.First());
            tripEntity.CreateUserId = "owner-user-id";

            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        It.IsAny<Guid>(),
                        t => t.TripLegs,
                        t => t.Passengers,
                        p => p.Transaction
                    )
                )
                .ReturnsAsync(tripEntity);

            _currentUserService.Setup(_ => _.IsInRole("Admin")).Returns(false);
            _currentUserService.Setup(_ => _.GetUserId()).Returns("another-user-id");

            // Act
            var result = await _tripService.Remove(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _repository.Verify(r => r.RemoveAsync(It.IsAny<Trip>()), Times.Never);
        }

        [Fact]
        public async Task TripService_FindById_ShouldReturnTrip_WhenIdIsValid()
        {
            // Arrange
            var id = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var tripDto = _tripListMock.First(t => t.Id == id);
            var tripEntity = _mapper.Map<Trip>(tripDto);
            tripEntity.BusinessPartner = new Individual { Name = "SER" };

            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        id,
                        t => t.BusinessPartner,
                        t => t.Vehicle,
                        t => t.Driver,
                        t => t.Transaction,
                        p => p.Transaction.Payments
                    )
                )
                .ReturnsAsync(tripEntity);

            // Act
            var result = await _tripService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal($"Viagem {tripDto.TripNumber} encontrada com sucesso", result.Message);
            _repository.Verify(
                r =>
                    r.GetByIdAsync(
                        id,
                        t => t.BusinessPartner,
                        t => t.Vehicle,
                        t => t.Driver,
                        t => t.Transaction,
                        p => p.Transaction.Payments
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task TripService_FindById_ShouldReturnWarning_WhenTripBelongsToAnotherUserAndCurrentUserIsNotAdmin()
        {
            // Arrange
            var id = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var tripDto = _tripListMock.First(t => t.Id == id);
            var tripEntity = _mapper.Map<Trip>(tripDto);
            tripEntity.CreateUserId = "owner-user-id";

            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        id,
                        t => t.BusinessPartner,
                        t => t.Vehicle,
                        t => t.Driver,
                        t => t.Transaction,
                        p => p.Transaction.Payments
                    )
                )
                .ReturnsAsync(tripEntity);

            _currentUserService.Setup(_ => _.IsInRole("Admin")).Returns(false);
            _currentUserService.Setup(_ => _.GetUserId()).Returns("another-user-id");

            // Act
            var result = await _tripService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task TripService_FindById_ShouldReturnTrip_WhenTripBelongsToCurrentUser()
        {
            // Arrange
            var id = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var tripDto = _tripListMock.First(t => t.Id == id);
            var tripEntity = _mapper.Map<Trip>(tripDto);
            tripEntity.CreateUserId = "owner-user-id";
            tripEntity.BusinessPartner = new Individual { Name = "SER" };

            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        id,
                        t => t.BusinessPartner,
                        t => t.Vehicle,
                        t => t.Driver,
                        t => t.Transaction,
                        p => p.Transaction.Payments
                    )
                )
                .ReturnsAsync(tripEntity);

            _currentUserService.Setup(_ => _.IsInRole("Admin")).Returns(false);
            _currentUserService.Setup(_ => _.GetUserId()).Returns("owner-user-id");

            // Act
            var result = await _tripService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(result.Data);
        }

        [Fact]
        public async Task TripService_FindById_ShouldReturnNoData_WhenIdIsNotFound()
        {
            // Arrange
            var id = Guid.Parse("00000000-0000-0000-0000-000000000010");
            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        id,
                        t => t.BusinessPartner,
                        t => t.Vehicle,
                        t => t.Driver,
                        t => t.Transaction,
                        p => p.Transaction.Payments
                    )
                )
                .ReturnsAsync((Trip)null);

            // Act
            var result = await _tripService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
            Assert.Equal($"Nenhuma Viagem com o ID {id} foi encontrada", result.Message);
        }

        [Fact]
        public async Task TripService_FindById_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            var id = Guid.Parse("00000000-0000-0000-0000-000000000001");
            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Trip, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _tripService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
            Assert.Equal($"Nenhuma Viagem com o ID {id} foi encontrada", result.Message);
        }

        [Fact]
        public async Task TripService_FindAll_ShouldReturnTrips_WhenDataExists()
        {
            // Arrange
            var tripsMock = _mapper.Map<IList<Trip>>(_tripListMock);
            tripsMock[0].BusinessPartner = new Individual { Name = "SER" };
            tripsMock[1].BusinessPartner = new Individual { Name = "THG" };
            _repository
                .Setup(r =>
                    r.GetAllAsync(
                        true,
                        t => t.BusinessPartner,
                        t => t.Vehicle,
                        t => t.Driver,
                        t => t.Transaction,
                        p => p.Payments
                    )
                )
                .ReturnsAsync(tripsMock);

            // Act
            var result = await _tripService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal($"{_tripListMock.Count} registro(s) encontrado(s).", result.Message);
            _repository.Verify(
                r =>
                    r.GetAllAsync(
                        true,
                        t => t.BusinessPartner,
                        t => t.Vehicle,
                        t => t.Driver,
                        t => t.Transaction,
                        p => p.Payments
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task TripService_FindAll_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Trip, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _tripService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data);
            Assert.Equal("0 registro(s) encontrado(s).", result.Message);
        }

        [Fact]
        public async Task TripService_FindAllPaged_ShouldReturnPagedTrips_WhenDataExists()
        {
            // Arrange
            var tripsMock = _mapper.Map<IList<Trip>>(_tripListMock);
            tripsMock[0].BusinessPartner = new Individual { Name = "SER" };
            tripsMock[1].BusinessPartner = new Individual { Name = "THG" };
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Trip, bool>>>(),
                        It.IsAny<Func<IQueryable<Trip>, IOrderedQueryable<Trip>>>(),
                        true,
                        It.IsAny<Expression<Func<Trip, object>>[]>()
                    )
                )
                .ReturnsAsync((tripsMock, tripsMock.Count));

            // Act
            var result = await _tripService.FindAllPaged(new PagedRequest { Page = 1, PageSize = 50 });

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(tripsMock.Count, result.Data!.TotalCount);
            Assert.Equal(tripsMock.Count, result.Data.Items.Count());
            Assert.Equal($"{tripsMock.Count} registro(s) encontrado(s).", result.Message);
        }

        [Fact]
        public async Task TripService_FindAllPaged_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Trip, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _tripService.FindAllPaged(new PagedRequest());

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data!.Items);
            Assert.Equal(0, result.Data.TotalCount);
            _repository.Verify(
                r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Trip, bool>>>(),
                        It.IsAny<Func<IQueryable<Trip>, IOrderedQueryable<Trip>>>(),
                        It.IsAny<bool>(),
                        It.IsAny<Expression<Func<Trip, object>>[]>()
                    ),
                Times.Never
            );
        }

        [Fact]
        public async Task TripService_FindAllPaged_ShouldComputeSkipAndTake_FromPageAndPageSize()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Trip, bool>>>(),
                        It.IsAny<Func<IQueryable<Trip>, IOrderedQueryable<Trip>>>(),
                        true,
                        It.IsAny<Expression<Func<Trip, object>>[]>()
                    )
                )
                .ReturnsAsync((new List<Trip>(), 0));

            // Act
            await _tripService.FindAllPaged(new PagedRequest { Page = 3, PageSize = 20 });

            // Assert
            _repository.Verify(
                r =>
                    r.GetPagedAsync(
                        40,
                        20,
                        It.IsAny<Expression<Func<Trip, bool>>>(),
                        It.IsAny<Func<IQueryable<Trip>, IOrderedQueryable<Trip>>>(),
                        true,
                        It.IsAny<Expression<Func<Trip, object>>[]>()
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task TripService_FindAllPaged_ShouldPassNullOrderBy_WhenSortFieldNotRequested()
        {
            // Arrange
            Func<IQueryable<Trip>, IOrderedQueryable<Trip>> capturedOrderBy = null;
            SetUpGetPagedAsyncCapture((_, orderBy) => capturedOrderBy = orderBy);

            // Act
            await _tripService.FindAllPaged(new PagedRequest { Page = 1, PageSize = 50 });

            // Assert
            Assert.Null(capturedOrderBy);
        }

        [Fact]
        public async Task TripService_FindAllPaged_ShouldPassOrderBy_WhenSortFieldRequested()
        {
            // Arrange
            Func<IQueryable<Trip>, IOrderedQueryable<Trip>> capturedOrderBy = null;
            SetUpGetPagedAsyncCapture((_, orderBy) => capturedOrderBy = orderBy);

            // Act
            await _tripService.FindAllPaged(
                new PagedRequest { Page = 1, PageSize = 50, SortField = "totalPrice", SortDescending = true }
            );

            // Assert
            Assert.NotNull(capturedOrderBy);
        }

        [Fact]
        public async Task TripService_FindAllPaged_FilterShouldMatchEverything_WhenNoFiltersRequested()
        {
            // Arrange
            Expression<Func<Trip, bool>> capturedFilter = null;
            SetUpGetPagedAsyncCapture((filter, _) => capturedFilter = filter);
            var trip = NewTripForFilterTests();

            // Act
            await _tripService.FindAllPaged(new PagedRequest { Page = 1, PageSize = 50 });

            // Assert
            Assert.True(capturedFilter.Compile()(trip));
        }

        [Fact]
        public async Task TripService_FindAllPaged_FilterShouldMatchOnlyQuickFilterHits()
        {
            // Arrange
            Expression<Func<Trip, bool>> capturedFilter = null;
            SetUpGetPagedAsyncCapture((filter, _) => capturedFilter = filter);
            var matching = NewTripForFilterTests(tripNumber: "SER-V00123");
            var nonMatching = NewTripForFilterTests(tripNumber: "THG-V00999");

            // Act
            await _tripService.FindAllPaged(new PagedRequest { Page = 1, PageSize = 50, QuickFilter = "00123" });

            // Assert
            var compiled = capturedFilter.Compile();
            Assert.True(compiled(matching));
            Assert.False(compiled(nonMatching));
        }

        [Fact]
        public async Task TripService_FindAllPaged_FilterShouldRespectDateRange()
        {
            // Arrange
            Expression<Func<Trip, bool>> capturedFilter = null;
            SetUpGetPagedAsyncCapture((filter, _) => capturedFilter = filter);
            var inRange = NewTripForFilterTests(createDate: new DateTime(2026, 3, 15));
            var before = NewTripForFilterTests(createDate: new DateTime(2026, 2, 28));
            var after = NewTripForFilterTests(createDate: new DateTime(2026, 4, 1));

            // Act
            await _tripService.FindAllPaged(
                new PagedRequest
                {
                    Page = 1,
                    PageSize = 50,
                    StartDate = new DateTime(2026, 3, 1),
                    EndDate = new DateTime(2026, 3, 31),
                }
            );

            // Assert
            var compiled = capturedFilter.Compile();
            Assert.True(compiled(inRange));
            Assert.False(compiled(before));
            Assert.False(compiled(after));
        }

        [Fact]
        public async Task TripService_FindAllPaged_FilterShouldRespectStatusList()
        {
            // Arrange
            Expression<Func<Trip, bool>> capturedFilter = null;
            SetUpGetPagedAsyncCapture((filter, _) => capturedFilter = filter);
            var open = NewTripForFilterTests(status: OrderStatus.Open);
            var closed = NewTripForFilterTests(status: OrderStatus.Closed);
            var waitingPayment = NewTripForFilterTests(status: OrderStatus.WaitingPayment);

            // Act
            await _tripService.FindAllPaged(
                new PagedRequest
                {
                    Page = 1,
                    PageSize = 50,
                    Statuses = new List<string> { "Open", "Closed" },
                }
            );

            // Assert
            var compiled = capturedFilter.Compile();
            Assert.True(compiled(open));
            Assert.True(compiled(closed));
            Assert.False(compiled(waitingPayment));
        }

        private static Trip NewTripForFilterTests(
            string tripNumber = "SER-V00001",
            string route = "Route",
            DateTime? createDate = null,
            OrderStatus status = OrderStatus.Open
        ) =>
            new()
            {
                TripNumber = tripNumber,
                Route = route,
                CreateDate = createDate ?? DateTime.UtcNow,
                Status = status,
                BusinessPartner = new Individual { Name = "Cliente Teste" },
            };

        private void SetUpGetPagedAsyncCapture(
            Action<Expression<Func<Trip, bool>>, Func<IQueryable<Trip>, IOrderedQueryable<Trip>>> onCaptured
        )
        {
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Trip, bool>>>(),
                        It.IsAny<Func<IQueryable<Trip>, IOrderedQueryable<Trip>>>(),
                        true,
                        It.IsAny<Expression<Func<Trip, object>>[]>()
                    )
                )
                .Callback<
                    int,
                    int,
                    Expression<Func<Trip, bool>>,
                    Func<IQueryable<Trip>, IOrderedQueryable<Trip>>,
                    bool,
                    Expression<Func<Trip, object>>[]
                >((_, _, filter, orderBy, _, _) => onCaptured(filter, orderBy))
                .ReturnsAsync((new List<Trip>(), 0));
        }

        [Fact]
        public async Task TripService_Update_ShouldGenerateServiceOrder_WhenTripTransitionsToClosedWithDriverAssigned()
        {
            // Arrange
            var tripId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var driverId = Guid.Parse("00000000-0000-0000-0000-000000000077");
            var tripDto = new TripDto
            {
                Id = tripId,
                TripNumber = "SER-V00001",
                Status = OrderStatus.Closed,
                DriverId = driverId,
                Transaction = new TransactionDto(),
            };

            var previousTrip = new Trip
            {
                Id = tripId,
                Status = OrderStatus.Open,
                DriverId = driverId,
            };

            _repository.Setup(r => r.GetByIdAsync(tripId)).ReturnsAsync(previousTrip);

            // Act
            await _tripService.Update(tripDto);

            // Assert
            _serviceOrderService.Verify(
                _ => _.GenerateForTrip(It.Is<Trip>(t => t.Id == tripId)),
                Times.Once
            );
        }

        [Fact]
        public async Task TripService_Update_ShouldNotGenerateServiceOrder_WhenTripWasAlreadyClosed()
        {
            // Arrange
            var tripId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var driverId = Guid.Parse("00000000-0000-0000-0000-000000000077");
            var tripDto = new TripDto
            {
                Id = tripId,
                TripNumber = "SER-V00001",
                Status = OrderStatus.Closed,
                DriverId = driverId,
                Transaction = new TransactionDto(),
            };

            var previousTrip = new Trip
            {
                Id = tripId,
                Status = OrderStatus.Closed,
                DriverId = driverId,
            };

            _repository.Setup(r => r.GetByIdAsync(tripId)).ReturnsAsync(previousTrip);

            // Act
            await _tripService.Update(tripDto);

            // Assert
            _serviceOrderService.Verify(_ => _.GenerateForTrip(It.IsAny<Trip>()), Times.Never);
        }

        [Fact]
        public async Task TripService_Update_ShouldReturnWarningAndNotUpdate_WhenTripBelongsToAnotherUserAndCurrentUserIsNotAdmin()
        {
            // Arrange
            var tripId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var tripDto = new TripDto
            {
                Id = tripId,
                TripNumber = "SER-V00001",
                Transaction = new TransactionDto(),
            };

            var existingTrip = new Trip { Id = tripId, CreateUserId = "owner-user-id" };

            _repository.Setup(r => r.GetByIdAsync(tripId)).ReturnsAsync(existingTrip);

            _currentUserService.Setup(_ => _.IsInRole("Admin")).Returns(false);
            _currentUserService.Setup(_ => _.GetUserId()).Returns("another-user-id");

            // Act
            var result = await _tripService.Update(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _repository.Verify(r => r.UpdateAsync(It.IsAny<Trip>()), Times.Never);
        }

        [Fact]
        public async Task TripService_FindByTripNumber_ShouldReturnNoData_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Trip, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _tripService.FindByTripNumber("SER-V00001");

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
            _repository.Verify(
                r =>
                    r.FirstOrDefaultAsync(
                        It.IsAny<Expression<Func<Trip, bool>>>(),
                        It.IsAny<Expression<Func<Trip, object>>[]>()
                    ),
                Times.Never
            );
        }

        [Fact]
        public async Task TripService_FindByBusinessPartnerId_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            var businessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Trip, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _tripService.FindByBusinessPartnerId(businessPartnerId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data);
        }

        [Fact]
        public async Task TripService_FindByDriverId_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            var driverId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Trip, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _tripService.FindByDriverId(driverId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data);
        }

        [Fact]
        public async Task TripService_FindByVehicleId_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            var vehicleId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Trip, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _tripService.FindByVehicleId(vehicleId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data);
        }

        [Fact]
        public async Task TripService_Add_ShouldReturnError_WhenSequenceServiceThrows()
        {
            // Arrange
            var tripDto = new TripDto { BusinessPartnerName = "SER", QuoteNumber = string.Empty };
            _sequenceService
                .Setup(_ => _.GetNextValue(It.IsAny<string>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _tripService.Add(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TripService_Add_ShouldReturnWarning_WhenVehicleIsNotFound()
        {
            // Arrange
            var vehicleId = Guid.Parse("00000000-0000-0000-0000-000000000097");
            var tripDto = new TripDto
            {
                BusinessPartnerName = "SER",
                VehicleId = vehicleId,
                QuoteNumber = string.Empty,
            };

            _vehicleRepository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Vehicle, bool>>>()))
                .ReturnsAsync(new List<Vehicle>());

            // Act
            var result = await _tripService.Add(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            Assert.Equal("Veículo selecionado não foi encontrado.", result.Message);
        }

        [Fact]
        public async Task TripService_Add_ShouldReturnWarning_WhenVehicleIsInactive()
        {
            // Arrange
            var vehicleId = Guid.Parse("00000000-0000-0000-0000-000000000096");
            var tripDto = new TripDto
            {
                BusinessPartnerName = "SER",
                VehicleId = vehicleId,
                QuoteNumber = string.Empty,
            };
            var inactiveVehicle = new Vehicle
            {
                Id = vehicleId,
                Plate = "XYZ1D23",
                Status = VehicleStatus.Inactive,
            };

            _vehicleRepository.Setup(_ => _.GetByIdAsync(vehicleId)).ReturnsAsync(inactiveVehicle);

            // Act
            var result = await _tripService.Add(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            Assert.Equal(
                $"O veículo {inactiveVehicle.Plate} está inativo e não pode ser vinculado a uma viagem.",
                result.Message
            );
        }

        [Fact]
        public async Task TripService_Add_ShouldUseExistingTransactionId_WhenTransactionIdIsProvidedWithoutTransactionDto()
        {
            // Arrange
            var existingTransactionId = Guid.Parse("00000000-0000-0000-0000-000000000050");
            var tripDto = new TripDto
            {
                BusinessPartnerName = "SER",
                TransactionId = existingTransactionId,
                QuoteNumber = string.Empty,
            };

            _sequenceService.Setup(_ => _.GetNextValue(It.IsAny<string>())).ReturnsAsync(1);
            _transactionService
                .Setup(_ => _.FindById(existingTransactionId))
                .ReturnsAsync(
                    new WebApiResponse<TransactionDto>
                    {
                        Status = ResponseStatus.Success,
                        Data = new TransactionDto { Id = existingTransactionId },
                    }
                );

            Trip capturedEntity = null;
            _repository
                .Setup(r => r.AddAsync(It.IsAny<Trip>()))
                .Callback<Trip>(e => capturedEntity = e)
                .Returns(Task.CompletedTask);

            // Act
            var result = await _tripService.Add(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(existingTransactionId, capturedEntity.TransactionId);
        }

        [Fact]
        public async Task TripService_Add_ShouldNotChangeTransactionId_WhenTransactionFindByIdFails()
        {
            // Arrange
            var existingTransactionId = Guid.Parse("00000000-0000-0000-0000-000000000051");
            var tripDto = new TripDto
            {
                BusinessPartnerName = "SER",
                TransactionId = existingTransactionId,
                QuoteNumber = string.Empty,
            };

            _sequenceService.Setup(_ => _.GetNextValue(It.IsAny<string>())).ReturnsAsync(1);
            _transactionService
                .Setup(_ => _.FindById(existingTransactionId))
                .ReturnsAsync(new WebApiResponse<TransactionDto> { Status = ResponseStatus.Error });

            Trip capturedEntity = null;
            _repository
                .Setup(r => r.AddAsync(It.IsAny<Trip>()))
                .Callback<Trip>(e => capturedEntity = e)
                .Returns(Task.CompletedTask);

            // Act
            var result = await _tripService.Add(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(existingTransactionId, capturedEntity.TransactionId);
        }

        [Fact]
        public async Task TripService_Update_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var tripDto = new TripDto { Id = Guid.NewGuid(), TripNumber = "SER-V00001" };
            _repository
                .Setup(r => r.UpdateAsync(It.IsAny<Trip>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _tripService.Update(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TripService_Update_ShouldReturnWarning_WhenVehicleAssignmentFails()
        {
            // Arrange
            var vehicleId = Guid.Parse("00000000-0000-0000-0000-000000000095");
            var tripDto = new TripDto
            {
                Id = Guid.NewGuid(),
                TripNumber = "SER-V00001",
                VehicleId = vehicleId,
            };
            var blockedVehicle = new Vehicle
            {
                Id = vehicleId,
                Plate = "BLK1D23",
                Status = VehicleStatus.Blocked,
            };

            _vehicleRepository.Setup(_ => _.GetByIdAsync(vehicleId)).ReturnsAsync(blockedVehicle);

            // Act
            var result = await _tripService.Update(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _repository.Verify(r => r.UpdateAsync(It.IsAny<Trip>()), Times.Never);
        }

        [Fact]
        public async Task TripService_Update_ShouldNotGenerateServiceOrder_WhenNoPreviousTripStateExists()
        {
            // Arrange - previousStatus has no value (new/never-persisted trip id) skips the
            // Closed-transition auto-ServiceOrder trigger.
            var tripId = Guid.NewGuid();
            var tripDto = new TripDto
            {
                Id = tripId,
                TripNumber = "SER-V00001",
                Status = OrderStatus.Closed,
                DriverId = Guid.NewGuid(),
            };

            // Default repository QueryAsync setup already returns an empty list.

            // Act
            var result = await _tripService.Update(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _serviceOrderService.Verify(_ => _.GenerateForTrip(It.IsAny<Trip>()), Times.Never);
        }

        [Fact]
        public async Task TripService_Update_ShouldNotGenerateServiceOrder_WhenNoDriverIsAssigned()
        {
            // Arrange
            var tripId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var tripDto = new TripDto
            {
                Id = tripId,
                TripNumber = "SER-V00001",
                Status = OrderStatus.Closed,
                DriverId = null,
                Transaction = new TransactionDto(),
            };

            var previousTrip = new Trip { Id = tripId, Status = OrderStatus.Open, DriverId = null };
            _repository.Setup(r => r.GetByIdAsync(tripId)).ReturnsAsync(previousTrip);

            // Act
            await _tripService.Update(tripDto);

            // Assert
            _serviceOrderService.Verify(_ => _.GenerateForTrip(It.IsAny<Trip>()), Times.Never);
        }

        [Fact]
        public async Task TripService_Update_ShouldNotCallTransactionUpdate_WhenTransactionIsNull()
        {
            // Arrange
            var tripDto = new TripDto
            {
                Id = Guid.NewGuid(),
                TripNumber = "SER-V00001",
                Transaction = null,
            };

            // Act
            var result = await _tripService.Update(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data.Transaction);
            _transactionService.Verify(_ => _.Update(It.IsAny<TransactionDto>()), Times.Never);
        }

        [Fact]
        public async Task TripService_Update_ShouldKeepOriginalTransactionDto_WhenTransactionUpdateFails()
        {
            // Arrange - unlike PurchaseOrderService/QuoteService, TripService.Update keeps the
            // original tripDto.Transaction instance when the ITransactionService.Update call does
            // not report Success, instead of nulling it out beforehand.
            var originalTransactionDto = new TransactionDto { Id = Guid.NewGuid() };
            var tripDto = new TripDto
            {
                Id = Guid.NewGuid(),
                TripNumber = "SER-V00001",
                Transaction = originalTransactionDto,
            };
            _transactionService
                .Setup(_ => _.Update(It.IsAny<TransactionDto>()))
                .ReturnsAsync(new WebApiResponse<TransactionDto> { Status = ResponseStatus.Error });

            // Act
            var result = await _tripService.Update(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Same(originalTransactionDto, result.Data.Transaction);
        }

        [Fact]
        public async Task TripService_Remove_ShouldReturnError_WhenTripIsNotFound()
        {
            // Arrange
            var tripDto = new TripDto { Id = Guid.NewGuid(), TripNumber = "SER-V00001" };
            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        tripDto.Id,
                        t => t.TripLegs,
                        t => t.Passengers,
                        p => p.Transaction
                    )
                )
                .ReturnsAsync((Trip)null);

            // Act
            var result = await _tripService.Remove(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Null(result.Data);
            _repository.Verify(r => r.RemoveAsync(It.IsAny<Trip>()), Times.Never);
        }

        [Fact]
        public async Task TripService_Remove_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var tripDto = new TripDto { Id = Guid.NewGuid() };
            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        tripDto.Id,
                        t => t.TripLegs,
                        t => t.Passengers,
                        p => p.Transaction
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _tripService.Remove(tripDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TripService_FindAll_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetAllAsync(
                        true,
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _tripService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TripService_FindById_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        id,
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _tripService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TripService_FindByTripNumber_ShouldReturnTrip_WhenTripNumberIsValid()
        {
            // Arrange
            var trip = new Trip { Id = Guid.NewGuid(), TripNumber = "SER-V00001" };
            _repository
                .Setup(r =>
                    r.FirstOrDefaultAsync(
                        It.IsAny<Expression<Func<Trip, bool>>>(),
                        It.IsAny<Expression<Func<Trip, object>>[]>()
                    )
                )
                .ReturnsAsync(trip);

            // Act
            var result = await _tripService.FindByTripNumber("SER-V00001");

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(result.Data);
        }

        [Fact]
        public async Task TripService_FindByTripNumber_ShouldReturnNoData_WhenNotFound()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.FirstOrDefaultAsync(
                        It.IsAny<Expression<Func<Trip, bool>>>(),
                        It.IsAny<Expression<Func<Trip, object>>[]>()
                    )
                )
                .ReturnsAsync((Trip)null);

            // Act
            var result = await _tripService.FindByTripNumber("SER-V00099");

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task TripService_FindByTripNumber_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.FirstOrDefaultAsync(
                        It.IsAny<Expression<Func<Trip, bool>>>(),
                        It.IsAny<Expression<Func<Trip, object>>[]>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _tripService.FindByTripNumber("SER-V00001");

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TripService_FindByBusinessPartnerId_ShouldReturnTrips_WhenDataExists()
        {
            // Arrange
            var businessPartnerId = Guid.NewGuid();
            var trips = new List<Trip> { new() { Id = Guid.NewGuid(), BusinessPartnerId = businessPartnerId } };
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Trip, bool>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>()
                    )
                )
                .ReturnsAsync(trips);

            // Act
            var result = await _tripService.FindByBusinessPartnerId(businessPartnerId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Single(result.Data);
        }

        [Fact]
        public async Task TripService_FindByBusinessPartnerId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Trip, bool>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _tripService.FindByBusinessPartnerId(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TripService_FindByDriverId_ShouldReturnTrips_WhenDataExists()
        {
            // Arrange
            var driverId = Guid.NewGuid();
            var trips = new List<Trip> { new() { Id = Guid.NewGuid() } };
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Trip, bool>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>()
                    )
                )
                .ReturnsAsync(trips);

            // Act
            var result = await _tripService.FindByDriverId(driverId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Single(result.Data);
        }

        [Fact]
        public async Task TripService_FindByDriverId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Trip, bool>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _tripService.FindByDriverId(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TripService_FindByVehicleId_ShouldReturnTrips_WhenDataExists()
        {
            // Arrange
            var vehicleId = Guid.NewGuid();
            var trips = new List<Trip> { new() { Id = Guid.NewGuid(), VehicleId = vehicleId } };
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Trip, bool>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>()
                    )
                )
                .ReturnsAsync(trips);

            // Act
            var result = await _tripService.FindByVehicleId(vehicleId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Single(result.Data);
        }

        [Fact]
        public async Task TripService_FindByVehicleId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Trip, bool>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>(),
                        It.IsAny<Expression<Func<Trip, object>>>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _tripService.FindByVehicleId(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }
    }
}
