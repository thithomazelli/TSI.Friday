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
    public class OrdersControllerTests
    {
        private readonly OrdersController _controller;
        private readonly Mock<IOrderService> _orderServiceMock;
        private readonly Mock<IDocumentPdfGenerationService> _documentPdfGenerationServiceMock;
        private readonly IList<OrderDto> _ordersMock;

        public OrdersControllerTests()
        {
            _orderServiceMock = new Mock<IOrderService>();
            _documentPdfGenerationServiceMock = new Mock<IDocumentPdfGenerationService>();
            _controller = new OrdersController(_orderServiceMock.Object, _documentPdfGenerationServiceMock.Object);

            _ordersMock = new List<OrderDto>
            {
                new OrderDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    OrderNumber = "ORD-001",
                    Description = "Pedido1",
                    BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                },
                new OrderDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    OrderNumber = "ORD-002",
                    Description = "Pedido2",
                    BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                },
            };
        }

        [Fact]
        public async Task GetAll_ShouldReturnOkWithData_WhenServiceReturnsOrders()
        {
            // Arrange
            var expected = new WebApiResponse<IEnumerable<OrderDto>>
            {
                Data = _ordersMock,
                Status = ResponseStatus.Success,
                Message = $"{_ordersMock.Count} registro(s) encontrado(s).",
            };

            _orderServiceMock.Setup(s => s.FindAll()).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetAll();

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<OrderDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _orderServiceMock.Verify(s => s.FindAll(), Times.Once);
        }

        [Fact]
        public async Task GetById_ShouldReturnOkWithOrder_WhenServiceReturnsOrder()
        {
            // Arrange
            var id = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var order = _ordersMock.First(o => o.Id == id);
            var expected = new WebApiResponse<OrderDto>
            {
                Data = order,
                Status = ResponseStatus.Success,
                Message = $"Pedido {order.OrderNumber} encontrado com sucesso",
            };

            _orderServiceMock.Setup(s => s.FindById(id)).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetById(id);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<OrderDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _orderServiceMock.Verify(s => s.FindById(id), Times.Once);
        }

        [Fact]
        public async Task Add_ShouldReturnOkWithCreatedOrder_WhenModelIsValid()
        {
            // Arrange
            var order = new OrderDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                OrderNumber = "ORD-003",
                Description = "Novo Pedido",
                BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000002"),
            };
            var expected = new WebApiResponse<OrderDto>
            {
                Data = order,
                Status = ResponseStatus.Success,
                Message = $"Pedido {order.OrderNumber} cadastrado com sucesso.",
            };

            _orderServiceMock.Setup(s => s.Add(order)).ReturnsAsync(expected);

            // Act
            var result = await _controller.Add(order);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<OrderDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _orderServiceMock.Verify(s => s.Add(order), Times.Once);
        }

        [Fact]
        public async Task Add_ShouldReturnBadRequest_WhenModelIsInvalid()
        {
            // Arrange
            var order = new OrderDto();
            _controller.ModelState.AddModelError("BusinessPartnerId", "BusinessPartnerId is required");

            // Act
            var result = await _controller.Add(order);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var modelState = Assert.IsType<SerializableError>(badRequest.Value);
            Assert.True(modelState.ContainsKey("BusinessPartnerId"));

            _orderServiceMock.Verify(s => s.Add(It.IsAny<OrderDto>()), Times.Never);
        }

        [Fact]
        public async Task Update_ShouldReturnOkWithUpdatedOrder_WhenModelIsValid()
        {
            // Arrange
            var order = _ordersMock.First();
            var expected = new WebApiResponse<OrderDto>
            {
                Data = order,
                Status = ResponseStatus.Success,
                Message = $"Pedido {order.OrderNumber} atualizado com sucesso.",
            };

            _orderServiceMock.Setup(s => s.Update(order)).ReturnsAsync(expected);

            // Act
            var result = await _controller.Update(order);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<OrderDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _orderServiceMock.Verify(s => s.Update(order), Times.Once);
        }

        [Fact]
        public async Task Update_ShouldReturnBadRequest_WhenModelIsInvalid()
        {
            // Arrange
            var order = new OrderDto();
            _controller.ModelState.AddModelError("BusinessPartnerId", "BusinessPartnerId is required");

            // Act
            var result = await _controller.Update(order);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var modelState = Assert.IsType<SerializableError>(badRequest.Value);
            Assert.True(modelState.ContainsKey("BusinessPartnerId"));

            _orderServiceMock.Verify(s => s.Update(It.IsAny<OrderDto>()), Times.Never);
        }

        [Fact]
        public async Task Remove_ShouldReturnOkWithRemovedOrder_WhenMethodIsCalled()
        {
            // Arrange
            var order = _ordersMock.First();
            var expected = new WebApiResponse<OrderDto>
            {
                Data = order,
                Status = ResponseStatus.Success,
                Message = $"Pedido {order.OrderNumber} removido com sucesso.",
            };

            _orderServiceMock.Setup(s => s.Remove(order)).ReturnsAsync(expected);

            // Act
            var result = await _controller.Remove(order);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<OrderDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _orderServiceMock.Verify(s => s.Remove(order), Times.Once);
        }

        [Fact]
        public async Task GetByOrderNumber_ShouldReturnOkWithOrder_WhenServiceReturnsOrder()
        {
            // Arrange
            var order = _ordersMock.First();
            var expected = new WebApiResponse<OrderDto>
            {
                Data = order,
                Status = ResponseStatus.Success,
                Message = $"Pedido {order.OrderNumber} encontrado com sucesso",
            };

            _orderServiceMock
                .Setup(s => s.FindByOrderNumber(order.OrderNumber))
                .ReturnsAsync(expected);

            // Act
            var result = await _controller.GetByOrderNumber(order.OrderNumber);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<OrderDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _orderServiceMock.Verify(s => s.FindByOrderNumber(order.OrderNumber), Times.Once);
        }

        [Fact]
        public async Task GetByBusinessPartnerId_ShouldReturnOkWithOrders_WhenServiceReturnsOrders()
        {
            // Arrange
            var businessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var expected = new WebApiResponse<IEnumerable<OrderDto>>
            {
                Data = _ordersMock,
                Status = ResponseStatus.Success,
                Message = $"{_ordersMock.Count} registro(s) encontrado(s).",
            };

            _orderServiceMock
                .Setup(s => s.FindByBusinessPartnerId(businessPartnerId))
                .ReturnsAsync(expected);

            // Act
            var result = await _controller.GetByBusinessPartnerId(businessPartnerId);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<OrderDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _orderServiceMock.Verify(
                s => s.FindByBusinessPartnerId(businessPartnerId),
                Times.Once
            );
        }

        [Fact]
        public async Task GetByProductId_ShouldReturnOkWithOrders_WhenServiceReturnsOrders()
        {
            // Arrange
            var productId = Guid.NewGuid();
            var expected = new WebApiResponse<IEnumerable<OrderDto>>
            {
                Data = _ordersMock,
                Status = ResponseStatus.Success,
                Message = $"{_ordersMock.Count} registro(s) encontrado(s).",
            };

            _orderServiceMock.Setup(s => s.FindByProductId(productId)).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetByProductId(productId);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<OrderDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _orderServiceMock.Verify(s => s.FindByProductId(productId), Times.Once);
        }

        [Fact]
        public async Task Pdf_ShouldReturnFile_WhenOrderExists()
        {
            var orderId = Guid.NewGuid();
            var pdfBytes = new byte[] { 0x25, 0x50, 0x44, 0x46 };
            _documentPdfGenerationServiceMock.Setup(s => s.GenerateSalesOrderPdf(orderId)).ReturnsAsync(pdfBytes);

            var result = await _controller.Pdf(orderId);

            var fileResult = Assert.IsType<FileContentResult>(result);
            Assert.Equal("application/pdf", fileResult.ContentType);
            Assert.Equal(pdfBytes, fileResult.FileContents);
        }

        [Fact]
        public async Task Pdf_ShouldReturnNotFound_WhenOrderDoesNotExist()
        {
            var orderId = Guid.NewGuid();
            _documentPdfGenerationServiceMock.Setup(s => s.GenerateSalesOrderPdf(orderId)).ReturnsAsync((byte[]?)null);

            var result = await _controller.Pdf(orderId);

            Assert.IsType<NotFoundObjectResult>(result);
        }
    }
}
