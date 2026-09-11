using System.Linq.Expressions;
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
        public async Task<WebApiResponse<PagedResult<BusinessPartnerDto>>> FindAllByTypePaged(
            BusinessPartnerType businessPartnerType,
            PagedRequest request
        )
        {
            WebApiResponse<PagedResult<BusinessPartnerDto>> result = new();

            try
            {
                var filter = BuildFilter(businessPartnerType, request);
                var orderBy = BuildOrderBy(request);

                // asNoTracking: true - this is a pure list/grid read, never saved back. Unlike
                // FindAllByType, Transactions isn't included here: it's only used afterwards
                // (via AutoMapper) to compute NextEmptyTransactionId, which the grid never
                // displays - loading every Transaction for every row on every page would defeat
                // the point of paginating this list in the first place.
                var (businessPartners, totalCount) = await _repository.GetPagedAsync(
                    skip: (Math.Max(request.Page, 1) - 1) * Math.Max(request.PageSize, 1),
                    take: Math.Max(request.PageSize, 1),
                    filter: filter,
                    orderBy: orderBy,
                    asNoTracking: true,
                    includes: c => c.Addresses
                );

                result.Data = new PagedResult<BusinessPartnerDto>
                {
                    Items = _mapper.Map<IEnumerable<BusinessPartnerDto>>(businessPartners).ToList(),
                    TotalCount = totalCount,
                };
                result.Status = ResponseStatus.Success;
                result.Message = $"{totalCount} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "BusinessPartnerService.FindAllByTypePaged", request);
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

        /// <summary>
        /// Known sort fields exposed by the Clients/Suppliers grid, mapped to the BusinessPartner
        /// property they sort by - an unrecognized SortField (or none) falls back to the
        /// repository's own default (CreateDate) ordering.
        /// </summary>
        private static readonly Dictionary<string, Expression<Func<BusinessPartner, object>>> SortMap =
            new()
            {
                ["name"] = b => b.Name,
                ["documentType"] = b => b.DocumentType,
                ["email"] = b => b.Email,
                ["phone"] = b => b.Phone,
                ["mobile"] = b => b.Mobile,
            };

        /// <summary>
        /// Type is always required (Clients and Suppliers are two separate grids); the quick
        /// filter then OR's across the grid's own visible text columns.
        /// </summary>
        private static Expression<Func<BusinessPartner, bool>> BuildFilter(
            BusinessPartnerType businessPartnerType,
            PagedRequest request
        )
        {
            var quickFilter = request.QuickFilter;
            var hasQuickFilter = !string.IsNullOrWhiteSpace(quickFilter);

            return b =>
                b.Type == businessPartnerType
                && (
                    !hasQuickFilter
                    || b.Name.Contains(quickFilter)
                    || b.Email.Contains(quickFilter)
                    || b.DocumentType.Contains(quickFilter)
                );
        }

        private static Func<
            IQueryable<BusinessPartner>,
            IOrderedQueryable<BusinessPartner>
        > BuildOrderBy(PagedRequest request)
        {
            if (
                string.IsNullOrWhiteSpace(request.SortField)
                || !SortMap.TryGetValue(request.SortField, out var keySelector)
            )
            {
                return null;
            }

            return request.SortDescending
                ? q => q.OrderByDescending(keySelector)
                : q => q.OrderBy(keySelector);
        }

        #endregion Private methods
    }
}
