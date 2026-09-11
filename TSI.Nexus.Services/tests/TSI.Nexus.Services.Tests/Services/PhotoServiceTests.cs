using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;
using TSI.Nexus.Services.Services;
using Xunit;

namespace TSI.Nexus.Services.Tests.Services
{
    public class PhotoServiceTests : IDisposable
    {
        private readonly PhotoService _service;
        private readonly Mock<IRepository<BusinessPartner>> _businessPartnerRepository;
        private readonly Mock<IRepository<Product>> _productRepository;
        private readonly Mock<IRepository<User>> _userRepository;
        private readonly Mock<IRepository<Vehicle>> _vehicleRepository;
        private readonly Mock<IRepository<Driver>> _driverRepository;
        private readonly Mock<IConfiguration> _configurationMock;
        private readonly string _tempContentRoot;

        public PhotoServiceTests()
        {
            _tempContentRoot = Path.Combine(Path.GetTempPath(), "PhotoServiceTests_" + Guid.NewGuid());
            Directory.CreateDirectory(_tempContentRoot);

            var envMock = new Mock<IWebHostEnvironment>();
            envMock.SetupGet(e => e.ContentRootPath).Returns(_tempContentRoot);

            _configurationMock = new Mock<IConfiguration>();

            _businessPartnerRepository = new Mock<IRepository<BusinessPartner>>();
            _productRepository = new Mock<IRepository<Product>>();
            _userRepository = new Mock<IRepository<User>>();
            _vehicleRepository = new Mock<IRepository<Vehicle>>();
            _driverRepository = new Mock<IRepository<Driver>>();

            _service = new PhotoService(
                envMock.Object,
                _businessPartnerRepository.Object,
                _productRepository.Object,
                _userRepository.Object,
                _vehicleRepository.Object,
                _driverRepository.Object,
                _configurationMock.Object
            );
        }

        public void Dispose()
        {
            if (Directory.Exists(_tempContentRoot))
            {
                Directory.Delete(_tempContentRoot, recursive: true);
            }
        }

        [Fact]
        public async Task PhotoService_UploadImageAsync_ShouldUpdateVehiclePhoto_WhenEntityFolderIsVehicles()
        {
            // Arrange
            var vehicleId = Guid.NewGuid();
            var vehicle = new Vehicle { Id = vehicleId };
            _vehicleRepository.Setup(r => r.GetByIdAsync(vehicleId)).ReturnsAsync(vehicle);
            var file = CreateFakeImageFile("vehicle-photo.jpg");

            // Act
            var fileName = await _service.UploadImageAsync("Vehicles", vehicleId, file);

            // Assert
            Assert.False(string.IsNullOrEmpty(fileName));
            Assert.Equal(fileName, vehicle.Photo);
            _vehicleRepository.Verify(r => r.UpdateAsync(vehicle), Times.Once);
        }

        [Fact]
        public async Task PhotoService_UploadImageAsync_ShouldUpdateDriverPhoto_WhenEntityFolderIsDrivers()
        {
            // Arrange
            var driverId = Guid.NewGuid();
            var driver = new Driver { Id = driverId };
            _driverRepository.Setup(r => r.GetByIdAsync(driverId)).ReturnsAsync(driver);
            var file = CreateFakeImageFile("driver-photo.png");

            // Act
            var fileName = await _service.UploadImageAsync("Drivers", driverId, file);

            // Assert
            Assert.False(string.IsNullOrEmpty(fileName));
            Assert.Equal(fileName, driver.Photo);
            _driverRepository.Verify(r => r.UpdateAsync(driver), Times.Once);
        }

        [Fact]
        public async Task PhotoService_UploadImageAsync_ShouldClearVehiclePhoto_WhenFileIsNull()
        {
            // Arrange
            var vehicleId = Guid.NewGuid();
            var vehicle = new Vehicle { Id = vehicleId, Photo = "old-photo.jpg" };
            _vehicleRepository.Setup(r => r.GetByIdAsync(vehicleId)).ReturnsAsync(vehicle);

            // Act
            var fileName = await _service.UploadImageAsync("Vehicles", vehicleId, null);

            // Assert
            Assert.Equal(string.Empty, fileName);
            Assert.Null(vehicle.Photo);
            _vehicleRepository.Verify(r => r.UpdateAsync(vehicle), Times.Once);
        }

