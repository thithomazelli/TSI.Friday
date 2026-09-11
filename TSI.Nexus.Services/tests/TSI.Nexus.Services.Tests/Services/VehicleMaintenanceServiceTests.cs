using System.Linq.Expressions;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services.Tests.Services
{
    public class VehicleMaintenanceServiceTests
    {
        private readonly VehicleMaintenanceService _service;
        private readonly Mock<IRepository<VehicleMaintenance>> _repository;
        private readonly Mock<IRepository<Vehicle>> _vehicleRepository;
        private readonly Mock<IFeatureToggleService> _featureToggleServiceMock;
        private readonly Mock<ILogService> _logServiceMock;
        private readonly Guid _vehicleId = Guid.Parse("00000000-0000-0000-0000-000000000010");

        public VehicleMaintenanceServiceTests()
        {
            _repository = new Mock<IRepository<VehicleMaintenance>>();
            _vehicleRepository = new Mock<IRepository<Vehicle>>();
            _featureToggleServiceMock = new Mock<IFeatureToggleService>();
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(It.IsAny<string>()))
                .ReturnsAsync(true);
            _featureToggleServiceMock
                            .Setup(_ => _.IsEnabledAsync(It.IsAny<string>(), It.IsAny<string>()))
                            .ReturnsAsync(true);
            _logServiceMock = new Mock<ILogService>();
            _service = new VehicleMaintenanceService(
                _repository.Object,
                _vehicleRepository.Object,
                _featureToggleServiceMock.Object,
                _logServiceMock.Object
            );
        }

        [Fact]
        public async Task VehicleMaintenanceService_Add_ShouldMarkAsOverdueAndBlockVehicle_WhenScheduledDateHasPassed()
        {
            // Arrange
            var vehicle = new Vehicle
            {
                Id = _vehicleId,
                Plate = "ABC1D23",
                Status = VehicleStatus.Available,
            };
            var maintenance = new VehicleMaintenance
            {
                Id = Guid.NewGuid(),
                VehicleId = _vehicleId,
                Status = MaintenanceStatus.Scheduled,
                ScheduledDate = DateTime.UtcNow.Date.AddDays(-5),
            };

            _vehicleRepository
                .Setup(_ => _.GetByIdAsync(vehicle.Id))
                .ReturnsAsync(vehicle);
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<VehicleMaintenance, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _service.Add(maintenance);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(MaintenanceStatus.Overdue, maintenance.Status);
            Assert.Equal(VehicleStatus.Blocked, vehicle.Status);
            _repository.Verify(_ => _.AddAsync(maintenance), Times.Once);
            _vehicleRepository.Verify(_ => _.UpdateAsync(vehicle), Times.Once);
        }

        [Fact]
        public async Task VehicleMaintenanceService_Add_ShouldNotBlockVehicle_WhenMaintenanceIsScheduledForTheFuture()
        {
            // Arrange
            var vehicle = new Vehicle
            {
                Id = _vehicleId,
                Plate = "ABC1D23",
                Status = VehicleStatus.Available,
            };
            var maintenance = new VehicleMaintenance
            {
                Id = Guid.NewGuid(),
                VehicleId = _vehicleId,
                Status = MaintenanceStatus.Scheduled,
                ScheduledDate = DateTime.UtcNow.Date.AddDays(5),
            };

            _vehicleRepository
                .Setup(_ => _.GetByIdAsync(vehicle.Id))
                .ReturnsAsync(vehicle);
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<VehicleMaintenance, bool>>>()))
                .ReturnsAsync(false);

            // Act
            var result = await _service.Add(maintenance);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(MaintenanceStatus.Scheduled, maintenance.Status);
            Assert.Equal(VehicleStatus.Available, vehicle.Status);
            _vehicleRepository.Verify(_ => _.UpdateAsync(It.IsAny<Vehicle>()), Times.Never);
        }

        [Fact]
        public async Task VehicleMaintenanceService_Update_ShouldReleaseVehicle_WhenMaintenanceIsCompletedAndNoOtherPendingExists()
        {
            // Arrange
            var vehicle = new Vehicle
            {
                Id = _vehicleId,
                Plate = "ABC1D23",
                Status = VehicleStatus.Blocked,
            };
            var maintenance = new VehicleMaintenance
            {
                Id = Guid.NewGuid(),
                VehicleId = _vehicleId,
                Status = MaintenanceStatus.Completed,
            };
            var existing = new VehicleMaintenance
            {
                Id = maintenance.Id,
                VehicleId = _vehicleId,
                VehicleMaintenanceProducts = new List<VehicleMaintenanceProduct>(),
            };

            _vehicleRepository
                .Setup(_ => _.GetByIdAsync(vehicle.Id))
                .ReturnsAsync(vehicle);
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<VehicleMaintenance, bool>>>()))
                .ReturnsAsync(false);
            _repository
                .Setup(_ => _.GetByIdAsync(maintenance.Id, m => m.VehicleMaintenanceProducts))
                .ReturnsAsync(existing);

            // Act
            var result = await _service.Update(maintenance);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(existing.CompletedDate);
            Assert.Equal(VehicleStatus.Available, vehicle.Status);
            _vehicleRepository.Verify(_ => _.UpdateAsync(vehicle), Times.Once);
        }

        [Fact]
        public async Task VehicleMaintenanceService_Update_ShouldKeepVehicleBlocked_WhenOtherPendingMaintenanceExists()
        {
            // Arrange
            var vehicle = new Vehicle
            {
                Id = _vehicleId,
                Plate = "ABC1D23",
                Status = VehicleStatus.Blocked,
            };
            var maintenance = new VehicleMaintenance
            {
                Id = Guid.NewGuid(),
                VehicleId = _vehicleId,
                Status = MaintenanceStatus.Completed,
            };
            var existing = new VehicleMaintenance
            {
                Id = maintenance.Id,
                VehicleId = _vehicleId,
                VehicleMaintenanceProducts = new List<VehicleMaintenanceProduct>(),
            };

            _vehicleRepository
                .Setup(_ => _.GetByIdAsync(vehicle.Id))
                .ReturnsAsync(vehicle);
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<VehicleMaintenance, bool>>>()))
                .ReturnsAsync(true);
            _repository
                .Setup(_ => _.GetByIdAsync(maintenance.Id, m => m.VehicleMaintenanceProducts))
                .ReturnsAsync(existing);

            // Act
            var result = await _service.Update(maintenance);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(VehicleStatus.Blocked, vehicle.Status);
            _vehicleRepository.Verify(_ => _.UpdateAsync(It.IsAny<Vehicle>()), Times.Never);
        }

        [Fact]
        public async Task VehicleMaintenanceService_Update_ShouldReconcileVehicleMaintenanceProducts()
        {
            // Arrange
            var vehicle = new Vehicle
            {
                Id = _vehicleId,
                Plate = "ABC1D23",
                Status = VehicleStatus.Available,
            };
            var keptProductId = Guid.NewGuid();
            var removedProductId = Guid.NewGuid();
            var newProductId = Guid.NewGuid();
            var maintenanceId = Guid.NewGuid();
            var keptLineId = Guid.NewGuid();

            var existing = new VehicleMaintenance
            {
                Id = maintenanceId,
                VehicleId = _vehicleId,
                Status = MaintenanceStatus.Scheduled,
                VehicleMaintenanceProducts = new List<VehicleMaintenanceProduct>
                {
                    new()
                    {
                        Id = keptLineId,
                        VehicleMaintenanceId = maintenanceId,
                        ProductId = keptProductId,
                        Quantity = 1,
                        Price = 10,
                    },
                    new()
                    {
                        Id = Guid.NewGuid(),
                        VehicleMaintenanceId = maintenanceId,
                        ProductId = removedProductId,
                        Quantity = 2,
                        Price = 20,
                    },
                },
            };

            var maintenance = new VehicleMaintenance
            {
                Id = maintenanceId,
                VehicleId = _vehicleId,
                Status = MaintenanceStatus.Scheduled,
                VehicleMaintenanceProducts = new List<VehicleMaintenanceProduct>
                {
                    new()
                    {
                        Id = keptLineId,
                        ProductId = keptProductId,
                        Quantity = 3,
                        Price = 15,
                    },
                    new() { ProductId = newProductId, Quantity = 1, Price = 30 },
                },
            };

            _vehicleRepository
                .Setup(_ => _.GetByIdAsync(vehicle.Id))
                .ReturnsAsync(vehicle);
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<VehicleMaintenance, bool>>>()))
                .ReturnsAsync(false);
            _repository
                .Setup(_ => _.GetByIdAsync(maintenanceId, m => m.VehicleMaintenanceProducts))
                .ReturnsAsync(existing);

            // Act
            var result = await _service.Update(maintenance);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(2, existing.VehicleMaintenanceProducts.Count);
            Assert.DoesNotContain(
                existing.VehicleMaintenanceProducts,
                p => p.ProductId == removedProductId
            );
            var kept = existing.VehicleMaintenanceProducts.Single(p => p.Id == keptLineId);
            Assert.Equal(3, kept.Quantity);
            Assert.Equal(15, kept.Price);
            Assert.Contains(
                existing.VehicleMaintenanceProducts,
                p => p.ProductId == newProductId && p.VehicleMaintenanceId == maintenanceId
            );
        }

        [Fact]
        public async Task VehicleMaintenanceService_FindByVehicle_ShouldReturnMaintenancesForVehicle()
        {
            // Arrange
            var maintenances = new List<VehicleMaintenance>
            {
                new() { Id = Guid.NewGuid(), VehicleId = _vehicleId },
            };

            _repository
                .Setup(_ => _.QueryAsync(
                    It.IsAny<Expression<Func<VehicleMaintenance, bool>>>(),
                    It.IsAny<Expression<Func<VehicleMaintenance, object>>[]>()
                ))
                .ReturnsAsync(maintenances);

            // Act
            var result = await _service.FindByVehicle(_vehicleId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(maintenances, result.Data);
        }

        [Fact]
        public async Task VehicleMaintenanceService_FindByVehicle_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.VehicleMaintenance, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _service.FindByVehicle(_vehicleId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data);
        }

        [Fact]
        public async Task VehicleMaintenanceService_FindByVehicle_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ =>
                    _.QueryAsync(
                        It.IsAny<Expression<Func<VehicleMaintenance, bool>>>(),
                        It.IsAny<Expression<Func<VehicleMaintenance, object>>[]>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.FindByVehicle(_vehicleId);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task VehicleMaintenanceService_Add_ShouldNotSyncVehicleStatus_WhenVehicleIsNotFound()
        {
            // Arrange - SyncVehicleStatusAsync's vehicle == null branch returns early.
            var maintenance = new VehicleMaintenance
            {
                Id = Guid.NewGuid(),
                VehicleId = _vehicleId,
                Status = MaintenanceStatus.Scheduled,
                ScheduledDate = DateTime.UtcNow.Date.AddDays(5),
            };

            _vehicleRepository
                .Setup(_ => _.GetByIdAsync(_vehicleId))
                .ReturnsAsync((Vehicle)null);

            // Act
            var result = await _service.Add(maintenance);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _vehicleRepository.Verify(_ => _.UpdateAsync(It.IsAny<Vehicle>()), Times.Never);
        }

        [Fact]
        public async Task VehicleMaintenanceService_Add_ShouldNotChangeVehicleStatus_WhenVehicleIsInactive()
        {
            // Arrange - SyncVehicleStatusAsync's vehicle.Status == Inactive branch returns early.
            var vehicle = new Vehicle
            {
                Id = _vehicleId,
                Plate = "ABC1D23",
                Status = VehicleStatus.Inactive,
            };
            var maintenance = new VehicleMaintenance
            {
                Id = Guid.NewGuid(),
                VehicleId = _vehicleId,
                Status = MaintenanceStatus.Scheduled,
                ScheduledDate = DateTime.UtcNow.Date.AddDays(-1),
            };

            _vehicleRepository
                .Setup(_ => _.GetByIdAsync(vehicle.Id))
                .ReturnsAsync(vehicle);

            // Act
            var result = await _service.Add(maintenance);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(VehicleStatus.Inactive, vehicle.Status);
            _vehicleRepository.Verify(_ => _.UpdateAsync(It.IsAny<Vehicle>()), Times.Never);
        }

        [Fact]
        public async Task VehicleMaintenanceService_Add_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var maintenance = new VehicleMaintenance { Id = Guid.NewGuid(), VehicleId = _vehicleId };
            _repository.Setup(_ => _.AddAsync(maintenance)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Add(maintenance);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task VehicleMaintenanceService_Update_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var maintenance = new VehicleMaintenance { Id = Guid.NewGuid(), VehicleId = _vehicleId };
            _repository
                .Setup(_ => _.GetByIdAsync(maintenance.Id, m => m.VehicleMaintenanceProducts))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Update(maintenance);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task VehicleMaintenanceService_Remove_ShouldRemoveSuccessfullyAndSyncVehicleStatus()
        {
            // Arrange
            var vehicle = new Vehicle { Id = _vehicleId, Status = VehicleStatus.Blocked };
            var maintenance = new VehicleMaintenance { Id = Guid.NewGuid(), VehicleId = _vehicleId };

            _vehicleRepository
                .Setup(_ => _.GetByIdAsync(vehicle.Id))
                .ReturnsAsync(vehicle);
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<VehicleMaintenance, bool>>>()))
                .ReturnsAsync(false);

            // Act
            var result = await _service.Remove(maintenance);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(VehicleStatus.Available, vehicle.Status);
            _repository.Verify(_ => _.RemoveAsync(maintenance), Times.Once);
        }

        [Fact]
        public async Task VehicleMaintenanceService_Remove_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var maintenance = new VehicleMaintenance { Id = Guid.NewGuid(), VehicleId = _vehicleId };
            _repository.Setup(_ => _.RemoveAsync(maintenance)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Remove(maintenance);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task VehicleMaintenanceService_FindAll_ShouldReturnMaintenances_WhenDataExists()
        {
            // Arrange
            var maintenances = new List<VehicleMaintenance> { new() { Id = Guid.NewGuid() } };
            _repository
                .Setup(_ => _.GetAllAsync(m => m.Vehicle, m => m.VehicleMaintenanceProducts))
                .ReturnsAsync(maintenances);

            // Act
            var result = await _service.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(maintenances, result.Data);
        }

        [Fact]
        public async Task VehicleMaintenanceService_FindAll_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ =>
                    _.IsEnabledAsync(FeatureToggleKeys.VehicleMaintenance, FeatureToggleKeys.FleetModule)
                )
                .ReturnsAsync(false);

            // Act
            var result = await _service.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data);
        }

        [Fact]
        public async Task VehicleMaintenanceService_FindAll_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ => _.GetAllAsync(m => m.Vehicle, m => m.VehicleMaintenanceProducts))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task VehicleMaintenanceService_FindAllPaged_ShouldReturnPagedMaintenances_WhenDataExists()
        {
            // Arrange
            var maintenances = new List<VehicleMaintenance> { new() { Id = Guid.NewGuid() } };
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<VehicleMaintenance, bool>>>(),
                        It.IsAny<Func<IQueryable<VehicleMaintenance>, IOrderedQueryable<VehicleMaintenance>>>(),
                        true,
                        It.IsAny<Expression<Func<VehicleMaintenance, object>>[]>()
                    )
                )
                .ReturnsAsync((maintenances, maintenances.Count));

            // Act
            var result = await _service.FindAllPaged(new PagedRequest { Page = 1, PageSize = 50 });

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(maintenances.Count, result.Data!.TotalCount);
            Assert.Equal(maintenances.Count, result.Data.Items.Count());
        }

        [Fact]
        public async Task VehicleMaintenanceService_FindAllPaged_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ =>
                    _.IsEnabledAsync(FeatureToggleKeys.VehicleMaintenance, FeatureToggleKeys.FleetModule)
                )
                .ReturnsAsync(false);

            // Act
            var result = await _service.FindAllPaged(new PagedRequest());

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data!.Items);
            Assert.Equal(0, result.Data.TotalCount);
        }

        [Fact]
        public async Task VehicleMaintenanceService_FindAllPaged_ShouldComputeSkipAndTake_FromPageAndPageSize()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<VehicleMaintenance, bool>>>(),
                        It.IsAny<Func<IQueryable<VehicleMaintenance>, IOrderedQueryable<VehicleMaintenance>>>(),
                        true,
                        It.IsAny<Expression<Func<VehicleMaintenance, object>>[]>()
                    )
                )
                .ReturnsAsync((new List<VehicleMaintenance>(), 0));

            // Act
            await _service.FindAllPaged(new PagedRequest { Page = 2, PageSize = 25 });

            // Assert
            _repository.Verify(
                r =>
                    r.GetPagedAsync(
                        25,
                        25,
                        It.IsAny<Expression<Func<VehicleMaintenance, bool>>>(),
                        It.IsAny<Func<IQueryable<VehicleMaintenance>, IOrderedQueryable<VehicleMaintenance>>>(),
                        true,
                        It.IsAny<Expression<Func<VehicleMaintenance, object>>[]>()
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task VehicleMaintenanceService_FindAllPaged_ShouldReturnErrorResult_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<VehicleMaintenance, bool>>>(),
                        It.IsAny<Func<IQueryable<VehicleMaintenance>, IOrderedQueryable<VehicleMaintenance>>>(),
                        It.IsAny<bool>(),
                        It.IsAny<Expression<Func<VehicleMaintenance, object>>[]>()
                    )
                )
                .ThrowsAsync(new Exception());

            // Act
            var result = await _service.FindAllPaged(new PagedRequest());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task VehicleMaintenanceService_FindById_ShouldReturnMaintenance_WhenIdIsValid()
        {
            // Arrange
            var id = Guid.NewGuid();
            var maintenance = new VehicleMaintenance { Id = id };
            _repository
                .Setup(_ => _.GetByIdAsync(id, m => m.Vehicle, m => m.VehicleMaintenanceProducts))
                .ReturnsAsync(maintenance);

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(maintenance, result.Data);
        }

        [Fact]
        public async Task VehicleMaintenanceService_FindById_ShouldReturnNoData_WhenIdIsNotFound()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository
                .Setup(_ => _.GetByIdAsync(id, m => m.Vehicle, m => m.VehicleMaintenanceProducts))
                .ReturnsAsync((VehicleMaintenance)null);

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task VehicleMaintenanceService_FindById_ShouldReturnNoData_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ =>
                    _.IsEnabledAsync(FeatureToggleKeys.VehicleMaintenance, FeatureToggleKeys.FleetModule)
                )
                .ReturnsAsync(false);

            // Act
            var result = await _service.FindById(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task VehicleMaintenanceService_FindById_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository
                .Setup(_ => _.GetByIdAsync(id, m => m.Vehicle, m => m.VehicleMaintenanceProducts))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }
    }
}
