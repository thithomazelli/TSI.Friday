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
    public class TransactionsControllerTests
    {
        private readonly TransactionsController _controller;
        private readonly Mock<ITransactionService> _serviceMock;
        private readonly IList<TransactionDto> _transactionsMock;

        public TransactionsControllerTests()
        {
            _serviceMock = new Mock<ITransactionService>();
            _controller = new TransactionsController(_serviceMock.Object);

            _transactionsMock = new List<TransactionDto>
            {
                new TransactionDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    Description = "Transação1",
                    BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    OrderId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                },
                new TransactionDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    Description = "Transação2",
                    BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    OrderId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                },
            };
        }

        [Fact]
        public async Task GetByBusinessPartnerId_ShouldReturnOkWithTransactions_WhenServiceReturnsTransactions()
        {
            // Arrange
            var businessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var transactions = _transactionsMock
                .Where(p => p.BusinessPartnerId == businessPartnerId)
                .ToList();
            var expected = new WebApiResponse<IEnumerable<TransactionDto>>
            {
                Data = transactions,
                Status = ResponseStatus.Success,
                Message = $"{transactions.Count} registro(s) encontrado(s).",
            };

            _serviceMock
                .Setup(s => s.FindByBusinessPartnerId(businessPartnerId))
                .ReturnsAsync(expected);

            // Act
            var result = await _controller.GetByBusinessPartnerId(businessPartnerId);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<TransactionDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.FindByBusinessPartnerId(businessPartnerId), Times.Once);
        }

        [Fact]
        public async Task GetById_ShouldReturnOkWithTransaction_WhenServiceReturnsTransaction()
        {
            // Arrange
            var id = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var transaction = _transactionsMock.First(p => p.Id == id);
            var expected = new WebApiResponse<TransactionDto>
            {
                Data = transaction,
                Status = ResponseStatus.Success,
                Message = $"Transação {transaction.Description} encontrado com sucesso",
            };

            _serviceMock.Setup(s => s.FindById(id)).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetById(id);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<TransactionDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.FindById(id), Times.Once);
        }

        [Fact]
        public async Task Add_ShouldReturnOkWithCreatedTransaction_WhenModelIsValid()
        {
            // Arrange
            var transaction = new TransactionDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                Description = "Transação3",
                BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                OrderId = Guid.Parse("00000000-0000-0000-0000-000000000002"),
            };
            var expected = new WebApiResponse<TransactionDto>
            {
                Data = transaction,
                Status = ResponseStatus.Success,
                Message = $"Transação {transaction.Description} cadastrado com sucesso.",
            };

            _serviceMock.Setup(s => s.Add(transaction)).ReturnsAsync(expected);

            // Act
            var result = await _controller.Add(transaction);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<TransactionDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.Add(transaction), Times.Once);
        }

        [Fact]
        public async Task Add_ShouldReturnBadRequest_WhenModelIsInvalid()
        {
            // Arrange
            var transaction = new TransactionDto();
            _controller.ModelState.AddModelError(
                "BusinessPartnerId",
                "BusinessPartnerId is required"
            );

            // Act
            var result = await _controller.Add(transaction);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var modelState = Assert.IsType<SerializableError>(badRequest.Value);
            Assert.True(modelState.ContainsKey("BusinessPartnerId"));

            _serviceMock.Verify(s => s.Add(It.IsAny<TransactionDto>()), Times.Never);
        }

        [Fact]
        public async Task Update_ShouldReturnOkWithUpdatedTransaction_WhenModelIsValid()
        {
            // Arrange
            var transaction = _transactionsMock.First();
            var expected = new WebApiResponse<TransactionDto>
            {
                Data = transaction,
                Status = ResponseStatus.Success,
                Message = $"Transação {transaction.Description} atualizado com sucesso.",
            };

            _serviceMock.Setup(s => s.Update(transaction)).ReturnsAsync(expected);

            // Act
            var result = await _controller.Update(transaction);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<TransactionDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.Update(transaction), Times.Once);
        }

        [Fact]
        public async Task Update_ShouldReturnBadRequest_WhenModelIsInvalid()
        {
            // Arrange
            var transaction = new TransactionDto();
            _controller.ModelState.AddModelError(
                "BusinessPartnerId",
                "BusinessPartnerId is required"
            );

            // Act
            var result = await _controller.Update(transaction);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var modelState = Assert.IsType<SerializableError>(badRequest.Value);
            Assert.True(modelState.ContainsKey("BusinessPartnerId"));

            _serviceMock.Verify(s => s.Update(It.IsAny<TransactionDto>()), Times.Never);
        }

        [Fact]
        public async Task Remove_ShouldReturnOkWithRemovedTransaction_WhenMethodIsCalled()
        {
            // Arrange
            var transaction = _transactionsMock.First();
            var expected = new WebApiResponse<TransactionDto>
            {
                Data = transaction,
                Status = ResponseStatus.Success,
                Message = $"Transação {transaction.Description} removido com sucesso.",
            };

            _serviceMock.Setup(s => s.Remove(transaction)).ReturnsAsync(expected);

            // Act
            var result = await _controller.Remove(transaction);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<TransactionDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.Remove(transaction), Times.Once);
        }

        [Fact]
        public async Task GetAll_ShouldReturnOkWithData_WhenServiceReturnsTransactions()
        {
            // Arrange
            var expected = new WebApiResponse<IEnumerable<TransactionDto>>
            {
                Data = _transactionsMock,
                Status = ResponseStatus.Success,
                Message = $"{_transactionsMock.Count} registro(s) encontrado(s).",
            };

            _serviceMock.Setup(s => s.FindAll()).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetAll();

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<TransactionDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.FindAll(), Times.Once);
        }

        [Fact]
        public async Task GetAllPaged_ShouldReturnOkWithData_WhenServiceReturnsPagedTransactions()
        {
            // Arrange
            var expected = new WebApiResponse<PagedResult<TransactionDto>>
            {
                Data = new PagedResult<TransactionDto> { Items = _transactionsMock, TotalCount = _transactionsMock.Count },
                Status = ResponseStatus.Success,
                Message = $"{_transactionsMock.Count} registro(s) encontrado(s).",
            };
            var request = new PagedRequest { Page = 1, PageSize = 50 };

            _serviceMock.Setup(s => s.FindAllPaged(request)).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetAllPaged(request);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<PagedResult<TransactionDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _serviceMock.Verify(s => s.FindAllPaged(request), Times.Once);
        }
    }
}
