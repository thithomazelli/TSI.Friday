using System.Linq.Expressions;
using FluentAssertions;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services.Tests.Services
{
    public class ProductServicePhotoTests
    {
        private readonly ProductPhotoService _productPhotoService;
        private readonly Mock<IRepository<ProductPhoto>> _repository;
        private readonly IList<ProductPhoto> _productPhotoListMock;

        public ProductServicePhotoTests()
        {
            _repository = new Mock<IRepository<ProductPhoto>>();
            _productPhotoService = new ProductPhotoService(_repository.Object);

            _productPhotoListMock = new List<ProductPhoto>
            {
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    ProductId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    FileName = "Photo001.jpg",
                    IsDefault = true,
                },
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    ProductId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    FileName = "Photo002.jpg",
                    IsDefault = false,
                },
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                    ProductId = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    FileName = "Photo003.jpg",
                    IsDefault = true,
                },
            };
        }

        [Fact]
        public async Task ProductPhotoService_Add_ShouldAddProductPhotoSuccessfully_WhenMethodIsCalled()
        {
            // Arrange
            var productPhotoMock = new ProductPhoto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                FileName = "Photo001.jpg",
                IsDefault = true,
            };
            var expectedResult = new WebApiResponse<ProductPhoto>
            {
                Data = productPhotoMock,
                Status = ResponseStatus.Success,
                Message = $"Imagem {productPhotoMock.FileName} cadastrada com sucesso.",
            };

            _repository.Setup(_ => _.AddAsync(It.IsAny<ProductPhoto>()));

            // Act
            var result = await _productPhotoService.Add(productPhotoMock);

            // Assert
            Assert.Equal(expectedResult.Data, productPhotoMock);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<ProductPhoto>()), Times.Once);
        }

        [Fact]
        public async Task ProductPhotoService_Add_ShouldNotAddProductPhotoAndReturnAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            var productPhotoMock = new ProductPhoto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                FileName = "Photo001.jpg",
                IsDefault = true,
            };
            var expectedResult = new WebApiResponse<Product>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível cadastrar a Imagem {productPhotoMock.FileName} na base de dados.",
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<ProductPhoto, bool>>>()))
                .ReturnsAsync(new List<ProductPhoto>());
            _repository.Setup(_ => _.AddAsync(It.IsAny<ProductPhoto>())).ThrowsAsync(exception);

            // Act
            var result = await _productPhotoService.Add(productPhotoMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<ProductPhoto>()), Times.Once);
        }

        [Fact]
        public async Task ProductPhotoService_Update_ShouldUpdateProductPhotoSuccessfully_WhenMethodIsCalled()
        {
            // Arrange
            var productPhotoMock = new ProductPhoto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                FileName = "Photo001.jpg",
                IsDefault = true,
            };

            var expectedResult = new WebApiResponse<ProductPhoto>
            {
                Data = productPhotoMock,
                Status = ResponseStatus.Success,
                Message = $"Imagem {productPhotoMock.FileName} atualizada com sucesso.",
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<ProductPhoto, bool>>>()))
                .ReturnsAsync(new List<ProductPhoto>());
            _repository.Setup(_ => _.UpdateAsync(It.IsAny<ProductPhoto>()));

            // Act
            var result = await _productPhotoService.Update(productPhotoMock);

            // Assert
            Assert.Equal(expectedResult.Data, productPhotoMock);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<ProductPhoto>()), Times.Once);
        }

        [Fact]
        public async Task ProductPhotoService_Update_ShouldNotUpdateProductPhotoAndReturnAndErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            var productPhotoMock = new ProductPhoto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                FileName = "Photo001.jpg",
                IsDefault = true,
            };
            var expectedResult = new WebApiResponse<Product>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível atualizar os dados da Imagem {productPhotoMock.FileName} na base de dados.",
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<ProductPhoto, bool>>>()))
                .ReturnsAsync(new List<ProductPhoto>());
            _repository.Setup(_ => _.UpdateAsync(It.IsAny<ProductPhoto>())).Throws(exception);

            // Act
            var result = await _productPhotoService.Update(productPhotoMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<ProductPhoto>()), Times.Once);
        }

        [Fact]
        public async Task ProductPhotoService_Remove_ShouldRemoveProductPhotoSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var productPhotoMock = new ProductPhoto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                FileName = "Photo001.jpg",
                IsDefault = true,
            };
            var expectedResult = new WebApiResponse<ProductPhoto>
            {
                Data = productPhotoMock,
                Status = ResponseStatus.Success,
                Message = $"Imagem {productPhotoMock.FileName} removida com sucesso.",
            };

            _repository.Setup(_ => _.RemoveAsync(It.IsAny<ProductPhoto>()));

            // Act
            var result = await _productPhotoService.Remove(productPhotoMock);

            // Assert
            Assert.Equal(expectedResult.Data, productPhotoMock);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.RemoveAsync(It.IsAny<ProductPhoto>()), Times.Once);
        }

        [Fact]
        public async Task ProductPhotoService_Remove_ShouldNotRemoveProductPhotoAndReturnsAndError_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            var productPhotoMock = new ProductPhoto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                FileName = "Photo001.jpg",
                IsDefault = true,
            };
            var expectedResult = new WebApiResponse<Product>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível remover a Imagem {productPhotoMock.FileName} da base de dados.",
            };

            _repository.Setup(_ => _.RemoveAsync(It.IsAny<ProductPhoto>())).Throws(exception);

            // Act
            var result = await _productPhotoService.Remove(productPhotoMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.RemoveAsync(It.IsAny<ProductPhoto>()), Times.Once);
        }

        [Fact]
        public async Task ProductPhotoService_FindById_ShouldReturnAnProductPhotoSuccessfully_WhenIdIsValid()
        {
            // Arrange
            var idMock = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var productPhotoMock = _productPhotoListMock.FirstOrDefault(_ => idMock.Equals(_.Id));
            var expectedResult = new WebApiResponse<ProductPhoto>
            {
                Data = productPhotoMock,
                Status = ResponseStatus.Success,
                Message = $"Imagem {productPhotoMock!.FileName} encontrada com sucesso",
            };

            _repository.Setup(_ => _.GetByIdAsync(idMock)).ReturnsAsync(productPhotoMock);

            // Act
            var result = await _productPhotoService.FindById(idMock);

            // Assert
            Assert.Equal(expectedResult.Data, result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.GetByIdAsync(idMock), Times.Once);
        }

        [Fact]
        public async Task ProductPhotoService_FindById_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenIdIsInvalid()
        {
            // Arrange
            var idMock = Guid.Parse("00000000-0000-0000-0000-000000000010");
            var expectedResult = new WebApiResponse<Product>
            {
                Data = null,
                Status = ResponseStatus.Success,
                Message = $"Nenhuma Imagem com o ID {idMock} foi encontrada",
            };

            _repository.Setup(_ => _.GetByIdAsync(idMock)).ReturnsAsync(value: null);

            // Act
            var result = await _productPhotoService.FindById(idMock);

            // Assert
            Assert.Null(result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.GetByIdAsync(idMock), Times.Once);
        }

        [Fact]
        public async Task ProductPhotoService_FindById_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var idMock = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var exception = new Exception();
            var expectedResult = new WebApiResponse<Product>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível acessar os registros de Imagems na base de dados.",
            };

            _repository.Setup(_ => _.GetByIdAsync(idMock)).Throws(exception);

            // Act
            var result = await _productPhotoService.FindById(idMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.GetByIdAsync(idMock), Times.Once);
        }

        [Fact]
        public async Task ProductPhotoService_FindDefaultByProduct_ShouldReturnAnProductPhotoSuccessfully_WhenIdIsValid()
        {
            // Arrange
            var productPhotoIdMock = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var productPhotoMock = _productPhotoListMock
                .Where(_ => productPhotoIdMock.Equals(_.ProductId) && _.IsDefault)
                .ToList();
            var expectedResult = new WebApiResponse<ProductPhoto>
            {
                Data = productPhotoMock.FirstOrDefault(),
                Status = ResponseStatus.Success,
                Message =
                    $"Imagem {productPhotoMock.FirstOrDefault()!.FileName} encontrada com sucesso",
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<ProductPhoto, bool>>>()))
                .ReturnsAsync(productPhotoMock);

            // Act
            var result = await _productPhotoService.FindDefaultByProduct(productPhotoIdMock);

            // Assert
            Assert.Equal(expectedResult.Data, result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.QueryAsync(It.IsAny<Expression<Func<ProductPhoto, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task ProductPhotoService_FindDefaultByProduct_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenThereIsNoDefaultImage()
        {
            // Arrange
            var productPhotoIdMock = Guid.Parse("00000000-0000-0000-0000-000000000010");
            var productPhotoMock = _productPhotoListMock
                .Where(_ => productPhotoIdMock.Equals(_.ProductId) && _.IsDefault)
                .ToList();
            var expectedResult = new WebApiResponse<ProductPhoto>
            {
                Data = null,
                Status = ResponseStatus.Success,
                Message =
                    $"Não foi encontrada nenhuma imagem padrão para o produto {productPhotoIdMock}.",
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<ProductPhoto, bool>>>()))
                .ReturnsAsync(productPhotoMock);

            // Act
            var result = await _productPhotoService.FindDefaultByProduct(productPhotoIdMock);

            // Assert
            Assert.Equal(expectedResult.Data, result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.QueryAsync(It.IsAny<Expression<Func<ProductPhoto, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task ProductPhotoService_FindDefaultByProduct_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var productPhotoIdMock = Guid.Parse("00000000-0000-0000-0000-000000000010");
            var exception = new Exception();
            var expectedResult = new WebApiResponse<Product>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível acessar os registros de Imagems na base de dados.",
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<ProductPhoto, bool>>>()))
                .Throws(exception);

            // Act
            var result = await _productPhotoService.FindDefaultByProduct(productPhotoIdMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.QueryAsync(It.IsAny<Expression<Func<ProductPhoto, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task ProductPhotoService_FindAllByProduct_ShouldReturnAListOfProductPhoto_WhenDataTableHasRegisters()
        {
            // Arrange
            var productIdMock = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var productPhotoListMock = _productPhotoListMock
                .Where(_ => _.ProductId == productIdMock)
                .ToList();
            var expectedResult = new WebApiResponse<IEnumerable<ProductPhoto>>
            {
                Data = productPhotoListMock,
                Status = ResponseStatus.Success,
                Message = $"{productPhotoListMock.Count} registro(s) encontrado(s).",
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<ProductPhoto, bool>>>()))
                .ReturnsAsync(productPhotoListMock);

            // Act
            var result = await _productPhotoService.FindAllByProduct(productIdMock);

            // Assert
            Assert.Equal(expectedResult.Data, result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.QueryAsync(It.IsAny<Expression<Func<ProductPhoto, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task ProductPhotoService_FindAllByProduct_ShouldReturnAnEmptyData_WhenDataTableHasNoRegisters()
        {
            // Arrange
            var productIdMock = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var expectedResult = new WebApiResponse<IEnumerable<ProductPhoto>>
            {
                Data = new List<ProductPhoto>(),
                Status = ResponseStatus.Success,
                Message = $"{0} registro(s) encontrado(s).",
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<ProductPhoto, bool>>>()))
                .ReturnsAsync(new List<ProductPhoto>());

            // Act
            var result = await _productPhotoService.FindAllByProduct(productIdMock);

            // Assert
            Assert.Equal(expectedResult.Data, result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.QueryAsync(It.IsAny<Expression<Func<ProductPhoto, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task ProductPhotoService_FindAllByProduct_ShouldReturnAnEmptyListAndAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var productIdMock = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var productPhotoMock = _productPhotoListMock
                .Where(_ => productIdMock.Equals(_.ProductId) && _.IsDefault)
                .ToList();
            var exception = new Exception();
            var expectedResult = new WebApiResponse<IEnumerable<Product>>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível acessar os registros de Imagems na base de dados.",
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<ProductPhoto, bool>>>()))
                .ThrowsAsync(exception);

            // Act
            var result = await _productPhotoService.FindAllByProduct(productIdMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.QueryAsync(It.IsAny<Expression<Func<ProductPhoto, bool>>>()),
                Times.Once
            );
        }
    }
}
