using System;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using AutoMapper;
using FluentAssertions;
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
    public class OrderServiceTests
    {
        private readonly OrderService _orderService;
        private readonly Mock<IRepository<Order>> _repository;
        private readonly Mock<ITransactionService> _transactionService;
        private readonly Mock<ISequenceService> _sequenceService;
        private readonly Mock<ICurrentUserService> _currentUserService;
        private readonly Mock<IFeatureToggleService> _featureToggleServiceMock;
        private readonly Mock<ILogService> _logService;
        private readonly IList<OrderDto> _orderListMock;
        private readonly IMapper _mapper;

        public OrderServiceTests()
        {
            var config = new MapperConfiguration(
                cfg =>
                {
                    cfg.ConstructServicesUsing(type => null);
                    cfg.AddMaps(typeof(MappingProfile).Assembly);
                },
                new LoggerFactory()
            );
            _repository = new Mock<IRepository<Order>>();
            _transactionService = new Mock<ITransactionService>();
            _sequenceService = new Mock<ISequenceService>();
            _currentUserService = new Mock<ICurrentUserService>();
            _featureToggleServiceMock = new Mock<IFeatureToggleService>();
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(It.IsAny<string>()))
                .ReturnsAsync(true);
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);
            _logService = new Mock<ILogService>();
            _mapper = config.CreateMapper();
            _orderService = new OrderService(
                _repository.Object,
                _transactionService.Object,
                _sequenceService.Object,
                _currentUserService.Object,
                _mapper,
                _featureToggleServiceMock.Object,
                _logService.Object
            );

            // Default: current user is Admin, so ownership checks are bypassed unless a test overrides this.
            _currentUserService.Setup(_ => _.IsInRole("Admin")).Returns(true);

            // Default: no previous Order state found, so the ownership-by-id lookup is safely
            // skipped unless a test overrides this.
            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Order, bool>>>()))
                .ReturnsAsync(new List<Order>());

            _orderListMock = new List<OrderDto>
            {
                new OrderDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    OrderNumber = "ORD-00001",
                    Description = "Pedido Teste1",
                    BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    BusinessPartnerName = "ORD",
                    Transaction = new TransactionDto(),
                    TransactionId = Guid.Parse("00000000-0000-0000-0000-000000000000"),
                    QuoteNumber = string.Empty,
                },
                new OrderDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    OrderNumber = "THG-00002",
                    Description = "Pedido Teste2",
                    BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    BusinessPartnerName = "THG",
                    Transaction = new TransactionDto(),
                    TransactionId = Guid.Parse("00000000-0000-0000-0000-000000000000"),
                    QuoteNumber = string.Empty,
                },
            };
        }

        [Fact]
        public async Task OrderService_Add_ShouldAddOrderSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var orderDto = new OrderDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                OrderNumber = "ORD-00001",
                Description = "Novo Pedido",
                BusinessPartnerName = "ORD",
                Transaction = new TransactionDto(),
                QuoteNumber = string.Empty,
            };

            var transactionDto = new TransactionDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                OrderId = Guid.Parse("00000000-0000-0000-0000-000000000003"),
            };

            _repository.Setup(r => r.AddAsync(It.IsAny<Order>())).Returns(Task.CompletedTask);
            _transactionService
                .Setup(_ => _.Add(It.IsAny<TransactionDto>()))
                .ReturnsAsync(new WebApiResponse<TransactionDto> { Data = transactionDto });
            _sequenceService.Setup(_ => _.GetNextValue(It.IsAny<string>())).ReturnsAsync(1);

            var expected = new WebApiResponse<OrderDto>
            {
                Data = new OrderDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                    OrderNumber = "ORD-00001",
                    Description = "Novo Pedido",
                    Transaction = new TransactionDto(),
                    TransactionId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    QuoteNumber = string.Empty,
                },
                Status = ResponseStatus.Success,
                Message = $"Pedido {orderDto.OrderNumber} cadastrado com sucesso.",
            };

            // Act
            var result = await _orderService.Add(orderDto);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(r => r.AddAsync(It.IsAny<Order>()), Times.Once);
        }

        [Fact]
        public async Task OrderService_Remove_ShouldRemoveOrderSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var orderDto = _orderListMock.First();
            var orderEntity = _mapper.Map<Order>(_orderListMock.First());

            _repository
                .Setup(r =>
                    r.GetByIdAsync(It.IsAny<Guid>(), o => o.OrderProducts, p => p.Transaction)
                )
                .ReturnsAsync(orderEntity);
            _repository.Setup(r => r.RemoveAsync(It.IsAny<Order>())).Returns(Task.CompletedTask);

            var expected = new WebApiResponse<OrderDto>
            {
                Data = orderDto,
                Status = ResponseStatus.Success,
                Message = $"Pedido {orderDto.OrderNumber} removido com sucesso.",
            };

            // Act
            var result = await _orderService.Remove(orderDto);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(r => r.RemoveAsync(It.IsAny<Order>()), Times.Once);
        }

        [Fact]
        public async Task OrderService_Remove_ShouldReturnWarningAndNotRemove_WhenOrderBelongsToAnotherUserAndCurrentUserIsNotAdmin()
        {
            // Arrange
            var orderDto = _orderListMock.First();
            var orderEntity = _mapper.Map<Order>(_orderListMock.First());
            orderEntity.CreateUserId = "owner-user-id";

            _repository
                .Setup(r =>
                    r.GetByIdAsync(It.IsAny<Guid>(), o => o.OrderProducts, p => p.Transaction)
                )
                .ReturnsAsync(orderEntity);

            _currentUserService.Setup(_ => _.IsInRole("Admin")).Returns(false);
            _currentUserService.Setup(_ => _.GetUserId()).Returns("another-user-id");

            // Act
            var result = await _orderService.Remove(orderDto);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _repository.Verify(r => r.RemoveAsync(It.IsAny<Order>()), Times.Never);
        }

        [Fact]
        public async Task OrderService_FindById_ShouldReturnOrder_WhenIdIsValid()
        {
            // Arrange
            var id = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var orderDto = _orderListMock.First(o => o.Id == id);
            var orderEntity = _mapper.Map<Order>(orderDto);
            orderEntity.BusinessPartner = new Individual { Name = "ORD" };

            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        id,
                        true,
                        true,
                        o => o.BusinessPartner,
                        op => op.OrderProducts,
                        t => t.Transaction,
                        p => p.Transaction.Payments
                    )
                )
                .ReturnsAsync(orderEntity);

            var expected = new WebApiResponse<OrderDto>
            {
                Data = orderDto,
                Status = ResponseStatus.Success,
                Message = $"Pedido {orderDto.OrderNumber} encontrado com sucesso",
            };

            // Act
            var result = await _orderService.FindById(id);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(
                r =>
                    r.GetByIdAsync(
                        id,
                        true,
                        true,
                        o => o.BusinessPartner,
                        op => op.OrderProducts,
                        t => t.Transaction,
                        p => p.Transaction.Payments
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task OrderService_FindById_ShouldReturnWarning_WhenOrderBelongsToAnotherUserAndCurrentUserIsNotAdmin()
        {
            // Arrange
            var id = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var orderDto = _orderListMock.First(o => o.Id == id);
            var orderEntity = _mapper.Map<Order>(orderDto);
            orderEntity.CreateUserId = "owner-user-id";

            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        id,
                        true,
                        true,
                        o => o.BusinessPartner,
                        op => op.OrderProducts,
                        t => t.Transaction,
                        p => p.Transaction.Payments
                    )
                )
                .ReturnsAsync(orderEntity);

            _currentUserService.Setup(_ => _.IsInRole("Admin")).Returns(false);
            _currentUserService.Setup(_ => _.GetUserId()).Returns("another-user-id");

            // Act
            var result = await _orderService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task OrderService_FindById_ShouldReturnOrder_WhenOrderBelongsToCurrentUser()
        {
            // Arrange
            var id = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var orderDto = _orderListMock.First(o => o.Id == id);
            var orderEntity = _mapper.Map<Order>(orderDto);
            orderEntity.CreateUserId = "owner-user-id";
            orderEntity.BusinessPartner = new Individual { Name = "ORD" };

            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        id,
                        true,
                        true,
                        o => o.BusinessPartner,
                        op => op.OrderProducts,
                        t => t.Transaction,
                        p => p.Transaction.Payments
                    )
                )
                .ReturnsAsync(orderEntity);

            _currentUserService.Setup(_ => _.IsInRole("Admin")).Returns(false);
            _currentUserService.Setup(_ => _.GetUserId()).Returns("owner-user-id");

            // Act
            var result = await _orderService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(result.Data);
        }

        [Fact]
        public async Task OrderService_FindById_ShouldReturnNoData_WhenIdIsNotFound()
        {
            // Arrange
            var id = Guid.Parse("00000000-0000-0000-0000-000000000010");
            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        id,
                        true,
                        true,
                        o => o.BusinessPartner,
                        op => op.OrderProducts,
                        t => t.Transaction,
                        p => p.Transaction.Payments
                    )
                )
                .ReturnsAsync((Order)null);

            var expected = new WebApiResponse<OrderDto>
            {
                Data = null,
                Status = ResponseStatus.Success,
                Message = $"Nenhum Pedido com o ID {id} foi encontrado",
            };

            // Act
            var result = await _orderService.FindById(id);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(
                r =>
                    r.GetByIdAsync(
                        id,
                        true,
                        true,
                        o => o.BusinessPartner,
                        op => op.OrderProducts,
                        t => t.Transaction,
                        p => p.Transaction.Payments
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task OrderService_FindAll_ShouldReturnOrders_WhenDataExists()
        {
            // Arrange
            var ordersMock = _mapper.Map<IList<Order>>(_orderListMock);
            ordersMock[0].BusinessPartner = new Individual { Name = "ORD" };
            ordersMock[1].BusinessPartner = new Individual { Name = "THG" };
            _repository
                .Setup(r =>
                    r.GetAllAsync(
                        true,
                        true,
                        o => o.BusinessPartner,
                        o => o.OrderProducts,
                        t => t.Transaction,
                        p => p.Payments
                    )
                )
                .ReturnsAsync(ordersMock);

            var expected = new WebApiResponse<IEnumerable<OrderDto>>
            {
                Data = _orderListMock,
                Status = ResponseStatus.Success,
                Message = $"{_orderListMock.Count} registro(s) encontrado(s).",
            };

            // Act
            var result = await _orderService.FindAll();

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(
                r =>
                    r.GetAllAsync(
                        true,
                        true,
                        o => o.BusinessPartner,
                        o => o.OrderProducts,
                        t => t.Transaction,
                        p => p.Payments
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task OrderService_Update_ShouldUpdateTheSameTrackedInstance_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange - this is the regression test for the EF Core "cannot be tracked because
            // another instance with the same key value is already being tracked" bug: Update must
            // load the entity once via GetByIdAsync and map the DTO onto that same instance,
            // rather than mapping a separate Order instance with the same Id.
            var orderId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var existingOrder = new Order
            {
                Id = orderId,
                OrderNumber = "ORD-00001",
                CreateUserId = "owner-user-id",
            };

            var orderDto = new OrderDto
            {
                Id = orderId,
                OrderNumber = "ORD-00001",
                Description = "Pedido atualizado",
                Transaction = new TransactionDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000010"),
                },
                QuoteNumber = string.Empty,
            };

            _repository.Setup(r => r.GetByIdAsync(orderId)).ReturnsAsync(existingOrder);
            _repository.Setup(r => r.UpdateAsync(It.IsAny<Order>())).Returns(Task.CompletedTask);
            _transactionService
                .Setup(_ => _.Update(It.IsAny<TransactionDto>()))
                .ReturnsAsync(
                    new WebApiResponse<TransactionDto> { Data = orderDto.Transaction, Status = ResponseStatus.Success }
                );

            // Act
            var result = await _orderService.Update(orderDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("Pedido atualizado", existingOrder.Description);
            _repository.Verify(r => r.UpdateAsync(existingOrder), Times.Once);
            _transactionService.Verify(
                _ => _.Update(It.Is<TransactionDto>(t => t.OrderId == orderId)),
                Times.Once
            );
        }

        [Fact]
        public async Task OrderService_Update_ShouldReturnWarningAndNotUpdate_WhenOrderBelongsToAnotherUserAndCurrentUserIsNotAdmin()
        {
            // Arrange
            var orderId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var orderDto = new OrderDto
            {
                Id = orderId,
                OrderNumber = "ORD-00001",
                Transaction = new TransactionDto(),
            };

            var existingOrder = new Order { Id = orderId, CreateUserId = "owner-user-id" };

            _repository.Setup(r => r.GetByIdAsync(orderId)).ReturnsAsync(existingOrder);

            _currentUserService.Setup(_ => _.IsInRole("Admin")).Returns(false);
            _currentUserService.Setup(_ => _.GetUserId()).Returns("another-user-id");

            // Act
            var result = await _orderService.Update(orderDto);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _repository.Verify(r => r.UpdateAsync(It.IsAny<Order>()), Times.Never);
        }

        [Fact]
        public async Task OrderService_Update_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var orderDto = new OrderDto
            {
                Id = Guid.NewGuid(),
                OrderNumber = "ORD-00001",
                Transaction = new TransactionDto(),
            };

            _repository.Setup(r => r.GetByIdAsync(orderDto.Id)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _orderService.Update(orderDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
        }

        [Fact]
        public async Task OrderService_Add_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var orderDto = new OrderDto { BusinessPartnerName = "ORD" };
            _sequenceService.Setup(_ => _.GetNextValue(It.IsAny<string>())).ReturnsAsync(1);
            _repository.Setup(r => r.AddAsync(It.IsAny<Order>())).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _orderService.Add(orderDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
        }

        [Fact]
        public async Task OrderService_Add_ShouldFetchExistingTransaction_WhenOnlyTransactionIdIsProvided()
        {
            // Arrange
            var transactionId = Guid.NewGuid();
            var orderDto = new OrderDto { BusinessPartnerName = "ORD", TransactionId = transactionId };
            var existingTransactionDto = new TransactionDto { Id = transactionId };

            _sequenceService.Setup(_ => _.GetNextValue(It.IsAny<string>())).ReturnsAsync(1);
            _transactionService
                .Setup(_ => _.FindById(transactionId))
                .ReturnsAsync(
                    new WebApiResponse<TransactionDto>
                    {
                        Data = existingTransactionDto,
                        Status = ResponseStatus.Success,
                    }
                );
            _repository.Setup(r => r.AddAsync(It.IsAny<Order>())).Returns(Task.CompletedTask);

            // Act
            var result = await _orderService.Add(orderDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _transactionService.Verify(_ => _.FindById(transactionId), Times.Once);
            _transactionService.Verify(_ => _.UpdateOrderId(It.IsAny<TransactionDto>()), Times.Once);
        }

        [Fact]
        public async Task OrderService_Add_ShouldNotAssignTransactionId_WhenFindByIdDoesNotSucceed()
        {
            // Arrange
            var transactionId = Guid.NewGuid();
            var orderDto = new OrderDto { BusinessPartnerName = "ORD", TransactionId = transactionId };

            _sequenceService.Setup(_ => _.GetNextValue(It.IsAny<string>())).ReturnsAsync(1);
            _transactionService
                .Setup(_ => _.FindById(transactionId))
                .ReturnsAsync(
                    new WebApiResponse<TransactionDto> { Data = null, Status = ResponseStatus.Success }
                );
            _repository.Setup(r => r.AddAsync(It.IsAny<Order>())).Returns(Task.CompletedTask);

            // Act
            var result = await _orderService.Add(orderDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _transactionService.Verify(_ => _.UpdateOrderId(It.IsAny<TransactionDto>()), Times.Never);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("  ")]
        [InlineData("Ab")]
        public async Task OrderService_Add_ShouldBuildPrefixFromRandomLetters_WhenBusinessPartnerNameHasFewerThanThreeLetters(
            string businessPartnerName
        )
        {
            // Arrange
            var orderDto = new OrderDto { BusinessPartnerName = businessPartnerName };
            _sequenceService.Setup(_ => _.GetNextValue(It.IsAny<string>())).ReturnsAsync(1);
            _repository.Setup(r => r.AddAsync(It.IsAny<Order>())).Returns(Task.CompletedTask);

            // Act
            var result = await _orderService.Add(orderDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Matches("^[A-Z]{3}-00001$", result.Data!.OrderNumber);
        }

        [Fact]
        public async Task OrderService_Remove_ShouldReturnError_WhenOrderIsNotFound()
        {
            // Arrange
            var orderDto = new OrderDto { Id = Guid.NewGuid(), OrderNumber = "ORD-00001" };
            _repository
                .Setup(r => r.GetByIdAsync(orderDto.Id, o => o.OrderProducts, p => p.Transaction))
                .ReturnsAsync((Order)null);

            // Act
            var result = await _orderService.Remove(orderDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Contains("não encontrado", result.Message);
            _repository.Verify(r => r.RemoveAsync(It.IsAny<Order>()), Times.Never);
        }

        [Fact]
        public async Task OrderService_Remove_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var orderDto = new OrderDto { Id = Guid.NewGuid(), OrderNumber = "ORD-00001" };
            _repository
                .Setup(r => r.GetByIdAsync(orderDto.Id, o => o.OrderProducts, p => p.Transaction))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _orderService.Remove(orderDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
        }

        [Fact]
        public async Task OrderService_FindAll_ShouldReturnEmpty_WhenModuleToggleIsDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Order, FeatureToggleKeys.SalesOrdersModule))
                .ReturnsAsync(false);

            // Act
            var result = await _orderService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data!);
            _repository.Verify(
                r =>
                    r.GetAllAsync(
                        true,
                        true,
                        It.IsAny<Expression<Func<Order, object>>>(),
                        It.IsAny<Expression<Func<Order, object>>>(),
                        It.IsAny<Expression<Func<Order, object>>>(),
                        It.IsAny<Expression<Func<Order, object>>>()
                    ),
                Times.Never
            );
        }

        [Fact]
        public async Task OrderService_FindAll_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetAllAsync(
                        true,
                        true,
                        It.IsAny<Expression<Func<Order, object>>>(),
                        It.IsAny<Expression<Func<Order, object>>>(),
                        It.IsAny<Expression<Func<Order, object>>>(),
                        It.IsAny<Expression<Func<Order, object>>>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _orderService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
        }

        [Fact]
        public async Task OrderService_FindAllPaged_ShouldReturnPagedOrders_WhenDataExists()
        {
            // Arrange
            var orders = new List<Order>
            {
                new() { Id = Guid.NewGuid(), BusinessPartner = new Individual { Name = "A" } },
                new() { Id = Guid.NewGuid(), BusinessPartner = new Individual { Name = "B" } },
            };
            SetUpGetPagedAsyncReturns(orders, orders.Count);

            // Act
            var result = await _orderService.FindAllPaged(new PagedRequest { Page = 1, PageSize = 50 });

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(2, result.Data!.TotalCount);
            Assert.Equal(2, result.Data.Items.Count());
        }

        [Fact]
        public async Task OrderService_FindAllPaged_ShouldReturnEmpty_WhenModuleToggleIsDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Order, FeatureToggleKeys.SalesOrdersModule))
                .ReturnsAsync(false);

            // Act
            var result = await _orderService.FindAllPaged(new PagedRequest());

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data!.Items);
            _repository.Verify(
                r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Order, bool>>>(),
                        It.IsAny<Func<IQueryable<Order>, IOrderedQueryable<Order>>>(),
                        It.IsAny<bool>(),
                        It.IsAny<Expression<Func<Order, object>>[]>()
                    ),
                Times.Never
            );
        }

        [Fact]
        public async Task OrderService_FindAllPaged_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Order, bool>>>(),
                        It.IsAny<Func<IQueryable<Order>, IOrderedQueryable<Order>>>(),
                        true,
                        It.IsAny<Expression<Func<Order, object>>[]>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _orderService.FindAllPaged(new PagedRequest());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
        }

        [Fact]
        public async Task OrderService_FindAllPaged_FilterShouldMatchOnlyQuickFilterHits()
        {
            // Arrange
            Expression<Func<Order, bool>> capturedFilter = null;
            SetUpGetPagedAsyncCapture(filter => capturedFilter = filter);
            var matching = NewOrderForFilterTests(orderNumber: "SER-P00123");
            var nonMatching = NewOrderForFilterTests(orderNumber: "THG-P00999");

            // Act
            await _orderService.FindAllPaged(new PagedRequest { Page = 1, PageSize = 50, QuickFilter = "00123" });

            // Assert
            var compiled = capturedFilter.Compile();
            Assert.True(compiled(matching));
            Assert.False(compiled(nonMatching));
        }

        [Fact]
        public async Task OrderService_FindAllPaged_FilterShouldRespectDateRange()
        {
            // Arrange
            Expression<Func<Order, bool>> capturedFilter = null;
            SetUpGetPagedAsyncCapture(filter => capturedFilter = filter);
            var inRange = NewOrderForFilterTests(createDate: new DateTime(2026, 3, 15));
            var before = NewOrderForFilterTests(createDate: new DateTime(2026, 2, 28));

            // Act
            await _orderService.FindAllPaged(
                new PagedRequest
                {
                    Page = 1,
                    PageSize = 50,
                    StartDate = new DateTime(2026, 3, 1),
                    EndDate = new DateTime(2026, 3, 31),
                }
            );

            // Assert
            var compiled = capturedFilter.Compile();
            Assert.True(compiled(inRange));
            Assert.False(compiled(before));
        }

        [Fact]
        public async Task OrderService_FindAllPaged_FilterShouldRespectStatusList()
        {
            // Arrange
            Expression<Func<Order, bool>> capturedFilter = null;
            SetUpGetPagedAsyncCapture(filter => capturedFilter = filter);
            var open = NewOrderForFilterTests(status: OrderStatus.Open);
            var closed = NewOrderForFilterTests(status: OrderStatus.Closed);

            // Act
            await _orderService.FindAllPaged(
                new PagedRequest { Page = 1, PageSize = 50, Statuses = new List<string> { "Open" } }
            );

            // Assert
            var compiled = capturedFilter.Compile();
            Assert.True(compiled(open));
            Assert.False(compiled(closed));
        }

        private static Order NewOrderForFilterTests(
            string orderNumber = "SER-P00001",
            string description = "Descricao",
            DateTime? createDate = null,
            OrderStatus status = OrderStatus.Open
        ) =>
            new()
            {
                OrderNumber = orderNumber,
                Description = description,
                CreateDate = createDate ?? DateTime.UtcNow,
                Status = status,
                BusinessPartner = new Individual { Name = "Cliente Teste" },
            };

        private void SetUpGetPagedAsyncReturns(IList<Order> orders, int totalCount)
        {
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Order, bool>>>(),
                        It.IsAny<Func<IQueryable<Order>, IOrderedQueryable<Order>>>(),
                        true,
                        It.IsAny<Expression<Func<Order, object>>[]>()
                    )
                )
                .ReturnsAsync((orders, totalCount));
        }

        private void SetUpGetPagedAsyncCapture(Action<Expression<Func<Order, bool>>> onCaptured)
        {
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Order, bool>>>(),
                        It.IsAny<Func<IQueryable<Order>, IOrderedQueryable<Order>>>(),
                        true,
                        It.IsAny<Expression<Func<Order, object>>[]>()
                    )
                )
                .Callback<
                    int,
                    int,
                    Expression<Func<Order, bool>>,
                    Func<IQueryable<Order>, IOrderedQueryable<Order>>,
                    bool,
                    Expression<Func<Order, object>>[]
                >((_, _, filter, _, _, _) => onCaptured(filter))
                .ReturnsAsync((new List<Order>(), 0));
        }

        [Fact]
        public async Task OrderService_FindById_ShouldReturnEmpty_WhenModuleToggleIsDisabled()
        {
            // Arrange
            var id = Guid.NewGuid();
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Order, FeatureToggleKeys.SalesOrdersModule))
                .ReturnsAsync(false);

            // Act
            var result = await _orderService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
            Assert.Contains(id.ToString(), result.Message);
        }

        [Fact]
        public async Task OrderService_FindById_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        id,
                        true,
                        true,
                        o => o.BusinessPartner,
                        op => op.OrderProducts,
                        t => t.Transaction,
                        p => p.Transaction.Payments
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _orderService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
        }

        [Fact]
        public async Task OrderService_FindByOrderNumber_ShouldReturnOrder_WhenOrderNumberIsValid()
        {
            // Arrange
            var orderNumber = "ORD-00001";
            var orderEntity = new Order { Id = Guid.NewGuid(), OrderNumber = orderNumber };
            _repository
                .Setup(r =>
                    r.FirstOrDefaultAsync(
                        It.IsAny<Expression<Func<Order, bool>>>(),
                        true,
                        o => o.BusinessPartner,
                        p => p.Transaction
                    )
                )
                .ReturnsAsync(orderEntity);

            // Act
            var result = await _orderService.FindByOrderNumber(orderNumber);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(result.Data);
            Assert.Contains("encontrado com sucesso", result.Message);
        }

        [Fact]
        public async Task OrderService_FindByOrderNumber_ShouldReturnNoData_WhenOrderNumberIsNotFound()
        {
            // Arrange
            var orderNumber = "ORD-99999";
            _repository
                .Setup(r =>
                    r.FirstOrDefaultAsync(
                        It.IsAny<Expression<Func<Order, bool>>>(),
                        true,
                        o => o.BusinessPartner,
                        p => p.Transaction
                    )
                )
                .ReturnsAsync((Order)null);

            // Act
            var result = await _orderService.FindByOrderNumber(orderNumber);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
            Assert.Contains(orderNumber, result.Message);
        }

        [Fact]
        public async Task OrderService_FindByOrderNumber_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var orderNumber = "ORD-00001";
            _repository
                .Setup(r =>
                    r.FirstOrDefaultAsync(
                        It.IsAny<Expression<Func<Order, bool>>>(),
                        true,
                        o => o.BusinessPartner,
                        p => p.Transaction
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _orderService.FindByOrderNumber(orderNumber);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
        }

        [Fact]
        public async Task OrderService_FindByBusinessPartnerId_ShouldReturnOrders_WhenDataExists()
        {
            // Arrange
            var businessPartnerId = Guid.NewGuid();
            var orders = new List<Order> { new() { Id = Guid.NewGuid(), BusinessPartnerId = businessPartnerId } };
            _repository
                .Setup(r =>
                    r.QueryAsync(It.IsAny<Expression<Func<Order, bool>>>(), true, p => p.Transaction)
                )
                .ReturnsAsync(orders);

            // Act
            var result = await _orderService.FindByBusinessPartnerId(businessPartnerId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Single(result.Data!);
        }

        [Fact]
        public async Task OrderService_FindByBusinessPartnerId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var businessPartnerId = Guid.NewGuid();
            _repository
                .Setup(r =>
                    r.QueryAsync(It.IsAny<Expression<Func<Order, bool>>>(), true, p => p.Transaction)
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _orderService.FindByBusinessPartnerId(businessPartnerId);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
        }

        [Fact]
        public async Task OrderService_FindByProductId_ShouldReturnOrders_WhenDataExists()
        {
            // Arrange
            var productId = Guid.NewGuid();
            var orders = new List<Order> { new() { Id = Guid.NewGuid() } };
            _repository
                .Setup(r => r.QueryAsync(It.IsAny<Expression<Func<Order, bool>>>(), true))
                .ReturnsAsync(orders);

            // Act
            var result = await _orderService.FindByProductId(productId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Single(result.Data!);
        }

        [Fact]
        public async Task OrderService_FindByProductId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var productId = Guid.NewGuid();
            _repository
                .Setup(r => r.QueryAsync(It.IsAny<Expression<Func<Order, bool>>>(), true))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _orderService.FindByProductId(productId);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
        }
    }
}
