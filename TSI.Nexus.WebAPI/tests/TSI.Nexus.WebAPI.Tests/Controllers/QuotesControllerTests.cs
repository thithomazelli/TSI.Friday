using Microsoft.AspNetCore.Mvc;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;
using TSI.Nexus.WebAPI.Controllers;

namespace TSI.Nexus.WebAPI.Tests.Controllers
{
    public class QuotesControllerTests
    {
        private readonly QuotesController _controller;
        private readonly Mock<IQuoteService> _serviceMock;
        private readonly Mock<IDocumentPdfGenerationService> _documentPdfGenerationServiceMock;

        public QuotesControllerTests()
        {
            _serviceMock = new Mock<IQuoteService>();
            _documentPdfGenerationServiceMock = new Mock<IDocumentPdfGenerationService>();
            _controller = new QuotesController(_serviceMock.Object, _documentPdfGenerationServiceMock.Object);
        }

        [Fact]
        public async Task QuotesController_Add_ShouldAddQuoteSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var dtoMock = new QuoteDto
            {
                Id = Guid.NewGuid(),
                BusinessPartnerId = Guid.NewGuid(),
            };
            var expectedResult = new WebApiResponse<QuoteDto>
            {
                Data = dtoMock,
                Status = ResponseStatus.Success,
                Message = "Orçamento cadastrado com sucesso.",
            };

            _serviceMock.Setup(_ => _.Add(It.IsAny<QuoteDto>())).ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.Add(dtoMock);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<QuoteDto>>(okResult.Value);
            Assert.Equal(ResponseStatus.Success, response.Status);
            Assert.Equal(dtoMock, response.Data);

            _serviceMock.Verify(_ => _.Add(It.IsAny<QuoteDto>()), Times.Once);
        }

        [Fact]
        public async Task QuotesController_Add_ShouldNotAddQuote_WhenMethodIsCalledWithAnInvalidObject()
        {
            // Arrange
            var dtoMock = new QuoteDto();
            _controller.ModelState.AddModelError(
                "BusinessPartnerId",
                "BusinessPartnerId is required"
            );

            // Act
            var result = await _controller.Add(dtoMock);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var modelState = Assert.IsType<SerializableError>(badRequest.Value);
            Assert.True(modelState.ContainsKey("BusinessPartnerId"));

            _serviceMock.Verify(_ => _.Add(It.IsAny<QuoteDto>()), Times.Never);
        }

        [Fact]
        public async Task QuotesController_Update_ShouldUpdateQuoteSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var dtoMock = new QuoteDto { Id = Guid.NewGuid() };
            var expectedResult = new WebApiResponse<QuoteDto>
            {
                Data = dtoMock,
                Status = ResponseStatus.Success,
                Message = "Orçamento atualizado com sucesso.",
            };

            _serviceMock.Setup(_ => _.Update(It.IsAny<QuoteDto>())).ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.Update(dtoMock);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<QuoteDto>>(okResult.Value);
            Assert.Equal(ResponseStatus.Success, response.Status);

