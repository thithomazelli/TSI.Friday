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
    public class IndividualServiceTests
    {
        private readonly IndividualService _individualService;
        private readonly Mock<IRepository<Individual>> _repository;
        private readonly Mock<ILogService> _logService;
        private readonly IList<BusinessPartnerDto> _businessPartnerListMock;
        private readonly IMapper _mapper;

        public IndividualServiceTests()
        {
            _repository = new Mock<IRepository<Individual>>();
            _logService = new Mock<ILogService>();

            // Configure AutoMapper for tests similar to application configuration
            var config = new MapperConfiguration(
                cfg =>
                {
                    cfg.ConstructServicesUsing(type => null);
                    cfg.AddMaps(typeof(MappingProfile).Assembly);
                },
                new LoggerFactory()
            );
            _mapper = config.CreateMapper();

            _individualService = new IndividualService(
                _repository.Object,
                _mapper,
                _logService.Object
            );

            _businessPartnerListMock = new List<BusinessPartnerDto>
            {
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    Name = "Thiago Thomazelli Ferreira",
                    Email = "thiago.thomazelli@tsi.com.br",
                    SocialSecurityCard = "111.222.333-44",
                    NationalIdCard = "11.222.333-4",
                    Birthday = DateTime.Now,
                },
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    Name = "Leonardo Thomazelli Ferreira",
                    Email = "leonardo.thomazelli@tsi.com.br",
                    Birthday = DateTime.Now.AddDays(1),
                },
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                    Name = "Fábio Moraes",
                    Email = "fabio.moraes@tsi.com.br",
                    Birthday = DateTime.Now.AddDays(2),
                },
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000004"),
                    Name = "Felipe Rocha",
                    Email = "felipe.rocha@tsi.com.br",
                    Birthday = DateTime.Now.AddDays(3),
                },
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000005"),
                    Name = "Renan Amarantes Fernandes",
                    Email = "renan.fernandes@tsi.com.br",
                    Birthday = DateTime.Now.AddDays(4),
                },
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000006"),
                    Name = "Rafael Spessotto",
                    Email = "rafael.spessotto@tsi.com.br",
                    Birthday = DateTime.Now.AddDays(-5),
                },
                new()
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000007"),
                    Name = "Administrator",
                    Email = "admin@tsi.com.br",
                    Birthday = DateTime.Now.AddDays(5),
                },
            };
        }

        [Fact]
        public async Task IndividualService_Add_ShouldAddIndividualSuccessfully_WhenMethodIsCalledWithAValidObjectAndIndividualIsNotDuplicated()
        {
            // Arrange
            var businessPartnerMock = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "Thiago Thomazelli Ferreira",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Data = businessPartnerMock,
                Status = ResponseStatus.Success,
                Message = $"Cliente {businessPartnerMock.Name} cadastrado com sucesso.",
            };

            _repository.Setup(_ => _.AddAsync(It.IsAny<Individual>()));
            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Individual, bool>>>()))
                .ReturnsAsync(false);

            // Act
            var result = await _individualService.Add(businessPartnerMock);

            // Assert
            Assert.Equal(expectedResult.Data, businessPartnerMock);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Individual>()), Times.Once);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Individual, bool>>>()),
                Times.Exactly(3)
            );
        }

        [Fact]
        public async Task IndividualService_Add_ShouldNotAddIndividualAndReturnAnErrorMessage_WhenEmailIsDuplicated()
        {
            // Arrange
            var businessPartnerMock = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "Thiago Thomazelli Ferreira",
                Email = "thiago.thomazelli@tsi.com.br",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Já existe um Cliente cadastrado com E-mail {businessPartnerMock.Email}.",
            };

            _repository
                .SetupSequence(_ => _.AnyAsync(It.IsAny<Expression<Func<Individual, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _individualService.Add(businessPartnerMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Individual>()), Times.Never);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Individual, bool>>>()),
                Times.Exactly(1)
            );
        }

        [Fact]
        public async Task IndividualService_Add_ShouldNotAddIndividualAndReturnAnErrorMessage_WhenSocialSecurityCardIsDuplicated()
        {
            // Arrange
            var businessPartnerMock = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "Thiago Thomazelli Ferreira",
                Email = "thiago.thomazelli@tsi.com.br",
                SocialSecurityCard = "111.222.333-44",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Já existe um Cliente cadastrado com o CPF {businessPartnerMock.SocialSecurityCard}.",
            };

            _repository
                .SetupSequence(_ => _.AnyAsync(It.IsAny<Expression<Func<Individual, bool>>>()))
                .ReturnsAsync(false)
                .ReturnsAsync(true);

            // Act
            var result = await _individualService.Add(businessPartnerMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Individual>()), Times.Never);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Individual, bool>>>()),
                Times.Exactly(2)
            );
        }

        [Fact]
        public async Task IndividualService_Add_ShouldNotAddIndividualAndReturnAnErrorMessage_WhenNationalIdCardIsDuplicated()
        {
            // Arrange
            var businessPartnerMock = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "Thiago Thomazelli Ferreira",
                Email = "thiago.thomazelli@tsi.com.br",
                SocialSecurityCard = "111.222.333-44",
                NationalIdCard = "11.222.333-4",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Já existe um Cliente cadastrado com o RG {businessPartnerMock.NationalIdCard}.",
            };

            _repository
                .SetupSequence(_ => _.AnyAsync(It.IsAny<Expression<Func<Individual, bool>>>()))
                .ReturnsAsync(false)
                .ReturnsAsync(false)
                .ReturnsAsync(true);

            // Act
            var result = await _individualService.Add(businessPartnerMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Individual>()), Times.Never);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Individual, bool>>>()),
                Times.Exactly(3)
            );
        }

        [Fact]
        public async Task IndividualService_Add_ShouldNotAddIndividualAndReturnAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            var businessPartnerMock = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "Thiago Thomazelli Ferreira",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível cadastrar o Cliente {businessPartnerMock.Name} na base de dados.",
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Individual, bool>>>()))
                .ReturnsAsync(new List<Individual>());
            _repository.Setup(_ => _.AddAsync(It.IsAny<Individual>())).ThrowsAsync(exception);

            // Act
            var result = await _individualService.Add(businessPartnerMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Individual>()), Times.Once);
        }

        [Fact]
        public async Task IndividualService_Update_ShouldUpdateIndividualSuccessfully_WhenMethodIsCalledWithAValidObjectAndIndividualIsNotDuplicated()
        {
            // Arrange
            var businessPartnerMock = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "Thiago Thomazelli Ferreira",
            };

            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Data = businessPartnerMock,
                Status = ResponseStatus.Success,
                Message = $"Cliente {businessPartnerMock.Name} atualizado com sucesso.",
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Individual, bool>>>()))
                .ReturnsAsync(new List<Individual>());

            _repository
                .Setup(_ => _.GetByIdAsync(businessPartnerMock.Id, c => c.Addresses))
                .ReturnsAsync(new Individual());
            _repository.Setup(_ => _.UpdateAsync(It.IsAny<Individual>()));

            // Act
            var result = await _individualService.Update(businessPartnerMock);

            // Assert
            Assert.Equal(expectedResult.Data, businessPartnerMock);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Individual>()), Times.Once);
        }

        [Fact]
        public async Task IndividualService_Update_ShouldNotUpdateIndividualAndReturnAnErrorMessage_WhenIndividualIsNotFound()
        {
            // Arrange
            var businessPartnerMock = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000099"),
                Name = "Thiago Thomazelli Ferreira",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message = $"Cliente com Id {businessPartnerMock.Id} não encontrado.",
            };

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Individual, bool>>>()))
                .ReturnsAsync(false);
            _repository
                .Setup(_ => _.GetByIdAsync(businessPartnerMock.Id, c => c.Addresses))
                .ReturnsAsync((Individual)null!);

            // Act
            var result = await _individualService.Update(businessPartnerMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Individual>()), Times.Never);
            _logService.Verify(
                _ => _.LogException(It.IsAny<Exception>(), "IndividualService.Update", businessPartnerMock),
                Times.Once
            );
        }

        [Fact]
        public async Task IndividualService_Update_ShouldNotUpdateIndividualAndReturnAnErrorMessage_WhenEmailIsDuplicated()
        {
            // Arrange
            var businessPartnerMock = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "Thiago Thomazelli Ferreira",
                Email = "thiago.thomazelli@tsi.com.br",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Já existe um Cliente cadastrado com E-mail {businessPartnerMock.Email}.",
            };

            _repository
                .SetupSequence(_ => _.AnyAsync(It.IsAny<Expression<Func<Individual, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _individualService.Update(businessPartnerMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Individual>()), Times.Never);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Individual, bool>>>()),
                Times.Exactly(1)
            );
        }

        [Fact]
        public async Task IndividualService_Update_ShouldNotUpdateIndividualAndReturnAnErrorMessage_WhenSocialSecurityCardIsDuplicated()
        {
            // Arrange
            var businessPartnerMock = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "Thiago Thomazelli Ferreira",
                Email = "thiago.thomazelli@tsi.com.br",
                SocialSecurityCard = "111.222.333-44",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Já existe um Cliente cadastrado com o CPF {businessPartnerMock.SocialSecurityCard}.",
            };

            _repository
                .SetupSequence(_ => _.AnyAsync(It.IsAny<Expression<Func<Individual, bool>>>()))
                .ReturnsAsync(false)
                .ReturnsAsync(true);

            // Act
            var result = await _individualService.Update(businessPartnerMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Individual>()), Times.Never);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Individual, bool>>>()),
                Times.Exactly(2)
            );
        }

        [Fact]
        public async Task IndividualService_Update_ShouldUpdateAddIndividualAndReturnAnErrorMessage_WhenNationalIdCardIsDuplicated()
        {
            // Arrange
            var businessPartnerMock = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "Thiago Thomazelli Ferreira",
                Email = "thiago.thomazelli@tsi.com.br",
                SocialSecurityCard = "111.222.333-44",
                NationalIdCard = "11.222.333-4",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Já existe um Cliente cadastrado com o RG {businessPartnerMock.NationalIdCard}.",
            };

            _repository
                .SetupSequence(_ => _.AnyAsync(It.IsAny<Expression<Func<Individual, bool>>>()))
                .ReturnsAsync(false)
                .ReturnsAsync(false)
                .ReturnsAsync(true);

            // Act
            var result = await _individualService.Update(businessPartnerMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Individual>()), Times.Never);
            _repository.Verify(
                _ => _.AnyAsync(It.IsAny<Expression<Func<Individual, bool>>>()),
                Times.Exactly(3)
            );
        }

        [Fact]
        public async Task IndividualService_Update_ShouldNotUpdateIndividualAndReturnAndErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            var businessPartnerMock = new BusinessPartnerDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Name = "Thiago Thomazelli Ferreira",
            };
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível atualizar os dados do Cliente {businessPartnerMock.Name} na base de dados.",
            };

            _repository
                .Setup(_ => _.GetByIdAsync(businessPartnerMock.Id, c => c.Addresses))
                .ReturnsAsync(new Individual());
            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Individual, bool>>>()))
                .ReturnsAsync(new List<Individual>());
            _repository.Setup(_ => _.UpdateAsync(It.IsAny<Individual>())).ThrowsAsync(exception);

            // Act
            var result = await _individualService.Update(businessPartnerMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Individual>()), Times.Once);
        }

        [Fact]
        public async Task IndividualService_FindBySocialSecurityCard_ShouldReturnAnIndividualSuccessfully_WhenFindBySocialSecurityCardIsValid()
        {
            // Arrange
            const string socialSecurityCardMock = "111.222.333-44";
            var businessPartnerMock = _businessPartnerListMock.FirstOrDefault(_ =>
                socialSecurityCardMock.Equals(_.SocialSecurityCard)
            );

            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Data = businessPartnerMock,
                Status = ResponseStatus.Success,
                Message = $"Cliente {businessPartnerMock.Name} encontrado com sucesso.",
            };

            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Individual, bool>>>()))
                .ReturnsAsync(_mapper.Map<Individual>(businessPartnerMock));

            // Act
            var result = await _individualService.FindBySocialSecurityCard(socialSecurityCardMock);

            // Assert
            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Individual, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task IndividualService_FindBySocialSecurityCard_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenFindBySocialSecurityCardIsInvalid()
        {
            // Arrange
            const string socialSecurityCardMock = "000.000.000-00";
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Data = null,
                Status = ResponseStatus.Success,
                Message = $"Nenhum registro com o CPF {socialSecurityCardMock} foi encontrado",
            };

            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Individual, bool>>>()))
                .ReturnsAsync(value: null);

            // Act
            var result = await _individualService.FindBySocialSecurityCard(socialSecurityCardMock);

            // Assert
            Assert.Null(result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Individual, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task IndividualService_FindBySocialSecurityCard_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            const string socialSecurityCardMock = "000.000.000-00";
            var exception = new Exception();
            var expectedResult = new WebApiResponse<BusinessPartnerDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível acessar os registros na base de dados.",
            };

            _repository
                .Setup(_ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Individual, bool>>>()))
                .ThrowsAsync(exception);

            // Act
            var result = await _individualService.FindBySocialSecurityCard(socialSecurityCardMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.FirstOrDefaultAsync(It.IsAny<Expression<Func<Individual, bool>>>()),
                Times.Once
            );
        }
    }
}
