using System.Linq.Expressions;
using FluentAssertions;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services.Tests.Services
{
    public class VehicleServiceTests
    {
        private readonly VehicleService _vehicleService;
        private readonly Mock<IRepository<Vehicle>> _repository;
        private readonly Mock<IRepository<Trip>> _tripRepositoryMock;
        private readonly Mock<IFeatureToggleService> _featureToggleServiceMock;
        private readonly Mock<ILogService> _logServiceMock;
        private readonly IList<Vehicle> _vehicleListMock;

        public VehicleServiceTests()
        {
            _repository = new Mock<IRepository<Vehicle>>();
            _tripRepositoryMock = new Mock<IRepository<Trip>>();
            _featureToggleServiceMock = new Mock<IFeatureToggleService>();
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(It.IsAny<string>()))
                .ReturnsAsync(true);
            _featureToggleServiceMock
                            .Setup(_ => _.IsEnabledAsync(It.IsAny<string>(), It.IsAny<string>()))
                            .ReturnsAsync(true);
            _logServiceMock = new Mock<ILogService>();
            _vehicleService = new VehicleService(
                _repository.Object,
                _tripRepositoryMock.Object,
                _featureToggleServiceMock.Object,
                _logServiceMock.Object
            );

            _vehicleListMock = new List<Vehicle>
            {
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    Plate = "ABC1D23",
                    Brand = "Mercedes-Benz",
                    Model = "O500",
                    SeatCapacity = 46,
                    Type = VehicleType.Bus,
                    Status = VehicleStatus.Available,
                },
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    Plate = "XYZ9E87",
                    Brand = "Volkswagen",
                    Model = "9.160",
                    SeatCapacity = 28,
                    Type = VehicleType.MiniBus,
                    Status = VehicleStatus.Blocked,
                },
            };
        }

        [Fact]
        public async Task VehicleService_Add_ShouldAddVehicleSuccessfully_WhenPlateIsNotDuplicated()
        {
            // Arrange
            var vehicleMock = new Vehicle
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Plate = "ABC1D23",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Vehicle, bool>>>()))
                .ReturnsAsync(false);

            // Act
            var result = await _vehicleService.Add(vehicleMock);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(vehicleMock, result.Data);
            Assert.Equal($"Veículo {vehicleMock.Plate} cadastrado com sucesso.", result.Message);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Vehicle>()), Times.Once);
        }

        [Fact]
        public async Task VehicleService_Add_ShouldNotAddVehicleAndReturnAnErrorMessage_WhenPlateIsDuplicated()
        {
            // Arrange
            var vehicleMock = new Vehicle
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Plate = "ABC1D23",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Vehicle, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _vehicleService.Add(vehicleMock);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal(
                $"Já existe um Veículo cadastrado com a placa {vehicleMock.Plate}.",
                result.Message
            );
            _repository.Verify(_ => _.AddAsync(It.IsAny<Vehicle>()), Times.Never);
        }

        [Fact]
        public async Task VehicleService_Update_ShouldUpdateVehicleSuccessfully_WhenPlateIsNotDuplicated()
        {
            // Arrange
            var vehicleMock = new Vehicle
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Plate = "ABC1D23",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Vehicle, bool>>>()))
                .ReturnsAsync(false);

            // Act
            var result = await _vehicleService.Update(vehicleMock);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal($"Veículo {vehicleMock.Plate} atualizado com sucesso.", result.Message);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Vehicle>()), Times.Once);
        }

        [Fact]
        public async Task VehicleService_Remove_ShouldReturnWarning_WhenVehicleIsLinkedToTrips()
        {
            // Arrange
            var vehicleMock = new Vehicle
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Plate = "ABC1D23",
            };

            _tripRepositoryMock
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Trip, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _vehicleService.Remove(vehicleMock);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _repository.Verify(_ => _.RemoveAsync(It.IsAny<Vehicle>()), Times.Never);
        }

        [Fact]
        public async Task VehicleService_Remove_ShouldRemoveVehicleSuccessfully_WhenNotLinkedToTrips()
        {
            // Arrange
            var vehicleMock = new Vehicle
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Plate = "ABC1D23",
            };

            _tripRepositoryMock
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Trip, bool>>>()))
                .ReturnsAsync(false);

            // Act
            var result = await _vehicleService.Remove(vehicleMock);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _repository.Verify(_ => _.RemoveAsync(It.IsAny<Vehicle>()), Times.Once);
        }

        [Fact]
        public async Task VehicleService_FindAll_ShouldReturnAllVehicles()
        {
            // Arrange
            _repository.Setup(_ => _.GetAllAsync()).ReturnsAsync(_vehicleListMock);

            // Act
            var result = await _vehicleService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(_vehicleListMock, result.Data);
        }

        [Fact]
        public async Task VehicleService_FindAllPaged_ShouldReturnPagedVehicles_WhenDataExists()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Vehicle, bool>>>(),
                        It.IsAny<Func<IQueryable<Vehicle>, IOrderedQueryable<Vehicle>>>(),
                        true,
                        It.IsAny<Expression<Func<Vehicle, object>>[]>()
                    )
                )
                .ReturnsAsync((_vehicleListMock, _vehicleListMock.Count));

            // Act
            var result = await _vehicleService.FindAllPaged(
                new PagedRequest { Page = 1, PageSize = 50 }
            );

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(_vehicleListMock.Count, result.Data!.TotalCount);
            Assert.Equal(_vehicleListMock.Count, result.Data.Items.Count());
        }

        [Fact]
        public async Task VehicleService_FindAllPaged_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Vehicle, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _vehicleService.FindAllPaged(new PagedRequest());

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data!.Items);
            Assert.Equal(0, result.Data.TotalCount);
            _repository.Verify(
                r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Vehicle, bool>>>(),
                        It.IsAny<Func<IQueryable<Vehicle>, IOrderedQueryable<Vehicle>>>(),
                        It.IsAny<bool>(),
                        It.IsAny<Expression<Func<Vehicle, object>>[]>()
                    ),
                Times.Never
            );
        }

        [Fact]
        public async Task VehicleService_FindAllPaged_ShouldComputeSkipAndTake_FromPageAndPageSize()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Vehicle, bool>>>(),
                        It.IsAny<Func<IQueryable<Vehicle>, IOrderedQueryable<Vehicle>>>(),
                        true,
                        It.IsAny<Expression<Func<Vehicle, object>>[]>()
                    )
                )
                .ReturnsAsync((new List<Vehicle>(), 0));

            // Act
            await _vehicleService.FindAllPaged(new PagedRequest { Page = 2, PageSize = 25 });

            // Assert
            _repository.Verify(
                r =>
                    r.GetPagedAsync(
                        25,
                        25,
                        It.IsAny<Expression<Func<Vehicle, bool>>>(),
                        It.IsAny<Func<IQueryable<Vehicle>, IOrderedQueryable<Vehicle>>>(),
                        true,
                        It.IsAny<Expression<Func<Vehicle, object>>[]>()
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task VehicleService_FindAllPaged_ShouldReturnErrorResult_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Vehicle, bool>>>(),
                        It.IsAny<Func<IQueryable<Vehicle>, IOrderedQueryable<Vehicle>>>(),
                        It.IsAny<bool>(),
                        It.IsAny<Expression<Func<Vehicle, object>>[]>()
                    )
                )
                .ThrowsAsync(new Exception());

            // Act
            var result = await _vehicleService.FindAllPaged(new PagedRequest());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task VehicleService_FindById_ShouldReturnVehicle_WhenIdIsValid()
        {
            // Arrange
            var idMock = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var vehicleMock = _vehicleListMock.First(_ => idMock.Equals(_.Id));

            _repository.Setup(_ => _.GetByIdAsync(idMock)).ReturnsAsync(vehicleMock);

            // Act
            var result = await _vehicleService.FindById(idMock);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(vehicleMock, result.Data);
        }

        [Fact]
        public async Task VehicleService_FindByPlate_ShouldReturnVehicle_WhenPlateIsValid()
        {
            // Arrange
            const string plateMock = "ABC1D23";
            var vehicleMock = _vehicleListMock.First(_ => plateMock.Equals(_.Plate));

            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Vehicle, bool>>>()))
                .ReturnsAsync(vehicleMock);

            // Act
            var result = await _vehicleService.FindByPlate(plateMock);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(vehicleMock, result.Data);
        }

        [Fact]
        public async Task VehicleService_FindAvailable_ShouldReturnOnlyAvailableVehicles()
        {
            // Arrange
            var availableOnly = _vehicleListMock.Where(v => v.Status == VehicleStatus.Available).ToList();

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Vehicle, bool>>>()))
                .ReturnsAsync(availableOnly);

            // Act
            var result = await _vehicleService.FindAvailable();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(availableOnly, result.Data);
        }

        [Fact]
        public async Task VehicleService_FindAll_ShouldReturnAnEmptyListAndAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            _repository.Setup(_ => _.GetAllAsync()).ThrowsAsync(exception);

            // Act
            var result = await _vehicleService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal(
                $"Não foi possível acessar os registros de Veículos na base de dados.",
                result.Message
            );
        }

        [Fact]
        public async Task VehicleService_FindByPlate_ShouldReturnNoData_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Vehicle, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _vehicleService.FindByPlate("ABC1D23");

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task VehicleService_FindAvailable_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Vehicle, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _vehicleService.FindAvailable();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data);
        }

        [Fact]
        public async Task VehicleService_Add_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var vehicleMock = new Vehicle { Id = Guid.NewGuid(), Plate = "ABC1D23" };
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Vehicle, bool>>>()))
                .ReturnsAsync(false);
            _repository.Setup(_ => _.AddAsync(vehicleMock)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _vehicleService.Add(vehicleMock);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task VehicleService_Update_ShouldNotUpdateAndReturnAnErrorMessage_WhenPlateIsDuplicated()
        {
            // Arrange
            var vehicleMock = new Vehicle { Id = Guid.NewGuid(), Plate = "ABC1D23" };
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Vehicle, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _vehicleService.Update(vehicleMock);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal(
                $"Já existe um Veículo cadastrado com a placa {vehicleMock.Plate}.",
                result.Message
            );
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Vehicle>()), Times.Never);
        }

        [Fact]
        public async Task VehicleService_Update_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var vehicleMock = new Vehicle { Id = Guid.NewGuid(), Plate = "ABC1D23" };
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Vehicle, bool>>>()))
                .ReturnsAsync(false);
            _repository.Setup(_ => _.UpdateAsync(vehicleMock)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _vehicleService.Update(vehicleMock);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task VehicleService_Remove_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var vehicleMock = new Vehicle { Id = Guid.NewGuid(), Plate = "ABC1D23" };
            _tripRepositoryMock
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Trip, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _vehicleService.Remove(vehicleMock);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task VehicleService_FindById_ShouldReturnNoData_WhenFleetModuleDisabled()
        {
            // Arrange
            var id = Guid.NewGuid();
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Vehicle, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _vehicleService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task VehicleService_FindById_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository.Setup(_ => _.GetByIdAsync(id)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _vehicleService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task VehicleService_FindByPlate_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Vehicle, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _vehicleService.FindByPlate("ABC1D23");

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task VehicleService_FindAvailable_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Vehicle, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _vehicleService.FindAvailable();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }
    }
}
