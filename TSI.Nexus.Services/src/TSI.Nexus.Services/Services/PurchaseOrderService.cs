using System.Linq.Expressions;
using System.Text.RegularExpressions;
using AutoMapper;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class PurchaseOrderService : IPurchaseOrderService
    {
        #region Properties

        private readonly IRepository<PurchaseOrder> _repository;
        private readonly ITransactionService _transactionService;
        private readonly ISequenceService _sequenceService;
        private readonly ICurrentUserService _currentUserService;
        private readonly IMapper _mapper;
        private readonly IFeatureToggleService _featureToggleService;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        public PurchaseOrderService(
            IRepository<PurchaseOrder> repository,
            ITransactionService transactionService,
            ISequenceService sequenceService,
            ICurrentUserService currentUserService,
            IMapper mapper,
            IFeatureToggleService featureToggleService,
            ILogService logService
        )
        {
            _repository = repository;
            _transactionService = transactionService;
            _sequenceService = sequenceService;
            _currentUserService = currentUserService;
            _mapper = mapper;
            _featureToggleService = featureToggleService;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PurchaseOrderDto>> Add(PurchaseOrderDto purchaseOrderDto)
        {
            WebApiResponse<PurchaseOrderDto> result = new();

            try
            {
                var prefix = BusinessPartnerPrefixGenerator.BuildPrefixFromBusinessPartnerName(
                    purchaseOrderDto.BusinessPartnerName
                );
                var next = await _sequenceService.GetNextValue("PurchaseOrderNumberSeq");
                purchaseOrderDto.PurchaseOrderNumber = $"{prefix}-{next:D5}";
                purchaseOrderDto.Description = string.IsNullOrEmpty(purchaseOrderDto.Description)
                    ? $"Pedido de Compra -  {purchaseOrderDto.PurchaseOrderNumber}"
                    : purchaseOrderDto.Description;

                // Save Transaction first (if provided) so we can assign TransactionId to
                // PurchaseOrder before saving PurchaseOrder
                var transactionResult = new WebApiResponse<TransactionDto>();

                var transactionDto = purchaseOrderDto.Transaction;
                if (transactionDto != null)
                {
                    transactionDto.Description =
                        $"Transação do Pedido de Compra - {purchaseOrderDto.PurchaseOrderNumber}";
                    transactionResult = await _transactionService.Add(transactionDto);
                    purchaseOrderDto.Transaction = null;
                    purchaseOrderDto.TransactionId = transactionResult.Data?.Id ?? null;
                }
                else if (purchaseOrderDto.TransactionId != null)
                {
                    transactionResult = await _transactionService.FindById(
                        purchaseOrderDto.TransactionId.Value
                    );
                    if (
                        transactionResult.Status == ResponseStatus.Success
                        && transactionResult.Data != null
                    )
                    {
                        purchaseOrderDto.TransactionId = transactionResult.Data.Id;
                    }
                }

                var purchaseOrderEntity = _mapper.Map<PurchaseOrder>(purchaseOrderDto);

                await _repository.AddAsync(purchaseOrderEntity);

                if (transactionResult?.Data != null)
                {
                    transactionResult.Data.PurchaseOrderId = purchaseOrderEntity.Id;
                    await _transactionService.UpdatePurchaseOrderId(transactionResult.Data);
                }

                var responseDto = _mapper.Map<PurchaseOrderDto>(purchaseOrderEntity);

                result.Data = responseDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"Pedido de Compra {purchaseOrderDto.PurchaseOrderNumber} cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PurchaseOrderService.Add", purchaseOrderDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o Pedido de Compra {purchaseOrderDto?.PurchaseOrderNumber} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PurchaseOrderDto>> Update(
            PurchaseOrderDto purchaseOrderDto
        )
        {
            WebApiResponse<PurchaseOrderDto> result = new();

            try
            {
                // Load the tracked entity and map the DTO onto it in place, instead of mapping a
                // separate PurchaseOrder instance with the same Id - EF Core cannot track two
                // different instances sharing the same key, which is what the previous
                // ownership-check query (tracking one instance) plus UpdateAsync (tracking a
                // second, mapped instance) ran into. Same fix as OrderService.Update.
                var purchaseOrderEntity = await _repository.GetByIdAsync(purchaseOrderDto.Id);

                var ownershipMessage = GetOwnershipErrorMessage(purchaseOrderEntity.CreateUserId);
                if (!string.IsNullOrEmpty(ownershipMessage))
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message = ownershipMessage;
                    return result;
                }

                // Map Transaction separately via ITransactionService (below), same as Add() does -
                // mapping it through AutoMapper here would attach a second, untracked Transaction
                // instance onto purchaseOrderEntity.Transaction with the same Id as the one
                // already persisted, hitting the same kind of tracking conflict fixed above.
                var transactionDto = purchaseOrderDto.Transaction;
                purchaseOrderDto.Transaction = null;

                _mapper.Map(purchaseOrderDto, purchaseOrderEntity);

                await _repository.UpdateAsync(purchaseOrderEntity);

                if (transactionDto != null)
                {
                    transactionDto.PurchaseOrderId = purchaseOrderEntity.Id;

                    var updRes = await _transactionService.Update(transactionDto);
                    if (updRes.Status == ResponseStatus.Success && updRes.Data != null)
                    {
                        purchaseOrderDto.Transaction = updRes.Data;
                    }
                }

                result.Data = _mapper.Map<PurchaseOrderDto>(purchaseOrderEntity);
                result.Data.Transaction = purchaseOrderDto.Transaction;

                result.Status = ResponseStatus.Success;
                result.Message =
                    $"Pedido de Compra {purchaseOrderDto.PurchaseOrderNumber} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PurchaseOrderService.Update", purchaseOrderDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do Pedido de Compra {purchaseOrderDto?.PurchaseOrderNumber} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PurchaseOrderDto>> Remove(
            PurchaseOrderDto purchaseOrderDto
        )
        {
            WebApiResponse<PurchaseOrderDto> result = new();

            try
            {
                var purchaseOrderEntity = await _repository.GetByIdAsync(
                    purchaseOrderDto.Id,
                    o => o.PurchaseOrderProducts,
                    p => p.Transaction
                );

                if (purchaseOrderEntity == null)
                {
                    _logService.LogException(
                        new Exception(
                            $"Pedido de Compra {purchaseOrderDto.PurchaseOrderNumber} não encontrado."
                        ),
                        "PurchaseOrderService.Remove",
                        purchaseOrderDto
                    );
                    result.Data = null;
                    result.Status = ResponseStatus.Error;
                    result.Message =
                        $"Pedido de Compra {purchaseOrderDto.PurchaseOrderNumber} não encontrado.";
                    return result;
                }

                var ownershipMessage = GetOwnershipErrorMessage(purchaseOrderEntity.CreateUserId);
                if (!string.IsNullOrEmpty(ownershipMessage))
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message = ownershipMessage;
                    return result;
                }

                await _repository.RemoveAsync(purchaseOrderEntity);

                var transactionDto = _mapper.Map<TransactionDto>(purchaseOrderEntity.Transaction);
                await _transactionService.Remove(transactionDto);

                result.Data = purchaseOrderDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"Pedido de Compra {purchaseOrderDto.PurchaseOrderNumber} removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PurchaseOrderService.Remove", purchaseOrderDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o Pedido de Compra {purchaseOrderDto?.PurchaseOrderNumber} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<PurchaseOrderDto>>> FindAll()
        {
            WebApiResponse<IEnumerable<PurchaseOrderDto>> result = new();

            try
            {
                if (
                    !await _featureToggleService.IsEnabledAsync(
                        FeatureToggleKeys.PurchaseOrder,
                        FeatureToggleKeys.PurchaseOrdersModule
                    )
                )
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                // asNoTracking: true - this is a pure list/grid read, never saved back.
                // splitQuery: true - PurchaseOrderProducts and Payments are both collections;
                // combined in one joined query their row counts multiply per purchase order (a
                // cross join), even though EF resolves it back correctly - AsSplitQuery() issues
                // one query per collection instead.
                var purchaseOrders = await _repository.GetAllAsync(
                    true,
                    true,
                    o => o.BusinessPartner,
                    o => o.PurchaseOrderProducts,
                    t => t.Transaction,
                    p => p.Payments
                );

                result.Data = _mapper.Map<IEnumerable<PurchaseOrderDto>>(purchaseOrders);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PurchaseOrderService.FindAll", null);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Pedidos de Compra na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PagedResult<PurchaseOrderDto>>> FindAllPaged(
            PagedRequest request
        )
        {
            WebApiResponse<PagedResult<PurchaseOrderDto>> result = new();

            try
            {
                if (
                    !await _featureToggleService.IsEnabledAsync(
                        FeatureToggleKeys.PurchaseOrder,
                        FeatureToggleKeys.PurchaseOrdersModule
                    )
                )
                {
                    result.Data = new PagedResult<PurchaseOrderDto> { Items = [], TotalCount = 0 };
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                var filter = BuildFilter(request);
                var orderBy = BuildOrderBy(request);

                // Unlike FindAll, PurchaseOrderProducts/Transaction/Payments aren't eager-loaded
                // here - the grid never displays them, only the details/edit form does (loaded
                // separately by FindById).
                var (purchaseOrders, totalCount) = await _repository.GetPagedAsync(
                    skip: (Math.Max(request.Page, 1) - 1) * Math.Max(request.PageSize, 1),
                    take: Math.Max(request.PageSize, 1),
                    filter: filter,
                    orderBy: orderBy,
                    asNoTracking: true,
                    includes: o => o.BusinessPartner
                );

                result.Data = new PagedResult<PurchaseOrderDto>
                {
                    Items = _mapper.Map<IEnumerable<PurchaseOrderDto>>(purchaseOrders).ToList(),
                    TotalCount = totalCount,
                };
                result.Status = ResponseStatus.Success;
                result.Message = $"{totalCount} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PurchaseOrderService.FindAllPaged", request);
                result.Status = ResponseStatus.Error;
                result.Message = "Não foi possível acessar os registros de Pedidos de Compra na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PurchaseOrderDto>> FindById(Guid? id)
        {
            WebApiResponse<PurchaseOrderDto> result = new();

            try
            {
                if (
                    !await _featureToggleService.IsEnabledAsync(
                        FeatureToggleKeys.PurchaseOrder,
                        FeatureToggleKeys.PurchaseOrdersModule
                    )
                )
                {
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhum Pedido de Compra com o ID {id} foi encontrado";
                    return result;
                }

                // splitQuery: true - PurchaseOrderProducts and Transaction.Payments are both
                // collections; see the same note on FindAll() above.
                var purchaseOrder = await _repository.GetByIdAsync(
                    id,
                    true,
                    true,
                    o => o.BusinessPartner,
                    op => op.PurchaseOrderProducts,
                    t => t.Transaction,
                    p => p.Transaction.Payments
                );

                if (purchaseOrder != null)
                {
                    var ownershipMessage = GetOwnershipErrorMessage(purchaseOrder.CreateUserId);
                    if (!string.IsNullOrEmpty(ownershipMessage))
                    {
                        result.Status = ResponseStatus.Warning;
                        result.Message = ownershipMessage;
                        return result;
                    }
                }

                result.Data = _mapper.Map<PurchaseOrderDto>(purchaseOrder);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Pedido de Compra {result.Data.PurchaseOrderNumber} encontrado com sucesso"
                        : $"Nenhum Pedido de Compra com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PurchaseOrderService.FindById", id);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Pedidos de Compra na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<PurchaseOrderDto>>> FindByBusinessPartnerId(
            Guid? businessPartnerId
        )
        {
            WebApiResponse<IEnumerable<PurchaseOrderDto>> result = new();

            try
            {
                var purchaseOrders = await _repository.QueryAsync(
                    o => o.BusinessPartnerId == businessPartnerId,
                    true,
                    p => p.Transaction
                );
                result.Data = _mapper.Map<IEnumerable<PurchaseOrderDto>>(purchaseOrders);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "PurchaseOrderService.FindByBusinessPartnerId",
                    businessPartnerId
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Pedidos de Compra do BusinessPartner {businessPartnerId}.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        /// <summary>
        /// Known sort fields exposed by the Purchase Orders grid, mapped to the PurchaseOrder
        /// property they sort by - an unrecognized SortField (or none) falls back to the
        /// repository's own default (CreateDate) ordering.
        /// </summary>
        private static readonly Dictionary<
            string,
            Expression<Func<PurchaseOrder, object>>
        > SortMap = new()
        {
            ["purchaseOrderNumber"] = o => o.PurchaseOrderNumber,
            ["businessPartnerName"] = o => o.BusinessPartner.Name,
            ["description"] = o => o.Description,
            ["totalPrice"] = o => o.TotalPrice,
            ["date"] = o => o.Date,
            ["status"] = o => o.Status,
        };

        private static Func<
            IQueryable<PurchaseOrder>,
            IOrderedQueryable<PurchaseOrder>
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

        /// <summary>
        /// Combines the quick filter with the date-range and status filters - the same panel the
        /// Purchase Orders list already had client-side, now applied server-side alongside
        /// pagination.
        /// </summary>
        private static Expression<Func<PurchaseOrder, bool>> BuildFilter(PagedRequest request)
        {
            var quickFilter = request.QuickFilter;
            var hasQuickFilter = !string.IsNullOrWhiteSpace(quickFilter);
            var startDate = request.StartDate?.Date;
            var endDate = request.EndDate?.Date;
            var statuses = EnumListParser.Parse<OrderStatus>(request.Statuses);
            var hasStatusFilter = statuses.Count > 0;

            return o =>
                (!hasQuickFilter
                    || o.PurchaseOrderNumber.Contains(quickFilter)
                    || o.Description.Contains(quickFilter)
                    || o.BusinessPartner.Name.Contains(quickFilter))
                && (startDate == null || o.CreateDate.Date >= startDate)
                && (endDate == null || o.CreateDate.Date <= endDate)
                && (!hasStatusFilter || statuses.Contains(o.Status));
        }

        /// <summary>
        /// Returns an error message when the current user is neither the creator of the
        /// PurchaseOrder nor an Admin. Admins and requests with no resolvable current user (e.g.
        /// system/background jobs) always pass through.
        /// </summary>
        private string GetOwnershipErrorMessage(string createUserId)
        {
            if (_currentUserService == null || _currentUserService.IsInRole("Admin"))
            {
                return string.Empty;
            }

            var currentUserId = _currentUserService.GetUserId();

            if (string.IsNullOrEmpty(currentUserId) || string.IsNullOrEmpty(createUserId))
            {
                return string.Empty;
            }

            return createUserId == currentUserId
                ? string.Empty
                : "Você não tem permissão para acessar este Pedido de Compra, pois foi criado por outro usuário.";
        }


        #endregion Private methods
    }
}
