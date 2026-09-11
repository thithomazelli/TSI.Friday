using System;
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
    public class PurchaseOrderServiceTests
    {
        private readonly PurchaseOrderService _purchaseOrderService;
        private readonly Mock<IRepository<PurchaseOrder>> _repository;
        private readonly Mock<ITransactionService> _transactionService;
        private readonly Mock<ISequenceService> _sequenceService;
        private readonly Mock<ICurrentUserService> _currentUserService;
        private readonly Mock<IFeatureToggleService> _featureToggleServiceMock;
        private readonly Mock<ILogService> _logService;
        private readonly IList<PurchaseOrderDto> _purchaseOrderListMock;
        private readonly IMapper _mapper;

        public PurchaseOrderServiceTests()
        {
            var config = new MapperConfiguration(
                cfg =>
                {
                    cfg.ConstructServicesUsing(type => null);
                    cfg.AddMaps(typeof(MappingProfile).Assembly);
                },
                new LoggerFactory()
            );
            _repository = new Mock<IRepository<PurchaseOrder>>();
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
            _purchaseOrderService = new PurchaseOrderService(
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

            // Default: no previous PurchaseOrder state found, so the ownership-by-id lookup is
            // safely skipped unless a test overrides this.
            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<PurchaseOrder, bool>>>()))
                .ReturnsAsync(new List<PurchaseOrder>());

            _purchaseOrderListMock = new List<PurchaseOrderDto>
            {
                new PurchaseOrderDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    PurchaseOrderNumber = "FOR-00001",
                    Description = "Pedido de Compra Teste1",
                    BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    BusinessPartnerName = "FOR",
                    Transaction = new TransactionDto(),
                    TransactionId = Guid.Parse("00000000-0000-0000-0000-000000000000"),
                },
                new PurchaseOrderDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    PurchaseOrderNumber = "PC-00002",
                    Description = "Pedido de Compra Teste2",
                    BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    BusinessPartnerName = "SUP",
                    Transaction = new TransactionDto(),
                    TransactionId = Guid.Parse("00000000-0000-0000-0000-000000000000"),
                },
            };
        }

        [Fact]
        public async Task PurchaseOrderService_Add_ShouldAddPurchaseOrderSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var purchaseOrderDto = new PurchaseOrderDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                PurchaseOrderNumber = "FOR-00001",
                Description = "Novo Pedido de Compra",
                BusinessPartnerName = "FOR",
                Transaction = new TransactionDto(),
            };

            var transactionDto = new TransactionDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                PurchaseOrderId = Guid.Parse("00000000-0000-0000-0000-000000000003"),
            };

            _repository
                .Setup(r => r.AddAsync(It.IsAny<PurchaseOrder>()))
                .Returns(Task.CompletedTask);
            _transactionService
                .Setup(_ => _.Add(It.IsAny<TransactionDto>()))
                .ReturnsAsync(new WebApiResponse<TransactionDto> { Data = transactionDto });
            _sequenceService.Setup(_ => _.GetNextValue(It.IsAny<string>())).ReturnsAsync(1);

            var expected = new WebApiResponse<PurchaseOrderDto>
            {
                Data = new PurchaseOrderDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                    PurchaseOrderNumber = "FOR-00001",
                    Description = "Novo Pedido de Compra",
                    Transaction = new TransactionDto(),
                    TransactionId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                },
                Status = ResponseStatus.Success,
                Message =
                    $"Pedido de Compra {purchaseOrderDto.PurchaseOrderNumber} cadastrado com sucesso.",
            };

            // Act
            var result = await _purchaseOrderService.Add(purchaseOrderDto);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(r => r.AddAsync(It.IsAny<PurchaseOrder>()), Times.Once);
        }

        [Fact]
        public async Task PurchaseOrderService_Remove_ShouldRemovePurchaseOrderSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var purchaseOrderDto = _purchaseOrderListMock.First();
            var purchaseOrderEntity = _mapper.Map<PurchaseOrder>(_purchaseOrderListMock.First());

            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        It.IsAny<Guid>(),
                        o => o.PurchaseOrderProducts,
                        p => p.Transaction
                    )
                )
                .ReturnsAsync(purchaseOrderEntity);
            _repository
                .Setup(r => r.RemoveAsync(It.IsAny<PurchaseOrder>()))
                .Returns(Task.CompletedTask);

            var expected = new WebApiResponse<PurchaseOrderDto>
            {
                Data = purchaseOrderDto,
                Status = ResponseStatus.Success,
                Message =
                    $"Pedido de Compra {purchaseOrderDto.PurchaseOrderNumber} removido com sucesso.",
            };

            // Act
            var result = await _purchaseOrderService.Remove(purchaseOrderDto);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(r => r.RemoveAsync(It.IsAny<PurchaseOrder>()), Times.Once);
        }

        [Fact]
        public async Task PurchaseOrderService_Remove_ShouldReturnWarningAndNotRemove_WhenPurchaseOrderBelongsToAnotherUserAndCurrentUserIsNotAdmin()
        {
            // Arrange
            var purchaseOrderDto = _purchaseOrderListMock.First();
            var purchaseOrderEntity = _mapper.Map<PurchaseOrder>(_purchaseOrderListMock.First());
            purchaseOrderEntity.CreateUserId = "owner-user-id";

            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        It.IsAny<Guid>(),
                        o => o.PurchaseOrderProducts,
                        p => p.Transaction
                    )
                )
                .ReturnsAsync(purchaseOrderEntity);

            _currentUserService.Setup(_ => _.IsInRole("Admin")).Returns(false);
            _currentUserService.Setup(_ => _.GetUserId()).Returns("another-user-id");

            // Act
            var result = await _purchaseOrderService.Remove(purchaseOrderDto);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _repository.Verify(r => r.RemoveAsync(It.IsAny<PurchaseOrder>()), Times.Never);
        }

        [Fact]
        public async Task PurchaseOrderService_FindById_ShouldReturnPurchaseOrder_WhenIdIsValid()
        {
            // Arrange
            var id = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var purchaseOrderDto = _purchaseOrderListMock.First(o => o.Id == id);
            var purchaseOrderEntity = _mapper.Map<PurchaseOrder>(purchaseOrderDto);
            purchaseOrderEntity.BusinessPartner = new Individual { Name = "FOR" };

            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        id,
                        true,
                        true,
                        o => o.BusinessPartner,
                        op => op.PurchaseOrderProducts,
                        t => t.Transaction,
                        p => p.Transaction.Payments
                    )
                )
                .ReturnsAsync(purchaseOrderEntity);

            var expected = new WebApiResponse<PurchaseOrderDto>
            {
                Data = purchaseOrderDto,
                Status = ResponseStatus.Success,
                Message =
                    $"Pedido de Compra {purchaseOrderDto.PurchaseOrderNumber} encontrado com sucesso",
            };

            // Act
            var result = await _purchaseOrderService.FindById(id);

            // Assert
            expected.Should().BeEquivalentTo(result);
        }

        [Fact]
        public async Task PurchaseOrderService_FindById_ShouldReturnNoData_WhenIdIsNotFound()
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
                        op => op.PurchaseOrderProducts,
                        t => t.Transaction,
                        p => p.Transaction.Payments
                    )
                )
                .ReturnsAsync((PurchaseOrder)null);

            var expected = new WebApiResponse<PurchaseOrderDto>
            {
                Data = null,
                Status = ResponseStatus.Success,
                Message = $"Nenhum Pedido de Compra com o ID {id} foi encontrado",
            };

            // Act
            var result = await _purchaseOrderService.FindById(id);

            // Assert
            expected.Should().BeEquivalentTo(result);
        }

        [Fact]
        public async Task PurchaseOrderService_FindAll_ShouldReturnPurchaseOrders_WhenDataExists()
        {
            // Arrange
            var purchaseOrdersMock = _mapper.Map<IList<PurchaseOrder>>(_purchaseOrderListMock);
            purchaseOrdersMock[0].BusinessPartner = new Individual { Name = "FOR" };
            purchaseOrdersMock[1].BusinessPartner = new Individual { Name = "SUP" };
            _repository
                .Setup(r =>
                    r.GetAllAsync(
                        true,
                        true,
                        o => o.BusinessPartner,
                        o => o.PurchaseOrderProducts,
                        t => t.Transaction,
                        p => p.Payments
                    )
                )
                .ReturnsAsync(purchaseOrdersMock);

            var expected = new WebApiResponse<IEnumerable<PurchaseOrderDto>>
            {
                Data = _purchaseOrderListMock,
                Status = ResponseStatus.Success,
                Message = $"{_purchaseOrderListMock.Count} registro(s) encontrado(s).",
            };

            // Act
            var result = await _purchaseOrderService.FindAll();

            // Assert
            expected.Should().BeEquivalentTo(result);
        }

        [Fact]
        public async Task PurchaseOrderService_FindAll_ShouldReturnEmpty_WhenModuleToggleIsDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ =>
                    _.IsEnabledAsync(
                        FeatureToggleKeys.PurchaseOrder,
                        FeatureToggleKeys.PurchaseOrdersModule
                    )
                )
                .ReturnsAsync(false);

            // Act
            var result = await _purchaseOrderService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data);
            _repository.Verify(
                r =>
                    r.GetAllAsync(
                        true,
                        true,
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>(),
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>(),
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>(),
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>()
                    ),
                Times.Never
            );
        }

        [Fact]
        public async Task PurchaseOrderService_FindAllPaged_ShouldReturnPagedPurchaseOrders_WhenDataExists()
        {
            // Arrange
            var purchaseOrders = new List<PurchaseOrder>
            {
                new() { Id = Guid.NewGuid(), BusinessPartner = new Individual { Name = "A" } },
                new() { Id = Guid.NewGuid(), BusinessPartner = new Individual { Name = "B" } },
            };
            SetUpGetPagedAsyncReturns(purchaseOrders, purchaseOrders.Count);

            // Act
            var result = await _purchaseOrderService.FindAllPaged(
                new PagedRequest { Page = 1, PageSize = 50 }
            );

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(2, result.Data!.TotalCount);
            Assert.Equal(2, result.Data.Items.Count());
        }

        [Fact]
        public async Task PurchaseOrderService_FindAllPaged_ShouldReturnEmpty_WhenModuleToggleIsDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ =>
                    _.IsEnabledAsync(
                        FeatureToggleKeys.PurchaseOrder,
                        FeatureToggleKeys.PurchaseOrdersModule
                    )
                )
                .ReturnsAsync(false);

            // Act
            var result = await _purchaseOrderService.FindAllPaged(new PagedRequest());

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data!.Items);
            _repository.Verify(
                r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<PurchaseOrder, bool>>>(),
                        It.IsAny<Func<IQueryable<PurchaseOrder>, IOrderedQueryable<PurchaseOrder>>>(),
                        It.IsAny<bool>(),
                        It.IsAny<Expression<Func<PurchaseOrder, object>>[]>()
                    ),
                Times.Never
            );
        }

        [Fact]
        public async Task PurchaseOrderService_FindAllPaged_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<PurchaseOrder, bool>>>(),
                        It.IsAny<Func<IQueryable<PurchaseOrder>, IOrderedQueryable<PurchaseOrder>>>(),
                        true,
                        It.IsAny<Expression<Func<PurchaseOrder, object>>[]>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _purchaseOrderService.FindAllPaged(new PagedRequest());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
        }

        [Fact]
        public async Task PurchaseOrderService_FindAllPaged_FilterShouldMatchOnlyQuickFilterHits()
        {
            // Arrange
            Expression<Func<PurchaseOrder, bool>> capturedFilter = null;
            SetUpGetPagedAsyncCapture(filter => capturedFilter = filter);
            var matching = NewPurchaseOrderForFilterTests(purchaseOrderNumber: "PC-00123");
            var nonMatching = NewPurchaseOrderForFilterTests(purchaseOrderNumber: "PC-00999");

            // Act
            await _purchaseOrderService.FindAllPaged(
                new PagedRequest { Page = 1, PageSize = 50, QuickFilter = "00123" }
            );

            // Assert
            var compiled = capturedFilter.Compile();
            Assert.True(compiled(matching));
            Assert.False(compiled(nonMatching));
        }

        [Fact]
        public async Task PurchaseOrderService_FindAllPaged_FilterShouldRespectDateRange()
        {
            // Arrange
            Expression<Func<PurchaseOrder, bool>> capturedFilter = null;
            SetUpGetPagedAsyncCapture(filter => capturedFilter = filter);
            var inRange = NewPurchaseOrderForFilterTests(createDate: new DateTime(2026, 3, 15));
            var before = NewPurchaseOrderForFilterTests(createDate: new DateTime(2026, 2, 28));

            // Act
            await _purchaseOrderService.FindAllPaged(
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
        public async Task PurchaseOrderService_FindAllPaged_FilterShouldRespectStatusList()
        {
            // Arrange
            Expression<Func<PurchaseOrder, bool>> capturedFilter = null;
            SetUpGetPagedAsyncCapture(filter => capturedFilter = filter);
            var open = NewPurchaseOrderForFilterTests(status: OrderStatus.Open);
            var closed = NewPurchaseOrderForFilterTests(status: OrderStatus.Closed);

            // Act
            await _purchaseOrderService.FindAllPaged(
                new PagedRequest { Page = 1, PageSize = 50, Statuses = new List<string> { "Open" } }
            );

            // Assert
            var compiled = capturedFilter.Compile();
            Assert.True(compiled(open));
            Assert.False(compiled(closed));
        }

        [Fact]
        public async Task PurchaseOrderService_FindAllPaged_ShouldComputeSkipAndTake_FromPageAndPageSize()
        {
            // Arrange
            SetUpGetPagedAsyncReturns(new List<PurchaseOrder>(), 0);

            // Act
            await _purchaseOrderService.FindAllPaged(new PagedRequest { Page = 2, PageSize = 25 });

            // Assert
            _repository.Verify(
                r =>
                    r.GetPagedAsync(
                        25,
                        25,
                        It.IsAny<Expression<Func<PurchaseOrder, bool>>>(),
                        It.IsAny<Func<IQueryable<PurchaseOrder>, IOrderedQueryable<PurchaseOrder>>>(),
                        true,
                        It.IsAny<Expression<Func<PurchaseOrder, object>>[]>()
                    ),
                Times.Once
            );
        }

        private static PurchaseOrder NewPurchaseOrderForFilterTests(
            string purchaseOrderNumber = "PC-00001",
            string description = "Descricao",
            DateTime? createDate = null,
            OrderStatus status = OrderStatus.Open
        ) =>
            new()
            {
                PurchaseOrderNumber = purchaseOrderNumber,
                Description = description,
                CreateDate = createDate ?? DateTime.UtcNow,
                Status = status,
                BusinessPartner = new Individual { Name = "Fornecedor Teste" },
            };

        private void SetUpGetPagedAsyncReturns(IList<PurchaseOrder> purchaseOrders, int totalCount)
        {
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<PurchaseOrder, bool>>>(),
                        It.IsAny<Func<IQueryable<PurchaseOrder>, IOrderedQueryable<PurchaseOrder>>>(),
                        true,
                        It.IsAny<Expression<Func<PurchaseOrder, object>>[]>()
                    )
                )
                .ReturnsAsync((purchaseOrders, totalCount));
        }

        private void SetUpGetPagedAsyncCapture(Action<Expression<Func<PurchaseOrder, bool>>> onCaptured)
        {
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<PurchaseOrder, bool>>>(),
                        It.IsAny<Func<IQueryable<PurchaseOrder>, IOrderedQueryable<PurchaseOrder>>>(),
                        true,
                        It.IsAny<Expression<Func<PurchaseOrder, object>>[]>()
                    )
                )
                .Callback<
                    int,
                    int,
                    Expression<Func<PurchaseOrder, bool>>,
                    Func<IQueryable<PurchaseOrder>, IOrderedQueryable<PurchaseOrder>>,
                    bool,
                    Expression<Func<PurchaseOrder, object>>[]
                >((_, _, filter, _, _, _) => onCaptured(filter))
                .ReturnsAsync((new List<PurchaseOrder>(), 0));
        }

        [Fact]
        public async Task PurchaseOrderService_Update_ShouldReturnWarningAndNotUpdate_WhenPurchaseOrderBelongsToAnotherUserAndCurrentUserIsNotAdmin()
        {
            // Arrange
            var purchaseOrderId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var purchaseOrderDto = new PurchaseOrderDto
            {
                Id = purchaseOrderId,
                PurchaseOrderNumber = "PC-00001",
                Transaction = new TransactionDto(),
            };

            var existingPurchaseOrder = new PurchaseOrder
            {
                Id = purchaseOrderId,
                CreateUserId = "owner-user-id",
            };

            _repository.Setup(r => r.GetByIdAsync(purchaseOrderId)).ReturnsAsync(existingPurchaseOrder);

            _currentUserService.Setup(_ => _.IsInRole("Admin")).Returns(false);
            _currentUserService.Setup(_ => _.GetUserId()).Returns("another-user-id");

            // Act
            var result = await _purchaseOrderService.Update(purchaseOrderDto);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _repository.Verify(r => r.UpdateAsync(It.IsAny<PurchaseOrder>()), Times.Never);
        }

        [Fact]
        public async Task PurchaseOrderService_Update_ShouldUpdateTheSameTrackedInstance_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange - regression test for the EF Core "cannot be tracked because another
            // instance with the same key value is already being tracked" bug: Update must load
            // the entity once via GetByIdAsync and map the DTO onto that same instance, rather
            // than mapping a separate PurchaseOrder instance with the same Id.
            var purchaseOrderId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var existingPurchaseOrder = new PurchaseOrder
            {
                Id = purchaseOrderId,
                PurchaseOrderNumber = "PC-00001",
                CreateUserId = "owner-user-id",
            };

            var purchaseOrderDto = new PurchaseOrderDto
            {
                Id = purchaseOrderId,
                PurchaseOrderNumber = "PC-00001",
                Description = "Pedido de compra atualizado",
                Transaction = new TransactionDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000010"),
                },
            };

            _repository.Setup(r => r.GetByIdAsync(purchaseOrderId)).ReturnsAsync(existingPurchaseOrder);
            _repository
                .Setup(r => r.UpdateAsync(It.IsAny<PurchaseOrder>()))
                .Returns(Task.CompletedTask);
            _transactionService
                .Setup(_ => _.Update(It.IsAny<TransactionDto>()))
                .ReturnsAsync(
                    new WebApiResponse<TransactionDto>
                    {
                        Data = purchaseOrderDto.Transaction,
                        Status = ResponseStatus.Success,
                    }
                );

            // Act
            var result = await _purchaseOrderService.Update(purchaseOrderDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("Pedido de compra atualizado", existingPurchaseOrder.Description);
            _repository.Verify(r => r.UpdateAsync(existingPurchaseOrder), Times.Once);
            _transactionService.Verify(
                _ => _.Update(It.Is<TransactionDto>(t => t.PurchaseOrderId == purchaseOrderId)),
                Times.Once
            );
        }

        [Fact]
        public async Task PurchaseOrderService_Add_ShouldReturnError_WhenSequenceServiceThrows()
        {
            // Arrange
            var purchaseOrderDto = new PurchaseOrderDto { BusinessPartnerName = "FOR" };
            _sequenceService
                .Setup(_ => _.GetNextValue(It.IsAny<string>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _purchaseOrderService.Add(purchaseOrderDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task PurchaseOrderService_Add_ShouldUseExistingTransactionId_WhenTransactionIdIsProvidedWithoutTransactionDto()
        {
            // Arrange
            var existingTransactionId = Guid.Parse("00000000-0000-0000-0000-000000000020");
            var purchaseOrderDto = new PurchaseOrderDto
            {
                BusinessPartnerName = "FOR",
                TransactionId = existingTransactionId,
            };

            _sequenceService.Setup(_ => _.GetNextValue(It.IsAny<string>())).ReturnsAsync(1);
            _transactionService
                .Setup(_ => _.FindById(existingTransactionId))
                .ReturnsAsync(
                    new WebApiResponse<TransactionDto>
                    {
                        Status = ResponseStatus.Success,
                        Data = new TransactionDto { Id = existingTransactionId },
                    }
                );

            PurchaseOrder capturedEntity = null;
            _repository
                .Setup(r => r.AddAsync(It.IsAny<PurchaseOrder>()))
                .Callback<PurchaseOrder>(e => capturedEntity = e)
                .Returns(Task.CompletedTask);

            // Act
            var result = await _purchaseOrderService.Add(purchaseOrderDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(capturedEntity);
            Assert.Equal(existingTransactionId, capturedEntity.TransactionId);
            _transactionService.Verify(
                _ => _.UpdatePurchaseOrderId(It.IsAny<TransactionDto>()),
                Times.Once
            );
        }

        [Fact]
        public async Task PurchaseOrderService_Add_ShouldNotChangeTransactionId_WhenTransactionFindByIdFails()
        {
            // Arrange
            var existingTransactionId = Guid.Parse("00000000-0000-0000-0000-000000000021");
            var purchaseOrderDto = new PurchaseOrderDto
            {
                BusinessPartnerName = "FOR",
                TransactionId = existingTransactionId,
            };

            _sequenceService.Setup(_ => _.GetNextValue(It.IsAny<string>())).ReturnsAsync(1);
            _transactionService
                .Setup(_ => _.FindById(existingTransactionId))
                .ReturnsAsync(
                    new WebApiResponse<TransactionDto> { Status = ResponseStatus.Error }
                );

            PurchaseOrder capturedEntity = null;
            _repository
                .Setup(r => r.AddAsync(It.IsAny<PurchaseOrder>()))
                .Callback<PurchaseOrder>(e => capturedEntity = e)
                .Returns(Task.CompletedTask);

            // Act
            var result = await _purchaseOrderService.Add(purchaseOrderDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(existingTransactionId, capturedEntity.TransactionId);
        }

        [Theory]
        [InlineData("ABC", "ABC")] // >=3 letters: first, middle, last
        [InlineData("AB", null)] // <3 letters: random-padded, only format is checked
        [InlineData("", null)] // empty: random-padded, only format is checked
        public async Task PurchaseOrderService_Add_ShouldBuildPurchaseOrderNumberWithExpectedPrefixFormat(
            string businessPartnerName,
            string expectedPrefix
        )
        {
            // Arrange
            var purchaseOrderDto = new PurchaseOrderDto { BusinessPartnerName = businessPartnerName };
            _sequenceService.Setup(_ => _.GetNextValue(It.IsAny<string>())).ReturnsAsync(7);

            // Act
            var result = await _purchaseOrderService.Add(purchaseOrderDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Matches("^[A-Z]{3}-00007$", result.Data.PurchaseOrderNumber);
            if (expectedPrefix != null)
            {
                Assert.StartsWith(expectedPrefix, result.Data.PurchaseOrderNumber);
            }
        }

        [Fact]
        public async Task PurchaseOrderService_Add_ShouldUseDefaultDescription_WhenDescriptionIsEmpty()
        {
            // Arrange
            var purchaseOrderDto = new PurchaseOrderDto
            {
                BusinessPartnerName = "FOR",
                Description = string.Empty,
            };
            _sequenceService.Setup(_ => _.GetNextValue(It.IsAny<string>())).ReturnsAsync(1);

            // Act
            var result = await _purchaseOrderService.Add(purchaseOrderDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.StartsWith("Pedido de Compra -", result.Data.Description);
        }

        [Fact]
        public async Task PurchaseOrderService_Update_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var purchaseOrderDto = new PurchaseOrderDto
            {
                Id = Guid.NewGuid(),
                Transaction = new TransactionDto(),
            };
            _repository
                .Setup(r => r.GetByIdAsync(purchaseOrderDto.Id))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _purchaseOrderService.Update(purchaseOrderDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task PurchaseOrderService_Update_ShouldNotCallTransactionUpdate_WhenTransactionDtoIsNull()
        {
            // Arrange
            var purchaseOrderId = Guid.Parse("00000000-0000-0000-0000-000000000030");
            var existingPurchaseOrder = new PurchaseOrder { Id = purchaseOrderId };
            var purchaseOrderDto = new PurchaseOrderDto { Id = purchaseOrderId, Transaction = null };

            _repository.Setup(r => r.GetByIdAsync(purchaseOrderId)).ReturnsAsync(existingPurchaseOrder);

            // Act
            var result = await _purchaseOrderService.Update(purchaseOrderDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data.Transaction);
            _transactionService.Verify(_ => _.Update(It.IsAny<TransactionDto>()), Times.Never);
        }

        [Fact]
        public async Task PurchaseOrderService_Update_ShouldNotOverwriteTransactionData_WhenTransactionUpdateFails()
        {
            // Arrange
            var purchaseOrderId = Guid.Parse("00000000-0000-0000-0000-000000000031");
            var existingPurchaseOrder = new PurchaseOrder { Id = purchaseOrderId };
            var purchaseOrderDto = new PurchaseOrderDto
            {
                Id = purchaseOrderId,
                Transaction = new TransactionDto { Id = Guid.NewGuid() },
            };

            _repository.Setup(r => r.GetByIdAsync(purchaseOrderId)).ReturnsAsync(existingPurchaseOrder);
            _transactionService
                .Setup(_ => _.Update(It.IsAny<TransactionDto>()))
                .ReturnsAsync(new WebApiResponse<TransactionDto> { Status = ResponseStatus.Error });

            // Act
            var result = await _purchaseOrderService.Update(purchaseOrderDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data.Transaction);
        }

        [Fact]
        public async Task PurchaseOrderService_Remove_ShouldReturnError_WhenPurchaseOrderIsNotFound()
        {
            // Arrange
            var purchaseOrderDto = new PurchaseOrderDto
            {
                Id = Guid.NewGuid(),
                PurchaseOrderNumber = "PC-00001",
            };
            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        purchaseOrderDto.Id,
                        o => o.PurchaseOrderProducts,
                        p => p.Transaction
                    )
                )
                .ReturnsAsync((PurchaseOrder)null);

            // Act
            var result = await _purchaseOrderService.Remove(purchaseOrderDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Null(result.Data);
            _repository.Verify(r => r.RemoveAsync(It.IsAny<PurchaseOrder>()), Times.Never);
        }

        [Fact]
        public async Task PurchaseOrderService_Remove_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var purchaseOrderDto = new PurchaseOrderDto { Id = Guid.NewGuid() };
            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        purchaseOrderDto.Id,
                        o => o.PurchaseOrderProducts,
                        p => p.Transaction
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _purchaseOrderService.Remove(purchaseOrderDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task PurchaseOrderService_FindAll_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetAllAsync(
                        true,
                        true,
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>(),
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>(),
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>(),
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _purchaseOrderService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task PurchaseOrderService_FindById_ShouldReturnNoData_WhenModuleToggleIsDisabled()
        {
            // Arrange
            var id = Guid.NewGuid();
            _featureToggleServiceMock
                .Setup(_ =>
                    _.IsEnabledAsync(
                        FeatureToggleKeys.PurchaseOrder,
                        FeatureToggleKeys.PurchaseOrdersModule
                    )
                )
                .ReturnsAsync(false);

            // Act
            var result = await _purchaseOrderService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal($"Nenhum Pedido de Compra com o ID {id} foi encontrado", result.Message);
            _repository.Verify(
                r =>
                    r.GetByIdAsync(
                        It.IsAny<Guid?>(),
                        true,
                        true,
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>(),
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>(),
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>(),
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>()
                    ),
                Times.Never
            );
        }

        [Fact]
        public async Task PurchaseOrderService_FindById_ShouldReturnWarning_WhenPurchaseOrderBelongsToAnotherUser()
        {
            // Arrange
            var id = Guid.Parse("00000000-0000-0000-0000-000000000040");
            var purchaseOrderEntity = new PurchaseOrder { Id = id, CreateUserId = "owner-user-id" };

            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        id,
                        true,
                        true,
                        o => o.BusinessPartner,
                        op => op.PurchaseOrderProducts,
                        t => t.Transaction,
                        p => p.Transaction.Payments
                    )
                )
                .ReturnsAsync(purchaseOrderEntity);
            _currentUserService.Setup(_ => _.IsInRole("Admin")).Returns(false);
            _currentUserService.Setup(_ => _.GetUserId()).Returns("another-user-id");

            // Act
            var result = await _purchaseOrderService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
        }

        [Fact]
        public async Task PurchaseOrderService_FindById_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        id,
                        true,
                        true,
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>(),
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>(),
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>(),
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _purchaseOrderService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task PurchaseOrderService_FindByBusinessPartnerId_ShouldReturnPurchaseOrders_WhenDataExists()
        {
            // Arrange
            var businessPartnerId = Guid.NewGuid();
            var purchaseOrders = new List<PurchaseOrder>
            {
                new() { Id = Guid.NewGuid(), BusinessPartnerId = businessPartnerId },
            };
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<PurchaseOrder, bool>>>(),
                        true,
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>()
                    )
                )
                .ReturnsAsync(purchaseOrders);

            // Act
            var result = await _purchaseOrderService.FindByBusinessPartnerId(businessPartnerId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Single(result.Data);
        }

        [Fact]
        public async Task PurchaseOrderService_FindByBusinessPartnerId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<PurchaseOrder, bool>>>(),
                        true,
                        It.IsAny<Expression<Func<PurchaseOrder, object>>>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _purchaseOrderService.FindByBusinessPartnerId(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }
    }
}
