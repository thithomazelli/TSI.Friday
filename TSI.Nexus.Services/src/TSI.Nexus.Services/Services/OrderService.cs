using System.Text.RegularExpressions;
using AutoMapper;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class OrderService : IOrderService
    {
        #region Properties

        /// <summary>
        /// OrderService constructor created to initialize the "_repository" using Dependency Injection.
        /// </summary>
        private readonly IRepository<Order> _repository;
        private readonly ITransactionService _transactionService;
        private readonly ISequenceService _sequenceService;
        private readonly ICurrentUserService _currentUserService;
        private readonly IMapper _mapper;
        private readonly IFeatureToggleService _featureToggleService;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        /// <summary>
        /// OrderService constructor created to initialize the "_repository" using Dependency Injection.
        /// </summary>
        /// <param name="repository">IRepository<Order> object used to initialize the internal variable using Dependency Injection.</param>
        public OrderService(
            IRepository<Order> repository,
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
        public async Task<WebApiResponse<OrderDto>> Add(OrderDto orderDto)
        {
            WebApiResponse<OrderDto> result = new();

            try
            {
                var prefix = BuildPrefixFromBusinessPartnerName(orderDto.BusinessPartnerName);
                var next = await _sequenceService.GetNextValue("OrderNumberSeq");
                orderDto.OrderNumber = $"{prefix}-{next:D5}";
                orderDto.Description = string.IsNullOrEmpty(orderDto.Description)
                    ? $"Pedido de Venda -  {orderDto.OrderNumber}"
                    : orderDto.Description;

                // Save Transaction first (if provided) so we can assign TransactionId to Order before saving Order
                var transactionResult = new WebApiResponse<TransactionDto>();

                var transactionDto = orderDto.Transaction;
                if (transactionDto != null)
                {
                    transactionDto.OrderNumber = orderDto.OrderNumber;
                    transactionDto.Description =
                        $"Transação do Pedido de Venda - {orderDto.OrderNumber}";
                    transactionResult = await _transactionService.Add(transactionDto);
                    orderDto.Transaction = null;
                    orderDto.TransactionId = transactionResult.Data?.Id ?? null;
                }
                else if (orderDto.TransactionId != null)
                {
                    // If TransactionId was provided without full Transaction data, we can try to fetch it to ensure it exists and get its OrderId if already set
                    transactionResult = await _transactionService.FindById(
                        orderDto.TransactionId.Value
                    );
                    if (
                        transactionResult.Status == ResponseStatus.Success
                        && transactionResult.Data != null
                    )
                    {
                        orderDto.TransactionId = transactionResult.Data.Id;
                    }
                }

                var orderEntity = _mapper.Map<Order>(orderDto);

                await _repository.AddAsync(orderEntity);

                // Update Transaction
                if (transactionResult?.Data != null)
                {
                    transactionResult.Data.OrderId = orderEntity.Id;
                    await _transactionService.UpdateOrderId(transactionResult.Data);
                }

                // prepare response DTO
                var responseDto = _mapper.Map<OrderDto>(orderEntity);

                result.Data = responseDto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Pedido {orderDto.OrderNumber} cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "OrderService.Add", orderDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o Pedido {orderDto?.OrderNumber} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<OrderDto>> Update(OrderDto orderDto)
        {
            WebApiResponse<OrderDto> result = new();

            try
            {
                // Load the tracked entity and map the DTO onto it in place, instead of mapping a
                // separate Order instance with the same Id - EF Core cannot track two different
                // instances sharing the same key, which is what the previous ownership-check
                // query (tracking one instance) plus UpdateAsync (tracking a second, mapped
                // instance) ran into.
                var orderEntity = await _repository.GetByIdAsync(orderDto.Id);

                var ownershipMessage = GetOwnershipErrorMessage(orderEntity.CreateUserId);
                if (!string.IsNullOrEmpty(ownershipMessage))
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message = ownershipMessage;
                    return result;
                }

                // Map Transaction separately via ITransactionService (below), same as Add() does -
                // mapping it through AutoMapper here would attach a second, untracked Transaction
                // instance onto orderEntity.Transaction with the same Id as the one already
                // persisted, hitting the same kind of tracking conflict fixed above for Order.
                var transactionDto = orderDto.Transaction;
                orderDto.Transaction = null;

                _mapper.Map(orderDto, orderEntity);

                await _repository.UpdateAsync(orderEntity);

                if (transactionDto != null)
                {
                    transactionDto.OrderId = orderEntity.Id;

                    var updRes = await _transactionService.Update(transactionDto);
                    if (updRes.Status == ResponseStatus.Success && updRes.Data != null)
                    {
                        orderDto.Transaction = updRes.Data;
                    }
                }

                result.Data = _mapper.Map<OrderDto>(orderEntity);
                result.Data.Transaction = orderDto.Transaction;

                result.Status = ResponseStatus.Success;
                result.Message = $"Pedido {orderDto.OrderNumber} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "OrderService.Update", orderDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do Pedido {orderDto?.OrderNumber} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<OrderDto>> Remove(OrderDto orderDto)
        {
            WebApiResponse<OrderDto> result = new();

            try
            {
                var orderEntity = await _repository.GetByIdAsync(
                    orderDto.Id,
                    o => o.OrderProducts,
                    p => p.Transaction
                );

                if (orderEntity == null)
                {
                    _logService.LogException(
                        new Exception($"Pedido {orderDto.OrderNumber} não encontrado."),
                        "OrderService.Remove",
                        orderDto
                    );
                    result.Data = null;
                    result.Status = ResponseStatus.Error;
                    result.Message = $"Pedido {orderDto.OrderNumber} não encontrado.";
                    return result;
                }

                var ownershipMessage = GetOwnershipErrorMessage(orderEntity.CreateUserId);
                if (!string.IsNullOrEmpty(ownershipMessage))
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message = ownershipMessage;
                    return result;
                }

                await _repository.RemoveAsync(orderEntity);

                var transactionDto = _mapper.Map<TransactionDto>(orderEntity.Transaction);
                await _transactionService.Remove(transactionDto);

                result.Data = orderDto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Pedido {orderDto.OrderNumber} removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "OrderService.Remove", orderDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o Pedido {orderDto?.OrderNumber} da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<OrderDto>>> FindAll()
        {
            WebApiResponse<IEnumerable<OrderDto>> result = new();

            try
            {
                if (
                    !await _featureToggleService.IsEnabledAsync(
                        FeatureToggleKeys.Order,
                        FeatureToggleKeys.SalesOrdersModule
                    )
                )
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                // asNoTracking: true - this is a pure list/grid read, never saved back.
                // splitQuery: true - OrderProducts and Payments are both collections; combined in
                // one joined query their row counts multiply per order (a cross join), even though
                // EF resolves it back correctly - AsSplitQuery() issues one query per collection instead.
                var orders = await _repository.GetAllAsync(
                    true,
                    true,
                    o => o.BusinessPartner,
                    o => o.OrderProducts,
                    t => t.Transaction,
                    p => p.Payments
                );

                result.Data = _mapper.Map<IEnumerable<OrderDto>>(orders);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "OrderService.FindAll", null);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Pedidos na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<OrderDto>> FindById(Guid? id)
        {
            WebApiResponse<OrderDto> result = new();

            try
            {
                if (
                    !await _featureToggleService.IsEnabledAsync(
                        FeatureToggleKeys.Order,
                        FeatureToggleKeys.SalesOrdersModule
                    )
                )
                {
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhum Pedido com o ID {id} foi encontrado";
                    return result;
                }

                // splitQuery: true - OrderProducts and Transaction.Payments are both collections;
                // see the same note on FindAll() above.
                var order = await _repository.GetByIdAsync(
                    id,
                    true,
                    true,
                    o => o.BusinessPartner,
                    op => op.OrderProducts,
                    t => t.Transaction,
                    p => p.Transaction.Payments
                );

                if (order != null)
                {
                    var ownershipMessage = GetOwnershipErrorMessage(order.CreateUserId);
                    if (!string.IsNullOrEmpty(ownershipMessage))
                    {
                        result.Status = ResponseStatus.Warning;
                        result.Message = ownershipMessage;
                        return result;
                    }
                }

                result.Data = _mapper.Map<OrderDto>(order);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Pedido {result.Data.OrderNumber} encontrado com sucesso"
                        : $"Nenhum Pedido com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "OrderService.FindById", id);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Pedidos na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<OrderDto>> FindByOrderNumber(string orderNumber)
        {
            WebApiResponse<OrderDto> result = new();

            try
            {
                var order = await _repository.FirstOrDefaultAsync(
                    o => o.OrderNumber == orderNumber,
                    true,
                    o => o.BusinessPartner,
                    p => p.Transaction
                );

                result.Data = _mapper.Map<OrderDto>(order);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Pedido {result.Data.OrderNumber} encontrado com sucesso"
                        : $"Nenhum Pedido com o número {orderNumber} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "OrderService.FindByOrderNumber", orderNumber);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível buscar o Pedido pelo número {orderNumber}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<OrderDto>>> FindByBusinessPartnerId(
            Guid? businessPartnerId
        )
        {
            WebApiResponse<IEnumerable<OrderDto>> result = new();

            try
            {
                var orders = await _repository.QueryAsync(
                    o => o.BusinessPartnerId == businessPartnerId,
                    true,
                    p => p.Transaction
                );
                result.Data = _mapper.Map<IEnumerable<OrderDto>>(orders);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "OrderService.FindByBusinessPartnerId",
                    businessPartnerId
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Pedidos do BusinessPartner {businessPartnerId}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<OrderDto>>> FindByProductId(Guid? productId)
        {
            WebApiResponse<IEnumerable<OrderDto>> result = new();

            try
            {
                var orders = await _repository.QueryAsync(
                    o => o.OrderProducts.Any(op => op.ProductId == productId),
                    true
                );
                result.Data = _mapper.Map<IEnumerable<OrderDto>>(orders);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "OrderService.FindByProductId", productId);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Pedidos relacionados ao Produto {productId}.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        /// <summary>
        /// Returns an error message when the current user is neither the creator of the Order nor
        /// an Admin. Admins and requests with no resolvable current user (e.g. system/background
        /// jobs) always pass through.
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
                : "Você não tem permissão para acessar este Pedido, pois foi criado por outro usuário.";
        }

        private static string BuildPrefixFromBusinessPartnerName(string businessPartnerName)
        {
            // Remove non-letter characters and whitespace, keep only A-Z letters
            var cleaned = string.Empty;
            if (!string.IsNullOrWhiteSpace(businessPartnerName))
            {
                cleaned = Regex.Replace(businessPartnerName.Normalize(), "[^A-Za-z]", string.Empty);
                cleaned = cleaned.ToUpperInvariant();
            }

            var letters = cleaned ?? string.Empty;

            char GetRandomLetter()
            {
                var rnd = Random.Shared;
                return (char)('A' + rnd.Next(0, 26));
            }

            string prefix;

            if (letters.Length >= 3)
            {
                var first = letters[0];
                var middle = letters[letters.Length / 2];
                var last = letters[letters.Length - 1];
                prefix = string.Concat(first, middle, last);
            }
            else
            {
                var chars = new List<char>();
                for (int i = 0; i < letters.Length; i++)
                    chars.Add(letters[i]);

                while (chars.Count < 3)
                    chars.Add(GetRandomLetter());

                prefix = new string(chars.ToArray());
            }

            return prefix;
        }

        #endregion Private methods
    }
}
