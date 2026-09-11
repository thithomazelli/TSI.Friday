using System.Linq.Expressions;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;

namespace TSI.Nexus.Services.Tests.Services
{
    public class AlertConfigServiceTests
    {
        private readonly Mock<IRepository<AlertConfig>> _repository;
        private readonly Mock<ILogService> _logService;
        private readonly AlertConfigService _service;

        public AlertConfigServiceTests()
        {
            _repository = new Mock<IRepository<AlertConfig>>();
            _logService = new Mock<ILogService>();
            _service = new AlertConfigService(_repository.Object, _logService.Object);
        }

        [Fact]
        public async Task FindAll_ShouldReturnAllAlertConfigs_WhenRepositorySucceeds()
        {
            // Arrange
            var configs = new List<AlertConfig>
            {
                new() { Key = "A", Name = "A" },
                new() { Key = "B", Name = "B" },
            };
            _repository.Setup(_ => _.GetAllAsync()).ReturnsAsync(configs);

            // Act
            var result = await _service.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(2, result.Data!.Count());
            Assert.Equal("2 registro(s) encontrado(s).", result.Message);
        }

        [Fact]
        public async Task FindAll_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository.Setup(_ => _.GetAllAsync()).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
            _logService.Verify(
                _ => _.LogException(It.IsAny<Exception>(), "AlertConfigService.FindAll", null),
                Times.Once
            );
        }

        [Fact]
        public async Task SetEnabled_ShouldEnableAlertConfig_WhenKeyIsFound()
        {
            // Arrange
            var config = new AlertConfig { Key = "A", Name = "AlertA", Enabled = false };
            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<AlertConfig, bool>>>()))
                .ReturnsAsync(config);

            // Act
            var result = await _service.SetEnabled("A", true);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.True(config.Enabled);
            Assert.Equal("Alerta AlertA ativado com sucesso.", result.Message);
            _repository.Verify(_ => _.UpdateAsync(config), Times.Once);
        }

        [Fact]
        public async Task SetEnabled_ShouldDisableAlertConfig_WhenKeyIsFound()
        {
            // Arrange
            var config = new AlertConfig { Key = "A", Name = "AlertA", Enabled = true };
            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<AlertConfig, bool>>>()))
                .ReturnsAsync(config);

            // Act
            var result = await _service.SetEnabled("A", false);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.False(config.Enabled);
            Assert.Equal("Alerta AlertA desativado com sucesso.", result.Message);
        }

        [Fact]
        public async Task SetEnabled_ShouldReturnWarning_WhenKeyIsNotFound()
        {
            // Arrange
            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<AlertConfig, bool>>>()))
                .ReturnsAsync((AlertConfig)null!);

            // Act
            var result = await _service.SetEnabled("Missing", true);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            Assert.Equal("Nenhum Alerta com a chave Missing foi encontrado.", result.Message);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<AlertConfig>()), Times.Never);
        }

        [Fact]
        public async Task SetEnabled_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<AlertConfig, bool>>>()))
                .ThrowsAsync(new Exception("db down"));

            // Act
            var result = await _service.SetEnabled("A", true);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("db down", result.Message);
            _logService.Verify(
                _ => _.LogException(It.IsAny<Exception>(), "AlertConfigService.SetEnabled", "A"),
                Times.Once
            );
        }

        [Fact]
        public async Task SetThresholdDays_ShouldUpdateThreshold_WhenKeyIsFound()
        {
            // Arrange
            var config = new AlertConfig { Key = "A", Name = "AlertA", ThresholdDays = 1 };
            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<AlertConfig, bool>>>()))
                .ReturnsAsync(config);

            // Act
            var result = await _service.SetThresholdDays("A", 7);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(7, config.ThresholdDays);
            _repository.Verify(_ => _.UpdateAsync(config), Times.Once);
        }

        [Fact]
        public async Task SetThresholdDays_ShouldReturnWarning_WhenKeyIsNotFound()
        {
            // Arrange
            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<AlertConfig, bool>>>()))
                .ReturnsAsync((AlertConfig)null!);

            // Act
            var result = await _service.SetThresholdDays("Missing", 7);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<AlertConfig>()), Times.Never);
        }

        [Fact]
        public async Task SetThresholdDays_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<AlertConfig, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.SetThresholdDays("A", 7);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            _logService.Verify(
                _ => _.LogException(It.IsAny<Exception>(), "AlertConfigService.SetThresholdDays", "A"),
                Times.Once
            );
        }

        [Fact]
        public async Task IsEnabledAsync_ShouldReturnEnabledValue_WhenAlertConfigIsFound()
        {
            // Arrange
            var config = new AlertConfig { Key = "A", Enabled = false };
            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<AlertConfig, bool>>>()))
                .ReturnsAsync(config);

            // Act
            var result = await _service.IsEnabledAsync("A");

            // Assert
            Assert.False(result);
        }

        [Fact]
        public async Task IsEnabledAsync_ShouldReturnTrue_WhenAlertConfigIsNotFound()
        {
            // Arrange
            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<AlertConfig, bool>>>()))
                .ReturnsAsync((AlertConfig)null!);

            // Act
            var result = await _service.IsEnabledAsync("Missing");

            // Assert
            Assert.True(result);
        }

        [Fact]
        public async Task IsEnabledAsync_ShouldReturnTrue_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<AlertConfig, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.IsEnabledAsync("A");

            // Assert
            Assert.True(result);
            _logService.Verify(
                _ => _.LogException(It.IsAny<Exception>(), "AlertConfigService.IsEnabledAsync", "A"),
                Times.Once
            );
        }

        [Fact]
        public async Task GetThresholdDaysAsync_ShouldReturnConfiguredValue_WhenAlertConfigIsFound()
        {
            // Arrange
            var config = new AlertConfig { Key = "A", ThresholdDays = 3 };
            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<AlertConfig, bool>>>()))
                .ReturnsAsync(config);

            // Act
            var result = await _service.GetThresholdDaysAsync("A", 10);

            // Assert
            Assert.Equal(3, result);
        }

        [Fact]
        public async Task GetThresholdDaysAsync_ShouldReturnDefaultValue_WhenAlertConfigIsNotFound()
        {
            // Arrange
            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<AlertConfig, bool>>>()))
                .ReturnsAsync((AlertConfig)null!);

            // Act
            var result = await _service.GetThresholdDaysAsync("Missing", 10);

            // Assert
            Assert.Equal(10, result);
        }

        [Fact]
        public async Task GetThresholdDaysAsync_ShouldReturnDefaultValue_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<AlertConfig, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.GetThresholdDaysAsync("A", 10);

            // Assert
            Assert.Equal(10, result);
            _logService.Verify(
                _ =>
                    _.LogException(It.IsAny<Exception>(), "AlertConfigService.GetThresholdDaysAsync", "A"),
                Times.Once
            );
        }
    }
}