            _serviceMock.Verify(_ => _.Update(It.IsAny<QuoteDto>()), Times.Once);
        }

        [Fact]
        public async Task QuotesController_Update_ShouldNotUpdateQuote_WhenMethodIsCalledWithAnInvalidObject()
        {
            // Arrange
            var dtoMock = new QuoteDto();
            _controller.ModelState.AddModelError(
                "BusinessPartnerId",
                "BusinessPartnerId is required"
            );

            // Act
            var result = await _controller.Update(dtoMock);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var modelState = Assert.IsType<SerializableError>(badRequest.Value);
            Assert.True(modelState.ContainsKey("BusinessPartnerId"));

            _serviceMock.Verify(_ => _.Update(It.IsAny<QuoteDto>()), Times.Never);
        }

        [Fact]
        public async Task QuotesController_ConvertToOrder_ShouldConvertQuoteToOrder_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var dtoMock = new QuoteDto { Id = Guid.NewGuid(), Type = QuoteType.Product };
            var expectedResult = new WebApiResponse<QuoteDto>
            {
                Data = dtoMock,
                Status = ResponseStatus.Success,
                Message = "Orçamento convertido em pedido com sucesso.",
            };

            _serviceMock
                .Setup(_ => _.ConvertToOrder(It.IsAny<QuoteDto>()))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.ConvertToOrder(dtoMock);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<QuoteDto>>(okResult.Value);
            Assert.Equal(ResponseStatus.Success, response.Status);

            _serviceMock.Verify(_ => _.ConvertToOrder(It.IsAny<QuoteDto>()), Times.Once);
        }

        [Fact]
        public async Task QuotesController_ConvertToOrder_ShouldNotConvertQuote_WhenMethodIsCalledWithAnInvalidObject()
        {
            // Arrange
            var dtoMock = new QuoteDto();
            _controller.ModelState.AddModelError(
                "BusinessPartnerId",
                "BusinessPartnerId is required"
            );

            // Act
            var result = await _controller.ConvertToOrder(dtoMock);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var modelState = Assert.IsType<SerializableError>(badRequest.Value);
            Assert.True(modelState.ContainsKey("BusinessPartnerId"));

            _serviceMock.Verify(_ => _.ConvertToOrder(It.IsAny<QuoteDto>()), Times.Never);
        }

        [Fact]
        public async Task QuotesController_ConvertToTrip_ShouldConvertQuoteToTrip_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var dtoMock = new QuoteDto { Id = Guid.NewGuid(), Type = QuoteType.Trip };
            var expectedResult = new WebApiResponse<QuoteDto>
            {
                Data = dtoMock,
                Status = ResponseStatus.Success,
                Message = "Orçamento convertido em viagem com sucesso.",
            };

            _serviceMock
                .Setup(_ => _.ConvertToTrip(It.IsAny<QuoteDto>()))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.ConvertToTrip(dtoMock);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<QuoteDto>>(okResult.Value);
            Assert.Equal(ResponseStatus.Success, response.Status);

            _serviceMock.Verify(_ => _.ConvertToTrip(It.IsAny<QuoteDto>()), Times.Once);
        }

        [Fact]
        public async Task QuotesController_ConvertToTrip_ShouldNotConvertQuote_WhenMethodIsCalledWithAnInvalidObject()
        {
            // Arrange
            var dtoMock = new QuoteDto();
            _controller.ModelState.AddModelError(
                "BusinessPartnerId",
                "BusinessPartnerId is required"
            );

            // Act
            var result = await _controller.ConvertToTrip(dtoMock);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var modelState = Assert.IsType<SerializableError>(badRequest.Value);
            Assert.True(modelState.ContainsKey("BusinessPartnerId"));

            _serviceMock.Verify(_ => _.ConvertToTrip(It.IsAny<QuoteDto>()), Times.Never);
        }

        [Fact]
        public async Task QuotesController_Remove_ShouldRemoveQuoteSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var dtoMock = new QuoteDto { Id = Guid.NewGuid() };
            var expectedResult = new WebApiResponse<QuoteDto>
            {
                Data = dtoMock,
                Status = ResponseStatus.Success,
                Message = "Orçamento removido com sucesso.",
            };

            _serviceMock.Setup(_ => _.Remove(It.IsAny<QuoteDto>())).ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.Remove(dtoMock);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<QuoteDto>>(okResult.Value);
            Assert.Equal(ResponseStatus.Success, response.Status);

            _serviceMock.Verify(_ => _.Remove(It.IsAny<QuoteDto>()), Times.Once);
        }

        [Fact]
        public async Task QuotesController_GetAll_ShouldGetAllQuotes_WhenMethodIsCalled()
        {
            // Arrange
            var listMock = new List<QuoteDto> { new() { Id = Guid.NewGuid() } };
            var expectedResult = new WebApiResponse<IEnumerable<QuoteDto>>
            {
                Data = listMock,
                Status = ResponseStatus.Success,
                Message = $"{listMock.Count} registro(s) encontrado(s).",
            };

            _serviceMock.Setup(_ => _.FindAll()).ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.GetAll();

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<QuoteDto>>>(okResult.Value);
            Assert.Equal(listMock, response.Data);

            _serviceMock.Verify(_ => _.FindAll(), Times.Once);
        }

        [Fact]
        public async Task QuotesController_GetById_ShouldGetQuoteById_WhenMethodIsCalled()
        {
            // Arrange
            var idMock = Guid.NewGuid();
            var dtoMock = new QuoteDto { Id = idMock };
            var expectedResult = new WebApiResponse<QuoteDto>
            {
                Data = dtoMock,
                Status = ResponseStatus.Success,
                Message = "Orçamento encontrado com sucesso",
            };

            _serviceMock.Setup(_ => _.FindById(idMock)).ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.GetById(idMock);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<QuoteDto>>(okResult.Value);
            Assert.Equal(dtoMock, response.Data);

            _serviceMock.Verify(_ => _.FindById(idMock), Times.Once);
        }

        [Fact]
        public async Task QuotesController_GetByQuoteNumber_ShouldGetQuoteByQuoteNumber_WhenMethodIsCalled()
        {
            // Arrange
            const string quoteNumber = "ORC-0001";
            var dtoMock = new QuoteDto { Id = Guid.NewGuid(), QuoteNumber = quoteNumber };
            var expectedResult = new WebApiResponse<QuoteDto>
            {
                Data = dtoMock,
                Status = ResponseStatus.Success,
                Message = "Orçamento encontrado com sucesso",
            };

            _serviceMock.Setup(_ => _.FindByQuoteNumber(quoteNumber)).ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.GetByQuoteNumber(quoteNumber);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<QuoteDto>>(okResult.Value);
            Assert.Equal(dtoMock, response.Data);

            _serviceMock.Verify(_ => _.FindByQuoteNumber(quoteNumber), Times.Once);
        }

        [Fact]
        public async Task QuotesController_GetByBusinessPartnerId_ShouldGetQuotesForBusinessPartner_WhenMethodIsCalled()
        {
            // Arrange
            var businessPartnerId = Guid.NewGuid();
            var listMock = new List<QuoteDto>
            {
                new() { Id = Guid.NewGuid(), BusinessPartnerId = businessPartnerId },
            };
            var expectedResult = new WebApiResponse<IEnumerable<QuoteDto>>
            {
                Data = listMock,
                Status = ResponseStatus.Success,
                Message = $"{listMock.Count} registro(s) encontrado(s).",
            };

            _serviceMock
                .Setup(_ => _.FindByBusinessPartnerId(businessPartnerId))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.GetByBusinessPartnerId(businessPartnerId);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<QuoteDto>>>(okResult.Value);
            Assert.Equal(listMock, response.Data);

            _serviceMock.Verify(_ => _.FindByBusinessPartnerId(businessPartnerId), Times.Once);
        }

        [Fact]
        public async Task QuotesController_GetByProductId_ShouldGetQuotesForProduct_WhenMethodIsCalled()
        {
            // Arrange
            var productId = Guid.NewGuid();
            var listMock = new List<QuoteDto> { new() { Id = Guid.NewGuid() } };
            var expectedResult = new WebApiResponse<IEnumerable<QuoteDto>>
            {
                Data = listMock,
                Status = ResponseStatus.Success,
                Message = $"{listMock.Count} registro(s) encontrado(s).",
            };

            _serviceMock.Setup(_ => _.FindByProductId(productId)).ReturnsAsync(expectedResult);

            // Act
            var result = await _controller.GetByProductId(productId);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<QuoteDto>>>(okResult.Value);
            Assert.Equal(listMock, response.Data);

            _serviceMock.Verify(_ => _.FindByProductId(productId), Times.Once);
        }

        [Fact]
        public async Task Pdf_ShouldReturnFile_WhenQuoteExists()
        {
            var quoteId = Guid.NewGuid();
            var pdfBytes = new byte[] { 0x25, 0x50, 0x44, 0x46 };
            _documentPdfGenerationServiceMock
                .Setup(s => s.GenerateQuotePdf(quoteId))
                .ReturnsAsync(pdfBytes);

            var result = await _controller.Pdf(quoteId);

            var fileResult = Assert.IsType<FileContentResult>(result);
            Assert.Equal("application/pdf", fileResult.ContentType);
            Assert.Equal(pdfBytes, fileResult.FileContents);
        }

        [Fact]
        public async Task Pdf_ShouldReturnNotFound_WhenQuoteDoesNotExist()
        {
            var quoteId = Guid.NewGuid();
            _documentPdfGenerationServiceMock
                .Setup(s => s.GenerateQuotePdf(quoteId))
                .ReturnsAsync((byte[]?)null);

            var result = await _controller.Pdf(quoteId);

            Assert.IsType<NotFoundObjectResult>(result);
        }
    }
}
