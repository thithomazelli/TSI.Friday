using System.Linq.Expressions;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services.Tests.Services
{
    public class PassengerServiceTests
    {
        private readonly PassengerService _service;
        private readonly Mock<IRepository<Passenger>> _repository;
        private readonly Mock<IFeatureToggleService> _featureToggleServiceMock;
        private readonly Mock<ILogService> _logServiceMock;
        private readonly Guid _tripId = Guid.Parse("00000000-0000-0000-0000-000000000010");

        public PassengerServiceTests()
        {
            _repository = new Mock<IRepository<Passenger>>();
            _featureToggleServiceMock = new Mock<IFeatureToggleService>();
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(It.IsAny<string>()))
                .ReturnsAsync(true);
            _featureToggleServiceMock
                            .Setup(_ => _.IsEnabledAsync(It.IsAny<string>(), It.IsAny<string>()))
                            .ReturnsAsync(true);
            _logServiceMock = new Mock<ILogService>();
            _service = new PassengerService(
                _repository.Object,
                _featureToggleServiceMock.Object,
                _logServiceMock.Object
            );
        }

        [Fact]
        public async Task PassengerService_Add_ShouldAddPassengerSuccessfully()
        {
            // Arrange
            var passenger = new Passenger
            {
                Id = Guid.NewGuid(),
                TripId = _tripId,
                Name = "Maria Silva",
            };

            // Act
            var result = await _service.Add(passenger);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(passenger, result.Data);
            _repository.Verify(_ => _.AddAsync(passenger), Times.Once);
        }

        [Fact]
        public async Task PassengerService_AddRange_ShouldAddAllPassengers()
        {
            // Arrange
            var passengers = new List<Passenger>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    TripId = _tripId,
                    Name = "Passageiro 1",
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    TripId = _tripId,
                    Name = "Passageiro 2",
                },
            };

            // Act
            var result = await _service.AddRange(passengers);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(2, result.Data!.Count());
            Assert.Equal("2 passageiro(s) importado(s) com sucesso.", result.Message);
            _repository.Verify(
                _ => _.AddRangeAsync(It.Is<IEnumerable<Passenger>>(p => p.Count() == 2)),
                Times.Once
            );
        }

        [Fact]
        public async Task PassengerService_AddRange_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var passengers = new List<Passenger>
            {
                new() { Id = Guid.NewGuid(), TripId = _tripId, Name = "Passageiro 1" },
            };
            _repository
                .Setup(_ => _.AddRangeAsync(It.IsAny<IEnumerable<Passenger>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.AddRange(passengers);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task PassengerService_Update_ShouldUpdatePassengerSuccessfully()
        {
            // Arrange
            var passenger = new Passenger
            {
                Id = Guid.NewGuid(),
                TripId = _tripId,
                Name = "Maria Silva",
            };

            // Act
            var result = await _service.Update(passenger);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _repository.Verify(_ => _.UpdateAsync(passenger), Times.Once);
        }

        [Fact]
        public async Task PassengerService_Remove_ShouldRemovePassengerSuccessfully()
        {
            // Arrange
            var passenger = new Passenger
            {
                Id = Guid.NewGuid(),
                TripId = _tripId,
                Name = "Maria Silva",
            };

            // Act
            var result = await _service.Remove(passenger);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _repository.Verify(_ => _.RemoveAsync(passenger), Times.Once);
        }

        [Fact]
        public async Task PassengerService_FindByTrip_ShouldReturnPassengersForTrip()
        {
            // Arrange
            var passengers = new List<Passenger>
            {
                new() { Id = Guid.NewGuid(), TripId = _tripId, Name = "Maria Silva" },
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Passenger, bool>>>()))
                .ReturnsAsync(passengers);

            // Act
            var result = await _service.FindByTrip(_tripId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(passengers, result.Data);
        }

        [Fact]
        public async Task PassengerService_Add_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var passenger = new Passenger { Id = Guid.NewGuid(), TripId = _tripId, Name = "Maria" };
            _repository.Setup(_ => _.AddAsync(passenger)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Add(passenger);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
        }

        [Fact]
        public async Task PassengerService_Update_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var passenger = new Passenger { Id = Guid.NewGuid(), TripId = _tripId, Name = "Maria" };
            _repository.Setup(_ => _.UpdateAsync(passenger)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Update(passenger);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
        }

        [Fact]
        public async Task PassengerService_Remove_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var passenger = new Passenger { Id = Guid.NewGuid(), TripId = _tripId, Name = "Maria" };
            _repository.Setup(_ => _.RemoveAsync(passenger)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Remove(passenger);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
        }

        [Fact]
        public async Task PassengerService_FindById_ShouldReturnPassenger_WhenIdIsValid()
        {
            // Arrange
            var id = Guid.NewGuid();
            var passenger = new Passenger { Id = id, TripId = _tripId, Name = "Maria" };
            _repository.Setup(_ => _.GetByIdAsync(id)).ReturnsAsync(passenger);

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(passenger, result.Data);
            Assert.Contains("encontrado com sucesso", result.Message);
        }

        [Fact]
        public async Task PassengerService_FindById_ShouldReturnNoData_WhenIdIsNotFound()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository.Setup(_ => _.GetByIdAsync(id)).ReturnsAsync((Passenger)null);

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
            Assert.Contains(id.ToString(), result.Message);
        }

        [Fact]
        public async Task PassengerService_FindById_ShouldReturnEmpty_WhenModuleToggleIsDisabled()
        {
            // Arrange
            var id = Guid.NewGuid();
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Passenger, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
            _repository.Verify(_ => _.GetByIdAsync(It.IsAny<Guid?>()), Times.Never);
        }

        [Fact]
        public async Task PassengerService_FindById_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository.Setup(_ => _.GetByIdAsync(id)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
        }

        [Fact]
        public async Task PassengerService_FindByTrip_ShouldReturnEmpty_WhenModuleToggleIsDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Passenger, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _service.FindByTrip(_tripId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data!);
            _repository.Verify(
                _ => _.QueryAsync(It.IsAny<Expression<Func<Passenger, bool>>>()),
                Times.Never
            );
        }

        [Fact]
        public async Task PassengerService_FindByTrip_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Passenger, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.FindByTrip(_tripId);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
        }
    }
}
