using System.Linq.Expressions;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services.Tests.Services
{
    public class DriverServiceTests
    {
        private readonly DriverService _driverService;
        private readonly Mock<IRepository<Driver>> _repository;
        private readonly Mock<IRepository<Trip>> _tripRepositoryMock;
        private readonly Mock<IFeatureToggleService> _featureToggleServiceMock;
        private readonly Mock<IAlertConfigService> _alertConfigServiceMock;
        private readonly Mock<ILogService> _logServiceMock;
        private readonly IList<Driver> _driverListMock;

        public DriverServiceTests()
        {
            _repository = new Mock<IRepository<Driver>>();
            _tripRepositoryMock = new Mock<IRepository<Trip>>();
            _featureToggleServiceMock = new Mock<IFeatureToggleService>();
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(It.IsAny<string>()))
                .ReturnsAsync(true);
            _featureToggleServiceMock
                            .Setup(_ => _.IsEnabledAsync(It.IsAny<string>(), It.IsAny<string>()))
                            .ReturnsAsync(true);
            _alertConfigServiceMock = new Mock<IAlertConfigService>();
            _alertConfigServiceMock
                .Setup(_ => _.IsEnabledAsync(It.IsAny<string>()))
                .ReturnsAsync(true);
            _logServiceMock = new Mock<ILogService>();
            _driverService = new DriverService(
                _repository.Object,
                _tripRepositoryMock.Object,
                _featureToggleServiceMock.Object,
                _alertConfigServiceMock.Object,
                _logServiceMock.Object
            );

            _driverListMock = new List<Driver>
            {
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    Name = "João da Silva",
                    SocialSecurityCard = "11111111111",
                    LicenseNumber = "12345678900",
                    LicenseCategory = "D",
                    EmploymentType = EmploymentType.CLT,
                    Status = DriverStatus.Active,
                },
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    Name = "Maria Souza",
                    SocialSecurityCard = "22222222222",
                    LicenseNumber = "98765432100",
                    LicenseCategory = "E",
                    EmploymentType = EmploymentType.CLT,
                    Status = DriverStatus.Inactive,
                },
            };
        }

        [Fact]
        public async Task DriverService_Add_ShouldAddDriverSuccessfully_WhenSocialSecurityCardIsNotDuplicated()
        {
            // Arrange
            var driverMock = new Driver
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "João da Silva",
                SocialSecurityCard = "11111111111",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Driver, bool>>>()))
                .ReturnsAsync(false);

            // Act
            var result = await _driverService.Add(driverMock);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(driverMock, result.Data);
            Assert.Equal($"Motorista {driverMock.Name} cadastrado com sucesso.", result.Message);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Driver>()), Times.Once);
        }

        [Fact]
        public async Task DriverService_Add_ShouldNotAddDriverAndReturnAnErrorMessage_WhenSocialSecurityCardIsDuplicated()
        {
            // Arrange
            var driverMock = new Driver
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "João da Silva",
                SocialSecurityCard = "11111111111",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Driver, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _driverService.Add(driverMock);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal(
                $"Já existe um Motorista cadastrado com o CPF {driverMock.SocialSecurityCard}.",
                result.Message
            );
            _repository.Verify(_ => _.AddAsync(It.IsAny<Driver>()), Times.Never);
        }

        [Fact]
        public async Task DriverService_Update_ShouldUpdateDriverSuccessfully_WhenSocialSecurityCardIsNotDuplicated()
        {
            // Arrange
            var driverMock = new Driver
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "João da Silva",
                SocialSecurityCard = "11111111111",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Driver, bool>>>()))
                .ReturnsAsync(false);

            // Act
            var result = await _driverService.Update(driverMock);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Driver>()), Times.Once);
        }

        [Fact]
        public async Task DriverService_Remove_ShouldReturnWarning_WhenDriverIsLinkedToTrips()
        {
            // Arrange
            var driverMock = new Driver
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "João da Silva",
            };

            _tripRepositoryMock
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Trip, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _driverService.Remove(driverMock);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _repository.Verify(_ => _.RemoveAsync(It.IsAny<Driver>()), Times.Never);
        }

        [Fact]
        public async Task DriverService_Remove_ShouldRemoveDriverSuccessfully_WhenNotLinkedToTrips()
        {
            // Arrange
            var driverMock = new Driver
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "João da Silva",
            };

            _tripRepositoryMock
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Trip, bool>>>()))
                .ReturnsAsync(false);

            // Act
            var result = await _driverService.Remove(driverMock);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _repository.Verify(_ => _.RemoveAsync(It.IsAny<Driver>()), Times.Once);
        }

        [Fact]
        public async Task DriverService_FindAll_ShouldReturnAllDrivers()
        {
            // Arrange
            _repository.Setup(_ => _.GetAllAsync()).ReturnsAsync(_driverListMock);

            // Act
            var result = await _driverService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(_driverListMock, result.Data);
        }

        [Fact]
        public async Task DriverService_FindAllPaged_ShouldReturnPagedDrivers_WhenDataExists()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Driver, bool>>>(),
                        It.IsAny<Func<IQueryable<Driver>, IOrderedQueryable<Driver>>>(),
                        true,
                        It.IsAny<Expression<Func<Driver, object>>[]>()
                    )
                )
                .ReturnsAsync((_driverListMock, _driverListMock.Count));

            // Act
            var result = await _driverService.FindAllPaged(
                new PagedRequest { Page = 1, PageSize = 50 }
            );

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(_driverListMock.Count, result.Data!.TotalCount);
            Assert.Equal(_driverListMock.Count, result.Data.Items.Count());
        }

        [Fact]
        public async Task DriverService_FindAllPaged_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Driver, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _driverService.FindAllPaged(new PagedRequest());

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data!.Items);
            Assert.Equal(0, result.Data.TotalCount);
            _repository.Verify(
                r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Driver, bool>>>(),
                        It.IsAny<Func<IQueryable<Driver>, IOrderedQueryable<Driver>>>(),
                        It.IsAny<bool>(),
                        It.IsAny<Expression<Func<Driver, object>>[]>()
                    ),
                Times.Never
            );
        }

        [Fact]
        public async Task DriverService_FindAllPaged_ShouldComputeSkipAndTake_FromPageAndPageSize()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Driver, bool>>>(),
                        It.IsAny<Func<IQueryable<Driver>, IOrderedQueryable<Driver>>>(),
                        true,
                        It.IsAny<Expression<Func<Driver, object>>[]>()
                    )
                )
                .ReturnsAsync((new List<Driver>(), 0));

            // Act
            await _driverService.FindAllPaged(new PagedRequest { Page = 2, PageSize = 25 });

            // Assert
            _repository.Verify(
                r =>
                    r.GetPagedAsync(
                        25,
                        25,
                        It.IsAny<Expression<Func<Driver, bool>>>(),
                        It.IsAny<Func<IQueryable<Driver>, IOrderedQueryable<Driver>>>(),
                        true,
                        It.IsAny<Expression<Func<Driver, object>>[]>()
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task DriverService_FindAllPaged_ShouldReturnErrorResult_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Driver, bool>>>(),
                        It.IsAny<Func<IQueryable<Driver>, IOrderedQueryable<Driver>>>(),
                        It.IsAny<bool>(),
                        It.IsAny<Expression<Func<Driver, object>>[]>()
                    )
                )
                .ThrowsAsync(new Exception());

            // Act
            var result = await _driverService.FindAllPaged(new PagedRequest());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task DriverService_FindById_ShouldReturnDriver_WhenIdIsValid()
        {
            // Arrange
            var idMock = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var driverMock = _driverListMock.First(_ => idMock.Equals(_.Id));

            _repository.Setup(_ => _.GetByIdAsync(idMock)).ReturnsAsync(driverMock);

            // Act
            var result = await _driverService.FindById(idMock);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(driverMock, result.Data);
        }

        [Fact]
        public async Task DriverService_FindBySocialSecurityCard_ShouldReturnDriver_WhenCpfIsValid()
        {
            // Arrange
            const string cpfMock = "11111111111";
            var driverMock = _driverListMock.First(_ => cpfMock.Equals(_.SocialSecurityCard));

            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Driver, bool>>>()))
                .ReturnsAsync(driverMock);

            // Act
            var result = await _driverService.FindBySocialSecurityCard(cpfMock);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(driverMock, result.Data);
        }

        [Fact]
        public async Task DriverService_FindActive_ShouldReturnOnlyActiveDrivers()
        {
            // Arrange
            var activeOnly = _driverListMock.Where(d => d.Status == DriverStatus.Active).ToList();

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Driver, bool>>>()))
                .ReturnsAsync(activeOnly);

            // Act
            var result = await _driverService.FindActive();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(activeOnly, result.Data);
        }

        [Fact]
        public async Task DriverService_FindWithExpiringLicense_ShouldReturnDriversWithExpiringOrExpiredLicense()
        {
            // Arrange
            var expiring = new List<Driver>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Name = "João da Silva",
                    LicenseExpiryDate = DateTime.UtcNow.Date.AddDays(-1),
                },
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Driver, bool>>>()))
                .ReturnsAsync(expiring);

            // Act
            var result = await _driverService.FindWithExpiringLicense(60);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(expiring, result.Data);
        }

        [Fact]
        public async Task DriverService_FindBySocialSecurityCard_ShouldReturnNoData_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Driver, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _driverService.FindBySocialSecurityCard("11111111111");

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task DriverService_FindActive_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Driver, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _driverService.FindActive();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data);
        }

        [Fact]
        public async Task DriverService_FindWithExpiringLicense_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Driver, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _driverService.FindWithExpiringLicense(60);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data);
        }

        [Fact]
        public async Task DriverService_FindWithExpiringLicense_ShouldReturnEmpty_WhenDriverLicenseExpiryAlertDisabled()
        {
            // Arrange
            _alertConfigServiceMock
                .Setup(_ => _.IsEnabledAsync(AlertConfigKeys.DriverLicenseExpiry))
                .ReturnsAsync(false);

            // Act
            var result = await _driverService.FindWithExpiringLicense(60);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data);
        }

        [Fact]
        public async Task DriverService_Add_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var driver = new Driver { Id = Guid.NewGuid(), Name = "Novo Motorista" };
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Driver, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _driverService.Add(driver);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            _logServiceMock.Verify(
                _ => _.LogException(It.IsAny<Exception>(), "DriverService.Add", driver),
                Times.Once
            );
        }

        [Fact]
        public async Task DriverService_Update_ShouldNotUpdateAndReturnAnErrorMessage_WhenSocialSecurityCardIsDuplicated()
        {
            // Arrange
            var driver = new Driver
            {
                Id = Guid.NewGuid(),
                Name = "Motorista",
                SocialSecurityCard = "11111111111",
            };
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Driver, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _driverService.Update(driver);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal($"Já existe um Motorista cadastrado com o CPF {driver.SocialSecurityCard}.", result.Message);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Driver>()), Times.Never);
        }

        [Fact]
        public async Task DriverService_Update_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var driver = new Driver { Id = Guid.NewGuid(), Name = "Motorista" };
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Driver, bool>>>()))
                .ReturnsAsync(false);
            _repository.Setup(_ => _.UpdateAsync(driver)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _driverService.Update(driver);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task DriverService_Remove_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var driver = new Driver { Id = Guid.NewGuid(), Name = "Motorista" };
            _tripRepositoryMock
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Trip, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _driverService.Remove(driver);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task DriverService_FindAll_ShouldReturnEmpty_WhenFleetModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Driver, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _driverService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data!);
            _repository.Verify(_ => _.GetAllAsync(), Times.Never);
        }

        [Fact]
        public async Task DriverService_FindAll_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository.Setup(_ => _.GetAllAsync()).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _driverService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task DriverService_FindById_ShouldReturnNoData_WhenFleetModuleDisabled()
        {
            // Arrange
            var id = Guid.NewGuid();
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Driver, FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _driverService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
            _repository.Verify(_ => _.GetByIdAsync(id), Times.Never);
        }

        [Fact]
        public async Task DriverService_FindById_ShouldReturnNoData_WhenNotFound()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository.Setup(_ => _.GetByIdAsync(id)).ReturnsAsync((Driver)null!);

            // Act
            var result = await _driverService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task DriverService_FindById_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository.Setup(_ => _.GetByIdAsync(id)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _driverService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task DriverService_FindBySocialSecurityCard_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Driver, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _driverService.FindBySocialSecurityCard("11111111111");

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task DriverService_FindActive_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Driver, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _driverService.FindActive();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task DriverService_FindWithExpiringLicense_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Driver, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _driverService.FindWithExpiringLicense(30);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }
    }
}