        [Fact]
        public async Task PhotoService_UploadImageAsync_ShouldUpdateBusinessPartnerPhoto_WhenEntityFolderIsBusinessPartners()
        {
            // Arrange
            var bpId = Guid.NewGuid();
            var bp = new Individual { Id = bpId, Name = "Cliente Teste" };
            _businessPartnerRepository.Setup(r => r.GetByIdAsync(bpId)).ReturnsAsync(bp);
            var file = CreateFakeImageFile("bp-photo.png");

            // Act
            var fileName = await _service.UploadImageAsync("BusinessPartners", bpId, file);

            // Assert
            Assert.False(string.IsNullOrEmpty(fileName));
            Assert.Equal(fileName, bp.Photo);
            _businessPartnerRepository.Verify(r => r.UpdateAsync(bp), Times.Once);
        }

        [Fact]
        public async Task PhotoService_UploadImageAsync_ShouldUpdateProductPhoto_WhenEntityFolderIsProducts()
        {
            // Arrange
            var productId = Guid.NewGuid();
            var product = new Product { Id = productId };
            _productRepository.Setup(r => r.GetByIdAsync(productId)).ReturnsAsync(product);
            var file = CreateFakeImageFile("product-photo.gif");

            // Act
            var fileName = await _service.UploadImageAsync("Products", productId, file);

            // Assert
            Assert.False(string.IsNullOrEmpty(fileName));
            Assert.Equal(fileName, product.Photo);
            _productRepository.Verify(r => r.UpdateAsync(product), Times.Once);
        }

        [Fact]
        public async Task PhotoService_UploadImageAsync_ShouldUpdateUserPhoto_WhenEntityFolderIsUsers()
        {
            // Arrange
            var userId = Guid.NewGuid();
            var user = new User { Id = userId.ToString() };
            _userRepository.Setup(r => r.GetByIdAsync(userId.ToString())).ReturnsAsync(user);
            var file = CreateFakeImageFile("user-photo.webp");

            // Act
            var fileName = await _service.UploadImageAsync("Users", userId, file);

            // Assert
            Assert.False(string.IsNullOrEmpty(fileName));
            Assert.Equal(fileName, user.Photo);
            _userRepository.Verify(r => r.UpdateAsync(user), Times.Once);
        }

        [Fact]
        public async Task PhotoService_UploadImageAsync_ShouldThrowArgumentException_WhenEntityFolderIsUnknown()
        {
            // Arrange - BuildPhotoPathAsync's switch is an allow-list of known entity folders;
            // anything else is rejected up front, before any directory is touched.
            var entityId = Guid.NewGuid();
            var file = CreateFakeImageFile("photo.jpg");

            // Act & Assert
            await Assert.ThrowsAsync<ArgumentException>(
                () => _service.UploadImageAsync("UnknownFolder", entityId, file)
            );
        }

        [Fact]
        public async Task PhotoService_UploadImageAsync_ShouldThrowArgumentException_WhenEntityFolderAttemptsPathTraversal()
        {
            // Arrange - entityFolder comes straight from the request; without the allow-list in
            // BuildPhotoPathAsync this used to be combined directly into the storage path,
            // letting a caller escape the configured attachments root entirely.
            var entityId = Guid.NewGuid();
            var file = CreateFakeImageFile("photo.jpg");

            // Act & Assert
            await Assert.ThrowsAsync<ArgumentException>(
                () => _service.UploadImageAsync("../../../etc", entityId, file)
            );
        }

        [Fact]
        public async Task PhotoService_UploadImageAsync_ShouldThrowArgumentException_WhenExtensionIsNotAllowed()
        {
            // Arrange
            var vehicleId = Guid.NewGuid();
            _vehicleRepository.Setup(r => r.GetByIdAsync(vehicleId)).ReturnsAsync(new Vehicle { Id = vehicleId });
            var file = CreateFakeImageFile("malware.exe");

            // Act & Assert
            await Assert.ThrowsAsync<ArgumentException>(
                () => _service.UploadImageAsync("Vehicles", vehicleId, file)
            );
        }

