using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;
using TSI.Nexus.WebAPI.Controllers;

namespace TSI.Nexus.WebAPI.Tests.Controllers
{
    public class PaymentsControllerTests
    {
        private readonly PaymentsController _controller;
        private readonly Mock<IPaymentService> _serviceMock;
        private readonly IList<PaymentDto> _paymentsMock;

        public PaymentsControllerTests()
        {
            _serviceMock = new Mock<IPaymentService>();
            _controller = new PaymentsController(_serviceMock.Object);

            _paymentsMock = new List<PaymentDto>
            {
                new PaymentDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    Description = "Payment1",
                    Status = PaymentStatus.Delayed,
                    Date = DateTime.UtcNow.Date.AddDays(-1),
                },
                new PaymentDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    Description = "Payment2",
                    Status = PaymentStatus.Pending,
                    Date = DateTime.UtcNow.Date.AddDays(-2),
                },
            };
        }

        [Fact]
        public async Task Add_ShouldReturnOkWithCreatedPayment_WhenModelIsValid()
        {
            // Arrange
            var payment = _paymentsMock.First();
            var expected = new WebApiResponse<PaymentDto>
            {
                Data = payment,
                Status = ResponseStatus.Success,
                Message = $"Pagamento {payment.Description} cadastrada com sucesso.",
            };

            _serviceMock.Setup(s => s.Add(payment)).ReturnsAsync(expected);

            // Act
            var result = await _controller.Add(payment);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<PaymentDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.Add(payment), Times.Once);
        }

        [Fact]
        public async Task Add_ShouldReturnBadRequest_WhenModelIsInvalid()
        {
            // Arrange
            var payment = new PaymentDto();
            _controller.ModelState.AddModelError("Date", "Date is required");

            // Act
            var result = await _controller.Add(payment);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var modelState = Assert.IsType<SerializableError>(badRequest.Value);
            Assert.True(modelState.ContainsKey("Date"));
            _serviceMock.Verify(s => s.Add(It.IsAny<PaymentDto>()), Times.Never);
        }

        [Fact]
        public async Task Update_ShouldReturnOkWithUpdatedPayment_WhenModelIsValid()
        {
            // Arrange
            var payment = _paymentsMock.First();
            var expected = new WebApiResponse<PaymentDto>
            {
                Data = payment,
                Status = ResponseStatus.Success,
                Message = $"Pagamento {payment.Description} atualizada com sucesso.",
            };

            _serviceMock.Setup(s => s.Update(payment)).ReturnsAsync(expected);

            // Act
            var result = await _controller.Update(payment);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<PaymentDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.Update(payment), Times.Once);
        }

        [Fact]
        public async Task Update_ShouldReturnBadRequest_WhenModelIsInvalid()
        {
            // Arrange
            var payment = new PaymentDto();
            _controller.ModelState.AddModelError("Status", "Status is required");

            // Act
            var result = await _controller.Update(payment);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var modelState = Assert.IsType<SerializableError>(badRequest.Value);
            Assert.True(modelState.ContainsKey("Status"));
            _serviceMock.Verify(s => s.Update(It.IsAny<PaymentDto>()), Times.Never);
        }

        [Fact]
        public async Task Remove_ShouldReturnOk_WhenCalled()
        {
            // Arrange
            var payment = _paymentsMock.First();
            var expected = new WebApiResponse<PaymentDto>
            {
                Data = payment,
                Status = ResponseStatus.Success,
                Message = $"Pagamento {payment.Description} removida com sucesso.",
            };

            _serviceMock.Setup(s => s.Remove(payment)).ReturnsAsync(expected);

            // Act
            var result = await _controller.Remove(payment);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<PaymentDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.Remove(payment), Times.Once);
        }

        [Fact]
        public async Task GetAll_ShouldReturnOkWithData_WhenServiceReturnsItems()
        {
            // Arrange
            var expected = new WebApiResponse<IEnumerable<PaymentDto>>
            {
                Data = _paymentsMock,
                Status = ResponseStatus.Success,
                Message = $"{_paymentsMock.Count} registro(s) encontrado(s).",
            };

            _serviceMock.Setup(s => s.FindAll()).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetAll();

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<PaymentDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.FindAll(), Times.Once);
        }

        [Fact]
        public async Task GetAllPaged_ShouldReturnOkWithData_WhenServiceReturnsPagedItems()
        {
            // Arrange
            var expected = new WebApiResponse<PagedResult<PaymentDto>>
            {
                Data = new PagedResult<PaymentDto> { Items = _paymentsMock, TotalCount = _paymentsMock.Count },
                Status = ResponseStatus.Success,
                Message = $"{_paymentsMock.Count} registro(s) encontrado(s).",
            };
            var request = new PagedRequest { Page = 1, PageSize = 50 };

            _serviceMock.Setup(s => s.FindAllPaged(request)).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetAllPaged(request);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<PagedResult<PaymentDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.FindAllPaged(request), Times.Once);
        }

        [Fact]
        public async Task GetById_ShouldReturnOkWithItem_WhenServiceReturnsItem()
        {
            // Arrange
            var id = _paymentsMock.First().Id;
            var expected = new WebApiResponse<PaymentDto>
            {
                Data = _paymentsMock.First(p => p.Id == id),
                Status = ResponseStatus.Success,
                Message = $"Pagamento {_paymentsMock.First(p => p.Id == id).Description} encontrada com sucesso",
            };

            _serviceMock.Setup(s => s.FindById(id)).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetById(id);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<PaymentDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.FindById(id), Times.Once);
        }

        [Fact]
        public async Task GetByTransactionId_ShouldReturnOkWithItems_WhenServiceReturnsItems()
        {
            // Arrange
            var txId = Guid.NewGuid();
            var list = new List<PaymentDto> { _paymentsMock.First() };
            var expected = new WebApiResponse<IEnumerable<PaymentDto>>
            {
                Data = list,
                Status = ResponseStatus.Success,
                Message = $"{list.Count} registro(s) encontrado(s).",
            };

            _serviceMock.Setup(s => s.FindByTransactionId(txId)).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetByTransactionId(txId);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<PaymentDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.FindByTransactionId(txId), Times.Once);
        }

        [Fact]
        public async Task GetByBusinessPartnerId_ShouldReturnOkWithItems_WhenServiceReturnsItems()
        {
            // Arrange
            var bpId = Guid.NewGuid();
            var list = new List<PaymentDto> { _paymentsMock.First() };
            var expected = new WebApiResponse<IEnumerable<PaymentDto>>
            {
                Data = list,
                Status = ResponseStatus.Success,
                Message = $"{list.Count} registro(s) encontrado(s).",
            };

            _serviceMock.Setup(s => s.FindByBusinessPartnerId(bpId)).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetByBusinessPartnerId(bpId);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<PaymentDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.FindByBusinessPartnerId(bpId), Times.Once);
        }

        [Fact]
        public async Task GetByOrderId_ShouldReturnOkWithItems_WhenServiceReturnsItems()
        {
            // Arrange
            var orderId = Guid.NewGuid();
            var list = new List<PaymentDto> { _paymentsMock.First() };
            var expected = new WebApiResponse<IEnumerable<PaymentDto>>
            {
                Data = list,
                Status = ResponseStatus.Success,
                Message = $"{list.Count} registro(s) encontrado(s).",
            };

            _serviceMock.Setup(s => s.FindByOrderId(orderId)).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetByOrderId(orderId);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<PaymentDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.FindByOrderId(orderId), Times.Once);
        }

        [Fact]
        public async Task GetByPurchaseOrderId_ShouldReturnOkWithItems_WhenServiceReturnsItems()
        {
            // Arrange
            var purchaseOrderId = Guid.NewGuid();
            var list = new List<PaymentDto> { _paymentsMock.First() };
            var expected = new WebApiResponse<IEnumerable<PaymentDto>>
            {
                Data = list,
                Status = ResponseStatus.Success,
                Message = $"{list.Count} registro(s) encontrado(s).",
            };

            _serviceMock
                .Setup(s => s.FindByPurchaseOrderId(purchaseOrderId))
                .ReturnsAsync(expected);

            // Act
            var result = await _controller.GetByPurchaseOrderId(purchaseOrderId);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<PaymentDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.FindByPurchaseOrderId(purchaseOrderId), Times.Once);
        }

        [Fact]
        public async Task GetByTripId_ShouldReturnOkWithItems_WhenServiceReturnsItems()
        {
            // Arrange
            var tripId = Guid.NewGuid();
            var list = new List<PaymentDto> { _paymentsMock.First() };
            var expected = new WebApiResponse<IEnumerable<PaymentDto>>
            {
                Data = list,
                Status = ResponseStatus.Success,
                Message = $"{list.Count} registro(s) encontrado(s).",
            };

            _serviceMock.Setup(s => s.FindByTripId(tripId)).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetByTripId(tripId);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<PaymentDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.FindByTripId(tripId), Times.Once);
        }

        [Fact]
        public async Task GetByDriverId_ShouldReturnOkWithItems_WhenServiceReturnsItems()
        {
            // Arrange
            var driverId = Guid.NewGuid();
            var list = new List<PaymentDto> { _paymentsMock.First() };
            var expected = new WebApiResponse<IEnumerable<PaymentDto>>
            {
                Data = list,
                Status = ResponseStatus.Success,
                Message = $"{list.Count} registro(s) encontrado(s).",
            };

            _serviceMock.Setup(s => s.FindByDriverId(driverId)).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetByDriverId(driverId);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<PaymentDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.FindByDriverId(driverId), Times.Once);
        }

        [Fact]
        public async Task GetPaymentsGroupByCategory_ShouldReturnOkWithJsonObject_WhenServiceReturnsData()
        {
            // Arrange
            var json = new JsonObject { ["categories"] = new JsonArray() };
            var expected = new WebApiResponse<JsonObject>
            {
                Data = json,
                Status = ResponseStatus.Success,
                Message = "Resumo por categoria gerado com sucesso.",
            };

            _serviceMock
                .Setup(s =>
                    s.GetPaymentsGroupByCategory(
                        It.IsAny<PaymentType?>(),
                        It.IsAny<DateTime?>(),
                        It.IsAny<DateTime?>()
                    )
                )
                .ReturnsAsync(expected);

            // Act
            var result = await _controller.GetPaymentsGroupByCategory();

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<JsonObject>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(
                s => s.GetPaymentsGroupByCategory(null, null, null),
                Times.Once
            );
        }

        [Fact]
        public async Task GetPaymentsHistory_ShouldReturnOkWithJsonObject_WhenServiceReturnsData()
        {
            // Arrange
            var json = new JsonObject { ["incoming"] = new JsonArray(), ["outgoing"] = new JsonArray() };
            var expected = new WebApiResponse<JsonObject>
            {
                Data = json,
                Status = ResponseStatus.Success,
                Message = "Histórico de pagamentos gerado com sucesso.",
            };

            _serviceMock.Setup(s => s.GetPaymentsHistory(It.IsAny<DateTime?>(), It.IsAny<DateTime?>())).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetPaymentsHistory();

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<JsonObject>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.GetPaymentsHistory(null, null), Times.Once);
        }

        [Fact]
        public async Task GetDelayed_ShouldReturnOkWithData_WhenServiceReturnsItems()
        {
            // Arrange
            var expected = new WebApiResponse<IEnumerable<PaymentDto>>
            {
                Data = _paymentsMock,
                Status = ResponseStatus.Success,
                Message = $"{_paymentsMock.Count} registro(s) encontrado(s).",
            };

            _serviceMock.Setup(s => s.FindDelayed()).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetDelayed();

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<PaymentDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.FindDelayed(), Times.Once);
        }
    }
}
