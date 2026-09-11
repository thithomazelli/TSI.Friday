using System.Linq.Expressions;
using AutoMapper;
using FluentAssertions;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;
using Microsoft.Extensions.Logging;
using TSI.Nexus.IoC;

namespace TSI.Nexus.Services.Tests.Services
{
    public class CompanyServiceTests
    {
        private readonly CompanyService _companyService;
        private readonly Mock<IRepository<Company>> _repository;
        private readonly Mock<ILogService> _logService;
        private readonly IList<Company> _companyListMock;
        private readonly IMapper _mapper;

        public CompanyServiceTests()
        {
            _repository = new Mock<IRepository<Company>>();
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
            _companyService = new CompanyService(_repository.Object, _mapper, _logService.Object);

            _companyListMock = new List<Company>
            {
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    Name = "TSI Soluções em Informática",
                    Email = "thiago.thomazelli@tsi.com.br",
                    NationalRegistry = "11.222.3333/0001-44",
                    StateRegistration = "11.222.333-4",
                    BusinessName = "",
                },
            };
        }

        [Fact]
        public async Task CompanyService_Add_ShouldAddCompanySuccessfully_WhenMethodIsCalledWithAValidObjectAndCompanyIsNotDuplicated()
        {
            // Arrange
            var companyDto = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "TSI Soluções em Informática",
            };

            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Data = companyDto,
                Status = ResponseStatus.Success,
                Message = $"Cliente {companyDto.Name} cadastrado com sucesso.",
            };

            _repository.Setup(_ => _.AddAsync(It.IsAny<Company>()));
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()))
                .ReturnsAsync(false);

            // Act
            var result = await _companyService.Add(companyDto);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);
            Assert.Equal(expectedResult.Data, result.Data);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Company>()), Times.Once);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()),
                Times.Exactly(3)
            );
        }

        [Fact]
        public async Task CompanyService_Add_ShouldNotAddCompanyAndReturnAnErrorMessage_WhenNameIsDuplicated()
        {
            // Arrange
            var companyDto = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "TSI Soluções em Informática",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message = $"Já existe um Cliente cadastrado com Nome {companyDto.Name}.",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _companyService.Add(companyDto);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Company>()), Times.Never);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task CompanyService_Add_ShouldNotAddCompanyAndReturnAnErrorMessage_WhenEmailIsDuplicated()
        {
            // Arrange
            var companyDto = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "TSI Soluções em Informática",
                Email = "thiago.thomazelli@tsi.com.br",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message = $"Já existe um Cliente cadastrado com E-mail {companyDto.Email}.",
            };

            _repository
                .SetupSequence(_ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()))
                .ReturnsAsync(false)
                .ReturnsAsync(true);

            // Act
            var result = await _companyService.Add(companyDto);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Company>()), Times.Never);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()),
                Times.Exactly(2)
            );
        }

        [Fact]
        public async Task CompanyService_Add_ShouldNotAddCompanyAndReturnAnErrorMessage_WhenNationalRegistryIsDuplicated()
        {
            // Arrange
            var companyDto = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "TSI Soluções em Informática",
                Email = "thiago.thomazelli@tsi.com.br",
                NationalRegistry = "11.222.3333/0001-44",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Já existe um Cliente cadastrado com o CNPJ {companyDto.NationalRegistry}.",
            };

            _repository
                .SetupSequence(_ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()))
                .ReturnsAsync(false)
                .ReturnsAsync(false)
                .ReturnsAsync(true);

            // Act
            var result = await _companyService.Add(companyDto);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Company>()), Times.Never);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()),
                Times.Exactly(3)
            );
        }

        [Fact]
        public async Task CompanyService_Add_ShouldNotAddCompanyAndReturnAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            var companyDto = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "TSI Soluções em Informática",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível cadastrar o Cliente {companyDto.Name} na base de dados.",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()))
                .ReturnsAsync(false);
            _repository.Setup(_ => _.AddAsync(It.IsAny<Company>())).ThrowsAsync(exception);

            // Act
            var result = await _companyService.Add(companyDto);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Company>()), Times.Once);
        }

        [Fact]
        public async Task CompanyService_Update_ShouldUpdateCompanySuccessfully_WhenMethodIsCalledWithAValidObjectAndCompanyIsNotDuplicated()
        {
            // Arrange
            var companyDto = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "TSI Soluções em Informática",
            };
            var companyEntity =
                _companyListMock.FirstOrDefault(_ => _.Id == companyDto.Id) ?? new Company();
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Data = companyDto,
                Status = ResponseStatus.Success,
                Message = $"Cliente {companyDto.Name} atualizado com sucesso.",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()))
                .ReturnsAsync(false);
            _repository
                .Setup(_ => _.GetByIdAsync(companyDto.Id, c => c.Addresses))
                .ReturnsAsync(companyEntity);
            _repository.Setup(_ => _.UpdateAsync(It.IsAny<Company>()));

            // Act
            var result = await _companyService.Update(companyDto);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);
            Assert.Equal(expectedResult.Data, result.Data);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Company>()), Times.Once);
        }

        [Fact]
        public async Task CompanyService_Update_ShouldNotUpdateCompanyAndReturnAnErrorMessage_WhenCompanyIsNotFound()
        {
            // Arrange
            var companyDto = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000099"),
                Name = "TSI Soluções em Informática",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message = $"Cliente com Id {companyDto.Id} não encontrado.",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()))
                .ReturnsAsync(false);
            _repository
                .Setup(_ => _.GetByIdAsync(companyDto.Id, c => c.Addresses))
                .ReturnsAsync((Company)null!);

            // Act
            var result = await _companyService.Update(companyDto);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Company>()), Times.Never);
            _logService.Verify(
                _ => _.LogException(It.IsAny<Exception>(), "CompanyService.Update", companyDto),
                Times.Once
            );
        }

        [Fact]
        public async Task CompanyService_Update_ShouldNotUpdateCompanyAndReturnAnErrorMessage_WhenNameIsDuplicated()
        {
            // Arrange
            var companyDto = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "TSI Soluções em Informática",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message = $"Já existe um Cliente cadastrado com Nome {companyDto.Name}.",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _companyService.Update(companyDto);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Company>()), Times.Never);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task CompanyService_Update_ShouldNotUpdateCompanyAndReturnAnErrorMessage_WhenEmailIsDuplicated()
        {
            // Arrange
            var companyDto = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "TSI Soluções em Informática",
                Email = "thiago.thomazelli@tsi.com.br",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message = $"Já existe um Cliente cadastrado com E-mail {companyDto.Email}.",
            };

            _repository
                .SetupSequence(_ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()))
                .ReturnsAsync(false)
                .ReturnsAsync(true);

            // Act
            var result = await _companyService.Update(companyDto);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Company>()), Times.Never);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()),
                Times.Exactly(2)
            );
        }

        [Fact]
        public async Task CompanyService_Update_ShouldNotUpdateCompanyAndReturnAnErrorMessage_WhenNationalRegistryIsDuplicated()
        {
            // Arrange
            var companyDto = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "TSI Soluções em Informática",
                Email = "thiago.thomazelli@tsi.com.br",
                NationalRegistry = "11.222.3333/0001-44",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Já existe um Cliente cadastrado com o CNPJ {companyDto.NationalRegistry}.",
            };

            _repository
                .SetupSequence(_ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()))
                .ReturnsAsync(false)
                .ReturnsAsync(false)
                .ReturnsAsync(true);

            // Act
            var result = await _companyService.Update(companyDto);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Company>()), Times.Never);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()),
                Times.Exactly(3)
            );
        }

        [Fact]
        public async Task CompanyService_Update_ShouldNotUpdateCompanyAndReturnAndErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            var companyDto = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "TSI Soluções em Informática",
            };
            var companyEntity =
                _companyListMock.FirstOrDefault(_ => _.Id == companyDto.Id) ?? new Company();
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível atualizar os dados do Cliente {companyDto.Name} na base de dados.",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Company, bool>>>()))
                .ReturnsAsync(false);
            _repository
                .Setup(_ => _.GetByIdAsync(companyDto.Id, c => c.Addresses))
                .ReturnsAsync(companyEntity);
            _repository.Setup(_ => _.UpdateAsync(It.IsAny<Company>())).ThrowsAsync(exception);

            // Act
            var result = await _companyService.Update(companyDto);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Company>()), Times.Once);
        }

        [Fact]
        public async Task CompanyService_FindByNationalRegistry_ShouldReturnAnCompanySuccessfully_WhenFindByNationalRegistryIsValid()
        {
            // Arrange
            const string nationalRegistraMock = "11.222.3333/0001-44";
            var companyEntity = _companyListMock.FirstOrDefault(_ =>
                nationalRegistraMock.Equals(_.NationalRegistry)
            );
            var expectedDto = _mapper.Map<BusinessPartnerDto>(companyEntity);
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Data = expectedDto,
                Status = ResponseStatus.Success,
                Message = $"Cliente {expectedDto.Name} encontrado com sucesso.",
            };

            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Company, bool>>>()))
                .ReturnsAsync(companyEntity);

            // Act
            var result = await _companyService.FindByNationalRegistry(nationalRegistraMock);

            // Assert
            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Company, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task CompanyService_FindByNationalRegistry_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenFindByNationalRegistryIsInvalid()
        {
            // Arrange
            const string nationalRegistraMock = "11.222.3333/0001-44";
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Data = null,
                Status = ResponseStatus.Success,
                Message = $"Nenhum registro com o CNPJ {nationalRegistraMock} foi encontrado",
            };

            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Company, bool>>>()))
                .ReturnsAsync(value: null as Company);

            // Act
            var result = await _companyService.FindByNationalRegistry(nationalRegistraMock);

            // Assert
            Assert.Null(result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Company, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task CompanyService_FindByNationalRegistry_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            const string nationalRegistraMock = "11.222.3333/0001-44";
            var exception = new Exception();
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível acessar os registros de BusinessPartners na base de dados.",
            };

            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Company, bool>>>()))
                .ThrowsAsync(exception);

            // Act
            var result = await _companyService.FindByNationalRegistry(nationalRegistraMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Company, bool>>>()),
                Times.Once
            );
        }
    }
}
