using System;
using System.Collections.Generic;
using System.Linq.Expressions;
using System.Threading.Tasks;
using AutoMapper;
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
    public class QuoteServiceTests
    {
        private readonly QuoteService _quoteService;
        private readonly Mock<IRepository<Quote>> _repository;
        private readonly Mock<IRepository<QuoteTrip>> _quoteTripRepository;
        private readonly Mock<ISequenceService> _sequenceService;
        private readonly Mock<ILogService> _logService;
        private readonly Mock<IRepository<Product>> _productRepository;
        private readonly Mock<IOrderService> _orderService;
        private readonly Mock<ITripService> _tripService;
        private readonly Mock<IFeatureToggleService> _featureToggleService;
        private readonly IMapper _mapper;

        public QuoteServiceTests()
        {
            var config = new MapperConfiguration(
                cfg =>
                {
                    cfg.ConstructServicesUsing(type => null);
                    cfg.AddMaps(typeof(MappingProfile).Assembly);
                },
                new LoggerFactory()
            );
            _repository = new Mock<IRepository<Quote>>();
            _quoteTripRepository = new Mock<IRepository<QuoteTrip>>();
            _sequenceService = new Mock<ISequenceService>();
            _logService = new Mock<ILogService>();
            _productRepository = new Mock<IRepository<Product>>();
            _orderService = new Mock<IOrderService>();
            _tripService = new Mock<ITripService>();
            _featureToggleService = new Mock<IFeatureToggleService>();
            _mapper = config.CreateMapper();
            _quoteService = new QuoteService(
                _repository.Object,
                _quoteTripRepository.Object,
                _sequenceService.Object,
                _mapper,
                _logService.Object,
                _productRepository.Object,
                _orderService.Object,
                _tripService.Object,
                _featureToggleService.Object
            );

            // Default: fleet module enabled, so the toggle guard is bypassed unless a test overrides this.
            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(It.IsAny<string>()))
                .ReturnsAsync(true);
            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);
        }

        [Fact]
        public async Task QuoteService_FindByQuoteNumber_ShouldReturnNoData_WhenTripQuoteAndFleetModuleDisabled()
        {
            // Arrange
            var quote = new Quote
            {
                Id = Guid.NewGuid(),
                QuoteNumber = "SER-Q00001",
                Type = QuoteType.Trip,
            };

            _repository
                .Setup(_ =>
                    _.FirstOrDefaultAsync(
                        It.IsAny<Expression<Func<Quote, bool>>>(),
                        It.IsAny<Expression<Func<Quote, object>>[]>()
                    )
                )
                .ReturnsAsync(quote);
            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _quoteService.FindByQuoteNumber("SER-Q00001");

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task QuoteService_FindByBusinessPartnerId_ShouldFilterOutTripQuotes_WhenFleetModuleDisabled()
        {
            // Arrange
            var businessPartnerId = Guid.NewGuid();
            var quotes = new List<Quote>
            {
                new() { Id = Guid.NewGuid(), Type = QuoteType.Product },
                new() { Id = Guid.NewGuid(), Type = QuoteType.Trip },
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Quote, bool>>>()))
                .ReturnsAsync(quotes);
            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _quoteService.FindByBusinessPartnerId(businessPartnerId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Single(result.Data);
            Assert.All(result.Data, q => Assert.Equal(QuoteType.Product, q.Type));
        }

        [Fact]
        public async Task QuoteService_FindByProductId_ShouldFilterOutTripQuotes_WhenFleetModuleDisabled()
        {
            // Arrange
            var productId = Guid.NewGuid();
            var quotes = new List<Quote>
            {
                new() { Id = Guid.NewGuid(), Type = QuoteType.Product },
                new() { Id = Guid.NewGuid(), Type = QuoteType.Trip },
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Quote, bool>>>()))
                .ReturnsAsync(quotes);
            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _quoteService.FindByProductId(productId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Single(result.Data);
            Assert.All(result.Data, q => Assert.Equal(QuoteType.Product, q.Type));
        }

        [Fact]
        public async Task QuoteService_FindByBusinessPartnerId_ShouldFilterOutProductQuotes_WhenQuotesModuleDisabled()
        {
            // Arrange
            var businessPartnerId = Guid.NewGuid();
            var quotes = new List<Quote>
            {
                new() { Id = Guid.NewGuid(), Type = QuoteType.Product },
                new() { Id = Guid.NewGuid(), Type = QuoteType.Trip },
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Quote, bool>>>()))
                .ReturnsAsync(quotes);
            _featureToggleService
                .Setup(_ =>
                    _.IsEnabledAsync(FeatureToggleKeys.Quote, FeatureToggleKeys.QuotesModule)
                )
                .ReturnsAsync(false);

            // Act
            var result = await _quoteService.FindByBusinessPartnerId(businessPartnerId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Single(result.Data);
            Assert.All(result.Data, q => Assert.Equal(QuoteType.Trip, q.Type));
        }

        [Fact]
        public async Task QuoteService_FindByProductId_ShouldFilterOutProductQuotes_WhenQuotesModuleDisabled()
        {
            // Arrange
            var productId = Guid.NewGuid();
            var quotes = new List<Quote>
            {
                new() { Id = Guid.NewGuid(), Type = QuoteType.Product },
                new() { Id = Guid.NewGuid(), Type = QuoteType.Trip },
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Quote, bool>>>()))
                .ReturnsAsync(quotes);
            _featureToggleService
                .Setup(_ =>
                    _.IsEnabledAsync(FeatureToggleKeys.Quote, FeatureToggleKeys.QuotesModule)
                )
                .ReturnsAsync(false);

            // Act
            var result = await _quoteService.FindByProductId(productId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Single(result.Data);
            Assert.All(result.Data, q => Assert.Equal(QuoteType.Trip, q.Type));
        }

        [Fact]
        public async Task QuoteService_FindByQuoteNumber_ShouldReturnNoData_WhenProductQuoteAndQuotesModuleDisabled()
        {
            // Arrange
            var quote = new Quote
            {
                Id = Guid.NewGuid(),
                QuoteNumber = "SER-Q00001",
                Type = QuoteType.Product,
            };

            _repository
                .Setup(_ =>
                    _.FirstOrDefaultAsync(
                        It.IsAny<Expression<Func<Quote, bool>>>(),
                        It.IsAny<Expression<Func<Quote, object>>[]>()
                    )
                )
                .ReturnsAsync(quote);
            _featureToggleService
                .Setup(_ =>
                    _.IsEnabledAsync(FeatureToggleKeys.Quote, FeatureToggleKeys.QuotesModule)
                )
                .ReturnsAsync(false);

            // Act
            var result = await _quoteService.FindByQuoteNumber("SER-Q00001");

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task QuoteService_ConvertToTrip_ShouldReturnWarning_WhenFleetModuleDisabled()
        {
            // Arrange
            var quoteDto = new QuoteDto
            {
                Id = Guid.NewGuid(),
                QuoteNumber = "SER-Q00001",
                Type = QuoteType.Trip,
                BusinessPartnerId = Guid.NewGuid(),
            };

            _featureToggleService
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.FleetModule))
                .ReturnsAsync(false);

            // Act
            var result = await _quoteService.ConvertToTrip(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _tripService.Verify(_ => _.Add(It.IsAny<TripDto>()), Times.Never);
        }

        [Fact]
        public async Task QuoteService_Add_ShouldPersistQuoteTrip_WhenTypeIsTripAndQuoteTripIsProvided()
        {
            // Arrange
            var quoteDto = new QuoteDto
            {
                BusinessPartnerId = Guid.NewGuid(),
                BusinessPartnerName = "SER",
                Type = QuoteType.Trip,
                QuoteTrip = new QuoteTripDto { Route = "SP-RJ", DistanceKm = 450, DailyCount = 1 },
            };

            _sequenceService.Setup(_ => _.GetNextValue("QuoteNumberSeq")).ReturnsAsync(1);

            // Act
            var result = await _quoteService.Add(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(result.Data.QuoteTrip);
            Assert.Equal("SP-RJ", result.Data.QuoteTrip.Route);
            _quoteTripRepository.Verify(
                _ =>
                    _.AddAsync(
                        It.Is<QuoteTrip>(qt =>
                            qt.Route == "SP-RJ" && qt.QuoteId == result.Data.Id
                        )
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task QuoteService_Add_ShouldNotPersistQuoteTrip_WhenTypeIsProduct()
        {
            // Arrange
            var quoteDto = new QuoteDto
            {
                BusinessPartnerId = Guid.NewGuid(),
                BusinessPartnerName = "SER",
                Type = QuoteType.Product,
            };

            _sequenceService.Setup(_ => _.GetNextValue("QuoteNumberSeq")).ReturnsAsync(1);

            // Act
            var result = await _quoteService.Add(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data.QuoteTrip);
            _quoteTripRepository.Verify(_ => _.AddAsync(It.IsAny<QuoteTrip>()), Times.Never);
        }

        [Fact]
        public async Task QuoteService_Update_ShouldCreateQuoteTrip_WhenNoneExistsYet()
        {
            // Arrange
            var quoteId = Guid.NewGuid();
            var quoteDto = new QuoteDto
            {
                Id = quoteId,
                QuoteNumber = "SER-Q00001",
                Type = QuoteType.Trip,
                QuoteTrip = new QuoteTripDto { Route = "SP-RJ", DistanceKm = 450 },
            };

            _quoteTripRepository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<QuoteTrip, bool>>>()))
                .ReturnsAsync((QuoteTrip)null);

            // Act
            var result = await _quoteService.Update(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _quoteTripRepository.Verify(
                _ => _.AddAsync(It.Is<QuoteTrip>(qt => qt.QuoteId == quoteId)),
                Times.Once
            );
            _quoteTripRepository.Verify(_ => _.UpdateAsync(It.IsAny<QuoteTrip>()), Times.Never);
        }

        [Fact]
        public async Task QuoteService_Update_ShouldUpdateExistingQuoteTrip()
        {
            // Arrange
            var quoteId = Guid.NewGuid();
            var existingQuoteTrip = new QuoteTrip { Id = Guid.NewGuid(), QuoteId = quoteId };
            var quoteDto = new QuoteDto
            {
                Id = quoteId,
                QuoteNumber = "SER-Q00001",
                Type = QuoteType.Trip,
                QuoteTrip = new QuoteTripDto { Route = "RJ-SP", DistanceKm = 460 },
            };

            _quoteTripRepository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<QuoteTrip, bool>>>()))
                .ReturnsAsync(existingQuoteTrip);

            // Act
            var result = await _quoteService.Update(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("RJ-SP", result.Data.QuoteTrip.Route);
            _quoteTripRepository.Verify(
                _ => _.UpdateAsync(It.Is<QuoteTrip>(qt => qt.Route == "RJ-SP")),
                Times.Once
            );
            _quoteTripRepository.Verify(_ => _.AddAsync(It.IsAny<QuoteTrip>()), Times.Never);
        }

        [Fact]
        public async Task QuoteService_ConvertToTrip_ShouldCarryQuoteTripFieldsIntoTripDto()
        {
            // Arrange
            var vehicleId = Guid.NewGuid();
            var driverId = Guid.NewGuid();
            var quoteDto = new QuoteDto
            {
                Id = Guid.NewGuid(),
                QuoteNumber = "SER-Q00001",
                Type = QuoteType.Trip,
                BusinessPartnerId = Guid.NewGuid(),
                QuoteTrip = new QuoteTripDto
                {
                    Route = "SP-RJ",
                    DistanceKm = 450,
                    DailyCount = 2,
                    TransportLicenseNumber = "ANTT-123",
                    VehicleId = vehicleId,
                    DriverId = driverId,
                },
            };

            TripDto capturedTripDto = null;
            _tripService
                .Setup(_ => _.Add(It.IsAny<TripDto>()))
                .Callback<TripDto>(dto => capturedTripDto = dto)
                .ReturnsAsync(new WebApiResponse<TripDto> { Status = ResponseStatus.Success });

            // Act
            var result = await _quoteService.ConvertToTrip(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(capturedTripDto);
            Assert.Equal("SP-RJ", capturedTripDto.Route);
            Assert.Equal(450, capturedTripDto.DistanceKm);
            Assert.Equal(2, capturedTripDto.DailyCount);
            Assert.Equal("ANTT-123", capturedTripDto.TransportLicenseNumber);
            Assert.Equal(vehicleId, capturedTripDto.VehicleId);
            Assert.Equal(driverId, capturedTripDto.DriverId);
        }

        [Fact]
        public async Task QuoteService_Add_ShouldReturnError_WhenSequenceServiceThrows()
        {
            // Arrange
            var quoteDto = new QuoteDto { BusinessPartnerName = "SER" };
            _sequenceService
                .Setup(_ => _.GetNextValue(It.IsAny<string>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _quoteService.Add(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task QuoteService_Update_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var quoteDto = new QuoteDto { Id = Guid.NewGuid(), Type = QuoteType.Product };
            _repository.Setup(r => r.UpdateAsync(It.IsAny<Quote>())).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _quoteService.Update(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task QuoteService_Remove_ShouldRemoveQuoteSuccessfully_WhenQuoteExists()
        {
            // Arrange
            var quoteId = Guid.NewGuid();
            var quoteDto = new QuoteDto { Id = quoteId, QuoteNumber = "SER-Q00001" };
            var quoteEntity = new Quote { Id = quoteId, QuoteNumber = "SER-Q00001" };

            _repository
                .Setup(r => r.GetByIdAsync(quoteId, q => q.QuoteProducts))
                .ReturnsAsync(quoteEntity);

            // Act
            var result = await _quoteService.Remove(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _repository.Verify(r => r.RemoveAsync(quoteEntity), Times.Once);
        }

        [Fact]
        public async Task QuoteService_Remove_ShouldReturnError_WhenQuoteIsNotFound()
        {
            // Arrange
            var quoteDto = new QuoteDto { Id = Guid.NewGuid(), QuoteNumber = "SER-Q00001" };
            _repository
                .Setup(r => r.GetByIdAsync(quoteDto.Id, q => q.QuoteProducts))
                .ReturnsAsync((Quote)null);

            // Act
            var result = await _quoteService.Remove(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Null(result.Data);
            _repository.Verify(r => r.RemoveAsync(It.IsAny<Quote>()), Times.Never);
        }

        [Fact]
        public async Task QuoteService_Remove_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var quoteDto = new QuoteDto { Id = Guid.NewGuid() };
            _repository
                .Setup(r => r.GetByIdAsync(quoteDto.Id, q => q.QuoteProducts))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _quoteService.Remove(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task QuoteService_FindAll_ShouldReturnQuotes_WhenDataExists()
        {
            // Arrange
            var quotes = new List<Quote>
            {
                new() { Id = Guid.NewGuid(), Type = QuoteType.Product },
                new() { Id = Guid.NewGuid(), Type = QuoteType.Trip },
            };
            _repository
                .Setup(r =>
                    r.GetAllAsync(
                        true,
                        It.IsAny<Expression<Func<Quote, object>>>(),
                        It.IsAny<Expression<Func<Quote, object>>>(),
                        It.IsAny<Expression<Func<Quote, object>>>(),
                        It.IsAny<Expression<Func<Quote, object>>>()
                    )
                )
                .ReturnsAsync(quotes);

            // Act
            var result = await _quoteService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(2, result.Data.Count());
        }

        [Fact]
        public async Task QuoteService_FindAll_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetAllAsync(
                        true,
                        It.IsAny<Expression<Func<Quote, object>>>(),
                        It.IsAny<Expression<Func<Quote, object>>>(),
                        It.IsAny<Expression<Func<Quote, object>>>(),
                        It.IsAny<Expression<Func<Quote, object>>>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _quoteService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task QuoteService_FindById_ShouldReturnQuote_WhenIdIsValid()
        {
            // Arrange
            var id = Guid.NewGuid();
            var quote = new Quote { Id = id, QuoteNumber = "SER-Q00001", Type = QuoteType.Product };
            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        id,
                        It.IsAny<Expression<Func<Quote, object>>>(),
                        It.IsAny<Expression<Func<Quote, object>>>(),
                        It.IsAny<Expression<Func<Quote, object>>>(),
                        It.IsAny<Expression<Func<Quote, object>>>()
                    )
                )
                .ReturnsAsync(quote);

            // Act
            var result = await _quoteService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(result.Data);
            Assert.Equal("SER-Q00001", result.Data.QuoteNumber);
        }

        [Fact]
        public async Task QuoteService_FindById_ShouldReturnNoData_WhenIdIsNotFound()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        id,
                        It.IsAny<Expression<Func<Quote, object>>>(),
                        It.IsAny<Expression<Func<Quote, object>>>(),
                        It.IsAny<Expression<Func<Quote, object>>>(),
                        It.IsAny<Expression<Func<Quote, object>>>()
                    )
                )
                .ReturnsAsync((Quote)null);

            // Act
            var result = await _quoteService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
            Assert.Equal($"Nenhum Orçamento com o ID {id} foi encontrado", result.Message);
        }

        [Fact]
        public async Task QuoteService_FindById_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        id,
                        It.IsAny<Expression<Func<Quote, object>>>(),
                        It.IsAny<Expression<Func<Quote, object>>>(),
                        It.IsAny<Expression<Func<Quote, object>>>(),
                        It.IsAny<Expression<Func<Quote, object>>>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _quoteService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task QuoteService_FindByQuoteNumber_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ =>
                    _.FirstOrDefaultAsync(
                        It.IsAny<Expression<Func<Quote, bool>>>(),
                        It.IsAny<Expression<Func<Quote, object>>[]>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _quoteService.FindByQuoteNumber("SER-Q00001");

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task QuoteService_FindByBusinessPartnerId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Quote, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _quoteService.FindByBusinessPartnerId(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task QuoteService_FindByProductId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Quote, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _quoteService.FindByProductId(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task QuoteService_ConvertToOrder_ShouldReturnError_WhenQuoteDtoIsNull()
        {
            // Act
            var result = await _quoteService.ConvertToOrder(null);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task QuoteService_ConvertToOrder_ShouldConvertSuccessfully_WhenStockIsSufficient()
        {
            // Arrange
            var quoteId = Guid.NewGuid();
            var productId = Guid.NewGuid();
            var quoteDto = new QuoteDto
            {
                Id = quoteId,
                QuoteNumber = "SER-Q00001",
                BusinessPartnerId = Guid.NewGuid(),
                QuoteProducts = new List<QuoteProductDto>
                {
                    new()
                    {
                        ProductId = productId,
                        ProductType = ProductType.Sale,
                        Quantity = 2,
                    },
                },
            };

            var product = new Product { Id = productId, Name = "Produto", QuantityInStock = 10 };
            _productRepository
                .Setup(r => r.QueryAsync(It.IsAny<Expression<Func<Product, bool>>>(), true))
                .ReturnsAsync(new List<Product> { product });
            _orderService
                .Setup(_ => _.Add(It.IsAny<OrderDto>()))
                .ReturnsAsync(new WebApiResponse<OrderDto> { Status = ResponseStatus.Success });

            var quoteEntity = new Quote { Id = quoteId, Status = QuoteStatus.Open };
            _repository
                .Setup(r => r.GetByIdAsync(quoteId, q => q.QuoteProducts))
                .ReturnsAsync(quoteEntity);

            // Act
            var result = await _quoteService.ConvertToOrder(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(QuoteStatus.Converted, quoteEntity.Status);
            _orderService.Verify(_ => _.Add(It.IsAny<OrderDto>()), Times.Once);
            _repository.Verify(r => r.UpdateAsync(quoteEntity), Times.Once);
        }

        [Fact]
        public async Task QuoteService_ConvertToOrder_ShouldReturnWarning_WhenProductIsOutOfStock()
        {
            // Arrange
            var productId = Guid.NewGuid();
            var otherProductId = Guid.NewGuid();
            var quoteDto = new QuoteDto
            {
                Id = Guid.NewGuid(),
                QuoteNumber = "SER-Q00001",
                BusinessPartnerId = Guid.NewGuid(),
                QuoteProducts = new List<QuoteProductDto>
                {
                    new()
                    {
                        ProductId = productId,
                        ProductType = ProductType.Sale,
                        Quantity = 10,
                    },
                    new()
                    {
                        ProductId = otherProductId,
                        ProductType = ProductType.Sale,
                        Quantity = 1,
                    },
                },
            };

            var lowStockProduct = new Product { Id = productId, Name = "Produto1", QuantityInStock = 1 };
            var okProduct = new Product { Id = otherProductId, Name = "Produto2", QuantityInStock = 5 };
            _productRepository
                .Setup(r => r.QueryAsync(It.IsAny<Expression<Func<Product, bool>>>(), true))
                .ReturnsAsync(new List<Product> { lowStockProduct, okProduct });

            // Act
            var result = await _quoteService.ConvertToOrder(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            Assert.NotNull(result.Data);
            Assert.Single(result.Data.QuoteProducts);
            _orderService.Verify(_ => _.Add(It.IsAny<OrderDto>()), Times.Never);
        }

        [Fact]
        public async Task QuoteService_ConvertToOrder_ShouldReturnWarningWithNoData_WhenAllProductsAreOutOfStock()
        {
            // Arrange
            var productId = Guid.NewGuid();
            var quoteDto = new QuoteDto
            {
                Id = Guid.NewGuid(),
                QuoteNumber = "SER-Q00001",
                BusinessPartnerId = Guid.NewGuid(),
                QuoteProducts = new List<QuoteProductDto>
                {
                    new()
                    {
                        ProductId = productId,
                        ProductType = ProductType.Rental,
                        Quantity = 10,
                    },
                },
            };

            var lowStockProduct = new Product { Id = productId, Name = "Produto1", QuantityInStock = 0 };
            _productRepository
                .Setup(r => r.QueryAsync(It.IsAny<Expression<Func<Product, bool>>>(), true))
                .ReturnsAsync(new List<Product> { lowStockProduct });

            // Act
            var result = await _quoteService.ConvertToOrder(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task QuoteService_ConvertToOrder_ShouldCreateTransaction_WhenPaymentsAreInformed()
        {
            // Arrange
            var quoteId = Guid.NewGuid();
            var quoteDto = new QuoteDto
            {
                Id = quoteId,
                QuoteNumber = "SER-Q00001",
                BusinessPartnerId = Guid.NewGuid(),
                TotalOfPayments = 2,
                PaymentTotalPrice = 100m,
            };

            OrderDto capturedOrderDto = null;
            _orderService
                .Setup(_ => _.Add(It.IsAny<OrderDto>()))
                .Callback<OrderDto>(dto => capturedOrderDto = dto)
                .ReturnsAsync(new WebApiResponse<OrderDto> { Status = ResponseStatus.Success });
            _repository
                .Setup(r => r.GetByIdAsync(quoteId, q => q.QuoteProducts))
                .ReturnsAsync((Quote)null);

            // Act
            var result = await _quoteService.ConvertToOrder(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(capturedOrderDto.Transaction);
            Assert.Equal(2, capturedOrderDto.Transaction.TotalOfPayments);
        }

        [Fact]
        public async Task QuoteService_ConvertToOrder_ShouldReturnError_WhenAnExceptionIsThrown()
        {
            // Arrange
            var quoteDto = new QuoteDto
            {
                Id = Guid.NewGuid(),
                QuoteNumber = "SER-Q00001",
                BusinessPartnerId = Guid.NewGuid(),
                QuoteProducts = new List<QuoteProductDto>
                {
                    new()
                    {
                        ProductId = Guid.NewGuid(),
                        ProductType = ProductType.Sale,
                        Quantity = 1,
                    },
                },
            };
            _productRepository
                .Setup(r => r.QueryAsync(It.IsAny<Expression<Func<Product, bool>>>(), true))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _quoteService.ConvertToOrder(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task QuoteService_ConvertToTrip_ShouldReturnError_WhenQuoteDtoIsNull()
        {
            // Act
            var result = await _quoteService.ConvertToTrip(null);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task QuoteService_ConvertToTrip_ShouldConvertSuccessfully_WhenQuoteTripIsNull()
        {
            // Arrange
            var quoteId = Guid.NewGuid();
            var quoteDto = new QuoteDto
            {
                Id = quoteId,
                QuoteNumber = "SER-Q00001",
                BusinessPartnerId = Guid.NewGuid(),
                QuoteTrip = null,
            };

            var quoteEntity = new Quote { Id = quoteId, Status = QuoteStatus.Open };
            _repository
                .Setup(r => r.GetByIdAsync(quoteId, q => q.QuoteProducts))
                .ReturnsAsync(quoteEntity);
            _tripService
                .Setup(_ => _.Add(It.IsAny<TripDto>()))
                .ReturnsAsync(new WebApiResponse<TripDto> { Status = ResponseStatus.Success });

            // Act
            var result = await _quoteService.ConvertToTrip(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(QuoteStatus.Converted, quoteEntity.Status);
        }

        [Fact]
        public async Task QuoteService_ConvertToTrip_ShouldCreateTransaction_WhenPaymentsAreInformed()
        {
            // Arrange
            var quoteDto = new QuoteDto
            {
                Id = Guid.NewGuid(),
                QuoteNumber = "SER-Q00001",
                BusinessPartnerId = Guid.NewGuid(),
                TotalOfExpenses = 1,
                ExpenseTotalPrice = 50m,
            };

            TripDto capturedTripDto = null;
            _tripService
                .Setup(_ => _.Add(It.IsAny<TripDto>()))
                .Callback<TripDto>(dto => capturedTripDto = dto)
                .ReturnsAsync(new WebApiResponse<TripDto> { Status = ResponseStatus.Success });
            _repository
                .Setup(r => r.GetByIdAsync(quoteDto.Id, q => q.QuoteProducts))
                .ReturnsAsync((Quote)null);

            // Act
            var result = await _quoteService.ConvertToTrip(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(capturedTripDto.Transaction);
            Assert.Equal(1, capturedTripDto.Transaction.TotalOfExpenses);
        }

        [Fact]
        public async Task QuoteService_ConvertToTrip_ShouldReturnError_WhenAnExceptionIsThrown()
        {
            // Arrange
            var quoteDto = new QuoteDto
            {
                Id = Guid.NewGuid(),
                QuoteNumber = "SER-Q00001",
                BusinessPartnerId = Guid.NewGuid(),
            };
            _tripService.Setup(_ => _.Add(It.IsAny<TripDto>())).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _quoteService.ConvertToTrip(quoteDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }
    }
}
