using System.Linq.Expressions;
using AutoMapper;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
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
    public class BusinessPartnerServiceTests
    {
        private readonly BusinessPartnerService _businessPartnerService;
        private readonly Mock<IRepository<BusinessPartner>> _repository;
        private readonly Mock<ILogService> _logService;
        private readonly IList<BusinessPartner> _businessPartnerListMock;
        private readonly IMapper _mapper;

        public BusinessPartnerServiceTests()
        {
            _repository = new Mock<IRepository<BusinessPartner>>();

            // Configure AutoMapper for tests (map BusinessPartner -> BusinessPartnerDto, including derived-type fields)
            var config = new MapperConfiguration(
                cfg =>
                {
                    cfg.ConstructServicesUsing(type => null);
                    cfg.AddMaps(typeof(MappingProfile).Assembly);
                },
                new LoggerFactory()
            );
            _mapper = config.CreateMapper();

            _logService = new Mock<ILogService>();
            _businessPartnerService = new BusinessPartnerService(
                _repository.Object,
                _mapper,
                _logService.Object
            );

            _businessPartnerListMock = new List<BusinessPartner>
            {
                new Company
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    Name = "TSI Soluções em Informática",
                    Email = "thiago.thomazelli@tsi.com.br",
                    Type = BusinessPartnerType.Client,
                },
                new Company
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    Name = "Nicole Psicologa Ltda",
                    Email = "nicole@psicologia.com.br",
                    Type = BusinessPartnerType.Supplier,
                },
            };
        }

        [Fact]
        public async Task BusinessPartnerService_Remove_ShouldRemoveBusinessPartnerSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var businessPartnerMock = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "TSI Soluções em Informática",
                DocumentType = "Física",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Data = businessPartnerMock,
                Status = ResponseStatus.Success,
                Message = $"Cliente {businessPartnerMock.Name} removido com sucesso.",
            };

            _repository
                .Setup(_ => _.GetByIdAsync(It.IsAny<Guid>()))
                .ReturnsAsync(_mapper.Map<Individual>(businessPartnerMock));
            _repository.Setup(_ => _.RemoveAsync(It.IsAny<BusinessPartner>()));

            // Act
            var result = await _businessPartnerService.Remove(businessPartnerMock);

            // Assert
            expectedResult.Should().BeEquivalentTo(result);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            _repository.Verify(_ => _.GetByIdAsync(It.IsAny<Guid>()), Times.Once);
            _repository.Verify(_ => _.RemoveAsync(It.IsAny<BusinessPartner>()), Times.Once);
        }

        [Fact]
        public async Task BusinessPartnerService_Remove_ShouldNotRemoveBusinessPartnerAndReturnsAndError_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            var businessPartnerMock = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "TSI Soluções em Informática",
            };
            var expectedResult = new WebApiResponse<BusinessPartner>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível remover o Cliente {businessPartnerMock.Name} da base de dados.",
            };

            _repository.Setup(_ => _.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync(new Company());
            _repository
                .Setup(_ => _.RemoveAsync(It.IsAny<BusinessPartner>()))
                .ThrowsAsync(exception);

            // Act
            var result = await _businessPartnerService.Remove(businessPartnerMock);

            // Assert
            expectedResult.Should().BeEquivalentTo(result);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            _repository.Verify(_ => _.GetByIdAsync(It.IsAny<Guid>()), Times.Once);
            _repository.Verify(_ => _.RemoveAsync(It.IsAny<BusinessPartner>()), Times.Once);
        }

        [Fact]
        public async Task BusinessPartnerService_Remove_ShouldReturnWarningWithForeignKeyMessage_WhenRemoveFailsDueToForeignKeyConstraint()
        {
            // Arrange
            var businessPartnerMock = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "TSI Soluções em Informática",
            };
            var innerException = new Exception("Cannot delete: foreign key constraint fails on table orders");
            var dbUpdateException = new DbUpdateException("update failed", innerException);

            _repository.Setup(_ => _.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync(new Company());
            _repository
                .Setup(_ => _.RemoveAsync(It.IsAny<BusinessPartner>()))
                .ThrowsAsync(dbUpdateException);

            // Act
            var result = await _businessPartnerService.Remove(businessPartnerMock);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            Assert.Equal(
                $"Não foi possível remover o Cliente {businessPartnerMock.Name} pois ele está vinculado à um ou mais pedidos e/ou transações.",
                result.Message
            );
            _logService.Verify(
                _ => _.LogException(dbUpdateException, "BusinessPartnerService.Remove", businessPartnerMock),
                Times.Once
            );
        }

        [Fact]
        public async Task BusinessPartnerService_Remove_ShouldReturnWarningWithGenericMessage_WhenRemoveFailsWithOtherDbUpdateException()
        {
            // Arrange
            var businessPartnerMock = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "TSI Soluções em Informática",
            };
            var innerException = new Exception("some other db error");
            var dbUpdateException = new DbUpdateException("update failed", innerException);

            _repository.Setup(_ => _.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync(new Company());
            _repository
                .Setup(_ => _.RemoveAsync(It.IsAny<BusinessPartner>()))
                .ThrowsAsync(dbUpdateException);

            // Act
            var result = await _businessPartnerService.Remove(businessPartnerMock);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            Assert.Equal(
                $"Não foi possível remover o Cliente {businessPartnerMock.Name} da base de dados.",
                result.Message
            );
        }

        [Fact]
        public async Task BusinessPartnerService_Remove_ShouldNotRemoveBusinessPartnerAndReturnsAndError_WhenBusinessPartnerIsNotFound()
        {
            // Arrange
            var businessPartnerMock = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "TSI Soluções em Informática",
            };

            var exception = new Exception(
                $"Cliente com Id {businessPartnerMock.Id} não encontrado."
            );
            var expectedResult = new WebApiResponse<BusinessPartner>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível remover o Cliente {businessPartnerMock.Name} da base de dados.",
            };

            _repository.Setup(_ => _.GetByIdAsync(It.IsAny<int>())).ThrowsAsync(exception);

            // Act
            var result = await _businessPartnerService.Remove(businessPartnerMock);

            // Assert
            expectedResult.Should().BeEquivalentTo(result);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            _repository.Verify(_ => _.RemoveAsync(It.IsAny<BusinessPartner>()), Times.Never);
        }

        [Fact]
        public async Task BusinessPartnerService_FindAllByType_ShouldReturnAListOfClients_WhenDataTableHasRegisters()
        {
            // Arrange
            var clientsMock = _businessPartnerListMock
                .Where(_ => BusinessPartnerType.Client.Equals(_.Type))
                .ToList();

            var expectedResult = new WebApiResponse<IEnumerable<BusinessPartnerDto>>
            {
                Data = _mapper.Map<IEnumerable<BusinessPartnerDto>>(clientsMock),
                Status = ResponseStatus.Success,
                Message = $"{clientsMock.Count()} registro(s) encontrado(s).",
            };

            _repository
                .Setup(_ =>
                    _.QueryAsync(
                        It.IsAny<Expression<Func<BusinessPartner, bool>>>(),
                        true,
                        c => c.Addresses,
                        t => t.Transactions
                    )
                )
                .ReturnsAsync(clientsMock);

            // Act
            var result = await _businessPartnerService.FindAllByType(BusinessPartnerType.Client);

            // Assert
            expectedResult.Should().BeEquivalentTo(result);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            _repository.Verify(
                _ =>
                    _.QueryAsync(
                        It.IsAny<Expression<Func<BusinessPartner, bool>>>(),
                        true,
                        c => c.Addresses,
                        t => t.Transactions
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task BusinessPartnerService_FindAllByType_ShouldReturnAListOfSuppliers_WhenDataTableHasRegisters()
        {
            // Arrange
            var suppliersMock = _businessPartnerListMock
                .Where(_ => BusinessPartnerType.Supplier.Equals(_.Type))
                .ToList();

            var expectedResult = new WebApiResponse<IEnumerable<BusinessPartnerDto>>
            {
                Data = _mapper.Map<IEnumerable<BusinessPartnerDto>>(suppliersMock),
                Status = ResponseStatus.Success,
                Message = $"{suppliersMock.Count()} registro(s) encontrado(s).",
            };

            _repository
                .Setup(_ =>
                    _.QueryAsync(
                        It.IsAny<Expression<Func<BusinessPartner, bool>>>(),
                        true,
                        c => c.Addresses,
                        t => t.Transactions
                    )
                )
                .ReturnsAsync(suppliersMock);

            // Act
            var result = await _businessPartnerService.FindAllByType(BusinessPartnerType.Supplier);

            // Assert
            expectedResult.Should().BeEquivalentTo(result);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            _repository.Verify(
                _ =>
                    _.QueryAsync(
                        It.IsAny<Expression<Func<BusinessPartner, bool>>>(),
                        true,
                        c => c.Addresses,
                        t => t.Transactions
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task BusinessPartnerService_FindAllByType_ShouldReturnAnEmptyData_WhenDataTableHasNoRegisters()
        {
            // Arrange
            var expectedResult = new WebApiResponse<IEnumerable<BusinessPartnerDto>>
            {
                Data = new List<BusinessPartnerDto>(),
                Status = ResponseStatus.Success,
                Message = $"{0} registro(s) encontrado(s).",
            };

            _repository
                .Setup(_ =>
                    _.QueryAsync(
                        It.IsAny<Expression<Func<BusinessPartner, bool>>>(),
                        true,
                        c => c.Addresses,
                        t => t.Transactions
                    )
                )
                .ReturnsAsync(new List<BusinessPartner>());

            // Act
            var result = await _businessPartnerService.FindAllByType(BusinessPartnerType.Supplier);

            // Assert
            Assert.Equal(expectedResult.Data, result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ =>
                    _.QueryAsync(
                        It.IsAny<Expression<Func<BusinessPartner, bool>>>(),
                        true,
                        c => c.Addresses,
                        t => t.Transactions
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task BusinessPartnerService_FindAllByType_ShouldReturnAnEmptyListAndAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            var expectedResult = new WebApiResponse<IEnumerable<BusinessPartnerDto>>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível acessar os registros de Cliente na base de dados.",
            };

            _repository
                .Setup(_ =>
                    _.QueryAsync(
                        It.IsAny<Expression<Func<BusinessPartner, bool>>>(),
                        true,
                        c => c.Addresses,
                        t => t.Transactions
                    )
                )
                .ThrowsAsync(exception);

            // Act
            var result = await _businessPartnerService.FindAllByType(BusinessPartnerType.Client);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ =>
                    _.QueryAsync(
                        It.IsAny<Expression<Func<BusinessPartner, bool>>>(),
                        true,
                        c => c.Addresses,
                        t => t.Transactions
                    ),
                Times.Once
            );
        }

        [Fact]
        public async Task BusinessPartnerService_FindById_ShouldReturnABusinessPartnerSuccessfully_WhenIdIsValid()
        {
            // Arrange
            var idMock = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var businessPartnerMock = _businessPartnerListMock.FirstOrDefault(_ =>
                idMock.Equals(_.Id)
            );
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Data = _mapper.Map<BusinessPartnerDto>(businessPartnerMock),
                Status = ResponseStatus.Success,
                Message = $"Cliente {businessPartnerMock.Name} encontrado com sucesso",
            };

            _repository
                .Setup(_ => _.GetByIdAsync(idMock, a => a.Addresses))
                .ReturnsAsync(businessPartnerMock);

            // Act
            var result = await _businessPartnerService.FindById(idMock);

            // Assert
            expectedResult.Should().BeEquivalentTo(result);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            _repository.Verify(_ => _.GetByIdAsync(idMock, a => a.Addresses), Times.Once);
        }

        [Fact]
        public async Task BusinessPartnerService_FindById_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenIdIsInvalid()
        {
            // Arrange
            var idMock = Guid.Parse("00000000-0000-0000-0000-000000000010");
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Data = null,
                Status = ResponseStatus.Success,
                Message = $"Nenhum registro com o ID {idMock} foi encontrado",
            };

            _repository
                .Setup(_ => _.GetByIdAsync(idMock, a => a.Addresses))
                .ReturnsAsync(value: null);

            // Act
            var result = await _businessPartnerService.FindById(idMock);

            // Assert
            Assert.Null(result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.GetByIdAsync(idMock, a => a.Addresses), Times.Once);
        }

        [Fact]
        public async Task BusinessPartnerService_FindById_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var idMock = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var exception = new Exception();
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível acessar os registros na base de dados.",
            };

            _repository.Setup(_ => _.GetByIdAsync(idMock, a => a.Addresses)).ThrowsAsync(exception);

            // Act
            var result = await _businessPartnerService.FindById(idMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.GetByIdAsync(idMock, a => a.Addresses), Times.Once);
        }

        [Fact]
        public async Task BusinessPartnerService_FindByEmail_ShouldReturnALisfOfBusinessPartnersSuccessfully_WhenEmailIsValid()
        {
            // Arrange
            const string emailMock = "thiago.thomazelli@tsi.com.br";
            var businessPartnerEntity = _businessPartnerListMock.FirstOrDefault(_ =>
                emailMock.Equals(_.Email)
            );
            var expectedDto = _mapper.Map<BusinessPartnerDto>(businessPartnerEntity);
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Data = expectedDto,
                Status = ResponseStatus.Success,
                Message = $"Cliente {expectedDto.Name} encontrado com sucesso.",
            };

            _repository
                .Setup(_ =>
                    _.FirstOrDefaultAsync(It.IsAny<Expression<Func<BusinessPartner, bool>>>())
                )
                .ReturnsAsync(businessPartnerEntity);

            // Act
            var result = await _businessPartnerService.FindByEmail(emailMock);

            // Assert
            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<BusinessPartner, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task BusinessPartnerService_FindByEmail_ShouldReturnAnEmptyData_WhenEmailIsNotFound()
        {
            // Arrange
            const string emailMock = "thiago@tsi.com";
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Data = null,
                Status = ResponseStatus.Success,
                Message = $"Nenhum registro com o E-mail {emailMock} foi encontrado",
            };

            _repository
                .Setup(_ =>
                    _.FirstOrDefaultAsync(It.IsAny<Expression<Func<BusinessPartner, bool>>>())
                )
                .ReturnsAsync(null as Company);

            // Act
            var result = await _businessPartnerService.FindByEmail(emailMock);

            // Assert
            Assert.Equal(expectedResult.Data, result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<BusinessPartner, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task BusinessPartnerService_FindByEmail_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            const string emailMock = "thiago@tsi.com";
            var exception = new Exception();
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível acessar os registros na base de dados.",
            };

            _repository
                .Setup(_ =>
                    _.FirstOrDefaultAsync(It.IsAny<Expression<Func<BusinessPartner, bool>>>())
                )
                .ThrowsAsync(exception);

            // Act
            var result = await _businessPartnerService.FindByEmail(emailMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<BusinessPartner, bool>>>()),
                Times.Once
            );
        }
    }
}
