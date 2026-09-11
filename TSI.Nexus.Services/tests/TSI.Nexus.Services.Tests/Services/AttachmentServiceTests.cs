using AutoMapper;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Data;
using TSI.Nexus.IoC;

namespace TSI.Nexus.Services.Tests.Services
{
    public class AttachmentServiceTests : IDisposable
    {
        private readonly Mock<IWebHostEnvironment> _env;
        private readonly Mock<IConfiguration> _config;
        private readonly Mock<IFeatureToggleService> _featureToggleService;
        private readonly Mock<ILogService> _logService;
        private readonly IMapper _mapper;
        private readonly string _contentRoot;
        private readonly List<MyDBContextEF> _contexts = new();

        public AttachmentServiceTests()
        {
            _contentRoot = Path.Combine(
                Path.GetTempPath(),
                "AttachmentServiceTests_" + Guid.NewGuid().ToString("N")
            );
            Directory.CreateDirectory(_contentRoot);

            _env = new Mock<IWebHostEnvironment>();
            _env.Setup(_ => _.ContentRootPath).Returns(_contentRoot);

            _config = new Mock<IConfiguration>();
            _featureToggleService = new Mock<IFeatureToggleService>();
            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);
            _logService = new Mock<ILogService>();

            var mapperConfig = new MapperConfiguration(
                cfg =>
                {
                    cfg.ConstructServicesUsing(type => null);
                    cfg.AddMaps(typeof(MappingProfile).Assembly);
                },
                new LoggerFactory()
            );
            _mapper = mapperConfig.CreateMapper();
        }

        public void Dispose()
        {
            foreach (var ctx in _contexts)
            {
                ctx.Dispose();
            }

            try
            {
                if (Directory.Exists(_contentRoot))
                {
                    Directory.Delete(_contentRoot, true);
                }
            }
            catch
            {
                // best-effort cleanup
            }
        }

        private MyDBContextEF CreateDbContext()
        {
            var options = new DbContextOptionsBuilder<MyDBContextEF>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            var ctx = new MyDBContextEF(options);
            _contexts.Add(ctx);
            return ctx;
        }

        private AttachmentService CreateService(MyDBContextEF db)
        {
            return new AttachmentService(
                _env.Object,
                db,
                _mapper,
                _config.Object,
                _featureToggleService.Object,
                _logService.Object
            );
        }

        private static IFormFile CreateFormFile(string fileName, string content = "test-content")
        {
            var bytes = System.Text.Encoding.UTF8.GetBytes(content);
            var stream = new MemoryStream(bytes);
            var file = new Mock<IFormFile>();
            file.Setup(f => f.FileName).Returns(fileName);
            file.Setup(f => f.Length).Returns(bytes.Length);
            file.Setup(f => f.CopyToAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
                .Returns<Stream, CancellationToken>((target, token) => stream.CopyToAsync(target, token));
            return file.Object;
        }

        #region Add

        [Fact]
        public async Task Add_ShouldReturnError_WhenFileIsNull()
        {
            // Arrange
            var db = CreateDbContext();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = null };

            // Act
            var result = await service.Add(dto, null);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal("Arquivo obrigatório. Por favor envie um arquivo.", result.Message);
        }

        [Fact]
        public async Task Add_ShouldSaveUnderBusinessPartnerFolder_WhenOnlyBusinessPartnerIdIsProvided()
        {
            // Arrange
            var db = CreateDbContext();
            var bp = new Individual { Id = Guid.NewGuid(), Name = "Cliente Teste", Email = "cliente.teste@test.com" };
            db.BusinessPartner.Add(bp);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = CreateFormFile("doc.pdf"), BusinessPartnerId = bp.Id };

