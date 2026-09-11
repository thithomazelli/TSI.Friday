using System.Linq.Expressions;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services.Tests.Services
{
    public class FuelLogServiceTests
    {
        private readonly FuelLogService _service;
        private readonly Mock<IRepository<FuelLog>> _repository;
        private readonly Mock<IRepository<Vehicle>> _vehicleRepository;
        private readonly Mock<IFeatureToggleService> _featureToggleServiceMock;
        private readonly Mock<ILogService> _logServiceMock;
        private readonly Guid _vehicleId = Guid.Parse("00000000-0000-0000-0000-000000000010");

        public FuelLogServiceTests()
        {
            _repository = new Mock<IRepository<FuelLog>>();
            _vehicleRepository = new Mock<IRepository<Vehicle>>();
            _featureToggleServiceMock = new Mock<IFeatureToggleService>();
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(It.IsAny<string>()))
                .ReturnsAsync(true);
            _featureToggleServiceMock
                            .Setup(_ => _.IsEnabledAsync(It.IsAny<string>(), It.IsAny<string>()))
                            .ReturnsAsync(true);
            _logServiceMock = new Mock<ILogService>();
            _service = new FuelLogService(
                _repository.Object,
                _vehicleRepository.Object,
                _featureToggleServiceMock.Object,
                _logServiceMock.Object
            );
        }

        [Fact]
        public async Task FuelLogService_Add_ShouldCalculateTotalCost_WhenNotInformed()
        {
            // Arrange
            var vehicle = new Vehicle { Id = _vehicleId, Plate = "ABC1D23", Odometer = 1000 };
            var fuelLog = new FuelLog
            {
                Id = Guid.NewGuid(),
                VehicleId = _vehicleId,
                Liters = 50,
                PricePerLiter = 6,
                Odometer = 1500,
            };

            _vehicleRepository
                .Setup(_ => _.GetByIdAsync(_vehicleId))
                .ReturnsAsync(vehicle);

            // Act
            var result = await _service.Add(fuelLog);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(300, fuelLog.TotalCost);
            _repository.Verify(_ => _.AddAsync(fuelLog), Times.Once);
        }

        [Fact]
        public async Task FuelLogService_Add_ShouldUpdateVehicleOdometer_WhenReadingIsHigherThanCurrent()
        {
            // Arrange
            var vehicle = new Vehicle { Id = _vehicleId, Plate = "ABC1D23", Odometer = 1000 };
            var fuelLog = new FuelLog
            {
                Id = Guid.NewGuid(),
                VehicleId = _vehicleId,
                Liters = 50,
                PricePerLiter = 6,
                Odometer = 1500,
            };

            _vehicleRepository
                .Setup(_ => _.GetByIdAsync(_vehicleId))
                .ReturnsAsync(vehicle);

            // Act
            await _service.Add(fuelLog);

            // Assert
            Assert.Equal(1500, vehicle.Odometer);
            _vehicleRepository.Verify(_ => _.UpdateAsync(vehicle), Times.Once);
        }

        [Fact]
        public async Task FuelLogService_Add_ShouldNotUpdateVehicleOdometer_WhenReadingIsLowerThanCurrent()
        {
            // Arrange
            var vehicle = new Vehicle { Id = _vehicleId, Plate = "ABC1D23", Odometer = 2000 };
            var fuelLog = new FuelLog
            {
                Id = Guid.NewGuid(),
                VehicleId = _vehicleId,
                Liters = 50,
                PricePerLiter = 6,
                Odometer = 1500,
            };

            _vehicleRepository
                .Setup(_ => _.GetByIdAsync(_vehicleId))
                .ReturnsAsync(vehicle);

            // Act
            await _service.Add(fuelLog);

            // Assert
            Assert.Equal(2000, vehicle.Odometer);
            _vehicleRepository.Verify(_ => _.UpdateAsync(It.IsAny<Vehicle>()), Times.Never);
        }

        [Fact]
        public async Task FuelLogService_Update_ShouldUpdateFuelLogSuccessfully()
        {
            // Arrange
            var fuelLog = new FuelLog { Id = Guid.NewGuid(), VehicleId = _vehicleId };

            // Act
            var result = await _service.Update(fuelLog);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _repository.Verify(_ => _.UpdateAsync(fuelLog), Times.Once);
        }

        [Fact]
        public async Task FuelLogService_Remove_ShouldRemoveFuelLogSuccessfully()
        {
            // Arrange
            var fuelLog = new FuelLog { Id = Guid.NewGuid(), VehicleId = _vehicleId };

            // Act
            var result = await _service.Remove(fuelLog);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _repository.Verify(_ => _.RemoveAsync(fuelLog), Times.Once);
        }

        [Fact]
        public async Task FuelLogService_FindAll_ShouldReturnAllLogs()
        {
            // Arrange
            var logs = new List<FuelLog> { new() { Id = Guid.NewGuid(), VehicleId = _vehicleId } };
            _repository.Setup(_ => _.GetAllAsync(f => f.Vehicle)).ReturnsAsync(logs);

            // Act
            var result = await _service.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(logs, result.Data);
        }

        [Fact]
        public async Task FuelLogService_FindAll_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.FuelLog, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _service.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data);
        }

        [Fact]
        public async Task FuelLogService_FindAllPaged_ShouldReturnPagedLogs_WhenDataExists()
        {
            // Arrange
            var logs = new List<FuelLog> { new() { Id = Guid.NewGuid(), VehicleId = _vehicleId } };
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<FuelLog, bool>>>(),
                        It.IsAny<Func<IQueryable<FuelLog>, IOrderedQueryable<FuelLog>>>(),
                        true,
                        It.IsAny<Expression<Func<FuelLog, object>>[]>()
                    )
                )
                .ReturnsAsync((logs, logs.Count));

            // Act
            var result = await _service.FindAllPaged(new PagedRequest { Page = 1, PageSize = 50 });

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(logs.Count, result.Data!.TotalCount);
            Assert.Equal(logs.Count, result.Data.Items.Count());
        }

        [Fact]
        public async Task FuelLogService_FindAllPaged_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.FuelLog, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _service.FindAllPaged(new PagedRequest());

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data!.Items);
            Assert.Equal(0, result.Data.TotalCount);
        }

        [Fact]
        public async Task FuelLogService_FindAllPaged_ShouldComputeSkipAndTake_FromPageAndPageSize()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<FuelLog, bool>>>(),
                        It.IsAny<Func<IQueryable<FuelLog>, IOrderedQueryable<FuelLog>>>(),
                        true,
                        It.IsAny<Expression<Func<FuelLog, object>>[]>()
                    )
                )
                .ReturnsAsync((new List<FuelLog>(), 0));

            // Act
            await _service.FindAllPaged(new PagedRequest { Page = 2, PageSize = 25 });

            // Assert
            _repository.Verify(
                r =>
                    r.GetPagedAsync(
                        25,
                        25,
                        It.IsAny<Expression<Func<FuelLog, bool>>>(),
                        It.IsAny<Func<IQueryable<FuelLog>, IOrderedQueryable<FuelLog>>>(),
                        true,
                        It.IsAny<Expression<Func<FuelLog, object>>[]>()
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task FuelLogService_FindAllPaged_ShouldReturnErrorResult_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<FuelLog, bool>>>(),
                        It.IsAny<Func<IQueryable<FuelLog>, IOrderedQueryable<FuelLog>>>(),
                        It.IsAny<bool>(),
                        It.IsAny<Expression<Func<FuelLog, object>>[]>()
                    )
                )
                .ThrowsAsync(new Exception());

            // Act
            var result = await _service.FindAllPaged(new PagedRequest());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task FuelLogService_FindByVehicle_ShouldReturnLogsForVehicle()
        {
            // Arrange
            var logs = new List<FuelLog> { new() { Id = Guid.NewGuid(), VehicleId = _vehicleId } };
            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<FuelLog, bool>>>()))
                .ReturnsAsync(logs);

            // Act
            var result = await _service.FindByVehicle(_vehicleId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(logs, result.Data);
        }

        [Fact]
        public async Task FuelLogService_Add_ShouldSkipOdometerSync_WhenOdometerIsZeroOrLess()
        {
            // Arrange
            var fuelLog = new FuelLog { Id = Guid.NewGuid(), VehicleId = _vehicleId, Odometer = 0 };

            // Act
            var result = await _service.Add(fuelLog);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _vehicleRepository.Verify(
                _ => _.GetByIdAsync(It.IsAny<Guid>()),
                Times.Never
            );
        }

        [Fact]
        public async Task FuelLogService_Add_ShouldSkipOdometerSync_WhenVehicleIsNotFound()
        {
            // Arrange
            var fuelLog = new FuelLog { Id = Guid.NewGuid(), VehicleId = _vehicleId, Odometer = 500 };
            _vehicleRepository
                .Setup(_ => _.GetByIdAsync(_vehicleId))
                .ReturnsAsync((Vehicle)null);

            // Act
            var result = await _service.Add(fuelLog);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _vehicleRepository.Verify(_ => _.UpdateAsync(It.IsAny<Vehicle>()), Times.Never);
        }

        [Fact]
        public async Task FuelLogService_Add_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var fuelLog = new FuelLog { Id = Guid.NewGuid(), VehicleId = _vehicleId };
            _repository.Setup(_ => _.AddAsync(fuelLog)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Add(fuelLog);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            _logServiceMock.Verify(
                _ => _.LogException(It.IsAny<Exception>(), "FuelLogService.Add", fuelLog),
                Times.Once
            );
        }

        [Fact]
        public async Task FuelLogService_Update_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var fuelLog = new FuelLog { Id = Guid.NewGuid() };
            _repository.Setup(_ => _.UpdateAsync(fuelLog)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Update(fuelLog);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task FuelLogService_Remove_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var fuelLog = new FuelLog { Id = Guid.NewGuid() };
            _repository.Setup(_ => _.RemoveAsync(fuelLog)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Remove(fuelLog);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task FuelLogService_FindAll_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository.Setup(_ => _.GetAllAsync(It.IsAny<Expression<Func<FuelLog, object>>>())).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task FuelLogService_FindById_ShouldReturnFuelLog_WhenFound()
        {
            // Arrange
            var id = Guid.NewGuid();
            var fuelLog = new FuelLog { Id = id };
            _repository.Setup(_ => _.GetByIdAsync(id)).ReturnsAsync(fuelLog);

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("Abastecimento encontrado com sucesso", result.Message);
        }

        [Fact]
        public async Task FuelLogService_FindById_ShouldReturnNoData_WhenNotFound()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository.Setup(_ => _.GetByIdAsync(id)).ReturnsAsync((FuelLog)null!);

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task FuelLogService_FindById_ShouldReturnNoData_WhenFleetModuleDisabled()
        {
            // Arrange
            var id = Guid.NewGuid();
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.FuelLog, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
            _repository.Verify(_ => _.GetByIdAsync(id), Times.Never);
        }

        [Fact]
        public async Task FuelLogService_FindById_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository.Setup(_ => _.GetByIdAsync(id)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task FuelLogService_FindByVehicle_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.FuelLog, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _service.FindByVehicle(_vehicleId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data!);
        }

        [Fact]
        public async Task FuelLogService_FindByVehicle_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<FuelLog, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.FindByVehicle(_vehicleId);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }
    }
}
