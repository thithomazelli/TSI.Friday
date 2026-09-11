using System.Linq;
using System.Linq.Expressions;
using AutoMapper;
using FluentAssertions;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;
using TSI.Nexus.IoC;
using Microsoft.Extensions.Logging;

namespace TSI.Nexus.Services.Tests.Services
{
    public class TransactionServiceTests
    {
        private readonly TransactionService _transactionService;
        private readonly Mock<IRepository<Transaction>> _repository;
        private readonly Mock<IRepository<Payment>> _paymentRepository;
        private readonly Mock<IFeatureToggleService> _featureToggleServiceMock;
        private readonly Mock<ILogService> _logService;
        private readonly IList<TransactionDto> _transactionsMock;
        private readonly IMapper _mapper;

        public TransactionServiceTests()
        {
            _repository = new Mock<IRepository<Transaction>>();
            _paymentRepository = new Mock<IRepository<Payment>>();
            _featureToggleServiceMock = new Mock<IFeatureToggleService>();
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(It.IsAny<string>()))
                .ReturnsAsync(true);
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);
            _logService = new Mock<ILogService>();
            var config = new MapperConfiguration(
                cfg =>
                {
                    cfg.ConstructServicesUsing(type => null);
                    cfg.AddMaps(typeof(MappingProfile).Assembly);
                },
                new LoggerFactory()
            );
            _mapper = config.CreateMapper();
            _transactionService = new TransactionService(
                _repository.Object,
                _paymentRepository.Object,
                _mapper,
                _featureToggleServiceMock.Object,
                _logService.Object
            );