            // Act
            var result = await service.Add(dto, null);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("doc.pdf", result.Data!.FileName);
            Assert.Contains("BusinessPartners", result.Data.Path);
            Assert.Contains("Cliente Teste", result.Data.Path);
            Assert.True(File.Exists(Path.Combine(_contentRoot, "attachments", "BusinessPartners", "Cliente Teste", "doc.pdf")));
        }

        [Fact]
        public async Task Add_ShouldAppendIncrementalSuffix_WhenFileAlreadyExists()
        {
            // Arrange
            var db = CreateDbContext();
            var bp = new Individual { Id = Guid.NewGuid(), Name = "Cliente", Email = "cliente@test.com" };
            db.BusinessPartner.Add(bp);
            await db.SaveChangesAsync();
            var service = CreateService(db);

            var first = await service.Add(
                new AttachmentDto { File = CreateFormFile("doc.pdf"), BusinessPartnerId = bp.Id },
                null
            );
            var second = await service.Add(
                new AttachmentDto { File = CreateFormFile("doc.pdf"), BusinessPartnerId = bp.Id },
                null
            );

            // Assert
            Assert.Equal(ResponseStatus.Success, first.Status);
            Assert.Equal(ResponseStatus.Success, second.Status);
            Assert.Equal("doc.pdf", first.Data!.FileName);
            Assert.Equal("doc(1).pdf", second.Data!.FileName);
        }

        [Fact]
        public async Task Add_ShouldResolveOrderIdAndBusinessPartnerId_FromOrderNumber()
        {
            // Arrange
            var db = CreateDbContext();
            var bp = new Individual { Id = Guid.NewGuid(), Name = "Cliente", Email = "cliente@test.com" };
            var order = new Order
            {
                Id = Guid.NewGuid(),
                OrderNumber = "ORD-0001",
                BusinessPartnerId = bp.Id,
            };
            db.BusinessPartner.Add(bp);
            db.Order.Add(order);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = CreateFormFile("doc.pdf"), OrderNumber = "ORD-0001" };

            // Act
            var result = await service.Add(dto, null);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(order.Id, result.Data!.OrderId);
            Assert.Equal(bp.Id, result.Data.BusinessPartnerId);
            Assert.Contains("Orders", result.Data.Path);
            Assert.Contains("ORD-0001", result.Data.Path);
        }

        [Fact]
        public async Task Add_ShouldResolvePurchaseOrderIdAndBusinessPartnerId_FromPurchaseOrderNumber()
        {
            // Arrange
            var db = CreateDbContext();
            var bp = new Individual { Id = Guid.NewGuid(), Name = "Fornecedor", Email = "fornecedor@test.com" };
            var purchaseOrder = new PurchaseOrder
            {
                Id = Guid.NewGuid(),
                PurchaseOrderNumber = "FOR-0001",
                BusinessPartnerId = bp.Id,
            };
            db.BusinessPartner.Add(bp);
            db.PurchaseOrder.Add(purchaseOrder);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var dto = new AttachmentDto
            {
                File = CreateFormFile("doc.pdf"),
                PurchaseOrderNumber = "FOR-0001",
            };

            // Act
            var result = await service.Add(dto, null);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(purchaseOrder.Id, result.Data!.PurchaseOrderId);
            Assert.Equal(bp.Id, result.Data.BusinessPartnerId);
            Assert.Contains("PurchaseOrders", result.Data.Path);
        }

        [Fact]
        public async Task Add_ShouldResolveTripIdAndBusinessPartnerId_FromTripNumber()
        {
            // Arrange
            var db = CreateDbContext();
            var bp = new Individual { Id = Guid.NewGuid(), Name = "Cliente Viagem", Email = "cliente.viagem@test.com" };
            var trip = new Trip
            {
                Id = Guid.NewGuid(),
                TripNumber = "TRP-0001",
                BusinessPartnerId = bp.Id,
            };
            db.BusinessPartner.Add(bp);
            db.Trip.Add(trip);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = CreateFormFile("doc.pdf"), TripNumber = "TRP-0001" };

            // Act
            var result = await service.Add(dto, null);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(trip.Id, result.Data!.TripId);
            Assert.Equal(bp.Id, result.Data.BusinessPartnerId);
            Assert.Contains("Trips", result.Data.Path);
        }

        [Fact]
        public async Task Add_ShouldResolveFullChain_FromPaymentIdThroughTransactionToOrderAndBusinessPartner()
        {
            // Arrange
            var db = CreateDbContext();
            var bp = new Individual { Id = Guid.NewGuid(), Name = "Cliente Pagamento", Email = "cliente.pagamento@test.com" };
            var order = new Order { Id = Guid.NewGuid(), OrderNumber = "ORD-9", BusinessPartnerId = bp.Id };
            var transaction = new Transaction
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                BusinessPartnerId = bp.Id,
            };
            var payment = new Payment
            {
                Id = Guid.NewGuid(),
                TransactionId = transaction.Id,
                OrderId = order.Id,
                BusinessPartnerId = bp.Id,
            };
            db.BusinessPartner.Add(bp);
            db.Order.Add(order);
            db.Transaction.Add(transaction);
            db.Payment.Add(payment);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = CreateFormFile("doc.pdf"), PaymentId = payment.Id };

            // Act
            var result = await service.Add(dto, null);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(transaction.Id, result.Data!.TransactionId);
            Assert.Equal(payment.Id, result.Data.PaymentId);
            Assert.Equal(bp.Id, result.Data.BusinessPartnerId);
            Assert.Contains("Payments", result.Data.Path);
        }

        [Fact]
        public async Task Add_ShouldResolveOrderAndBusinessPartner_FromTransactionId()
        {
            // Arrange
            var db = CreateDbContext();
            var bp = new Individual { Id = Guid.NewGuid(), Name = "Cliente Transacao", Email = "cliente.transacao@test.com" };
            var order = new Order { Id = Guid.NewGuid(), OrderNumber = "ORD-8", BusinessPartnerId = bp.Id };
            var transaction = new Transaction
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                BusinessPartnerId = bp.Id,
            };
            db.BusinessPartner.Add(bp);
            db.Order.Add(order);
            db.Transaction.Add(transaction);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = CreateFormFile("doc.pdf"), TransactionId = transaction.Id };

            // Act
            var result = await service.Add(dto, null);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(order.Id, result.Data!.OrderId);
            Assert.Equal(bp.Id, result.Data.BusinessPartnerId);
        }

        [Fact]
        public async Task Add_ShouldSaveUnderProductsFolder_WhenProductIdIsProvided()
        {
            // Arrange
            var db = CreateDbContext();
            var product = new Product { Id = Guid.NewGuid(), Name = "Produto X" };
            db.Product.Add(product);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = CreateFormFile("manual.pdf"), ProductId = product.Id };

            // Act
            var result = await service.Add(dto, null);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Contains("Products", result.Data!.Path);
            Assert.Contains("Produto X", result.Data.Path);
        }

        [Fact]
        public async Task Add_ShouldSaveUnderVehicleMaintenanceFolder_WhenVehicleMaintenanceIdIsProvided()
        {
            // Arrange
            var db = CreateDbContext();
            var vehicle = new Vehicle { Id = Guid.NewGuid(), Plate = "ABC1234" };
            var maintenance = new VehicleMaintenance { Id = Guid.NewGuid(), VehicleId = vehicle.Id };
            db.Vehicle.Add(vehicle);
            db.VehicleMaintenance.Add(maintenance);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var dto = new AttachmentDto
            {
                File = CreateFormFile("nota.pdf"),
                VehicleMaintenanceId = maintenance.Id,
            };

            // Act
            var result = await service.Add(dto, null);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Contains("Vehicles", result.Data!.Path);
            Assert.Contains("ABC1234", result.Data.Path);
            Assert.Contains("Maintenances", result.Data.Path);
        }

        [Fact]
        public async Task Add_ShouldSaveUnderVehicleFolder_WhenVehicleIdIsProvided()
        {
            // Arrange
            var db = CreateDbContext();
            var vehicle = new Vehicle { Id = Guid.NewGuid(), Plate = "XYZ9876" };
            db.Vehicle.Add(vehicle);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = CreateFormFile("foto.jpg"), VehicleId = vehicle.Id };

            // Act
            var result = await service.Add(dto, null);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Contains("Vehicles", result.Data!.Path);
            Assert.Contains("XYZ9876", result.Data.Path);
        }

        [Fact]
        public async Task Add_ShouldSaveUnderDriverFolder_WhenDriverIdIsProvided()
        {
            // Arrange
            var db = CreateDbContext();
            var driver = new Driver { Id = Guid.NewGuid(), Name = "Motorista Teste" };
            db.Driver.Add(driver);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = CreateFormFile("cnh.pdf"), DriverId = driver.Id };

            // Act
            var result = await service.Add(dto, null);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Contains("Drivers", result.Data!.Path);
            Assert.Contains("Motorista Teste", result.Data.Path);
        }

        [Fact]
        public async Task Add_ShouldSaveUnderUsersFolder_WhenOnlyUserIdIsProvided()
        {
            // Arrange
            var db = CreateDbContext();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = CreateFormFile("avatar.png"), UserId = "user-123" };

            // Act
            var result = await service.Add(dto, null);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Contains("Users", result.Data!.Path);
            Assert.Contains("user-123", result.Data.Path);
        }

        [Fact]
        public async Task Add_ShouldSaveUnderBasePath_WhenNoIdsAreProvided()
        {
            // Arrange
            var db = CreateDbContext();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = CreateFormFile("solto.txt") };

            // Act
            var result = await service.Add(dto, null);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.True(File.Exists(Path.Combine(_contentRoot, "attachments", "solto.txt")));
        }

        [Fact]
        public async Task Add_ShouldParseOverridePath_ForBusinessPartnerOrderPattern()
        {
            // Arrange
            var db = CreateDbContext();
            var bp = new Individual { Id = Guid.NewGuid(), Name = "Cliente Path", Email = "cliente.path@test.com" };
            var order = new Order
            {
                Id = Guid.NewGuid(),
                OrderNumber = "PATH-001",
                BusinessPartnerId = bp.Id,
            };
            db.BusinessPartner.Add(bp);
            db.Order.Add(order);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = CreateFormFile("doc.pdf") };

            // Act
            var result = await service.Add(dto, "BusinessPartners/Cliente Path/Orders/PATH-001");

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(order.Id, result.Data!.OrderId);
            Assert.Equal(bp.Id, result.Data.BusinessPartnerId);
        }

        [Fact]
        public async Task Add_ShouldParseOverridePath_ForBusinessPartnerTransactionPaymentPattern()
        {
            // Arrange
            var db = CreateDbContext();
            var bp = new Individual { Id = Guid.NewGuid(), Name = "Cliente Pag", Email = "cliente.pag@test.com" };
            var transaction = new Transaction { Id = Guid.NewGuid(), BusinessPartnerId = bp.Id };
            var payment = new Payment { Id = Guid.NewGuid(), TransactionId = transaction.Id, BusinessPartnerId = bp.Id };
            db.BusinessPartner.Add(bp);
            db.Transaction.Add(transaction);
            db.Payment.Add(payment);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = CreateFormFile("recibo.pdf") };
            var overridePath = $"BusinessPartners/Cliente Pag/Transactions/{transaction.Id}/Payments/{payment.Id}";

            // Act
            var result = await service.Add(dto, overridePath);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(transaction.Id, result.Data!.TransactionId);
            Assert.Equal(payment.Id, result.Data.PaymentId);
        }

        [Fact]
        public async Task Add_ShouldParseOverridePath_ForProductsPattern()
        {
            // Arrange
            var db = CreateDbContext();
            var product = new Product { Id = Guid.NewGuid(), Name = "Produto Path" };
            db.Product.Add(product);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = CreateFormFile("ficha.pdf") };

            // Act
            var result = await service.Add(dto, "Products/Produto Path");

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(product.Id, result.Data!.ProductId);
        }

        [Fact]
        public async Task Add_ShouldParseOverridePath_ForVehicleMaintenancePattern()
        {
            // Arrange
            var db = CreateDbContext();
            var vehicle = new Vehicle { Id = Guid.NewGuid(), Plate = "PATH0001" };
            var maintenance = new VehicleMaintenance { Id = Guid.NewGuid(), VehicleId = vehicle.Id };
            db.Vehicle.Add(vehicle);
            db.VehicleMaintenance.Add(maintenance);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = CreateFormFile("laudo.pdf") };

            // Act
            var result = await service.Add(dto, $"Vehicles/PATH0001/Maintenances/{maintenance.Id}");

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(maintenance.Id, result.Data!.VehicleMaintenanceId);
            Assert.Equal(vehicle.Id, result.Data.VehicleId);
        }

        [Fact]
        public async Task Add_ShouldParseOverridePath_ForDriversPattern()
        {
            // Arrange
            var db = CreateDbContext();
            var driver = new Driver { Id = Guid.NewGuid(), Name = "Driver Path" };
            db.Driver.Add(driver);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = CreateFormFile("cnh.pdf") };

            // Act
            var result = await service.Add(dto, "Drivers/Driver Path");

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(driver.Id, result.Data!.DriverId);
        }

        [Fact]
        public async Task Add_ShouldParseOverridePath_ForUsersPattern()
        {
            // Arrange
            var db = CreateDbContext();
            var service = CreateService(db);
            var dto = new AttachmentDto { File = CreateFormFile("avatar.png") };

            // Act
            var result = await service.Add(dto, "Users/user-abc");

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("user-abc", result.Data!.UserId);
        }

        [Fact]
        public async Task Add_ShouldReturnError_WhenCopyToAsyncThrows()
        {
            // Arrange
            var db = CreateDbContext();
            var service = CreateService(db);
            var fileMock = new Mock<IFormFile>();
            fileMock.Setup(f => f.FileName).Returns("boom.pdf");
            fileMock
                .Setup(f => f.CopyToAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new IOException("disk full"));
            var dto = new AttachmentDto { File = fileMock.Object };

            // Act
            var result = await service.Add(dto, null);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("disk full", result.Message);
            _logService.Verify(
                _ => _.LogException(It.IsAny<Exception>(), "AttachmentService.Add", dto),
                Times.Once
            );
        }

        #endregion

        #region Update

        [Fact]
        public async Task Update_ShouldReturnError_WhenIdIsNullOrEmpty()
        {
            // Arrange
            var db = CreateDbContext();
            var service = CreateService(db);

            // Act
            var result = await service.Update(new AttachmentDto { Id = null }, null);
            var result2 = await service.Update(new AttachmentDto { Id = Guid.Empty }, null);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal(ResponseStatus.Error, result2.Status);
        }

        [Fact]
        public async Task Update_ShouldReturnError_WhenAttachmentIsNotFound()
        {
            // Arrange
            var db = CreateDbContext();
            var service = CreateService(db);

            // Act
            var result = await service.Update(new AttachmentDto { Id = Guid.NewGuid() }, null);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal("Anexo não encontrado.", result.Message);
        }

        [Fact]
        public async Task Update_ShouldUpdateMetadataOnly_WhenNoFileIsProvided()
        {
            // Arrange
            var db = CreateDbContext();
            var bp = new Individual { Id = Guid.NewGuid(), Name = "Cliente Update", Email = "cliente.update@test.com" };
            var existing = new Attachment { Id = Guid.NewGuid(), FileName = "old.pdf", Path = "attachments/old.pdf" };
            db.BusinessPartner.Add(bp);
            db.Attachments.Add(existing);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var dto = new AttachmentDto { Id = existing.Id, BusinessPartnerId = bp.Id };

            // Act
            var result = await service.Update(dto, null);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(bp.Id, result.Data!.BusinessPartnerId);
            Assert.Equal("old.pdf", result.Data.FileName);
        }

        [Fact]
        public async Task Update_ShouldReplaceFileAndDeleteOldFile_WhenFileIsProvided()
        {
            // Arrange
            var db = CreateDbContext();
            var bp = new Individual { Id = Guid.NewGuid(), Name = "Cliente Replace", Email = "cliente.replace@test.com" };
            db.BusinessPartner.Add(bp);
            await db.SaveChangesAsync();
            var service = CreateService(db);

            var addResult = await service.Add(
                new AttachmentDto { File = CreateFormFile("original.pdf"), BusinessPartnerId = bp.Id },
                null
            );
            var oldFullPath = Path.Combine(
                _contentRoot,
                "attachments",
                "BusinessPartners",
                "Cliente Replace",
                "original.pdf"
            );
            Assert.True(File.Exists(oldFullPath));

            var updateDto = new AttachmentDto
            {
                Id = addResult.Data!.Id,
                BusinessPartnerId = bp.Id,
                File = CreateFormFile("updated.pdf"),
            };

            // Act
            var result = await service.Update(updateDto, null);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("updated.pdf", result.Data!.FileName);
            Assert.False(File.Exists(oldFullPath));
            Assert.True(
                File.Exists(
                    Path.Combine(_contentRoot, "attachments", "BusinessPartners", "Cliente Replace", "updated.pdf")
                )
            );
        }

        [Fact]
        public async Task Update_ShouldAppendIncrementalSuffix_WhenReplacementFileNameAlreadyExists()
        {
            // Arrange
            var db = CreateDbContext();
            var bp = new Individual { Id = Guid.NewGuid(), Name = "Cliente Suffix", Email = "cliente.suffix@test.com" };
            db.BusinessPartner.Add(bp);
            await db.SaveChangesAsync();
            var service = CreateService(db);

            await service.Add(
                new AttachmentDto { File = CreateFormFile("shared.pdf"), BusinessPartnerId = bp.Id },
                null
            );
            var addResult = await service.Add(
                new AttachmentDto { File = CreateFormFile("original.pdf"), BusinessPartnerId = bp.Id },
                null
            );

            var updateDto = new AttachmentDto
            {
                Id = addResult.Data!.Id,
                BusinessPartnerId = bp.Id,
                File = CreateFormFile("shared.pdf"),
            };

            // Act
            var result = await service.Update(updateDto, null);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("shared(1).pdf", result.Data!.FileName);
        }

        [Fact]
        public async Task Update_ShouldReturnError_WhenExceptionIsThrown()
        {
            // Arrange
            var db = CreateDbContext();
            var existing = new Attachment { Id = Guid.NewGuid(), FileName = "x.pdf", Path = "attachments/x.pdf" };
            db.Attachments.Add(existing);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            await db.DisposeAsync();

            // Act
            var result = await service.Update(new AttachmentDto { Id = existing.Id }, null);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        #endregion

        #region Delete

        [Fact]
        public async Task Delete_ShouldReturnError_WhenAttachmentIsNotFound()
        {
            // Arrange
            var db = CreateDbContext();
            var service = CreateService(db);

            // Act
            var result = await service.Delete(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal("Anexo não encontrado.", result.Message);
        }

        [Fact]
        public async Task Delete_ShouldRemoveAttachmentAndFile_WhenFound()
        {
            // Arrange
            var db = CreateDbContext();
            var bp = new Individual { Id = Guid.NewGuid(), Name = "Cliente Delete", Email = "cliente.delete@test.com" };
            db.BusinessPartner.Add(bp);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var addResult = await service.Add(
                new AttachmentDto { File = CreateFormFile("toDelete.pdf"), BusinessPartnerId = bp.Id },
                null
            );
            var fullPath = Path.Combine(
                _contentRoot,
                "attachments",
                "BusinessPartners",
                "Cliente Delete",
                "toDelete.pdf"
            );
            Assert.True(File.Exists(fullPath));

            // Act
            var result = await service.Delete(addResult.Data!.Id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.False(File.Exists(fullPath));
            Assert.Null(await db.Attachments.FindAsync(addResult.Data.Id));
        }

        [Fact]
        public async Task Delete_ShouldReturnError_WhenExceptionIsThrown()
        {
            // Arrange
            var db = CreateDbContext();
            var existing = new Attachment { Id = Guid.NewGuid(), FileName = "x.pdf", Path = "attachments/x.pdf" };
            db.Attachments.Add(existing);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            await db.DisposeAsync();

            // Act
            var result = await service.Delete(existing.Id);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        #endregion

        #region GetById

        [Fact]
        public async Task GetById_ShouldReturnNotFoundMessage_WhenFeatureToggleIsDisabled()
        {
            // Arrange
            var db = CreateDbContext();
            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Attachment, FeatureToggleKeys.AttachmentsModule))
                .ReturnsAsync(false);
            var service = CreateService(db);

            // Act
            var result = await service.GetById(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
            Assert.Equal("Não encontrado", result.Message);
        }

        [Fact]
        public async Task GetById_ShouldReturnData_WhenAttachmentIsFound()
        {
            // Arrange
            var db = CreateDbContext();
            var attachment = new Attachment { Id = Guid.NewGuid(), FileName = "x.pdf", Path = "attachments/x.pdf" };
            db.Attachments.Add(attachment);
            await db.SaveChangesAsync();
            var service = CreateService(db);

            // Act
            var result = await service.GetById(attachment.Id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(result.Data);
            Assert.Equal("Encontrado", result.Message);
        }

        [Fact]
        public async Task GetById_ShouldReturnNotFoundMessage_WhenAttachmentIsMissing()
        {
            // Arrange
            var db = CreateDbContext();
            var service = CreateService(db);

            // Act
            var result = await service.GetById(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
            Assert.Equal("Não encontrado", result.Message);
        }

        [Fact]
        public async Task GetById_ShouldReturnError_WhenExceptionIsThrown()
        {
            // Arrange
            var db = CreateDbContext();
            var service = CreateService(db);
            await db.DisposeAsync();

            // Act
            var result = await service.GetById(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        #endregion

        #region GetFileById

        [Fact]
        public async Task GetFileById_ShouldReturnError_WhenFeatureToggleIsDisabled()
        {
            // Arrange
            var db = CreateDbContext();
            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Attachment, FeatureToggleKeys.AttachmentsModule))
                .ReturnsAsync(false);
            var service = CreateService(db);

            // Act
            var result = await service.GetFileById(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal("Anexo não encontrado.", result.Message);
        }

        [Fact]
        public async Task GetFileById_ShouldReturnError_WhenAttachmentIsNotFound()
        {
            // Arrange
            var db = CreateDbContext();
            var service = CreateService(db);

            // Act
            var result = await service.GetFileById(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal("Anexo não encontrado.", result.Message);
        }

        [Fact]
        public async Task GetFileById_ShouldReturnError_WhenFileIsMissingOnDisk()
        {
            // Arrange
            var db = CreateDbContext();
            var attachment = new Attachment
            {
                Id = Guid.NewGuid(),
                FileName = "missing.pdf",
                Path = "attachments/missing.pdf",
            };
            db.Attachments.Add(attachment);
            await db.SaveChangesAsync();
            var service = CreateService(db);

            // Act
            var result = await service.GetFileById(attachment.Id);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Equal("Arquivo não encontrado no disco.", result.Message);
        }

        [Fact]
        public async Task GetFileById_ShouldReturnStream_WhenFileExistsOnDisk()
        {
            // Arrange
            var db = CreateDbContext();
            var bp = new Individual { Id = Guid.NewGuid(), Name = "Cliente File", Email = "cliente.file@test.com" };
            db.BusinessPartner.Add(bp);
            await db.SaveChangesAsync();
            var service = CreateService(db);
            var addResult = await service.Add(
                new AttachmentDto { File = CreateFormFile("readable.pdf"), BusinessPartnerId = bp.Id },
                null
            );

            // Act
            var result = await service.GetFileById(addResult.Data!.Id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("readable.pdf", result.Data!.FileName);
            Assert.NotNull(result.Data.Stream);
            result.Data.Stream.Dispose();
        }

        [Fact]
        public async Task GetFileById_ShouldReturnError_WhenExceptionIsThrown()
        {
            // Arrange
            var db = CreateDbContext();
            var service = CreateService(db);
            await db.DisposeAsync();

            // Act
            var result = await service.GetFileById(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        #endregion

        #region Get by relation id

        [Fact]
        public async Task GetByBusinessPartnerId_ShouldReturnOnlyMatchingAttachments()
        {
            // Arrange
            var db = CreateDbContext();
            var bpId = Guid.NewGuid();
            db.Attachments.Add(new Attachment { Id = Guid.NewGuid(), FileName = "a", Path = "p", BusinessPartnerId = bpId });
            db.Attachments.Add(new Attachment { Id = Guid.NewGuid(), FileName = "b", Path = "p", BusinessPartnerId = Guid.NewGuid() });
            await db.SaveChangesAsync();
            var service = CreateService(db);

            // Act
            var result = await service.GetByBusinessPartnerId(bpId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Single(result.Data!);
        }

        [Fact]
        public async Task GetByOrderId_ShouldReturnOnlyMatchingAttachments()
        {
            // Arrange
            var db = CreateDbContext();
            var orderId = Guid.NewGuid();
            db.Attachments.Add(new Attachment { Id = Guid.NewGuid(), FileName = "a", Path = "p", OrderId = orderId });
            db.Attachments.Add(new Attachment { Id = Guid.NewGuid(), FileName = "b", Path = "p", OrderId = Guid.NewGuid() });
            await db.SaveChangesAsync();
            var service = CreateService(db);

            // Act
            var result = await service.GetByOrderId(orderId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Single(result.Data!);
        }

        [Fact]
        public async Task GetByTripId_ShouldReturnOnlyMatchingAttachments()
        {
            // Arrange
            var db = CreateDbContext();
            var tripId = Guid.NewGuid();
            db.Attachments.Add(new Attachment { Id = Guid.NewGuid(), FileName = "a", Path = "p", TripId = tripId });
            await db.SaveChangesAsync();
            var service = CreateService(db);

            // Act
            var result = await service.GetByTripId(tripId);

            // Assert
            Assert.Single(result.Data!);
        }

        [Fact]
        public async Task GetByPurchaseOrderId_ShouldReturnOnlyMatchingAttachments()
        {
            // Arrange
            var db = CreateDbContext();
            var purchaseOrderId = Guid.NewGuid();
            db.Attachments.Add(
                new Attachment { Id = Guid.NewGuid(), FileName = "a", Path = "p", PurchaseOrderId = purchaseOrderId }
            );
            await db.SaveChangesAsync();
            var service = CreateService(db);

            // Act
            var result = await service.GetByPurchaseOrderId(purchaseOrderId);

            // Assert
            Assert.Single(result.Data!);
        }

        [Fact]
        public async Task GetByTransactionId_ShouldReturnOnlyMatchingAttachments()
        {
            // Arrange
            var db = CreateDbContext();
            var transactionId = Guid.NewGuid();
            db.Attachments.Add(
                new Attachment { Id = Guid.NewGuid(), FileName = "a", Path = "p", TransactionId = transactionId }
            );
            await db.SaveChangesAsync();
            var service = CreateService(db);

            // Act
            var result = await service.GetByTransactionId(transactionId);

            // Assert
            Assert.Single(result.Data!);
        }

        [Fact]
        public async Task GetByPaymentId_ShouldReturnOnlyMatchingAttachments()
        {
            // Arrange
            var db = CreateDbContext();
            var paymentId = Guid.NewGuid();
            db.Attachments.Add(new Attachment { Id = Guid.NewGuid(), FileName = "a", Path = "p", PaymentId = paymentId });
            await db.SaveChangesAsync();
            var service = CreateService(db);

            // Act
            var result = await service.GetByPaymentId(paymentId);

            // Assert
            Assert.Single(result.Data!);
        }

        [Fact]
        public async Task GetByProductId_ShouldReturnOnlyMatchingAttachments()
        {
            // Arrange
            var db = CreateDbContext();
            var productId = Guid.NewGuid();
            db.Attachments.Add(new Attachment { Id = Guid.NewGuid(), FileName = "a", Path = "p", ProductId = productId });
            await db.SaveChangesAsync();
            var service = CreateService(db);

            // Act
            var result = await service.GetByProductId(productId);

            // Assert
            Assert.Single(result.Data!);
        }

        [Fact]
        public async Task GetByVehicleId_ShouldReturnOnlyMatchingAttachments()
        {
            // Arrange
            var db = CreateDbContext();
            var vehicleId = Guid.NewGuid();
            db.Attachments.Add(new Attachment { Id = Guid.NewGuid(), FileName = "a", Path = "p", VehicleId = vehicleId });
            await db.SaveChangesAsync();
            var service = CreateService(db);

            // Act
            var result = await service.GetByVehicleId(vehicleId);

            // Assert
            Assert.Single(result.Data!);
        }

        [Fact]
        public async Task GetByDriverId_ShouldReturnOnlyMatchingAttachments()
        {
            // Arrange
            var db = CreateDbContext();
            var driverId = Guid.NewGuid();
            db.Attachments.Add(new Attachment { Id = Guid.NewGuid(), FileName = "a", Path = "p", DriverId = driverId });
            await db.SaveChangesAsync();
            var service = CreateService(db);

            // Act
            var result = await service.GetByDriverId(driverId);

            // Assert
            Assert.Single(result.Data!);
        }

        [Fact]
        public async Task GetByVehicleMaintenanceId_ShouldReturnOnlyMatchingAttachments()
        {
            // Arrange
            var db = CreateDbContext();
            var maintenanceId = Guid.NewGuid();
            db.Attachments.Add(
                new Attachment { Id = Guid.NewGuid(), FileName = "a", Path = "p", VehicleMaintenanceId = maintenanceId }
            );
            await db.SaveChangesAsync();
            var service = CreateService(db);

            // Act
            var result = await service.GetByVehicleMaintenanceId(maintenanceId);

            // Assert
            Assert.Single(result.Data!);
        }

        [Fact]
        public async Task GetByUserId_ShouldReturnOnlyMatchingAttachments()
        {
            // Arrange
            var db = CreateDbContext();
            db.Attachments.Add(new Attachment { Id = Guid.NewGuid(), FileName = "a", Path = "p", UserId = "user-1" });
            db.Attachments.Add(new Attachment { Id = Guid.NewGuid(), FileName = "b", Path = "p", UserId = "user-2" });
            await db.SaveChangesAsync();
            var service = CreateService(db);

            // Act
            var result = await service.GetByUserId("user-1");

            // Assert
            Assert.Single(result.Data!);
        }

        [Fact]
        public async Task GetByUserId_ShouldReturnError_WhenExceptionIsThrown()
        {
            // Arrange
            var db = CreateDbContext();
            var service = CreateService(db);
            await db.DisposeAsync();

            // Act
            var result = await service.GetByUserId("user-1");

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        #endregion
    }
}
