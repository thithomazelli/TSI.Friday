using AutoMapper;
using Microsoft.EntityFrameworkCore;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class TransactionService : ITransactionService
    {
        #region Properties

        /// <summary>
        /// Repository object created to access the Transaction registers on database using EntityFramework.
        /// </summary>
        private readonly IRepository<Transaction> _repository;
        private readonly IRepository<Payment> _paymentRepository;
        private readonly IMapper _mapper;
        private readonly IFeatureToggleService _featureToggleService;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        /// <summary>
        /// TransactionService constructor created to initialize the "_repository" using Dependency Injection.
        /// </summary>
        /// <param name="repository">IRepository<Transaction> object used to initialize the internal variable using Dependency Injection.</param>
        public TransactionService(
            IRepository<Transaction> repository,
            IRepository<Payment> paymentRepository,
            IMapper mapper,
            IFeatureToggleService featureToggleService,
            ILogService logService
        )
        {
            _repository = repository;
            _paymentRepository = paymentRepository;
            _mapper = mapper;
            _featureToggleService = featureToggleService;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TransactionDto>> Add(TransactionDto transactionDto)
        {
            WebApiResponse<TransactionDto> result = new();

            try
            {
                var transactionEntity = _mapper.Map<Transaction>(transactionDto);
                CreatePayments(transactionEntity, transactionDto);

                await _repository.AddAsync(transactionEntity);

                result.Data = _mapper.Map<TransactionDto>(transactionEntity);
                result.Status = ResponseStatus.Success;
                result.Message = $"Transação {transactionDto.Description} cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TransactionService.Add", transactionDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o Transação {transactionDto?.Description} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TransactionDto>> Update(TransactionDto transactionDto)
        {
            WebApiResponse<TransactionDto> result = new();

            try
            {
                // Load tracked transaction with payments from DB
                var transactionEntity = await _repository.GetByIdAsync(
                    transactionDto.Id,
                    p => p.Payments
                );
                if (transactionEntity == null)
                {
                    var message = $"Transação com Id {transactionDto.Id} não encontrado.";
                    _logService.LogException(
                        new Exception(message),
                        "TransactionService.Update",
                        transactionDto
                    );
                    result.Status = ResponseStatus.Error;
                    result.Message = message;
                    return result;
                }

                // Map scalar fields (do not replace collection instance)
                _mapper.Map(transactionDto, transactionEntity);

                // Update payments statuses if requested (except already approved)
                if (transactionDto.MarkAllPaymentsAsApproved)
                {
                    // Bulk update payments for this transaction to Approved (skip already approved)
                    await _paymentRepository.ExecuteUpdateAsync(
                        p =>
                            p.TransactionId == transactionEntity.Id
                            && p.Status != PaymentStatus.Approved,
                        p => p.Status = PaymentStatus.Approved
                    );
                }

                await _repository.UpdateAsync(transactionEntity);

                // Map scalar fields (do not replace collection instance)
                _mapper.Map(transactionDto, transactionEntity);

                result.Data = transactionDto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Transação {transactionDto.Description} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TransactionService.Update", transactionDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do Transação {transactionDto?.Description} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TransactionDto>> UpdateOrderId(
            TransactionDto transactionDto
        )
        {
            WebApiResponse<TransactionDto> result = new();

            try
            {
                // Load tracked transaction with payments from DB
                var transactionEntity = await _repository.GetByIdAsync(
                    transactionDto.Id,
                    p => p.Payments
                );
                if (transactionEntity == null)
                {
                    var message = $"Transação com Id {transactionDto.Id} não encontrado.";
                    _logService.LogException(
                        new Exception(message),
                        "TransactionService.UpdateOrderId",
                        transactionDto
                    );
                    result.Status = ResponseStatus.Error;
                    result.Message = message;
                    return result;
                }

                // Map scalar fields (do not replace collection instance)
                _mapper.Map(transactionDto, transactionEntity);

                // Update payments statuses if requested (except already approved)
                foreach (var payments in transactionEntity.Payments)
                {
                    payments.OrderId = transactionDto.OrderId;
                }

                await _repository.UpdateAsync(transactionEntity);

                result.Data = _mapper.Map<TransactionDto>(transactionEntity);
                result.Status = ResponseStatus.Success;
                result.Message = $"Transação {transactionDto.Description} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TransactionService.UpdateOrderId", transactionDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do Transação {transactionDto?.Description} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TransactionDto>> UpdatePurchaseOrderId(
            TransactionDto transactionDto
        )
        {
            WebApiResponse<TransactionDto> result = new();

            try
            {
                // Load tracked transaction with payments from DB
                var transactionEntity = await _repository.GetByIdAsync(
                    transactionDto.Id,
                    p => p.Payments
                );
                if (transactionEntity == null)
                {
                    var message = $"Transação com Id {transactionDto.Id} não encontrado.";
                    _logService.LogException(
                        new Exception(message),
                        "TransactionService.UpdatePurchaseOrderId",
                        transactionDto
                    );
                    result.Status = ResponseStatus.Error;
                    result.Message = message;
                    return result;
                }

                // Map scalar fields (do not replace collection instance)
                _mapper.Map(transactionDto, transactionEntity);

                foreach (var payments in transactionEntity.Payments)
                {
                    payments.PurchaseOrderId = transactionDto.PurchaseOrderId;
                }

                await _repository.UpdateAsync(transactionEntity);

                result.Data = _mapper.Map<TransactionDto>(transactionEntity);
                result.Status = ResponseStatus.Success;
                result.Message = $"Transação {transactionDto.Description} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "TransactionService.UpdatePurchaseOrderId",
                    transactionDto
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do Transação {transactionDto?.Description} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TransactionDto>> UpdateTripId(
            TransactionDto transactionDto
        )
        {
            WebApiResponse<TransactionDto> result = new();

            try
            {
                // Load tracked transaction with payments from DB
                var transactionEntity = await _repository.GetByIdAsync(
                    transactionDto.Id,
                    p => p.Payments
                );
                if (transactionEntity == null)
                {
                    var message = $"Transação com Id {transactionDto.Id} não encontrado.";
                    _logService.LogException(
                        new Exception(message),
                        "TransactionService.UpdateTripId",
                        transactionDto
                    );
                    result.Status = ResponseStatus.Error;
                    result.Message = message;
                    return result;
                }

                // Map scalar fields (do not replace collection instance)
                _mapper.Map(transactionDto, transactionEntity);

                // Update payments statuses if requested (except already approved)
                foreach (var payments in transactionEntity.Payments)
                {
                    payments.TripId = transactionDto.TripId;
                }

                await _repository.UpdateAsync(transactionEntity);

                result.Data = _mapper.Map<TransactionDto>(transactionEntity);
                result.Status = ResponseStatus.Success;
                result.Message = $"Transação {transactionDto.Description} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TransactionService.UpdateTripId", transactionDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do Transação {transactionDto?.Description} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TransactionDto>> Remove(TransactionDto transactionDto)
        {
            WebApiResponse<TransactionDto> result = new();

            try
            {
                // Load tracked entity from the DB to avoid tracking conflicts
                var transactionEntity = await _repository.GetByIdAsync(transactionDto.Id);
                if (transactionEntity == null)
                {
                    var message = $"Transação com Id {transactionDto.Id} não encontrado.";
                    _logService.LogException(
                        new Exception(message),
                        "TransactionService.Remove",
                        transactionDto
                    );
                    result.Status = ResponseStatus.Error;
                    result.Message = message;
                    return result;
                }

                await _repository.RemoveAsync(transactionEntity);

                result.Data = transactionDto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Transação {transactionDto.Description} removido com sucesso.";
            }
            catch (DbUpdateException ex)
            {
                _logService.LogException(ex, "TransactionService.Remove", transactionDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o Transação {transactionDto?.Description}. Existe um pedido de vendas vinculado.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TransactionService.Remove", transactionDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o Transação {transactionDto?.Description} da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<TransactionDto>>> FindAll()
        {
            WebApiResponse<IEnumerable<TransactionDto>> result = new();

            try
            {
                if (
                    !await _featureToggleService.IsEnabledAsync(
                        FeatureToggleKeys.Transaction,
                        FeatureToggleKeys.FinanceModule
                    )
                )
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                var transactions = await _repository.GetAllAsync(
                    true,
                    c => c.BusinessPartner,
                    o => o.Order,
                    p => p.Payments
                );

                var transactionDtos = transactions
                    .Select(p =>
                    {
                        var dto = _mapper.Map<TransactionDto>(p);
                        var price = ComputePriceFromPayments(p.Payments);
                        var status = ComputeStatusFromPayments(p.Payments);
                        dto.PaymentTotalPrice = price;
                        dto.Status = status;
                        return dto;
                    })
                    .ToList();

                result.Data = transactionDtos;
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TransactionService.FindAll", null);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Transaçãos na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<TransactionDto>> FindById(Guid? id)
        {
            WebApiResponse<TransactionDto> result = new();

            try
            {
                if (
                    !await _featureToggleService.IsEnabledAsync(
                        FeatureToggleKeys.Transaction,
                        FeatureToggleKeys.FinanceModule
                    )
                )
                {
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhuma Transação com o ID {id} foi encontrada";
                    return result;
                }

                var transaction = await _repository.GetByIdAsync(
                    id,
                    true,
                    c => c.BusinessPartner,
                    o => o.Order,
                    p => p.Payments
                );

                if (transaction == null)
                {
                    var message = $"Transação com Id {id} não encontrado.";
                    _logService.LogException(
                        new Exception(message),
                        "TransactionService.FindById",
                        id
                    );
                    result.Status = ResponseStatus.Error;
                    result.Message = message;
                    return result;
                }

                var dto = _mapper.Map<TransactionDto>(transaction);
                var paymentTotalPrice = ComputePriceFromPayments(transaction.Payments);
                var expenseTotalPrice = ComputePriceFromExpenses(transaction.Payments);
                var status = ComputeStatusFromPayments(transaction.Payments);
                dto.PaymentTotalPrice = paymentTotalPrice;
                dto.ExpenseTotalPrice = expenseTotalPrice;
                dto.Status = status;

                result.Data = dto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Transação {result.Data.Description} encontrado com sucesso"
                        : $"Nenhum Transação com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "TransactionService.FindById", id);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Transaçãos na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<TransactionDto>>> FindByBusinessPartnerId(
            Guid? businessPartnerId
        )
        {
            WebApiResponse<IEnumerable<TransactionDto>> result = new();

            try
            {
                var transactions = await _repository.QueryAsync(
                    p => p.BusinessPartnerId == businessPartnerId,
                    true,
                    c => c.BusinessPartner,
                    o => o.Order,
                    p => p.Payments
                );
                var transactionDtos = transactions
                    .Select(p =>
                    {
                        var dto = _mapper.Map<TransactionDto>(p);
                        var paymentTotalPrice = ComputePriceFromPayments(p.Payments);
                        var expenseTotalPrice = ComputePriceFromExpenses(p.Payments);
                        var status = ComputeStatusFromPayments(p.Payments);
                        dto.PaymentTotalPrice = paymentTotalPrice;
                        dto.ExpenseTotalPrice = expenseTotalPrice;
                        dto.Status = status;
                        return dto;
                    })
                    .ToList();

                result.Data = transactionDtos;
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "TransactionService.FindByBusinessPartnerId",
                    businessPartnerId
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Transaçãos do BusinessPartner {businessPartnerId}.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        /// <summary>
        /// Create the payments for a given TransactionDto based on its TotalOfPayments property
        /// and add them to the Payments collection of the TransactionDto.
        /// </summary>
        /// <param name="transaction">TransactionDto object</param>
        private static void CreatePayments(
            Transaction transactionEntity,
            TransactionDto transactionDto
        )
        {
            for (var i = 1; i <= (transactionDto.TotalOfPayments); i++)
            {
                var originalDate = transactionDto.Date;
                var nextMonth = originalDate.AddMonths(i - 1);
                var payment = new Payment
                {
                    Type = PaymentType.Incoming,
                    Status = transactionDto.Status,
                    Condition = transactionDto.Condition,
                    Method = transactionDto.Method,
                    Date = i == 1 ? originalDate : nextMonth,
                    Description =
                        $"{transactionDto.Description} - {i}/{transactionDto.TotalOfPayments}",
                    PaymentNumber = i,
                    Price =
                        transactionDto.PaymentTotalPrice != 0 && transactionDto.TotalOfPayments > 0
                            ? transactionDto.PaymentTotalPrice / transactionDto.TotalOfPayments
                            : transactionDto.PaymentTotalPrice,
                    OrderId = transactionDto.OrderId,
                    BusinessPartnerId = transactionDto.BusinessPartnerId,
                    TransactionId = transactionEntity.Id,
                    Transaction = transactionEntity,
                };

                if (
                    payment.Status != PaymentStatus.Approved
                    && payment.Date.ToUniversalTime().Date < DateTime.UtcNow.Date
                )
                {
                    payment.Status = PaymentStatus.Delayed;
                }

                transactionEntity.Payments.Add(payment);
            }

            for (var i = 1; i <= (transactionDto.TotalOfExpenses); i++)
            {
                var originalDate = transactionDto.Date;
                var nextMonth = originalDate.AddMonths(i - 1);
                var payment = new Payment
                {
                    Type = PaymentType.Outgoing,
                    Status = transactionDto.Status,
                    Condition = transactionDto.Condition,
                    Method = transactionDto.Method,
                    Date = i == 1 ? originalDate : nextMonth,
                    Description =
                        $"{transactionDto.Description} - {i}/{transactionDto.TotalOfExpenses}",
                    PaymentNumber = i,
                    Price =
                        transactionDto.ExpenseTotalPrice != 0 && transactionDto.TotalOfExpenses > 0
                            ? transactionDto.ExpenseTotalPrice / transactionDto.TotalOfExpenses
                            : transactionDto.ExpenseTotalPrice,
                    OrderId = transactionDto.OrderId,
                    BusinessPartnerId = transactionDto.BusinessPartnerId,
                    TransactionId = transactionEntity.Id,
                    Transaction = transactionEntity,
                };

                if (
                    payment.Status != PaymentStatus.Approved
                    && payment.Date.ToUniversalTime().Date < DateTime.UtcNow.Date
                )
                {
                    payment.Status = PaymentStatus.Delayed;
                }

                transactionEntity.Payments.Add(payment);
            }
        }

        /// <summary>
        /// Computes the total price from a collection of transaction payments.
        /// </summary>
        /// <param name="payments">Payments object</param>
        /// <returns>The total price calculated from the payments</returns>
        private static decimal ComputePriceFromPayments(IEnumerable<Payment>? payments)
        {
            var list = payments?.ToList() ?? new List<Payment>();
            return list.Sum(i => PaymentType.Incoming.Equals(i.Type) ? i.Price : 0m);
        }

        /// <summary>
        /// Computes the total price from a collection of transaction payments.
        /// </summary>
        /// <param name="payments">Payments object</param>
        /// <returns>The total price calculated from the payments</returns>
        private static decimal ComputePriceFromExpenses(IEnumerable<Payment>? payments)
        {
            var list = payments?.ToList() ?? new List<Payment>();
            return list.Sum(i => PaymentType.Outgoing.Equals(i.Type) ? i.Price : 0m);
        }

        /// <summary>
        /// Computes the status from a collection of transaction payments.
        /// </summary>
        /// <param name="payments">Payments object</param>
        /// <returns>The status calculated from the payments</returns>
        private static PaymentStatus ComputeStatusFromPayments(IEnumerable<Payment>? payments)
        {
            var list = payments?.ToList() ?? [];

            if (!list.Any())
            {
                return PaymentStatus.Pending;
            }

            if (list.All(i => i.Status == PaymentStatus.Approved))
            {
                return PaymentStatus.Approved;
            }

            var pendingPayments = list.Where(i => i.Status != PaymentStatus.Approved).ToList();
            if (pendingPayments.Any())
            {
                var today = DateTime.UtcNow.Date;
                var anyOverdue = pendingPayments.Any(pi => pi.Date.ToUniversalTime().Date < today);
                return anyOverdue ? PaymentStatus.Delayed : PaymentStatus.Pending;
            }

            if (list.Any(i => i.Status == PaymentStatus.Delayed))
            {
                return PaymentStatus.Delayed;
            }

            return PaymentStatus.Pending;
        }

        #endregion Public methods
    }
}
