using System.Linq.Expressions;
using FluentAssertions;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services.Tests.Services
{
    public class ProductServiceTests
    {
        private readonly ProductService _productService;
        private readonly Mock<IRepository<Product>> _repository;
        private readonly Mock<IRepository<OrderProduct>> _orderProductRepositoryMock;
        private readonly Mock<ILogService> _logServiceMock;
        private readonly IList<Product> _productListMock;

        public ProductServiceTests()
        {
            _repository = new Mock<IRepository<Product>>();
            _orderProductRepositoryMock = new Mock<IRepository<OrderProduct>>();
            _logServiceMock = new Mock<ILogService>();
            _productService = new ProductService(
                _repository.Object,
                _orderProductRepositoryMock.Object,
                _logServiceMock.Object
            );

            _productListMock = new List<Product>
            {
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    Sku = "SKU001",
                    Name = "Caçamba",
                    Unit = ProductUnit.Unit,
                    Price = 25.00M,
                },
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    Sku = "SKU002",
                    Name = "Descarte de Reciclagem",
                    Unit = ProductUnit.Kilogram,
                    Price = 2.00M,
                },
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                    Sku = "SKU003",
                    Name = "Descarte de Rejeito",
                    Unit = ProductUnit.Gram,
                    Price = 1.00M,
                },
            };
        }

        [Fact]
        public async Task ProductService_Add_ShouldAddProductSuccessfully_WhenMethodIsCalledWithAValidObjectAndProductIsNotDuplicated()
        {
            // Arrange
            var productMock = new Product
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Sku = "SKU001",
                Name = "Caçamba",
                Unit = ProductUnit.Unit,
                Price = 25.00M,
            };
            var expectedResult = new WebApiResponse<Product>
            {
                Data = productMock,
                Status = ResponseStatus.Success,
                Message = $"Produto {productMock.Name} cadastrado com sucesso.",
            };

            _repository.Setup(_ => _.AddAsync(It.IsAny<Product>()));
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Product, bool>>>()))
                .ReturnsAsync(false);

            // Act
            var result = await _productService.Add(productMock);

            // Assert
            Assert.Equal(expectedResult.Data, productMock);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Product>()), Times.Once);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Product, bool>>>()),
                Times.Exactly(2)
            );
        }

        [Fact]
        public async Task ProductService_Add_ShouldNotAddProductAndReturnAnErrorMessage_WhenNameIsDuplicated()
        {
            // Arrange
            var productMock = new Product
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Sku = "SKU001",
                Name = "Caçamba",
                Unit = ProductUnit.Unit,
                Price = 25.00M,
            };
            var expectedResult = new WebApiResponse<Product>
            {
                Status = ResponseStatus.Error,
                Message = $"Já existe um Produto cadastrado com Nome {productMock.Name}.",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Product, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _productService.Add(productMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Product>()), Times.Never);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Product, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task ProductService_Add_ShouldNotAddProductAndReturnAnErrorMessage_WhenSkuIsDuplicated()
        {
            // Arrange
            var productMock = new Product
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Sku = "SKU001",
                Name = "Caçamba",
                Unit = ProductUnit.Unit,
                Price = 25.00M,
            };
            var expectedResult = new WebApiResponse<Product>
            {
                Status = ResponseStatus.Error,
                Message = $"Já existe um Produto cadastrado com Sku {productMock.Sku}.",
            };

            _repository
                .SetupSequence(_ => _.AnyAsync(It.IsAny<Expression<Func<Product, bool>>>()))
                .ReturnsAsync(false)
                .ReturnsAsync(true);

            // Act
            var result = await _productService.Add(productMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Product>()), Times.Never);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Product, bool>>>()),
                Times.Exactly(2)
            );
        }

        [Fact]
        public async Task ProductService_Add_ShouldNotAddProductAndReturnAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            var productMock = new Product
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000010"),
                Sku = "SKU010",
                Name = "Novo Produto",
            };
            var expectedResult = new WebApiResponse<Product>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível cadastrar o Produto {productMock.Name} na base de dados.",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Product, bool>>>()))
                .ReturnsAsync(false);
            _repository.Setup(_ => _.AddAsync(It.IsAny<Product>())).ThrowsAsync(exception);

            // Act
            var result = await _productService.Add(productMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);
            expectedResult.Should().BeEquivalentTo(result);
            _logServiceMock.Verify(
                _ => _.LogException(exception, "ProductService.Add", productMock),
                Times.Once
            );
        }

        [Fact]
        public async Task ProductService_Update_ShouldUpdateProductSuccessfully_WhenMethodIsCalledWithAValidObjectAndProductIsNotDuplicated()
        {
            // Arrange
            var productMock = new Product
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Sku = "SKU001",
                Name = "Caçamba",
                Unit = ProductUnit.Unit,
                Price = 25.00M,
            };

            var expectedResult = new WebApiResponse<Product>
            {
                Data = productMock,
                Status = ResponseStatus.Success,
                Message = $"Produto {productMock.Name} atualizado com sucesso.",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Product, bool>>>()))
                .ReturnsAsync(false);
            _repository.Setup(_ => _.UpdateAsync(It.IsAny<Product>()));

            // Act
            var result = await _productService.Update(productMock);

            // Assert
            Assert.Equal(expectedResult.Data, productMock);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Product>()), Times.Once);
        }

        [Fact]
        public async Task ProductService_Update_ShouldNotUpdateProductAndReturnAnErrorMessage_WhenNameIsDuplicated()
        {
            // Arrange
            var productMock = new Product
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Sku = "SKU001",
                Name = "Caçamba",
                Unit = ProductUnit.Unit,
                Price = 25.00M,
            };
            var expectedResult = new WebApiResponse<Product>
            {
                Status = ResponseStatus.Error,
                Message = $"Já existe um Produto cadastrado com Nome {productMock.Name}.",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Product, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _productService.Update(productMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Product>()), Times.Never);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Product, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task ProductService_Update_ShouldNotUpdateProductAndReturnAnErrorMessage_WhenSkuIsDuplicated()
        {
            // Arrange
            var productMock = new Product
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Sku = "SKU001",
                Name = "Caçamba",
                Unit = ProductUnit.Unit,
                Price = 25.00M,
            };
            var expectedResult = new WebApiResponse<Product>
            {
                Status = ResponseStatus.Error,
                Message = $"Já existe um Produto cadastrado com Sku {productMock.Sku}.",
            };

            _repository
                .SetupSequence(_ => _.AnyAsync(It.IsAny<Expression<Func<Product, bool>>>()))
                .ReturnsAsync(false)
                .ReturnsAsync(true);

            // Act
            var result = await _productService.Update(productMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Product>()), Times.Never);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Product, bool>>>()),
                Times.Exactly(2)
            );
        }

        [Fact]
        public async Task ProductService_Update_ShouldNotUpdateProductAndReturnAndErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            var productMock = new Product
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Sku = "SKU001",
                Name = "Caçamba",
                Unit = ProductUnit.Unit,
                Price = 25.00M,
            };
            var expectedResult = new WebApiResponse<Product>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível atualizar os dados do Produto {productMock.Name} na base de dados.",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Product, bool>>>()))
                .ReturnsAsync(false);
            _repository.Setup(_ => _.UpdateAsync(It.IsAny<Product>())).Throws(exception);

            // Act
            var result = await _productService.Update(productMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Product>()), Times.Once);
        }

        [Fact]
        public async Task ProductService_Remove_ShouldRemoveProductSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var productMock = new Product
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Sku = "SKU001",
                Name = "Caçamba",
                Unit = ProductUnit.Unit,
                Price = 25.00M,
            };
            var expectedResult = new WebApiResponse<Product>
            {
                Data = productMock,
                Status = ResponseStatus.Success,
                Message = $"Produto {productMock.Name} removido com sucesso.",
            };

            _repository.Setup(_ => _.RemoveAsync(It.IsAny<Product>()));

            // Act
            var result = await _productService.Remove(productMock);

            // Assert
            Assert.Equal(expectedResult.Data, productMock);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.RemoveAsync(It.IsAny<Product>()), Times.Once);
        }

        [Fact]
        public async Task ProductService_Remove_ShouldNotRemoveProductAndReturnsAndError_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            var productMock = new Product
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Sku = "SKU001",
                Name = "Caçamba",
                Unit = ProductUnit.Unit,
                Price = 25.00M,
            };
            var expectedResult = new WebApiResponse<Product>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível remover o Produto {productMock.Name} da base de dados.",
            };

            _repository.Setup(_ => _.RemoveAsync(It.IsAny<Product>())).ThrowsAsync(exception);

            // Act
            var result = await _productService.Remove(productMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.RemoveAsync(It.IsAny<Product>()), Times.Once);
        }

        [Fact]
        public async Task ProductService_Remove_ShouldReturnWarning_WhenProductIsLinkedToOrders()
        {
            // Arrange
            var productMock = new Product
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Sku = "SKU001",
                Name = "Caçamba",
            };
            var expectedResult = new WebApiResponse<Product>
            {
                Data = productMock,
                Status = ResponseStatus.Warning,
                Message =
                    $"Produto {productMock.Name} não pode ser removido pois está vinculado à um ou mais pedidos.",
            };

            _orderProductRepositoryMock
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<OrderProduct, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _productService.Remove(productMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);
            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.RemoveAsync(It.IsAny<Product>()), Times.Never);
            _logServiceMock.Verify(
                _ => _.LogException(It.IsAny<Exception>(), "ProductService.Remove", productMock),
                Times.Once
            );
        }

        [Fact]
        public async Task ProductService_FindAll_ShouldReturnAListOfProducts_WhenDataTableHasRegisters()
        {
            // Arrange
            var expectedResult = new WebApiResponse<IEnumerable<Product>>
            {
                Data = _productListMock,
                Status = ResponseStatus.Success,
                Message = $"{_productListMock.Count} registro(s) encontrado(s).",
            };

            _repository.Setup(_ => _.GetAllAsync()).ReturnsAsync(_productListMock);

            // Act
            var result = await _productService.FindAll();

            // Assert
            Assert.Equal(expectedResult.Data, result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.GetAllAsync(), Times.Once);
        }

        [Fact]
        public async Task ProductService_FindAll_ShouldReturnAnEmptyData_WhenDataTableHasNoRegisters()
        {
            // Arrange
            var expectedResult = new WebApiResponse<IEnumerable<Product>>
            {
                Data = new List<Product>(),
                Status = ResponseStatus.Success,
                Message = $"{0} registro(s) encontrado(s).",
            };

            _repository.Setup(_ => _.GetAllAsync()).ReturnsAsync(new List<Product>());

            // Act
            var result = await _productService.FindAll();

            // Assert
            Assert.Equal(expectedResult.Data, result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.GetAllAsync(), Times.Once);
        }

        [Fact]
        public async Task ProductService_FindAll_ShouldReturnAnEmptyListAndAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            var expectedResult = new WebApiResponse<IEnumerable<Product>>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível acessar os registros de Produtos na base de dados.",
            };

            _repository.Setup(_ => _.GetAllAsync()).ThrowsAsync(exception);

            // Act
            var result = await _productService.FindAll();

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.GetAllAsync(), Times.Once);
        }

        [Fact]
        public async Task ProductService_FindById_ShouldReturnAnProductSuccessfully_WhenIdIsValid()
        {
            // Arrange
            var idMock = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var productMock = _productListMock.FirstOrDefault(_ => idMock.Equals(_.Id));
            var expectedResult = new WebApiResponse<Product>
            {
                Data = productMock,
                Status = ResponseStatus.Success,
                Message = $"Produto {productMock!.Name} encontrado com sucesso",
            };

            _repository.Setup(_ => _.GetByIdAsync(idMock)).ReturnsAsync(productMock);

            // Act
            var result = await _productService.FindById(idMock);

            // Assert
            Assert.Equal(expectedResult.Data, result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.GetByIdAsync(idMock), Times.Once);
        }

        [Fact]
        public async Task ProductService_FindById_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenIdIsInvalid()
        {
            // Arrange
            var idMock = Guid.Parse("00000000-0000-0000-0000-000000000010");
            var expectedResult = new WebApiResponse<Product>
            {
                Data = null,
                Status = ResponseStatus.Success,
                Message = $"Nenhum Produto com o ID {idMock} foi encontrado",
            };

            _repository.Setup(_ => _.GetByIdAsync(idMock)).ReturnsAsync(value: null);

            // Act
            var result = await _productService.FindById(idMock);

            // Assert
            Assert.Null(result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.GetByIdAsync(idMock), Times.Once);
        }

        [Fact]
        public async Task ProductService_FindById_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var idMock = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var exception = new Exception();
            var expectedResult = new WebApiResponse<Product>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível acessar os registros de Produtos na base de dados.",
            };

            _repository.Setup(_ => _.GetByIdAsync(idMock)).ThrowsAsync(exception);

            // Act
            var result = await _productService.FindById(idMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.GetByIdAsync(idMock), Times.Once);
        }

        [Fact]
        public async Task ProductService_FindBySku_ShouldReturnAnProductSuccessfully_WhenIdIsValid()
        {
            // Arrange
            const string skuMock = "SKU001";
            var productMock = _productListMock.Where(_ => skuMock.Equals(_.Sku)).FirstOrDefault();
            var expectedResult = new WebApiResponse<Product>
            {
                Data = productMock,
                Status = ResponseStatus.Success,
                Message = $"Produto {productMock!.Name} encontrado com sucesso",
            };

            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Product, bool>>>()))
                .ReturnsAsync(productMock);

            // Act
            var result = await _productService.FindBySku(skuMock);

            // Assert
            Assert.Equal(expectedResult.Data, result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Product, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task ProductService_FindBySku_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenSkuIsInvalid()
        {
            // Arrange
            const string skuMock = "SKU0010";
            var expectedResult = new WebApiResponse<Product>
            {
                Data = null,
                Status = ResponseStatus.Success,
                Message = $"Nenhum Produto com Sku {skuMock} foi encontrado",
            };

            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Product, bool>>>()))
                .ReturnsAsync(value: null);

            // Act
            var result = await _productService.FindBySku(skuMock);

            // Assert
            Assert.Null(result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Product, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task ProductService_FindBySku_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            const string skuMock = "SKU0010";
            var exception = new Exception();
            var expectedResult = new WebApiResponse<Product>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível acessar os registros de Produtos na base de dados.",
            };

            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Product, bool>>>()))
                .ThrowsAsync(exception);

            // Act
            var result = await _productService.FindBySku(skuMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Product, bool>>>()),
                Times.Once
            );
        }
    }
}
