using AutoMapper;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public sealed class AddressService : IAddressService
    {
        #region Properties

        /// <summary>
        /// Repository object created to access the Addresses registers on database using EntityFramework.
        /// </summary>
        private readonly IRepository<Address> _repository;
        private readonly IMapper _mapper;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        /// <summary>
        /// AddressService constructor created to initialize the "_repository" using Dependency Injection.
        /// </summary>
        /// <param name="repository">IRepository<StudentFrequentView> object used to initialize the internal variable using Dependency Injection.</param>
        public AddressService(
            IRepository<Address> repository,
            IMapper mapper,
            ILogService logService
        )
        {
            _repository = repository;
            _mapper = mapper;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<AddressDto>> Add(AddressDto addressDto)
        {
            WebApiResponse<AddressDto> result = new();

            try
            {
                var addressEntity = _mapper.Map<Address>(addressDto);
                addressEntity.IsDefault = await SetDefaultAddress(addressDto);

                await _repository.AddAsync(addressEntity);
                var addressDtoUpdated = _mapper.Map<AddressDto>(addressEntity);

                result.Data = addressDtoUpdated;
                result.Status = ResponseStatus.Success;
                result.Message = "Endereço cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "AddressService.Add", addressDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o Endereço na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<AddressDto>> Update(AddressDto addressDto)
        {
            WebApiResponse<AddressDto> result = new();

            try
            {
                var addressEntity = _mapper.Map<Address>(addressDto);

                await CleanPreviousDefaultAddress(addressDto);

                await _repository.UpdateAsync(addressEntity);

                result.Data = addressDto;
                result.Status = ResponseStatus.Success;
                result.Message = "Endereço atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "AddressService.Update", addressDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar o Endereço na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<AddressDto>> Remove(AddressDto addressDto)
        {
            WebApiResponse<AddressDto> result = new();

            try
            {
                var addressEntity = _mapper.Map<Address>(addressDto);
                await _repository.RemoveAsync(addressEntity);

                result.Data = addressDto;
                result.Status = ResponseStatus.Success;
                result.Message = "Endereço removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "AddressService.Remove", addressDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o Endereço na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<AddressDto>> FindById(Guid? id)
        {
            WebApiResponse<AddressDto> result = new();

            try
            {
                var addressEntity = await _repository.GetByIdAsync(id);
                var addressDto = _mapper.Map<AddressDto>(addressEntity);
                result.Data = addressDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? "Endereço foi encontrado com sucesso"
                        : $"Nenhum Endereço com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "AddressService.FindById", id);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Endereço na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<AddressDto>>> FindByBusinessPartnerId(
            Guid? businessPartnerId
        )
        {
            WebApiResponse<IEnumerable<AddressDto>> result = new();

            try
            {
                var addressesEntity = await _repository.QueryAsync(_ =>
                    _.BusinessPartnerId.Equals(businessPartnerId)
                );
                var addressesDto = _mapper.Map<IEnumerable<AddressDto>>(addressesEntity).ToList();

                result.Data = addressesDto;
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "AddressService.FindByBusinessPartnerId",
                    businessPartnerId
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Endereço na base de dados.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        private async Task<bool> SetDefaultAddress(AddressDto addressDto)
        {
            var addressEntity = _mapper.Map<Address>(addressDto);
            var anyAddresses = await _repository.AnyAsync(a =>
                a.BusinessPartnerId == addressDto.BusinessPartnerId
            );

            if (!anyAddresses)
            {
                addressEntity.IsDefault = true;
            }
            else if (addressDto.IsDefault)
            {
                await CleanPreviousDefaultAddress(addressDto);
                addressEntity.IsDefault = true;
            }

            return addressEntity.IsDefault;
        }

        private async Task CleanPreviousDefaultAddress(AddressDto addressDto)
        {
            if (!addressDto.IsDefault)
            {
                return;
            }

            var existingDefaults = await _repository.QueryAsync(a =>
                a.BusinessPartnerId == addressDto.BusinessPartnerId
                && a.Id != addressDto.Id
                && a.IsDefault
            );

            if (existingDefaults == null)
            {
                return;
            }

            foreach (var d in existingDefaults)
            {
                d.IsDefault = false;
            }

            await _repository.UpdateRangeAsync(existingDefaults);
        }

        #endregion Private methods
    }
}
