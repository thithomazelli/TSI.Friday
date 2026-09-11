using AutoMapper;
using Microsoft.EntityFrameworkCore;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public sealed class BusinessPartnerService : IBusinessPartnerService
    {
        #region Properties

        /// <summary>
        /// Repository object created to access the BusinessPartner registers on database using EntityFramework.
        /// </summary>
        private readonly IRepository<BusinessPartner> _repository;
        private readonly IMapper _mapper;
        private readonly ILogService _logService;
        private readonly IDictionary<BusinessPartnerType, string> _businessPartnerMap =
            new Dictionary<BusinessPartnerType, string>
            {
                { BusinessPartnerType.Client, "Cliente" },
                { BusinessPartnerType.Supplier, "Fornecedor" },
            };

        #endregion Properties

        #region Public methods

        /// <summary>
        /// BusinessPartnerService constructor created to initialize the "_repository" using Dependency Injection.
        /// </summary>
        /// <param name="repository">IRepository<BusinessPartner> object used to initialize the internal variable using Dependency Injection.</param>
        /// <param name="mapper">Mapper object used to initialize the internal variable using Dependency Injection.</param>
        public BusinessPartnerService(
            IRepository<BusinessPartner> repository,
            IMapper mapper,
            ILogService logService
        )
        {
            _repository = repository;
            _mapper = mapper;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<BusinessPartnerDto>> Remove(
            BusinessPartnerDto businessPartnerDto
        )
        {
            WebApiResponse<BusinessPartnerDto> result = new();

            try
            {
                var businessPartner = await _repository.GetByIdAsync(businessPartnerDto.Id);
                if (businessPartner == null)
                {
                    throw new Exception(
                        $"{_businessPartnerMap[businessPartnerDto.Type]} com Id {businessPartnerDto.Id} não encontrado."
                    );
                }

                await _repository.RemoveAsync(businessPartner);

                result.Data = businessPartnerDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"{_businessPartnerMap[businessPartnerDto.Type]} {businessPartner.Name} removido com sucesso.";
            }
            catch (DbUpdateException ex)
            {
                _logService.LogException(ex, "BusinessPartnerService.Remove", businessPartnerDto);
                result.Status = ResponseStatus.Warning;
                result.Message =
                    ex.InnerException?.Message.Contains("foreign key constraint fails") == true
                        ? $"Não foi possível remover o {_businessPartnerMap[businessPartnerDto.Type]} {businessPartnerDto.Name} pois ele está vinculado à um ou mais pedidos e/ou transações."
                        : $"Não foi possível remover o {_businessPartnerMap[businessPartnerDto.Type]} {businessPartnerDto.Name} da base de dados.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "BusinessPartnerService.Remove", businessPartnerDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o {_businessPartnerMap[businessPartnerDto.Type]} {businessPartnerDto.Name} da base de dados.";
            }
            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<BusinessPartnerDto>>> FindAllByType(
            BusinessPartnerType businessPartnerType
        )
        {
            WebApiResponse<IEnumerable<BusinessPartnerDto>> result = new();

            try
            {
                // asNoTracking: true - this is a pure list/grid read, never saved back.
                var businessPartners = await _repository.QueryAsync(
                    _ => businessPartnerType.Equals(_.Type),
                    true,
                    c => c.Addresses,
                    t => t.Transactions
                );

                result.Data = _mapper.Map<IEnumerable<BusinessPartnerDto>>(businessPartners);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "BusinessPartnerService.FindAllByType",
                    businessPartnerType
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de {_businessPartnerMap[businessPartnerType]} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<BusinessPartnerDto>> FindById(Guid? id)
        {
            WebApiResponse<BusinessPartnerDto> result = new();

            try
            {
                var businessPartnerEntity = await _repository.GetByIdAsync(id, a => a.Addresses);
                result.Data = _mapper.Map<BusinessPartnerDto>(businessPartnerEntity);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"{_businessPartnerMap[businessPartnerEntity.Type]} {result.Data.Name} encontrado com sucesso"
                        : $"Nenhum registro com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "BusinessPartnerService.FindById", id);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<BusinessPartnerDto>> FindByEmail(string email)
        {
            WebApiResponse<BusinessPartnerDto> result = new();

            try
            {
                var businessPartnerEntity = await _repository.FirstOrDefaultAsync(x =>
                    x.Email == email
                );
                result.Data = _mapper.Map<BusinessPartnerDto>(businessPartnerEntity);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"{_businessPartnerMap[businessPartnerEntity.Type]} {result.Data.Name} encontrado com sucesso."
                        : $"Nenhum registro com o E-mail {email} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "BusinessPartnerService.FindByEmail", email);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros na base de dados.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        #endregion Private methods
    }
}
