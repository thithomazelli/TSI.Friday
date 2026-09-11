using AutoMapper;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class IndividualService : IIndividualService
    {
        #region Properties

        /// <summary>
        /// Repository object created to access the Individual registers on database using EntityFramework.
        /// </summary>
        private readonly IRepository<Individual> _repository;
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
        /// IndividualService constructor created to initialize the "_repository" using Dependency Injection.
        /// </summary>
        /// <param name="repository">IRepository<Individual> object used to initialize the internal variable using Dependency Injection.</param>
        public IndividualService(
            IRepository<Individual> repository,
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
                var individualDuplicatedMessage =
                    await CheckIfIndividualIsDuplicatedAndGetErrorMessage(businessPartnerDto);

                if (!string.IsNullOrEmpty(individualDuplicatedMessage))
                {
                    _logService.LogException(
                        new Exception(individualDuplicatedMessage),
                        "IndividualService.Add",
                        businessPartnerDto
                    );
                    result.Status = ResponseStatus.Error;
                    result.Message = individualDuplicatedMessage;
                    return result;
                }

                var businessPartnerEntity = _mapper.Map<Individual>(businessPartnerDto);
                await _repository.AddAsync(businessPartnerEntity);

                // AddAsync populates businessPartnerEntity.Id (DB-generated), but the incoming
                // DTO still has whatever Id it arrived with (Guid.Empty for a new record) - copy
                // it back before returning, or callers that navigate to /clients/{id} right after
                // a successful create land on Guid.Empty instead of the real record.
                businessPartnerDto.Id = businessPartnerEntity.Id;
                result.Data = businessPartnerDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"{_businessPartnerMap[businessPartnerDto.Type]} {businessPartnerDto.Name} cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "IndividualService.Add", businessPartnerDto);
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
                var individualDuplicatedMessage =
                    await CheckIfIndividualIsDuplicatedAndGetErrorMessage(businessPartnerDto);

                if (!string.IsNullOrEmpty(individualDuplicatedMessage))
                {
                    _logService.LogException(
                        new Exception(individualDuplicatedMessage),
                        "IndividualService.Update",
                        businessPartnerDto
                    );
                    result.Status = ResponseStatus.Error;
                    result.Message = individualDuplicatedMessage;
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
                        "IndividualService.Update",
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
                _logService.LogException(ex, "IndividualService.Update", businessPartnerDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do {_businessPartnerMap[businessPartnerDto.Type]} {businessPartnerDto.Name} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<BusinessPartnerDto>> FindBySocialSecurityCard(
            string socialSecurityCard
        )
        {
            WebApiResponse<BusinessPartnerDto> result = new();

            try
            {
                var businessPartnerEntity = await _repository.FirstOrDefaultAsync(_ =>
                    _.SocialSecurityCard.Equals(socialSecurityCard)
                );
                result.Data = _mapper.Map<BusinessPartnerDto>(businessPartnerEntity);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"{_businessPartnerMap[businessPartnerEntity.Type]} {result.Data.Name} encontrado com sucesso."
                        : $"Nenhum registro com o CPF {socialSecurityCard} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "IndividualService.FindBySocialSecurityCard",
                    socialSecurityCard
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros na base de dados.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        /// <summary>
        /// Should verify if the Individual is already being registered on the database.
        /// </summary>
        /// <param name="individualDto">The Individual object that is being added or updated.</param>
        /// <returns>The error message when Individual is duplicated. Otherwise an empty string.</returns>
        private async Task<string> CheckIfIndividualIsDuplicatedAndGetErrorMessage(
            BusinessPartnerDto individualDto
        )
        {
            if (await IsEmailDuplicated(individualDto))
            {
                return $"Já existe um {_businessPartnerMap[individualDto.Type]} cadastrado com E-mail {individualDto.Email}.";
            }

            if (await IsSocialSecurityCardDuplicated(individualDto))
            {
                return $"Já existe um {_businessPartnerMap[individualDto.Type]} cadastrado com o CPF {individualDto.SocialSecurityCard}.";
            }

            if (await IsNationalIDCardDuplicated(individualDto))
            {
                return $"Já existe um {_businessPartnerMap[individualDto.Type]} cadastrado com o RG {individualDto.NationalIdCard}.";
            }

            return string.Empty;
        }

        /// <summary>
        /// Should verify if the Individual email is already being used by another register on the database.
        /// </summary>
        /// <param name="individualDto">The Individual object that is being added or updated.</param>
        /// <returns>True when the Email is duplicated; Otherwise false.</returns>
        private async Task<bool> IsEmailDuplicated(BusinessPartnerDto individualDto)
        {
            return await _repository.AnyAsync(_ =>
                _.Id != individualDto.Id
                && !string.IsNullOrEmpty(_.Email)
                && _.Email == individualDto.Email
                && _.Type == individualDto.Type
            );
        }

        /// <summary>
        /// Should verify if the Individual SocialSecurityCard is already being used by another register on the database.
        /// </summary>
        /// <param name="individualDto">The Individual object that is being added or updated.</param>
        /// <returns>True when the SocialSecurityCard is duplicated; Otherwise false.</returns>
        private async Task<bool> IsSocialSecurityCardDuplicated(BusinessPartnerDto individualDto)
        {
            return await _repository.AnyAsync(_ =>
                _.Id != individualDto.Id
                && !string.IsNullOrEmpty(_.SocialSecurityCard)
                && _.SocialSecurityCard == individualDto.SocialSecurityCard
                && _.Type == individualDto.Type
            );
        }

        /// <summary>
        /// Should verify if the Individual NationalIDCard is already being used by another register on the database.
        /// </summary>
        /// <param name="individualDto">The Individual object that is being added or updated.</param>
        /// <returns>True when the NationalIDCard is duplicated; Otherwise false.</returns>
        private async Task<bool> IsNationalIDCardDuplicated(BusinessPartnerDto individualDto)
        {
            return await _repository.AnyAsync(_ =>
                _.Id != individualDto.Id
                && !string.IsNullOrEmpty(_.NationalIdCard)
                && _.NationalIdCard == individualDto.NationalIdCard
                && _.Type == individualDto.Type
            );
        }

        #endregion Private methods
    }
}
