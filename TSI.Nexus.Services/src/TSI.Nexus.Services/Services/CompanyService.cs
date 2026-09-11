using AutoMapper;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class CompanyService : ICompanyService
    {
        #region Properties

        /// <summary>
        /// Repository object created to access the Company registers on database using EntityFramework.
        /// </summary>
        private readonly IRepository<Company> _repository;
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
        /// CompanyService constructor created to initialize the "_repository" using Dependency Injection.
        /// </summary>
        /// <param name="repository">IRepository<Company> object used to initialize the internal variable using Dependency Injection.</param>
        public CompanyService(
            IRepository<Company> repository,
            IMapper mapper,
            ILogService logService
        )
        {
            _repository = repository;
            _mapper = mapper;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<BusinessPartnerDto>> Add(
            BusinessPartnerDto businessPartnerDto
        )
        {
            WebApiResponse<BusinessPartnerDto> result = new();

            try
            {
                var companyDuplicatedMessage = await CheckIfCompanyIsDuplicatedAndGetErrorMessage(
                    businessPartnerDto
                );

                if (!string.IsNullOrEmpty(companyDuplicatedMessage))
                {
                    _logService.LogException(
                        new Exception(companyDuplicatedMessage),
                        "CompanyService.Add",
                        businessPartnerDto
                    );
                    result.Status = ResponseStatus.Error;
                    result.Message = companyDuplicatedMessage;
                    return result;
                }

                var companyEntity = _mapper.Map<Company>(businessPartnerDto);
                await _repository.AddAsync(companyEntity);

                // AddAsync populates companyEntity.Id (DB-generated), but the incoming DTO still
                // has whatever Id it arrived with (Guid.Empty for a new record) - copy it back
                // before returning, or callers that navigate to /suppliers/{id} right after a
                // successful create land on Guid.Empty instead of the real record.
                businessPartnerDto.Id = companyEntity.Id;
                result.Data = businessPartnerDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"{_businessPartnerMap[businessPartnerDto.Type]} {businessPartnerDto.Name} cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "CompanyService.Add", businessPartnerDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o {_businessPartnerMap[businessPartnerDto.Type]} {businessPartnerDto.Name} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<BusinessPartnerDto>> Update(
            BusinessPartnerDto businessPartnerDto
        )
        {
            WebApiResponse<BusinessPartnerDto> result = new();

            try
            {
                var companyDuplicatedMessage = await CheckIfCompanyIsDuplicatedAndGetErrorMessage(
                    businessPartnerDto
                );

                if (!string.IsNullOrEmpty(companyDuplicatedMessage))
                {
                    _logService.LogException(
                        new Exception(companyDuplicatedMessage),
                        "CompanyService.Update",
                        businessPartnerDto
                    );
                    result.Status = ResponseStatus.Error;
                    result.Message = companyDuplicatedMessage;
                    return result;
                }

                // Load tracked entity including Addresses so EF can detect changes on navigation
                var existing = await _repository.GetByIdAsync(
                    businessPartnerDto.Id,
                    c => c.Addresses
                );

                if (existing == null)
                {
                    var message =
                        $"{_businessPartnerMap[businessPartnerDto.Type]} com Id {businessPartnerDto.Id} não encontrado.";
                    _logService.LogException(
                        new Exception(message),
                        "CompanyService.Update",
                        businessPartnerDto
                    );
                    result.Status = ResponseStatus.Error;
                    result.Message = message;
                    return result;
                }

                // Map simple/scalar properties from DTO to tracked entity
                _mapper.Map(businessPartnerDto, existing);

                await _repository.UpdateAsync(existing);

                result.Data = businessPartnerDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"{_businessPartnerMap[businessPartnerDto.Type]} {businessPartnerDto.Name} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "CompanyService.Update", businessPartnerDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do {_businessPartnerMap[businessPartnerDto.Type]} {businessPartnerDto.Name} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<BusinessPartnerDto>> FindByNationalRegistry(
            string nationalRegistry
        )
        {
            WebApiResponse<BusinessPartnerDto> result = new();

            try
            {
                var businessPartnerEntity = await _repository.FirstOrDefaultAsync(x =>
                    x.NationalRegistry == nationalRegistry
                );
                result.Data = _mapper.Map<BusinessPartnerDto>(businessPartnerEntity);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"{_businessPartnerMap[businessPartnerEntity.Type]} {result.Data.Name} encontrado com sucesso."
                        : $"Nenhum registro com o CNPJ {nationalRegistry} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "CompanyService.FindByNationalRegistry",
                    nationalRegistry
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de BusinessPartners na base de dados.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        /// <summary>
        /// Should verify if the Company is already being registered on the database.
        /// </summary>
        /// <param name="companyDto">The CompanyDTO object that is being added or updated.</param>
        /// <returns>The error message when Company is duplicated. Otherwise an empty string.</returns>
        private async Task<string> CheckIfCompanyIsDuplicatedAndGetErrorMessage(
            BusinessPartnerDto companyDto
        )
        {
            if (await IsNameDuplicated(companyDto))
            {
                return $"Já existe um {_businessPartnerMap[companyDto.Type]} cadastrado com Nome {companyDto.Name}.";
            }

            if (await IsEmailDuplicated(companyDto))
            {
                return $"Já existe um {_businessPartnerMap[companyDto.Type]} cadastrado com E-mail {companyDto.Email}.";
            }

            if (await IsNationalRegistryDuplicated(companyDto))
            {
                return $"Já existe um {_businessPartnerMap[companyDto.Type]} cadastrado com o CNPJ {companyDto.NationalRegistry}.";
            }

            return string.Empty;
        }

        /// <summary>
        /// Should verify if the Company name is already being used by another register on the database.
        /// </summary>
        /// <param name="companyDto">The Company object that is being added or updated.</param>
        /// <returns>True when the Name is duplicated; Otherwise false.</returns>
        private async Task<bool> IsNameDuplicated(BusinessPartnerDto companyDto)
        {
            return await _repository.AnyAsync(_ =>
                _.Id != companyDto.Id && _.Name == companyDto.Name && _.Type == companyDto.Type
            );
        }

        /// <summary>
        /// Should verify if the Company email is already being used by another register on the database.
        /// </summary>
        /// <param name="companyDto">The Company object that is being added or updated.</param>
        /// <returns>True when the Email is duplicated; Otherwise false.</returns>
        private async Task<bool> IsEmailDuplicated(BusinessPartnerDto companyDto)
        {
            return await _repository.AnyAsync(_ =>
                _.Id != companyDto.Id
                && !string.IsNullOrEmpty(_.Email)
                && _.Email == companyDto.Email
                && _.Type == companyDto.Type
            );
        }

        /// <summary>
        /// Should verify if the Company NationalRegistry is already being used by another register on the database.
        /// </summary>
        /// <param name="companyDto">The Company object that is being added or updated.</param>
        /// <returns>True when the NationalIDCard is duplicated; Otherwise false.</returns>
        private async Task<bool> IsNationalRegistryDuplicated(BusinessPartnerDto companyDto)
        {
            return await _repository.AnyAsync(_ =>
                _.Id != companyDto.Id
                && !string.IsNullOrEmpty(_.NationalRegistry)
                && _.NationalRegistry == companyDto.NationalRegistry
                && _.Type == companyDto.Type
            );
        }

        #endregion Private methods
    }
}
