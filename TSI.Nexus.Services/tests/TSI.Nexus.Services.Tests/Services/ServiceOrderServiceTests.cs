using System.Linq.Expressions;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services.Tests.Services
{
    public class ServiceOrderServiceTests
    {
        private readonly ServiceOrderService _service;
        private readonly Mock<IRepository<ServiceOrder>> _repository;
        private readonly Mock<IRepository<Commission>> _commissionRepository;
        private readonly Mock<IRepository<Driver>> _driverRepository;
        private readonly Mock<ISequenceService> _sequenceService;
        private readonly Mock<IFeatureToggleService> _featureToggleServiceMock;
        private readonly Mock<ILogService> _logServiceMock;

        public ServiceOrderServiceTests()
        {
            _repository = new Mock<IRepository<ServiceOrder>>();
            _commissionRepository = new Mock<IRepository<Commission>>();
            _driverRepository = new Mock<IRepository<Driver>>();
            _sequenceService = new Mock<ISequenceService>();
            _featureToggleServiceMock = new Mock<IFeatureToggleService>();
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(It.IsAny<string>()))
                .ReturnsAsync(true);
            _featureToggleServiceMock
                            .Setup(_ => _.IsEnabledAsync(It.IsAny<string>(), It.IsAny<string>()))
                            .ReturnsAsync(true);
            _logServiceMock = new Mock<ILogService>();
            _service = new ServiceOrderService(
                _repository.Object,
                _commissionRepository.Object,
                _driverRepository.Object,
                _sequenceService.Object,
                _featureToggleServiceMock.Object,
                _logServiceMock.Object
            );

            _sequenceService.Setup(_ => _.GetNextValue("ServiceOrderNumberSeq")).ReturnsAsync(1);
        }

        [Fact]
        public async Task ServiceOrderService_GenerateForTrip_ShouldReturnWarning_WhenTripHasNoDriver()
        {
            // Arrange
            var trip = new Trip { Id = Guid.NewGuid(), TripNumber = "VIA-001", DriverId = null };

            // Act
            var result = await _service.GenerateForTrip(trip);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _repository.Verify(_ => _.AddAsync(It.IsAny<ServiceOrder>()), Times.Never);
        }

        [Fact]
        public async Task ServiceOrderService_GenerateForTrip_ShouldReturnWarning_WhenFleetModuleDisabled()
        {
            // Arrange
            var trip = new Trip
            {
                Id = Guid.NewGuid(),
                TripNumber = "VIA-001",
                DriverId = Guid.NewGuid(),
                TotalPrice = 1000,
            };

            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.ServiceOrder, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _service.GenerateForTrip(trip);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _repository.Verify(_ => _.AddAsync(It.IsAny<ServiceOrder>()), Times.Never);
        }

        [Fact]
        public async Task ServiceOrderService_GenerateForTrip_ShouldReturnWarning_WhenServiceOrderAlreadyExistsForTrip()
        {
            // Arrange
            var driverId = Guid.NewGuid();
            var trip = new Trip
            {
                Id = Guid.NewGuid(),
                TripNumber = "VIA-001",
                DriverId = driverId,
                TotalPrice = 1000,
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<ServiceOrder, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _service.GenerateForTrip(trip);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _repository.Verify(_ => _.AddAsync(It.IsAny<ServiceOrder>()), Times.Never);
        }

        [Fact]
        public async Task ServiceOrderService_GenerateForTrip_ShouldCreateServiceOrderAndCommission_WhenDataIsValid()
        {
            // Arrange
            var driverId = Guid.NewGuid();
            var trip = new Trip
            {
                Id = Guid.NewGuid(),
                TripNumber = "VIA-001",
                DriverId = driverId,
                TotalPrice = 1000,
            };
            var driver = new Driver
            {
                Id = driverId,
                Name = "João da Silva",
                CommissionPercentage = 10,
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<ServiceOrder, bool>>>()))
                .ReturnsAsync(false);
            _driverRepository
                .Setup(_ => _.GetByIdAsync(driverId))
                .ReturnsAsync(driver);

            // Act
            var result = await _service.GenerateForTrip(trip);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("OS-00001", result.Data!.Number);
            Assert.NotNull(result.Data.Commission);
            Assert.Equal(100, result.Data.Commission!.Amount); // 1000 * 10%
            _repository.Verify(_ => _.AddAsync(It.IsAny<ServiceOrder>()), Times.Once);
            _commissionRepository.Verify(_ => _.AddAsync(It.IsAny<Commission>()), Times.Once);
        }

        [Fact]
        public async Task ServiceOrderService_GenerateForTrip_ShouldReturnWarning_WhenDriverIsNotFound()
        {
            // Arrange
            var driverId = Guid.NewGuid();
            var trip = new Trip
            {
                Id = Guid.NewGuid(),
                TripNumber = "VIA-001",
                DriverId = driverId,
                TotalPrice = 1000,
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<ServiceOrder, bool>>>()))
                .ReturnsAsync(false);
            _driverRepository
                .Setup(_ => _.GetByIdAsync(driverId))
                .ReturnsAsync((Driver)null);

            // Act
            var result = await _service.GenerateForTrip(trip);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _repository.Verify(_ => _.AddAsync(It.IsAny<ServiceOrder>()), Times.Never);
        }

        [Fact]
        public async Task ServiceOrderService_FindByDriver_ShouldReturnServiceOrdersForDriver()
        {
            // Arrange
            var driverId = Guid.NewGuid();
            var serviceOrders = new List<ServiceOrder>
            {
                new() { Id = Guid.NewGuid(), DriverId = driverId, Number = "OS-00001" },
            };

            _repository
                .Setup(_ =>
                    _.QueryAsync(
                        It.IsAny<Expression<Func<ServiceOrder, bool>>>(),
                        It.IsAny<Expression<Func<ServiceOrder, object>>[]>()
                    )
                )
                .ReturnsAsync(serviceOrders);

            // Act
            var result = await _service.FindByDriver(driverId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(serviceOrders, result.Data);
        }

        [Fact]
        public async Task ServiceOrderService_FindByDriver_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ =>
                    _.IsEnabledAsync(FeatureToggleKeys.ServiceOrder, FeatureToggleKeys.FleetModule)
                )
                .ReturnsAsync(false);

            // Act
            var result = await _service.FindByDriver(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data);
        }

        [Fact]
        public async Task ServiceOrderService_FindByDriver_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ =>
                    _.QueryAsync(
                        It.IsAny<Expression<Func<ServiceOrder, bool>>>(),
                        It.IsAny<Expression<Func<ServiceOrder, object>>[]>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.FindByDriver(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task ServiceOrderService_Add_ShouldBuildNumber_WhenNumberIsNotProvided()
        {
            // Arrange
            var serviceOrder = new ServiceOrder { Id = Guid.NewGuid() };

            // Act
            var result = await _service.Add(serviceOrder);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("OS-00001", serviceOrder.Number);
            _repository.Verify(_ => _.AddAsync(serviceOrder), Times.Once);
        }

        [Fact]
        public async Task ServiceOrderService_Add_ShouldKeepProvidedNumber_WhenNumberIsAlreadySet()
        {
            // Arrange
            var serviceOrder = new ServiceOrder { Id = Guid.NewGuid(), Number = "OS-CUSTOM" };

            // Act
            var result = await _service.Add(serviceOrder);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("OS-CUSTOM", serviceOrder.Number);
            _sequenceService.Verify(_ => _.GetNextValue(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task ServiceOrderService_Add_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var serviceOrder = new ServiceOrder { Id = Guid.NewGuid() };
            _repository.Setup(_ => _.AddAsync(serviceOrder)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Add(serviceOrder);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task ServiceOrderService_Update_ShouldSetCompletionDate_WhenStatusIsCompletedAndDateIsNull()
        {
            // Arrange
            var serviceOrder = new ServiceOrder
            {
                Id = Guid.NewGuid(),
                Status = ServiceOrderStatus.Completed,
                CompletionDate = null,
            };

            // Act
            var result = await _service.Update(serviceOrder);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(serviceOrder.CompletionDate);
            _repository.Verify(_ => _.UpdateAsync(serviceOrder), Times.Once);
        }

        [Fact]
        public async Task ServiceOrderService_Update_ShouldNotOverwriteCompletionDate_WhenAlreadySet()
        {
            // Arrange
            var completionDate = DateTime.UtcNow.AddDays(-1);
            var serviceOrder = new ServiceOrder
            {
                Id = Guid.NewGuid(),
                Status = ServiceOrderStatus.Completed,
                CompletionDate = completionDate,
            };

            // Act
            var result = await _service.Update(serviceOrder);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(completionDate, serviceOrder.CompletionDate);
        }

        [Fact]
        public async Task ServiceOrderService_Update_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var serviceOrder = new ServiceOrder { Id = Guid.NewGuid() };
            _repository.Setup(_ => _.UpdateAsync(serviceOrder)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Update(serviceOrder);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task ServiceOrderService_Remove_ShouldRemoveSuccessfully()
        {
            // Arrange
            var serviceOrder = new ServiceOrder { Id = Guid.NewGuid(), Number = "OS-00001" };

            // Act
            var result = await _service.Remove(serviceOrder);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _repository.Verify(_ => _.RemoveAsync(serviceOrder), Times.Once);
        }

        [Fact]
        public async Task ServiceOrderService_Remove_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var serviceOrder = new ServiceOrder { Id = Guid.NewGuid() };
            _repository.Setup(_ => _.RemoveAsync(serviceOrder)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Remove(serviceOrder);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task ServiceOrderService_FindById_ShouldReturnServiceOrder_WhenIdIsValid()
        {
            // Arrange
            var id = Guid.NewGuid();
            var serviceOrder = new ServiceOrder { Id = id, Number = "OS-00001" };
            _repository.Setup(_ => _.GetByIdAsync(id, s => s.Commission)).ReturnsAsync(serviceOrder);

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(serviceOrder, result.Data);
        }

        [Fact]
        public async Task ServiceOrderService_FindById_ShouldReturnNoData_WhenIdIsNotFound()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository.Setup(_ => _.GetByIdAsync(id, s => s.Commission)).ReturnsAsync((ServiceOrder)null);

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task ServiceOrderService_FindById_ShouldReturnNoData_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ =>
                    _.IsEnabledAsync(FeatureToggleKeys.ServiceOrder, FeatureToggleKeys.FleetModule)
                )
                .ReturnsAsync(false);

            // Act
            var result = await _service.FindById(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task ServiceOrderService_FindById_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository
                .Setup(_ => _.GetByIdAsync(id, s => s.Commission))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task ServiceOrderService_GenerateForTrip_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var trip = new Trip { Id = Guid.NewGuid(), DriverId = Guid.NewGuid() };
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<ServiceOrder, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.GenerateForTrip(trip);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }
    }
}