        [Fact]
        public async Task PhotoService_UploadImageAsync_ShouldThrowArgumentException_WhenFileIsTooLarge()
        {
            // Arrange
            var vehicleId = Guid.NewGuid();
            _vehicleRepository.Setup(r => r.GetByIdAsync(vehicleId)).ReturnsAsync(new Vehicle { Id = vehicleId });

            var bigContent = new byte[6 * 1024 * 1024]; // 6 MB > 5 MB max
            var stream = new MemoryStream(bigContent);
            var file = new FormFile(stream, 0, bigContent.Length, "file", "big-photo.jpg")
            {
                Headers = new HeaderDictionary(),
                ContentType = "image/jpeg",
            };

            // Act & Assert
            await Assert.ThrowsAsync<ArgumentException>(
                () => _service.UploadImageAsync("Vehicles", vehicleId, file)
            );
        }

        [Fact]
        public async Task PhotoService_UploadImageAsync_ShouldUseConfiguredRootedBasePath_WhenConfigured()
        {
            // Arrange
            var rootedPath = Path.Combine(Path.GetTempPath(), "PhotoServiceTests_rooted_" + Guid.NewGuid());
            _configurationMock.SetupGet(c => c["Attachments:BasePath"]).Returns(rootedPath);

            var vehicleId = Guid.NewGuid();
            var vehicle = new Vehicle { Id = vehicleId };
            _vehicleRepository.Setup(r => r.GetByIdAsync(vehicleId)).ReturnsAsync(vehicle);
            var file = CreateFakeImageFile("vehicle-photo.jpg");

            try
            {
                // Act
                var fileName = await _service.UploadImageAsync("Vehicles", vehicleId, file);

                // Assert
                Assert.False(string.IsNullOrEmpty(fileName));
                Assert.True(
                    File.Exists(Path.Combine(rootedPath, "Vehicles", vehicleId.ToString(), fileName))
                );
            }
            finally
            {
                if (Directory.Exists(rootedPath))
                {
                    Directory.Delete(rootedPath, recursive: true);
                }
            }
        }

        [Fact]
        public async Task PhotoService_GetPhotoFileAsync_ShouldReturnError_WhenFileNameIsEmpty()
        {
            // Act
            var result = await _service.GetPhotoFileAsync("Vehicles", Guid.NewGuid(), string.Empty);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal("File name is required", result.Message);
        }

        [Fact]
        public async Task PhotoService_GetPhotoFileAsync_ShouldReturnError_WhenPhotoDoesNotExist()
        {
            // Act
            var result = await _service.GetPhotoFileAsync("Vehicles", Guid.NewGuid(), "not-there.jpg");

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal("Photo not found", result.Message);
        }

        [Fact]
        public async Task PhotoService_GetPhotoFileAsync_ShouldReturnPhoto_WhenFileExists()
        {
            // Arrange
            var vehicleId = Guid.NewGuid();
            _vehicleRepository.Setup(r => r.GetByIdAsync(vehicleId)).ReturnsAsync(new Vehicle { Id = vehicleId });
            var file = CreateFakeImageFile("vehicle-photo.jpg");
            var fileName = await _service.UploadImageAsync("Vehicles", vehicleId, file);

            // Act
            var result = await _service.GetPhotoFileAsync("Vehicles", vehicleId, fileName);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(result.Data);
            Assert.Equal(fileName, result.Data.FileName);
            result.Data.Stream.Dispose();
        }

        private static IFormFile CreateFakeImageFile(string fileName)
        {
            var content = Encoding.UTF8.GetBytes("fake-image-content");
            var stream = new MemoryStream(content);
            return new FormFile(stream, 0, content.Length, "file", fileName)
            {
                Headers = new HeaderDictionary(),
                ContentType = "image/jpeg",
            };
        }
    }
}
