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
    public class PaymentServiceTests
    {
        private readonly PaymentService _paymentService;
        private readonly Mock<IRepository<Payment>> _repository;
        private readonly Mock<IFeatureToggleService> _featureToggleServiceMock;
        private readonly Mock<ILogService> _logService;
        private readonly IList<Payment> _paymentsMock;
        private readonly IMapper _mapper;

        public PaymentServiceTests()
        {
            _repository = new Mock<IRepository<Payment>>();
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
            _paymentService = new PaymentService(
                _repository.Object,
                _mapper,
                _featureToggleServiceMock.Object,
                _logService.Object
            );

            _paymentsMock = new List<Payment>
            {
                new Payment
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    Description = "Transação1",
                    TransactionId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                },
                new Payment
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    Description = "Transação2",
                    TransactionId = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                },
            };
        }

        [Fact]
        public async Task PaymentService_Add_ShouldAddPaymentSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var paymentDto = new PaymentDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                Description = "Transação3",
                TransactionId = Guid.Parse("00000000-0000-0000-0000-000000000003"),
            };
            _repository.Setup(r => r.AddAsync(It.IsAny<Payment>())).Returns(Task.CompletedTask);

            var expected = new WebApiResponse<PaymentDto>
            {
                Data = paymentDto,
                Status = ResponseStatus.Success,
                Message = $"Pagamento {paymentDto.Description} cadastrada com sucesso.",
            };

            // Act
            var result = await _paymentService.Add(paymentDto);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(r => r.AddAsync(It.IsAny<Payment>()), Times.Once);
        }

        [Fact]
        public async Task PaymentService_Update_ShouldUpdatePaymentSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var paymentDto = _mapper.Map<PaymentDto>(_paymentsMock.First());
            _repository.Setup(r => r.UpdateAsync(It.IsAny<Payment>())).Returns(Task.CompletedTask);

            var expected = new WebApiResponse<PaymentDto>
            {
                Data = paymentDto,
                Status = ResponseStatus.Success,
                Message = $"Pagamento {paymentDto.Description} atualizada com sucesso.",
            };

            // Act
            var result = await _paymentService.Update(paymentDto);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(r => r.UpdateAsync(It.IsAny<Payment>()), Times.Once);
        }

        [Fact]
        public async Task PaymentService_Remove_ShouldRemovePaymentSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var paymentDto = _mapper.Map<PaymentDto>(_paymentsMock.First());
            _repository.Setup(r => r.RemoveAsync(It.IsAny<Payment>())).Returns(Task.CompletedTask);

            var expected = new WebApiResponse<PaymentDto>
            {
                Data = paymentDto,
                Status = ResponseStatus.Success,
                Message = $"Pagamento {paymentDto.Description} removida com sucesso.",
            };

            // Act
            var result = await _paymentService.Remove(paymentDto);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(r => r.RemoveAsync(It.IsAny<Payment>()), Times.Once);
        }

        [Fact]
        public async Task PaymentService_FindById_ShouldReturnPayment_WhenIdIsValid()
        {
            // Arrange
            var id = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var transaction = _paymentsMock.First(p => p.Id == id);
            _repository.Setup(r => r.GetByIdAsync(id, true)).ReturnsAsync(transaction);

            var expected = new WebApiResponse<PaymentDto>
            {
                Data = _mapper.Map<PaymentDto>(transaction),
                Status = ResponseStatus.Success,
                Message = $"Pagamento {transaction.Description} encontrada com sucesso",
            };

            // Act
            var result = await _paymentService.FindById(id);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(r => r.GetByIdAsync(id, true), Times.Once);
        }

        [Fact]
        public async Task PaymentService_FindByTransactionId_ShouldReturnPayments_WhenTransactionIdIsValid()
        {
            // Arrange
            var transactionId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var transactions = _paymentsMock.Where(p => p.TransactionId == transactionId).ToList();
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        c => c.BusinessPartner,
                        o => o.Order,
                        t => t.Transaction
                    )
                )
                .ReturnsAsync(transactions);

            var expected = new WebApiResponse<IEnumerable<PaymentDto>>
            {
                Data = _mapper.Map<IEnumerable<PaymentDto>>(transactions),
                Status = ResponseStatus.Success,
                Message = $"{transactions.Count} registro(s) encontrado(s).",
            };

            // Act
            var result = await _paymentService.FindByTransactionId(transactionId);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(
                r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        c => c.BusinessPartner,
                        o => o.Order,
                        t => t.Transaction
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task PaymentService_FindByBusinessPartnerId_ShouldReturnPayments_WhenBusinessPartnerIdIsValid()
        {
            // Arrange
            var businessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var transactions = _paymentsMock
                .Where(p => p.BusinessPartnerId == businessPartnerId)
                .ToList();
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        c => c.BusinessPartner,
                        o => o.Order,
                        t => t.Transaction
                    )
                )
                .ReturnsAsync(transactions);

            var expected = new WebApiResponse<IEnumerable<PaymentDto>>
            {
                Data = _mapper.Map<IEnumerable<PaymentDto>>(transactions),
                Status = ResponseStatus.Success,
                Message = $"{transactions.Count} registro(s) encontrado(s).",
            };

            // Act
            var result = await _paymentService.FindByBusinessPartnerId(businessPartnerId);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(
                r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        c => c.BusinessPartner,
                        o => o.Order,
                        t => t.Transaction
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task PaymentService_FindByOrderId_ShouldReturnPayments_WhenOrderIdIsValid()
        {
            // Arrange
            var orderId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var transactions = _paymentsMock.Where(p => p.OrderId == orderId).ToList();
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        c => c.BusinessPartner,
                        o => o.Order,
                        t => t.Transaction
                    )
                )
                .ReturnsAsync(transactions);

            var expected = new WebApiResponse<IEnumerable<PaymentDto>>
            {
                Data = _mapper.Map<IEnumerable<PaymentDto>>(transactions),
                Status = ResponseStatus.Success,
                Message = $"{transactions.Count} registro(s) encontrado(s).",
            };

            // Act
            var result = await _paymentService.FindByOrderId(orderId);

            // Assert
            expected.Should().BeEquivalentTo(result);
            _repository.Verify(
                r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        c => c.BusinessPartner,
                        o => o.Order,
                        t => t.Transaction
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task PaymentService_FindDelayed_ShouldReturnDelayedAndPastItems()
        {
            // Arrange
            var today = DateTime.UtcNow.Date;
            var tomorrowUtc = today.AddDays(1);
            var expectedItems = new List<Payment>
            {
                new Payment
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000011"),
                    Description = "Payment A",
                    Date = DateTime.UtcNow.Date.AddDays(-1),
                    Status = PaymentStatus.Pending,
                },
                new Payment
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000012"),
                    Description = "Payment B",
                    Date = DateTime.UtcNow.Date.AddDays(-5),
                    Status = PaymentStatus.Delayed,
                },
                new Payment
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000013"),
                    Description = "Payment C",
                    Date = DateTime.UtcNow.Date.AddDays(1),
                    Status = PaymentStatus.Approved,
                },
            };

            var expectedQueryItems = expectedItems
                .Where(p =>
                    p.Status == PaymentStatus.Delayed
                    || (
                        p.Status != PaymentStatus.Approved
                        && p.Date != default(DateTime)
                        && p.Date < tomorrowUtc
                    )
                )
                .ToList();

            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        t => t.Transaction,
                        t => t.BusinessPartner,
                        t => t.Order
                    )
                )
                .ReturnsAsync(expectedQueryItems);

            var expected = _mapper
                .Map<IEnumerable<PaymentDto>>(expectedQueryItems)
                .OrderBy(p => p.Date);

            // Act
            var result = await _paymentService.FindDelayed();

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.Should().BeEquivalentTo(expected);
            _repository.Verify(
                r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        t => t.Transaction,
                        t => t.BusinessPartner,
                        t => t.Order
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task PaymentService_Add_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var paymentDto = new PaymentDto { Description = "Falha" };
            _repository.Setup(r => r.AddAsync(It.IsAny<Payment>())).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _paymentService.Add(paymentDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Contains("boom", result.Message);
        }

        [Fact]
        public async Task PaymentService_Add_ShouldSetStatusDelayed_WhenDateIsInThePastAndStatusIsNotApproved()
        {
            // Arrange
            var paymentDto = new PaymentDto
            {
                Description = "Atrasado",
                Date = DateTime.UtcNow.Date.AddDays(-5),
                Status = PaymentStatus.Pending,
            };
            _repository.Setup(r => r.AddAsync(It.IsAny<Payment>())).Returns(Task.CompletedTask);

            // Act
            var result = await _paymentService.Add(paymentDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(PaymentStatus.Delayed, result.Data!.Status);
        }

        [Fact]
        public async Task PaymentService_Add_ShouldNotChangeStatus_WhenStatusIsApproved()
        {
            // Arrange
            var paymentDto = new PaymentDto
            {
                Description = "Aprovado",
                Date = DateTime.UtcNow.Date.AddDays(-5),
                Status = PaymentStatus.Approved,
            };
            _repository.Setup(r => r.AddAsync(It.IsAny<Payment>())).Returns(Task.CompletedTask);

            // Act
            var result = await _paymentService.Add(paymentDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(PaymentStatus.Approved, result.Data!.Status);
        }

        [Fact]
        public async Task PaymentService_Add_ShouldNotChangeStatus_WhenDateIsInTheFuture()
        {
            // Arrange
            var paymentDto = new PaymentDto
            {
                Description = "Futuro",
                Date = DateTime.UtcNow.Date.AddDays(5),
                Status = PaymentStatus.Pending,
            };
            _repository.Setup(r => r.AddAsync(It.IsAny<Payment>())).Returns(Task.CompletedTask);

            // Act
            var result = await _paymentService.Add(paymentDto);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(PaymentStatus.Pending, result.Data!.Status);
        }

        [Fact]
        public async Task PaymentService_Update_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var paymentDto = _mapper.Map<PaymentDto>(_paymentsMock.First());
            _repository
                .Setup(r => r.UpdateAsync(It.IsAny<Payment>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _paymentService.Update(paymentDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Contains("boom", result.Message);
        }

        [Fact]
        public async Task PaymentService_Remove_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var paymentDto = _mapper.Map<PaymentDto>(_paymentsMock.First());
            _repository
                .Setup(r => r.RemoveAsync(It.IsAny<Payment>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _paymentService.Remove(paymentDto);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Contains("boom", result.Message);
        }

        [Fact]
        public async Task PaymentService_FindById_ShouldReturnNoData_WhenIdIsNotFound()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository.Setup(r => r.GetByIdAsync(id, true)).ReturnsAsync((Payment)null);

            // Act
            var result = await _paymentService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
            Assert.Contains(id.ToString(), result.Message);
        }

        [Fact]
        public async Task PaymentService_FindById_ShouldReturnEmpty_WhenModuleToggleIsDisabled()
        {
            // Arrange
            var id = Guid.NewGuid();
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Payment, FeatureToggleKeys.FinanceModule))
                .ReturnsAsync(false);

            // Act
            var result = await _paymentService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
            _repository.Verify(r => r.GetByIdAsync(It.IsAny<Guid?>()), Times.Never);
        }

        [Fact]
        public async Task PaymentService_FindById_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository.Setup(r => r.GetByIdAsync(id, true)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _paymentService.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Contains("boom", result.Message);
        }

        [Fact]
        public async Task PaymentService_FindAll_ShouldReturnPayments_WhenDataExists()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetAllAsync(
                        true,
                        It.IsAny<Expression<Func<Payment, object>>>(),
                        It.IsAny<Expression<Func<Payment, object>>>(),
                        It.IsAny<Expression<Func<Payment, object>>>()
                    )
                )
                .ReturnsAsync(_paymentsMock);

            // Act
            var result = await _paymentService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(_paymentsMock.Count, result.Data!.Count());
        }

        [Fact]
        public async Task PaymentService_FindAll_ShouldReturnEmpty_WhenModuleToggleIsDisabled()
        {
            // Arrange
            _featureToggleServiceMock
                .Setup(_ => _.IsEnabledAsync(FeatureToggleKeys.Payment, FeatureToggleKeys.FinanceModule))
                .ReturnsAsync(false);

            // Act
            var result = await _paymentService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Empty(result.Data!);
            _repository.Verify(
                r =>
                    r.GetAllAsync(
                        true,
                        It.IsAny<Expression<Func<Payment, object>>>(),
                        It.IsAny<Expression<Func<Payment, object>>>(),
                        It.IsAny<Expression<Func<Payment, object>>>()
                    ),
                Times.Never
            );
        }

        [Fact]
        public async Task PaymentService_FindAll_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetAllAsync(
                        true,
                        It.IsAny<Expression<Func<Payment, object>>>(),
                        It.IsAny<Expression<Func<Payment, object>>>(),
                        It.IsAny<Expression<Func<Payment, object>>>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _paymentService.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Contains("boom", result.Message);
        }

        [Fact]
        public async Task PaymentService_FindByTransactionId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        c => c.BusinessPartner,
                        o => o.Order,
                        t => t.Transaction
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _paymentService.FindByTransactionId(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Contains("boom", result.Message);
        }

        [Fact]
        public async Task PaymentService_FindByBusinessPartnerId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        c => c.BusinessPartner,
                        o => o.Order,
                        t => t.Transaction
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _paymentService.FindByBusinessPartnerId(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Contains("boom", result.Message);
        }

        [Fact]
        public async Task PaymentService_FindByOrderId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        c => c.BusinessPartner,
                        o => o.Order,
                        t => t.Transaction
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _paymentService.FindByOrderId(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Contains("boom", result.Message);
        }

        [Fact]
        public async Task PaymentService_FindByPurchaseOrderId_ShouldReturnPayments_WhenPurchaseOrderIdIsValid()
        {
            // Arrange
            var purchaseOrderId = Guid.NewGuid();
            var payments = new List<Payment>
            {
                new() { Id = Guid.NewGuid(), PurchaseOrderId = purchaseOrderId, Description = "PC" },
            };
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        c => c.BusinessPartner,
                        o => o.PurchaseOrder,
                        t => t.Transaction
                    )
                )
                .ReturnsAsync(payments);

            // Act
            var result = await _paymentService.FindByPurchaseOrderId(purchaseOrderId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Single(result.Data!);
        }

        [Fact]
        public async Task PaymentService_FindByPurchaseOrderId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        c => c.BusinessPartner,
                        o => o.PurchaseOrder,
                        t => t.Transaction
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _paymentService.FindByPurchaseOrderId(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Contains("boom", result.Message);
        }

        [Fact]
        public async Task PaymentService_FindByTripId_ShouldReturnPayments_WhenTripIdIsValid()
        {
            // Arrange
            var tripId = Guid.NewGuid();
            var payments = new List<Payment>
            {
                new() { Id = Guid.NewGuid(), TripId = tripId, Description = "Viagem" },
            };
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        c => c.BusinessPartner,
                        o => o.Trip,
                        t => t.Transaction
                    )
                )
                .ReturnsAsync(payments);

            // Act
            var result = await _paymentService.FindByTripId(tripId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Single(result.Data!);
        }

        [Fact]
        public async Task PaymentService_FindByTripId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        c => c.BusinessPartner,
                        o => o.Trip,
                        t => t.Transaction
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _paymentService.FindByTripId(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Contains("boom", result.Message);
        }

        [Fact]
        public async Task PaymentService_FindByDriverId_ShouldReturnPayments_WhenDriverIdIsValid()
        {
            // Arrange
            var driverId = Guid.NewGuid();
            var payments = new List<Payment>
            {
                new() { Id = Guid.NewGuid(), DriverId = driverId, Description = "Motorista" },
            };
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        c => c.Driver,
                        o => o.Trip,
                        t => t.Transaction
                    )
                )
                .ReturnsAsync(payments);

            // Act
            var result = await _paymentService.FindByDriverId(driverId);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Single(result.Data!);
        }

        [Fact]
        public async Task PaymentService_FindByDriverId_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        c => c.Driver,
                        o => o.Trip,
                        t => t.Transaction
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _paymentService.FindByDriverId(Guid.NewGuid());

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Contains("boom", result.Message);
        }

        [Fact]
        public async Task PaymentService_FindDelayed_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Payment, bool>>>(),
                        true,
                        t => t.Transaction,
                        t => t.BusinessPartner,
                        t => t.Order
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _paymentService.FindDelayed();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Contains("boom", result.Message);
        }

        [Fact]
        public async Task PaymentService_GetPaymentsHistory_ShouldReturnLast12Months_WhenNoRangeProvided()
        {
            // Arrange
            var now = DateTime.UtcNow.Date;
            var payments = new List<Payment>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Type = PaymentType.Incoming,
                    Price = 100m,
                    Date = now,
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    Type = PaymentType.Outgoing,
                    Price = 50m,
                    Date = now,
                },
            };
            _repository
                .Setup(r => r.QueryAsync(It.IsAny<Expression<Func<Payment, bool>>>(), true))
                .ReturnsAsync(payments);

            // Act
            var result = await _paymentService.GetPaymentsHistory();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.NotNull(result.Data);
            Assert.True(result.Data!["incoming"]!.AsArray().Count == 12);
            Assert.True(result.Data!["outgoing"]!.AsArray().Count == 12);
            Assert.Equal(12, result.Data!["categories"]!.AsArray().Count);
            Assert.Equal(12, result.Data!["monthsData"]!.AsArray().Count);
        }

        [Fact]
        public async Task PaymentService_GetPaymentsHistory_ShouldUseProvidedRange_WhenStartAndEndAreGiven()
        {
            // Arrange
            var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var end = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc);
            var payments = new List<Payment>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Type = PaymentType.Incoming,
                    Price = 200m,
                    Date = new DateTime(2026, 2, 10, 0, 0, 0, DateTimeKind.Utc),
                },
            };
            _repository
                .Setup(r => r.QueryAsync(It.IsAny<Expression<Func<Payment, bool>>>(), true))
                .ReturnsAsync(payments);

            // Act
            var result = await _paymentService.GetPaymentsHistory(start, end);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(3, result.Data!["categories"]!.AsArray().Count);
        }

        [Fact]
        public async Task PaymentService_GetPaymentsHistory_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r => r.QueryAsync(It.IsAny<Expression<Func<Payment, bool>>>(), true))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _paymentService.GetPaymentsHistory();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Contains("boom", result.Message);
        }

        [Fact]
        public async Task PaymentService_GetPaymentsGroupByCategory_ShouldGroupByCategory_WhenNoFiltersProvided()
        {
            // Arrange
            var now = DateTime.UtcNow.Date;
            var payments = new List<Payment>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Category = "Combustível",
                    Price = 100m,
                    Date = now,
                    Type = PaymentType.Outgoing,
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    Category = "Combustível",
                    Price = 50m,
                    Date = now,
                    Type = PaymentType.Outgoing,
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    Category = null,
                    Price = 25m,
                    Date = now,
                    Type = PaymentType.Incoming,
                },
            };
            _repository
                .Setup(r => r.QueryAsync(It.IsAny<Expression<Func<Payment, bool>>>(), true))
                .ReturnsAsync(payments);

            // Act
            var result = await _paymentService.GetPaymentsGroupByCategory();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(150m, result.Data!["Combustível"]!.GetValue<decimal>());
            Assert.Equal(25m, result.Data![string.Empty]!.GetValue<decimal>());
        }

        [Fact]
        public async Task PaymentService_GetPaymentsGroupByCategory_ShouldFilterByType_WhenTypeIsProvided()
        {
            // Arrange
            var now = DateTime.UtcNow.Date;
            var payments = new List<Payment>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Category = "Combustível",
                    Price = 100m,
                    Date = now,
                    Type = PaymentType.Outgoing,
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    Category = "Receita",
                    Price = 200m,
                    Date = now,
                    Type = PaymentType.Incoming,
                },
            };
            _repository
                .Setup(r => r.QueryAsync(It.IsAny<Expression<Func<Payment, bool>>>(), true))
                .ReturnsAsync(payments);

            // Act
            var result = await _paymentService.GetPaymentsGroupByCategory(PaymentType.Incoming);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.False(result.Data!.ContainsKey("Combustível"));
            Assert.Equal(200m, result.Data!["Receita"]!.GetValue<decimal>());
        }

        [Fact]
        public async Task PaymentService_GetPaymentsGroupByCategory_ShouldUseProvidedRange_WhenStartAndEndAreGiven()
        {
            // Arrange
            var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var end = new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc);
            var payments = new List<Payment>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Category = "Dentro",
                    Price = 10m,
                    Date = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc),
                    Type = PaymentType.Outgoing,
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    Category = "Fora",
                    Price = 999m,
                    Date = new DateTime(2026, 3, 15, 0, 0, 0, DateTimeKind.Utc),
                    Type = PaymentType.Outgoing,
                },
            };
            _repository
                .Setup(r => r.QueryAsync(It.IsAny<Expression<Func<Payment, bool>>>(), true))
                .ReturnsAsync(payments);

            // Act
            var result = await _paymentService.GetPaymentsGroupByCategory(null, start, end);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.True(result.Data!.ContainsKey("Dentro"));
            Assert.False(result.Data!.ContainsKey("Fora"));
        }

        [Fact]
        public async Task PaymentService_GetPaymentsGroupByCategory_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r => r.QueryAsync(It.IsAny<Expression<Func<Payment, bool>>>(), true))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _paymentService.GetPaymentsGroupByCategory();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            Assert.Contains("boom", result.Message);
        }
    }
}