            _transactionsMock = new List<TransactionDto>
            {
                new TransactionDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    Description = "Transação 1",
                    BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    OrderId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    Status = PaymentStatus.Pending,
                },
                new TransactionDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    Description = "Transação 2",
                    BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    OrderId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    Status = PaymentStatus.Pending,
                },
            };
        }

        [Fact]
        public async Task TransactionService_Add_ShouldAddTransactionSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var transactionDto = new TransactionDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                Description = "Transação 3",
                BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                OrderId = Guid.Parse("00000000-0000-0000-0000-000000000002"),
            };
            _repository.Setup(r => r.AddAsync(It.IsAny<Transaction>())).Returns(Task.CompletedTask);

            var expected = new WebApiResponse<TransactionDto>
            {
                Data = transactionDto,
                Status = ResponseStatus.Success,
                Message = $"Transação {transactionDto.Description} cadastrado com sucesso.",
            };

            // Act
            var result = await _transactionService.Add(transactionDto);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(r => r.AddAsync(It.IsAny<Transaction>()), Times.Once);
        }

        [Fact]
        public async Task TransactionService_Update_ShouldUpdateTransactionSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var transactionDto = _transactionsMock.First();
            var transactionEntity = _mapper.Map<Transaction>(transactionDto);

            _repository
                .Setup(_ => _.GetByIdAsync(It.IsAny<Guid>(), p => p.Payments))
                .ReturnsAsync(transactionEntity);
            _repository
                .Setup(_ => _.UpdateAsync(It.IsAny<Transaction>()))
                .Returns(Task.CompletedTask);

            var expected = new WebApiResponse<TransactionDto>
            {
                Data = transactionDto,
                Status = ResponseStatus.Success,
                Message = $"Transação {transactionDto.Description} atualizado com sucesso.",
            };

            // Act
            var result = await _transactionService.Update(transactionDto);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(r => r.UpdateAsync(It.IsAny<Transaction>()), Times.Once);
        }

        [Fact]
        public async Task TransactionService_Remove_ShouldRemoveTransactionSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var transactionDto = _transactionsMock.First();

            _repository
                .Setup(_ => _.GetByIdAsync(It.IsAny<Guid>()))
                .ReturnsAsync(_mapper.Map<Transaction>(transactionDto));
            _repository
                .Setup(r => r.RemoveAsync(It.IsAny<Transaction>()))
                .Returns(Task.CompletedTask);

            var expected = new WebApiResponse<TransactionDto>
            {
                Data = transactionDto,
                Status = ResponseStatus.Success,
                Message = $"Transação {transactionDto.Description} removido com sucesso.",
            };

            // Act
            var result = await _transactionService.Remove(transactionDto);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(r => r.RemoveAsync(It.IsAny<Transaction>()), Times.Once);
        }

        [Fact]
        public async Task TransactionService_FindById_ShouldReturnTransaction_WhenIdIsValid()
        {
            // Arrange
            var id = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var transactionDto = _transactionsMock.First(p => p.Id == id);
            var transactionEntity = _mapper.Map<Transaction>(transactionDto);

            _repository
                .Setup(r =>
                    r.GetByIdAsync(id, true, c => c.BusinessPartner, o => o.Order, p => p.Payments)
                )
                .ReturnsAsync(transactionEntity);

            var expected = new WebApiResponse<TransactionDto>
            {
                Data = transactionDto,
                Status = ResponseStatus.Success,
                Message = $"Transação {transactionDto.Description} encontrado com sucesso",
            };

            // Act
            var result = await _transactionService.FindById(id);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(
                r => r.GetByIdAsync(id, true, c => c.BusinessPartner, o => o.Order, p => p.Payments),
                Times.Once
            );
        }

        [Fact]
        public async Task TransactionService_FindByBusinessPartnerId_ShouldReturnTransactions_WhenBusinessPartnerIdIsValid()
        {
            // Arrange
            var businessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var transactionDtoList = _transactionsMock
                .Where(p => p.BusinessPartnerId == businessPartnerId)
                .ToList();
            var transactionEntityList = _mapper.Map<IList<Transaction>>(transactionDtoList);
            _repository
                .Setup(_ =>
                    _.QueryAsync(
                        It.IsAny<Expression<Func<Transaction, bool>>>(),
                        true,
                        c => c.BusinessPartner,
                        o => o.Order,
                        p => p.Payments
                    )
                )
                .ReturnsAsync(transactionEntityList);

            var expected = new WebApiResponse<IEnumerable<TransactionDto>>
            {
                Data = transactionDtoList,
                Status = ResponseStatus.Success,
                Message = $"{transactionDtoList.Count} registro(s) encontrado(s).",
            };

            // Act
            var result = await _transactionService.FindByBusinessPartnerId(businessPartnerId);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(
                r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Transaction, bool>>>(),
                        true,
                        c => c.BusinessPartner,
                        o => o.Order,
                        p => p.Payments
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task TransactionService_Update_WhenMarkAllPaymentsAsApproved_CallsExecuteUpdateOnPaymentRepository()
        {
            // Arrange
            var txId = Guid.NewGuid();
            var transactionEntity = new Transaction
            {
                Id = txId,
                Payments = new List<Payment>
                {
                    new Payment
                    {
                        Id = Guid.NewGuid(),
                        Status = PaymentStatus.Pending,
                        TransactionId = txId,
                    },
                    new Payment
                    {
                        Id = Guid.NewGuid(),
                        Status = PaymentStatus.Delayed,
                        TransactionId = txId,
                    },
                },
            };

            _repository
                .Setup(r =>
                    r.GetByIdAsync(txId, It.IsAny<Expression<Func<Transaction, object>>[]>())
                )
                .ReturnsAsync(transactionEntity);

            _paymentRepository
                .Setup(r =>
                    r.ExecuteUpdateAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        It.IsAny<Action<Payment>>()
                    )
                )
                .ReturnsAsync(2);

            _repository
                .Setup(r => r.UpdateAsync(It.IsAny<Transaction>()))
                .Returns(Task.CompletedTask);

            var dto = new TransactionDto
            {
                Id = txId,
                MarkAllPaymentsAsApproved = true,
                Description = "Tx",
            };

            // Act
            var result = await _transactionService.Update(dto);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            _paymentRepository.Verify(
                r =>
                    r.ExecuteUpdateAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        It.IsAny<Action<Payment>>()
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task TransactionService_Add_ShouldCreatePaymentsAndMarkDelayed_WhenPastDueDateAndTotalOfPaymentsAndExpensesAreInformed()
        {
            // Arrange - covers both CreatePayments loops (incoming and outgoing), the pro-rated
            // Price split, and the auto-Delayed transition for a past due date.
            var transactionDto = new TransactionDto
            {
                Id = Guid.NewGuid(),
                Description = "Tx com parcelas",
                Date = DateTime.UtcNow.AddMonths(-3),
                Status = PaymentStatus.Pending,
                TotalOfPayments = 2,
                PaymentTotalPrice = 200m,
                TotalOfExpenses = 1,
                ExpenseTotalPrice = 50m,
            };

            Transaction capturedEntity = null;
            _repository
                .Setup(r => r.AddAsync(It.IsAny<Transaction>()))
                .Callback<Transaction>(e => capturedEntity = e)
                .Returns(Task.CompletedTask);

            // Act
            var result = await _transactionService.Add(transactionDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(capturedEntity);
            Assert.Equal(3, capturedEntity.Payments.Count);
            Assert.Equal(2, capturedEntity.Payments.Count(p => p.Type == PaymentType.Incoming));
            Assert.Equal(1, capturedEntity.Payments.Count(p => p.Type == PaymentType.Outgoing));
            Assert.All(capturedEntity.Payments, p => Assert.Equal(PaymentStatus.Delayed, p.Status));
            Assert.Equal(100m, capturedEntity.Payments.First(p => p.Type == PaymentType.Incoming).Price);
        }

        [Fact]
        public async Task TransactionService_Add_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var transactionDto = new TransactionDto { Description = "Tx" };
            _repository.Setup(r => r.AddAsync(It.IsAny<Transaction>())).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _transactionService.Add(transactionDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TransactionService_Update_ShouldReturnError_WhenTransactionIsNotFound()
        {
            // Arrange
            var dto = new TransactionDto { Id = Guid.NewGuid(), Description = "Tx" };
            _repository
                .Setup(r => r.GetByIdAsync(dto.Id, p => p.Payments))
                .ReturnsAsync((Transaction)null);

            // Act
            var result = await _transactionService.Update(dto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            _repository.Verify(r => r.UpdateAsync(It.IsAny<Transaction>()), Times.Never);
        }

        [Fact]
        public async Task TransactionService_Update_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var dto = new TransactionDto { Id = Guid.NewGuid(), Description = "Tx" };
            _repository
                .Setup(r => r.GetByIdAsync(dto.Id, p => p.Payments))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _transactionService.Update(dto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TransactionService_UpdateOrderId_ShouldUpdatePaymentsOrderId_WhenTransactionExists()
        {
            // Arrange
            var txId = Guid.NewGuid();
            var orderId = Guid.NewGuid();
            var transactionEntity = new Transaction
            {
                Id = txId,
                Payments = new List<Payment> { new() { Id = Guid.NewGuid(), TransactionId = txId } },
            };
            _repository
                .Setup(r => r.GetByIdAsync(txId, p => p.Payments))
                .ReturnsAsync(transactionEntity);

            var dto = new TransactionDto { Id = txId, OrderId = orderId, Description = "Tx" };

            // Act
            var result = await _transactionService.UpdateOrderId(dto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.All(transactionEntity.Payments, p => Assert.Equal(orderId, p.OrderId));
            _repository.Verify(r => r.UpdateAsync(transactionEntity), Times.Once);
        }

        [Fact]
        public async Task TransactionService_UpdateOrderId_ShouldReturnError_WhenTransactionIsNotFound()
        {
            // Arrange
            var dto = new TransactionDto { Id = Guid.NewGuid(), Description = "Tx" };
            _repository
                .Setup(r => r.GetByIdAsync(dto.Id, p => p.Payments))
                .ReturnsAsync((Transaction)null);

            // Act
            var result = await _transactionService.UpdateOrderId(dto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TransactionService_UpdateOrderId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var dto = new TransactionDto { Id = Guid.NewGuid(), Description = "Tx" };
            _repository
                .Setup(r => r.GetByIdAsync(dto.Id, p => p.Payments))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _transactionService.UpdateOrderId(dto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TransactionService_UpdatePurchaseOrderId_ShouldUpdatePaymentsPurchaseOrderId_WhenTransactionExists()
        {
            // Arrange
            var txId = Guid.NewGuid();
            var purchaseOrderId = Guid.NewGuid();
            var transactionEntity = new Transaction
            {
                Id = txId,
                Payments = new List<Payment> { new() { Id = Guid.NewGuid(), TransactionId = txId } },
            };
            _repository
                .Setup(r => r.GetByIdAsync(txId, p => p.Payments))
                .ReturnsAsync(transactionEntity);

            var dto = new TransactionDto
            {
                Id = txId,
                PurchaseOrderId = purchaseOrderId,
                Description = "Tx",
            };

            // Act
            var result = await _transactionService.UpdatePurchaseOrderId(dto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.All(transactionEntity.Payments, p => Assert.Equal(purchaseOrderId, p.PurchaseOrderId));
            _repository.Verify(r => r.UpdateAsync(transactionEntity), Times.Once);
        }

        [Fact]
        public async Task TransactionService_UpdatePurchaseOrderId_ShouldReturnError_WhenTransactionIsNotFound()
        {
            // Arrange
            var dto = new TransactionDto { Id = Guid.NewGuid(), Description = "Tx" };
            _repository
                .Setup(r => r.GetByIdAsync(dto.Id, p => p.Payments))
                .ReturnsAsync((Transaction)null);

            // Act
            var result = await _transactionService.UpdatePurchaseOrderId(dto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TransactionService_UpdatePurchaseOrderId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var dto = new TransactionDto { Id = Guid.NewGuid(), Description = "Tx" };
            _repository
                .Setup(r => r.GetByIdAsync(dto.Id, p => p.Payments))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _transactionService.UpdatePurchaseOrderId(dto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TransactionService_UpdateTripId_ShouldUpdatePaymentsTripId_WhenTransactionExists()
        {
            // Arrange
            var txId = Guid.NewGuid();
            var tripId = Guid.NewGuid();
            var transactionEntity = new Transaction
            {
                Id = txId,
                Payments = new List<Payment> { new() { Id = Guid.NewGuid(), TransactionId = txId } },
            };
            _repository
                .Setup(r => r.GetByIdAsync(txId, p => p.Payments))
                .ReturnsAsync(transactionEntity);

            var dto = new TransactionDto { Id = txId, TripId = tripId, Description = "Tx" };

            // Act
            var result = await _transactionService.UpdateTripId(dto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.All(transactionEntity.Payments, p => Assert.Equal(tripId, p.TripId));
            _repository.Verify(r => r.UpdateAsync(transactionEntity), Times.Once);
        }

        [Fact]
        public async Task TransactionService_UpdateTripId_ShouldReturnError_WhenTransactionIsNotFound()
        {
            // Arrange
            var dto = new TransactionDto { Id = Guid.NewGuid(), Description = "Tx" };
            _repository
                .Setup(r => r.GetByIdAsync(dto.Id, p => p.Payments))
                .ReturnsAsync((Transaction)null);

            // Act
            var result = await _transactionService.UpdateTripId(dto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TransactionService_UpdateTripId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var dto = new TransactionDto { Id = Guid.NewGuid(), Description = "Tx" };
            _repository
                .Setup(r => r.GetByIdAsync(dto.Id, p => p.Payments))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _transactionService.UpdateTripId(dto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TransactionService_Remove_ShouldReturnError_WhenTransactionIsNotFound()
        {
            // Arrange
            var dto = new TransactionDto { Id = Guid.NewGuid(), Description = "Tx" };
            _repository.Setup(r => r.GetByIdAsync(dto.Id)).ReturnsAsync((Transaction)null);

            // Act
            var result = await _transactionService.Remove(dto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            _repository.Verify(r => r.RemoveAsync(It.IsAny<Transaction>()), Times.Never);
        }

        [Fact]
        public async Task TransactionService_Remove_ShouldReturnLinkedOrderError_WhenRepositoryThrowsDbUpdateException()
        {
            // Arrange
            var dto = new TransactionDto { Id = Guid.NewGuid(), Description = "Tx" };
            var entity = new Transaction { Id = dto.Id };
            _repository.Setup(r => r.GetByIdAsync(dto.Id)).ReturnsAsync(entity);
            _repository
                .Setup(r => r.RemoveAsync(entity))
                .ThrowsAsync(
                    new Microsoft.EntityFrameworkCore.DbUpdateException("fk violation")
                );

            // Act
            var result = await _transactionService.Remove(dto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Contains("pedido de vendas vinculado", result.Message);
        }

        [Fact]
        public async Task TransactionService_Remove_ShouldReturnError_WhenRepositoryThrowsGenericException()
        {
            // Arrange
            var dto = new TransactionDto { Id = Guid.NewGuid(), Description = "Tx" };
            _repository.Setup(r => r.GetByIdAsync(dto.Id)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _transactionService.Remove(dto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TransactionService_FindAll_ShouldReturnEmpty_WhenFinanceModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ =>
                    _.IsEnabledAsync(FeatureToggleKeys.Transaction, FeatureToggleKeys.FinanceModule)
                )
                .ReturnsAsync(false);

            // Act
            var result = await _transactionService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data);
        }

        [Fact]
        public async Task TransactionService_FindAll_ShouldComputeStatusAndPaymentTotalPrice_WhenDataExists()
        {
            // Arrange - covers ComputeStatusFromPayments: all-approved short-circuit.
            var transactions = new List<Transaction>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Description = "Tx",
                    Payments = new List<Payment>
                    {
                        new()
                        {
                            Type = PaymentType.Incoming,
                            Status = PaymentStatus.Approved,
                            Price = 100m,
                            Date = DateTime.UtcNow,
                        },
                    },
                },
            };
            _repository
                .Setup(r => r.GetAllAsync(true, c => c.BusinessPartner, o => o.Order, p => p.Payments))
                .ReturnsAsync(transactions);

            // Act
            var result = await _transactionService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            var dto = Assert.Single(result.Data);
            Assert.Equal(100m, dto.PaymentTotalPrice);
            Assert.Equal(PaymentStatus.Approved, dto.Status);
        }

        [Fact]
        public async Task TransactionService_FindAll_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r => r.GetAllAsync(true, c => c.BusinessPartner, o => o.Order, p => p.Payments))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _transactionService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TransactionService_FindAllPaged_ShouldComputeStatusAndPaymentTotalPrice_WhenDataExists()
        {
            // Arrange
            var transactions = new List<Transaction>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Description = "Tx",
                    Payments = new List<Payment>
                    {
                        new()
                        {
                            Type = PaymentType.Incoming,
                            Status = PaymentStatus.Approved,
                            Price = 100m,
                            Date = DateTime.UtcNow,
                        },
                    },
                },
            };
            SetUpGetPagedAsyncReturns(transactions, transactions.Count);

            // Act
            var result = await _transactionService.FindAllPaged(new PagedRequest { Page = 1, PageSize = 50 });

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(1, result.Data!.TotalCount);
            var dto = Assert.Single(result.Data.Items);
            Assert.Equal(100m, dto.PaymentTotalPrice);
            Assert.Equal(PaymentStatus.Approved, dto.Status);
        }

        [Fact]
        public async Task TransactionService_FindAllPaged_ShouldReturnEmpty_WhenFinanceModuleDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ =>
                    _.IsEnabledAsync(FeatureToggleKeys.Transaction, FeatureToggleKeys.FinanceModule)
                )
                .ReturnsAsync(false);

            // Act
            var result = await _transactionService.FindAllPaged(new PagedRequest());

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data!.Items);
            _repository.Verify(
                r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Transaction, bool>>>(),
                        It.IsAny<Func<IQueryable<Transaction>, IOrderedQueryable<Transaction>>>(),
                        It.IsAny<bool>(),
                        It.IsAny<Expression<Func<Transaction, object>>[]>()
                    ),
                Times.Never
            );
        }

        [Fact]
        public async Task TransactionService_FindAllPaged_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Transaction, bool>>>(),
                        It.IsAny<Func<IQueryable<Transaction>, IOrderedQueryable<Transaction>>>(),
                        true,
                        It.IsAny<Expression<Func<Transaction, object>>[]>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _transactionService.FindAllPaged(new PagedRequest());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.DoesNotContain("boom", result.Message);
        }

        [Fact]
        public async Task TransactionService_FindAllPaged_FilterShouldMatchOnlyQuickFilterHits()
        {
            // Arrange
            Expression<Func<Transaction, bool>> capturedFilter = null;
            SetUpGetPagedAsyncCapture(filter => capturedFilter = filter);
            var matching = NewTransactionForFilterTests(description: "Aluguel de caçamba");
            var nonMatching = NewTransactionForFilterTests(description: "Combustível");

            // Act
            await _transactionService.FindAllPaged(
                new PagedRequest { Page = 1, PageSize = 50, QuickFilter = "caçamba" }
            );

            // Assert
            var compiled = capturedFilter.Compile();
            Assert.True(compiled(matching));
            Assert.False(compiled(nonMatching));
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public async Task TransactionService_FindAllPaged_FilterShouldMatchApproved_OnlyWhenAllPaymentsApproved(
            bool allApproved
        )
        {
            // Arrange - mirrors ComputeStatusFromPayments: Approved iff there is at least one
            // payment and every payment is Approved.
            Expression<Func<Transaction, bool>> capturedFilter = null;
            SetUpGetPagedAsyncCapture(filter => capturedFilter = filter);
            var transaction = NewTransactionForFilterTests(
                payments: allApproved
                    ? new List<Payment> { NewPayment(PaymentStatus.Approved, DateTime.UtcNow) }
                    : new List<Payment>
                    {
                        NewPayment(PaymentStatus.Approved, DateTime.UtcNow),
                        NewPayment(PaymentStatus.Pending, DateTime.UtcNow.AddDays(1)),
                    }
            );

            // Act
            await _transactionService.FindAllPaged(
                new PagedRequest { Page = 1, PageSize = 50, Statuses = new List<string> { "Approved" } }
            );

            // Assert
            Assert.Equal(allApproved, capturedFilter.Compile()(transaction));
        }

        [Fact]
        public async Task TransactionService_FindAllPaged_FilterShouldMatchPending_WhenNoPaymentsExist()
        {
            // Arrange - mirrors ComputeStatusFromPayments: empty Payments => Pending.
            Expression<Func<Transaction, bool>> capturedFilter = null;
            SetUpGetPagedAsyncCapture(filter => capturedFilter = filter);
            var transaction = NewTransactionForFilterTests(payments: new List<Payment>());

            // Act
            await _transactionService.FindAllPaged(
                new PagedRequest { Page = 1, PageSize = 50, Statuses = new List<string> { "Pending" } }
            );

            // Assert
            Assert.True(capturedFilter.Compile()(transaction));
        }

        [Fact]
        public async Task TransactionService_FindAllPaged_FilterShouldMatchPending_WhenNonApprovedPaymentsAreNotOverdue()
        {
            // Arrange - mirrors ComputeStatusFromPayments: not all approved, but no non-approved
            // payment is overdue => Pending.
            Expression<Func<Transaction, bool>> capturedFilter = null;
            SetUpGetPagedAsyncCapture(filter => capturedFilter = filter);
            var transaction = NewTransactionForFilterTests(
                payments: new List<Payment>
                {
                    NewPayment(PaymentStatus.Approved, DateTime.UtcNow),
                    NewPayment(PaymentStatus.Pending, DateTime.UtcNow.AddDays(1)),
                }
            );

            // Act
            await _transactionService.FindAllPaged(
                new PagedRequest { Page = 1, PageSize = 50, Statuses = new List<string> { "Pending" } }
            );

            // Assert
            var compiled = capturedFilter.Compile();
            Assert.True(compiled(transaction));
            Assert.False(
                SetUpAndCompileFor(transaction, new List<string> { "Delayed" })
            );
        }

        [Fact]
        public async Task TransactionService_FindAllPaged_FilterShouldMatchDelayed_WhenANonApprovedPaymentIsOverdue()
        {
            // Arrange - mirrors ComputeStatusFromPayments: not all approved, and at least one
            // non-approved payment's Date is before today => Delayed.
            Expression<Func<Transaction, bool>> capturedFilter = null;
            SetUpGetPagedAsyncCapture(filter => capturedFilter = filter);
            var transaction = NewTransactionForFilterTests(
                payments: new List<Payment>
                {
                    NewPayment(PaymentStatus.Approved, DateTime.UtcNow),
                    NewPayment(PaymentStatus.Pending, DateTime.UtcNow.AddDays(-3)),
                }
            );

            // Act
            await _transactionService.FindAllPaged(
                new PagedRequest { Page = 1, PageSize = 50, Statuses = new List<string> { "Delayed" } }
            );

            // Assert
            var compiled = capturedFilter.Compile();
            Assert.True(compiled(transaction));
            Assert.False(SetUpAndCompileFor(transaction, new List<string> { "Pending" }));
        }

        private bool SetUpAndCompileFor(Transaction transaction, List<string> statuses)
        {
            Expression<Func<Transaction, bool>> capturedFilter = null;
            SetUpGetPagedAsyncCapture(filter => capturedFilter = filter);
            _transactionService
                .FindAllPaged(new PagedRequest { Page = 1, PageSize = 50, Statuses = statuses })
                .GetAwaiter()
                .GetResult();
            return capturedFilter.Compile()(transaction);
        }

        private static Payment NewPayment(PaymentStatus status, DateTime date) =>
            new() { Status = status, Date = date, Type = PaymentType.Incoming, Price = 10m };

        private static Transaction NewTransactionForFilterTests(
            string description = "Descricao",
            DateTime? date = null,
            List<Payment> payments = null
        ) =>
            new()
            {
                Description = description,
                Date = date ?? DateTime.UtcNow,
                Payments = payments ?? new List<Payment>(),
                BusinessPartner = new Individual { Name = "Cliente Teste" },
            };

        private void SetUpGetPagedAsyncReturns(IList<Transaction> transactions, int totalCount)
        {
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Transaction, bool>>>(),
                        It.IsAny<Func<IQueryable<Transaction>, IOrderedQueryable<Transaction>>>(),
                        true,
                        It.IsAny<Expression<Func<Transaction, object>>[]>()
                    )
                )
                .ReturnsAsync((transactions, totalCount));
        }

        private void SetUpGetPagedAsyncCapture(Action<Expression<Func<Transaction, bool>>> onCaptured)
        {
            _repository
                .Setup(r =>
                    r.GetPagedAsync(
                        It.IsAny<int>(),
                        It.IsAny<int>(),
                        It.IsAny<Expression<Func<Transaction, bool>>>(),
                        It.IsAny<Func<IQueryable<Transaction>, IOrderedQueryable<Transaction>>>(),
                        true,
                        It.IsAny<Expression<Func<Transaction, object>>[]>()
                    )
                )
                .Callback<
                    int,
                    int,
                    Expression<Func<Transaction, bool>>,
                    Func<IQueryable<Transaction>, IOrderedQueryable<Transaction>>,
                    bool,
                    Expression<Func<Transaction, object>>[]
                >((_, _, filter, _, _, _) => onCaptured(filter))
                .ReturnsAsync((new List<Transaction>(), 0));
        }

        [Fact]
        public async Task TransactionService_FindById_ShouldReturnEmptyMessage_WhenFinanceModuleDisabled()
        {
            // Arrange
            var id = Guid.NewGuid();
            _featureToggleServiceMock
                .Setup(_ =>
                    _.IsEnabledAsync(FeatureToggleKeys.Transaction, FeatureToggleKeys.FinanceModule)
                )
                .ReturnsAsync(false);

            // Act
            var result = await _transactionService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal($"Nenhuma Transação com o ID {id} foi encontrada", result.Message);
        }

        [Fact]
        public async Task TransactionService_FindById_ShouldReturnError_WhenTransactionIsNotFound()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository
                .Setup(r => r.GetByIdAsync(id, true, c => c.BusinessPartner, o => o.Order, p => p.Payments))
                .ReturnsAsync((Transaction)null);

            // Act
            var result = await _transactionService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TransactionService_FindById_ShouldComputeDelayedStatus_WhenAnyPendingPaymentIsOverdue()
        {
            // Arrange - covers ComputeStatusFromPayments: pending payments present, one overdue.
            var id = Guid.NewGuid();
            var transactionEntity = new Transaction
            {
                Id = id,
                Description = "Tx",
                Payments = new List<Payment>
                {
                    new()
                    {
                        Type = PaymentType.Incoming,
                        Status = PaymentStatus.Pending,
                        Price = 100m,
                        Date = DateTime.UtcNow.AddDays(-5),
                    },
                    new()
                    {
                        Type = PaymentType.Outgoing,
                        Status = PaymentStatus.Pending,
                        Price = 30m,
                        Date = DateTime.UtcNow.AddDays(5),
                    },
                },
            };
            _repository
                .Setup(r => r.GetByIdAsync(id, true, c => c.BusinessPartner, o => o.Order, p => p.Payments))
                .ReturnsAsync(transactionEntity);

            // Act
            var result = await _transactionService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(PaymentStatus.Delayed, result.Data.Status);
            Assert.Equal(100m, result.Data.PaymentTotalPrice);
            Assert.Equal(30m, result.Data.ExpenseTotalPrice);
        }

        [Fact]
        public async Task TransactionService_FindById_ShouldComputePendingStatus_WhenPendingPaymentsAreNotOverdue()
        {
            // Arrange
            var id = Guid.NewGuid();
            var transactionEntity = new Transaction
            {
                Id = id,
                Description = "Tx",
                Payments = new List<Payment>
                {
                    new()
                    {
                        Type = PaymentType.Incoming,
                        Status = PaymentStatus.Pending,
                        Price = 100m,
                        Date = DateTime.UtcNow.AddDays(5),
                    },
                },
            };
            _repository
                .Setup(r => r.GetByIdAsync(id, true, c => c.BusinessPartner, o => o.Order, p => p.Payments))
                .ReturnsAsync(transactionEntity);

            // Act
            var result = await _transactionService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(PaymentStatus.Pending, result.Data.Status);
        }

        [Fact]
        public async Task TransactionService_FindById_ShouldComputePendingStatus_WhenThereAreNoPayments()
        {
            // Arrange - covers ComputeStatusFromPayments: empty list branch.
            var id = Guid.NewGuid();
            var transactionEntity = new Transaction
            {
                Id = id,
                Description = "Tx",
                Payments = new List<Payment>(),
            };
            _repository
                .Setup(r => r.GetByIdAsync(id, true, c => c.BusinessPartner, o => o.Order, p => p.Payments))
                .ReturnsAsync(transactionEntity);

            // Act
            var result = await _transactionService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(PaymentStatus.Pending, result.Data.Status);
        }

        [Fact]
        public async Task TransactionService_FindById_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository
                .Setup(r => r.GetByIdAsync(id, true, c => c.BusinessPartner, o => o.Order, p => p.Payments))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _transactionService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task TransactionService_FindByBusinessPartnerId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(_ =>
                    _.QueryAsync(
                        It.IsAny<Expression<Func<Transaction, bool>>>(),
                        true,
                        c => c.BusinessPartner,
                        o => o.Order,
                        p => p.Payments
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _transactionService.FindByBusinessPartnerId(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }
    }
}
