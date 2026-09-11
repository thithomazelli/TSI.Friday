using System.Linq.Expressions;
using AutoMapper;
using FluentAssertions;
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
    public class AddressServiceTests
    {
        private readonly AddressService _addressService;
        private readonly Mock<IRepository<Address>> _repository;
        private readonly Mock<ILogService> _logService;
        private readonly IList<AddressDto> _addressListMock;
        private readonly IMapper _mapper;

        public AddressServiceTests()
        {
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

            _repository = new Mock<IRepository<Address>>();
            _logService = new Mock<ILogService>();
            _addressService = new AddressService(_repository.Object, _mapper, _logService.Object);
            _addressListMock = new List<AddressDto>
            {
                new AddressDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    Type = "Residencial",
                    Country = "Brasil",
                    City = "Santo André",
                    State = "SP",
                    ZipCode = "09190-620",
                    Street = "Rua Juazeiro",
                    Number = 303,
                    Comments = "Apto 21",
                    IsDefault = true,
                },
                new AddressDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    Type = "Comercial",
                    Country = "Brasil",
                    City = "Santo André",
                    State = "SP",
                    ZipCode = "09260-290",
                    Street = "Rua Osório de Almeida",
                    Number = 950,
                    Comments = "",
                },
            };
        }

        [Fact]
        public async Task AddressService_Add_ShouldAddAddressSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var addressMock = _addressListMock.FirstOrDefault();
            var expectedResult = new WebApiResponse<AddressDto>
            {
                Data = addressMock,
                Status = ResponseStatus.Success,
                Message = "Endereço cadastrado com sucesso.",
            };

            _repository.Setup(_ => _.AddAsync(It.IsAny<Address>()));

            // Act
            var result = await _addressService.Add(addressMock);

            // Assert
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Address>()), Times.Once);
        }

        [Fact]
        public async Task AddressService_Add_ShouldNotAddAddressAndReturnAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            var addressMock = _addressListMock.FirstOrDefault();
            var expectedResult = new WebApiResponse<AddressDto>
            {
                Data = null,
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível cadastrar o Endereço na base de dados.",
            };

            _repository.Setup(_ => _.AddAsync(It.IsAny<Address>())).ThrowsAsync(exception);

            // Act
            var result = await _addressService.Add(addressMock);

            // Assert
            Assert.Null(result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.AddAsync(It.IsAny<Address>()), Times.Once);
        }

        [Fact]
        public async Task AddressService_Add_ShouldSetIsDefaultAndCleanPrevious_WhenOtherAddressesExistAndDtoIsDefault()
        {
            // Arrange
            var addressMock = _addressListMock.First();
            addressMock.IsDefault = true;
            var previousDefault = _mapper.Map<Address>(_addressListMock.Last());
            previousDefault.IsDefault = true;

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Address, bool>>>()))
                .ReturnsAsync(true);
            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Address, bool>>>()))
                .ReturnsAsync(new List<Address> { previousDefault });

            // Act
            var result = await _addressService.Add(addressMock);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.True(result.Data!.IsDefault);
            Assert.False(previousDefault.IsDefault);
            _repository.Verify(
                _ => _.UpdateRangeAsync(It.Is<IEnumerable<Address>>(l => l.Contains(previousDefault))),
                Times.Once
            );
        }

        [Fact]
        public async Task AddressService_Add_ShouldNotSetIsDefault_WhenOtherAddressesExistAndDtoIsNotDefault()
        {
            // Arrange
            var addressMock = _addressListMock.Last();
            addressMock.IsDefault = false;

            _repository
                .Setup(_ => _.AnyAsync(It.IsAny<Expression<Func<Address, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _addressService.Add(addressMock);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.False(result.Data!.IsDefault);
            _repository.Verify(
                _ => _.QueryAsync(It.IsAny<Expression<Func<Address, bool>>>()),
                Times.Never
            );
        }

        [Fact]
        public async Task AddressService_Update_ShouldUpdateAddressSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var addressMock = _addressListMock.FirstOrDefault();
            var expectedResult = new WebApiResponse<AddressDto>
            {
                Data = addressMock,
                Status = ResponseStatus.Success,
                Message = "Endereço atualizado com sucesso.",
            };

            _repository.Setup(_ => _.UpdateAsync(It.IsAny<Address>()));

            // Act
            var result = await _addressService.Update(addressMock);

            // Assert
            Assert.Equal(expectedResult.Data, addressMock);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Address>()), Times.Once);
        }

        [Fact]
        public async Task AddressService_Update_ShouldNotUpdateAddressAndReturnAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            var addressMock = _addressListMock.FirstOrDefault();
            var expectedResult = new WebApiResponse<AddressDto>
            {
                Data = null,
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível atualizar o Endereço na base de dados.",
            };

            _repository.Setup(_ => _.UpdateAsync(It.IsAny<Address>())).ThrowsAsync(exception);

            // Act
            var result = await _addressService.Update(addressMock);

            // Assert
            Assert.Null(result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.UpdateAsync(It.IsAny<Address>()), Times.Once);
        }

        [Fact]
        public async Task AddressService_Update_ShouldNotQueryPreviousDefaults_WhenDtoIsNotDefault()
        {
            // Arrange
            var addressMock = _addressListMock.Last();
            addressMock.IsDefault = false;

            // Act
            var result = await _addressService.Update(addressMock);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _repository.Verify(
                _ => _.QueryAsync(It.IsAny<Expression<Func<Address, bool>>>()),
                Times.Never
            );
            _repository.Verify(_ => _.UpdateRangeAsync(It.IsAny<IEnumerable<Address>>()), Times.Never);
        }

        [Fact]
        public async Task AddressService_Update_ShouldClearPreviousDefaults_WhenDtoIsDefaultAndOtherDefaultsExist()
        {
            // Arrange
            var addressMock = _addressListMock.First();
            addressMock.IsDefault = true;
            var previousDefault = _mapper.Map<Address>(_addressListMock.Last());
            previousDefault.IsDefault = true;

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Address, bool>>>()))
                .ReturnsAsync(new List<Address> { previousDefault });

            // Act
            var result = await _addressService.Update(addressMock);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.False(previousDefault.IsDefault);
            _repository.Verify(
                _ => _.UpdateRangeAsync(It.Is<IEnumerable<Address>>(l => l.Contains(previousDefault))),
                Times.Once
            );
        }

        [Fact]
        public async Task AddressService_Remove_ShouldRemoveAddressSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var addressMock = _addressListMock.FirstOrDefault();
            var expectedResult = new WebApiResponse<AddressDto>
            {
                Data = addressMock,
                Status = ResponseStatus.Success,
                Message = "Endereço removido com sucesso.",
            };

            _repository.Setup(_ => _.RemoveAsync(It.IsAny<Address>()));

            // Act
            var result = await _addressService.Remove(addressMock);

            // Assert
            Assert.Equal(expectedResult.Data, addressMock);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.RemoveAsync(It.IsAny<Address>()), Times.Once);
        }

        [Fact]
        public async Task AddressService_Remove_ShouldNotRemoveAddressAndReturnAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var exception = new Exception();
            var addressMock = _addressListMock.FirstOrDefault();
            var expectedResult = new WebApiResponse<AddressDto>
            {
                Data = null,
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível remover o Endereço na base de dados.",
            };

            _repository.Setup(_ => _.RemoveAsync(It.IsAny<Address>())).ThrowsAsync(exception);

            // Act
            var result = await _addressService.Remove(addressMock);

            // Assert
            Assert.Null(result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.RemoveAsync(It.IsAny<Address>()), Times.Once);
        }

        [Fact]
        public async Task AddressService_FindById_ShouldReturnAnAddressSuccessfully_WhenIdIsValid()
        {
            // Arrange
            var idMock = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var addressMock = _addressListMock.FirstOrDefault(_ =>
                idMock.Equals(_.BusinessPartnerId)
            );
            var expectedResult = new WebApiResponse<AddressDto>
            {
                Data = addressMock,
                Status = ResponseStatus.Success,
                Message = "Endereço foi encontrado com sucesso",
            };

            _repository
                .Setup(_ => _.GetByIdAsync(idMock))
                .ReturnsAsync(_mapper.Map<Address>(addressMock));

            // Act
            var result = await _addressService.FindById(idMock);

            // Assert
            expectedResult.Should().BeEquivalentTo(result);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            _repository.Verify(_ => _.GetByIdAsync(idMock), Times.Once);
        }

        [Fact]
        public async Task AddressService_FindById_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenIdIsInvalid()
        {
            // Arrange
            var idMock = Guid.Parse("00000000-0000-0000-0000-00000000000A");
            var expectedResult = new WebApiResponse<AddressDto>
            {
                Data = null,
                Status = ResponseStatus.Success,
                Message = $"Nenhum Endereço com o ID {idMock} foi encontrado",
            };

            _repository.Setup(_ => _.GetByIdAsync(idMock)).ReturnsAsync(value: null);

            // Act
            var result = await _addressService.FindById(idMock);

            // Assert
            Assert.Null(result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.GetByIdAsync(idMock), Times.Once);
        }

        [Fact]
        public async Task AddressService_FindById_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var idMock = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var exception = new Exception();
            var expectedResult = new WebApiResponse<AddressDto>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível acessar os registros de Endereço na base de dados.",
            };

            _repository.Setup(_ => _.GetByIdAsync(idMock)).ThrowsAsync(exception);

            // Act
            var result = await _addressService.FindById(idMock);

            // Assert
            Assert.Null(result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(_ => _.GetByIdAsync(idMock), Times.Once);
        }

        [Fact]
        public async Task AddressService_FindByBusinessPartnerId_ShouldReturnALisfOfAddressesSuccessfully_WhenBusinessPartnerIdIsValid()
        {
            // Arrange
            var businessPartnerIdMock = Guid.Parse("00000000-0000-0000-0000-00000000000A");
            var expectedResult = new WebApiResponse<IEnumerable<AddressDto>>
            {
                Data = _addressListMock,
                Status = ResponseStatus.Success,
                Message = $"{_addressListMock.Count} registro(s) encontrado(s).",
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Address, bool>>>()))
                .ReturnsAsync(_mapper.Map<IList<Address>>(_addressListMock));

            // Act
            var result = await _addressService.FindByBusinessPartnerId(businessPartnerIdMock);

            // Assert
            expectedResult.Should().BeEquivalentTo(result);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            _repository.Verify(
                _ => _.QueryAsync(It.IsAny<Expression<Func<Address, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task AddressService_FindByBusinessPartnerId_ShouldReturnAnEmptyData_WhenBusinessPartnerIdIsInvalid()
        {
            // Arrange
            var businessPartnerIdMock = Guid.Parse("00000000-0000-0000-0000-00000000000A");
            var expectedResult = new WebApiResponse<IEnumerable<AddressDto>>
            {
                Data = new List<AddressDto>(),
                Status = ResponseStatus.Success,
                Message = $"{0} registro(s) encontrado(s).",
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Address, bool>>>()))
                .ReturnsAsync(new List<Address>());

            // Act
            var result = await _addressService.FindByBusinessPartnerId(businessPartnerIdMock);

            // Assert
            Assert.Equal(expectedResult.Data, result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.QueryAsync(It.IsAny<Expression<Func<Address, bool>>>()),
                Times.Once
            );
        }

        [Fact]
        public async Task AddressService_FindByBusinessPartnerId_ShouldReturnAnEmptyDataAndAnErrorMessage_WhenRepositoryGetsAnError()
        {
            // Arrange
            var businessPartnerIdMock = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var exception = new Exception();
            var expectedResult = new WebApiResponse<IEnumerable<AddressDto>>
            {
                Status = ResponseStatus.Error,
                Message =
                    $"Não foi possível acessar os registros de Endereço na base de dados.",
            };

            _repository
                .Setup(_ => _.QueryAsync(It.IsAny<Expression<Func<Address, bool>>>()))
                .ThrowsAsync(exception);

            // Act
            var result = await _addressService.FindByBusinessPartnerId(businessPartnerIdMock);

            // Assert
            Assert.Null(result.Data);
            Assert.Equal(expectedResult.Status, result.Status);
            Assert.Equal(expectedResult.Message, result.Message);

            expectedResult.Should().BeEquivalentTo(result);
            _repository.Verify(
                _ => _.QueryAsync(It.IsAny<Expression<Func<Address, bool>>>()),
                Times.Once
            );
        }
    }
}
