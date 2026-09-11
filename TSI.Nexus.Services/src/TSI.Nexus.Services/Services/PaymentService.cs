using System.Text.Json.Nodes;
using AutoMapper;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class PaymentService : IPaymentService
    {
        #region Properties

        /// <summary>
        /// Repository object created to access the Payment registers on database using EntityFramework.
        /// </summary>
        private readonly IRepository<Payment> _repository;
        private readonly IMapper _mapper;
        private readonly IFeatureToggleService _featureToggleService;
        private readonly ILogService _logService;
        private readonly string[] _monthNamesAbbr =
        {
            "Jan",
            "Fev",
            "Mar",
            "Abr",
            "Mai",
            "Jun",
            "Jul",
            "Ago",
            "Set",
            "Out",
            "Nov",
            "Dez",
        };
        private readonly string[] _monthNamesFull =
        {
            "Janeiro",
            "Fevereiro",
            "Março",
            "Abril",
            "Maio",
            "Junho",
            "Julho",
            "Agosto",
            "Setembro",
            "Outubro",
            "Novembro",
            "Dezembro",
        };

        #endregion Properties

        #region Public methods

        /// <summary>
        /// PaymentService constructor created to initialize the "_repository" using Dependency Injection.
        /// </summary>
        /// <param name="repository">IRepository<Payment> object used to initialize the internal variable using Dependency Injection.</param>
        public PaymentService(
            IRepository<Payment> repository,
            IMapper mapper,
            IFeatureToggleService featureToggleService,
            ILogService logService
        )
        {
            _repository = repository;
            _mapper = mapper;
            _featureToggleService = featureToggleService;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PaymentDto>> Add(PaymentDto paymentDto)
        {
            WebApiResponse<PaymentDto> result = new();

            try
            {
                UpdatePaymentStatusByDate(paymentDto);

                var paymentEntity = _mapper.Map<Payment>(paymentDto);
                await _repository.AddAsync(paymentEntity);

                result.Data = _mapper.Map<PaymentDto>(paymentEntity);
                result.Status = ResponseStatus.Success;
                result.Message = $"Pagamento {paymentDto.Description} cadastrada com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PaymentService.Add", paymentDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar a Pagamento {paymentDto?.Description} na base de dados. Erro: {ex.Message}";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PaymentDto>> Update(PaymentDto paymentDto)
        {
            WebApiResponse<PaymentDto> result = new();

            try
            {
                UpdatePaymentStatusByDate(paymentDto);

                var paymentEntity = _mapper.Map<Payment>(paymentDto);
                await _repository.UpdateAsync(paymentEntity);

                result.Data = _mapper.Map<PaymentDto>(paymentEntity);
                result.Status = ResponseStatus.Success;
                result.Message = $"Pagamento {paymentDto.Description} atualizada com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PaymentService.Update", paymentDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do pagamento {paymentDto?.Description} na base de dados. Erro: {ex.Message}";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PaymentDto>> Remove(PaymentDto paymentDto)
        {
            WebApiResponse<PaymentDto> result = new();

            try
            {
                var paymentEntity = _mapper.Map<Payment>(paymentDto);
                await _repository.RemoveAsync(paymentEntity);

                result.Data = paymentDto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Pagamento {paymentDto.Description} removida com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PaymentService.Remove", paymentDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover a Pagamento {paymentDto?.Description} da base de dados. Erro: {ex.Message}";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<PaymentDto>>> FindAll()
        {
            WebApiResponse<IEnumerable<PaymentDto>> result = new();

            try
            {
                if (
                    !await _featureToggleService.IsEnabledAsync(
                        FeatureToggleKeys.Payment,
                        FeatureToggleKeys.FinanceModule
                    )
                )
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                var payments = await _repository.GetAllAsync(
                    true,
                    t => t.Transaction,
                    c => c.BusinessPartner,
                    o => o.Order
                );
                result.Data = _mapper.Map<IEnumerable<PaymentDto>>(payments);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PaymentService.FindAll", null);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Pagamentos de Transação na base de dados. Erro: {ex.Message}";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PaymentDto>> FindById(Guid? id)
        {
            WebApiResponse<PaymentDto> result = new();

            try
            {
                if (
                    !await _featureToggleService.IsEnabledAsync(
                        FeatureToggleKeys.Payment,
                        FeatureToggleKeys.FinanceModule
                    )
                )
                {
                    result.Data = null;
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhuma Parcela de pagamento com o ID {id} foi encontrada";
                    return result;
                }

                var payment = await _repository.GetByIdAsync(id, true);
                result.Data = _mapper.Map<PaymentDto>(payment);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Pagamento {result.Data.Description} encontrada com sucesso"
                        : $"Nenhuma Parcela de pagamento com o ID {id} foi encontrada";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PaymentService.FindById", id);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Pagamentos de Transação na base de dados. Erro: {ex.Message}";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<PaymentDto>>> FindByTransactionId(
            Guid? transactionId
        )
        {
            WebApiResponse<IEnumerable<PaymentDto>> result = new();

            try
            {
                var payments = await _repository.QueryAsync(
                    p => p.TransactionId == transactionId,
                    true,
                    c => c.BusinessPartner,
                    o => o.Order,
                    t => t.Transaction
                );
                result.Data = _mapper.Map<IEnumerable<PaymentDto>>(payments).OrderBy(_ => _.Date);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PaymentService.FindByTransactionId", transactionId);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Pagamentos do Transação baseado no Transação {transactionId}. Erro: {ex.Message}";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<PaymentDto>>> FindByBusinessPartnerId(
            Guid? businessPartnerId
        )
        {
            WebApiResponse<IEnumerable<PaymentDto>> result = new();

            try
            {
                var payments = await _repository.QueryAsync(
                    p => p.BusinessPartnerId == businessPartnerId,
                    true,
                    c => c.BusinessPartner,
                    o => o.Order,
                    t => t.Transaction
                );
                result.Data = _mapper.Map<IEnumerable<PaymentDto>>(payments).OrderBy(_ => _.Date);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "PaymentService.FindByBusinessPartnerId",
                    businessPartnerId
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Pagamentos do Transação baseado no BusinessPartner {businessPartnerId}. Erro: {ex.Message}";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<PaymentDto>>> FindByOrderId(Guid? orderId)
        {
            WebApiResponse<IEnumerable<PaymentDto>> result = new();

            try
            {
                var payments = await _repository.QueryAsync(
                    p => p.OrderId == orderId,
                    true,
                    c => c.BusinessPartner,
                    o => o.Order,
                    t => t.Transaction
                );
                result.Data = _mapper.Map<IEnumerable<PaymentDto>>(payments).OrderBy(_ => _.Date);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PaymentService.FindByOrderId", orderId);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Pagamentos do Transação baseado no Pedido {orderId}. Erro: {ex.Message}";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<PaymentDto>>> FindByPurchaseOrderId(
            Guid? purchaseOrderId
        )
        {
            WebApiResponse<IEnumerable<PaymentDto>> result = new();

            try
            {
                var payments = await _repository.QueryAsync(
                    p => p.PurchaseOrderId == purchaseOrderId,
                    true,
                    c => c.BusinessPartner,
                    o => o.PurchaseOrder,
                    t => t.Transaction
                );
                result.Data = _mapper.Map<IEnumerable<PaymentDto>>(payments).OrderBy(_ => _.Date);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PaymentService.FindByPurchaseOrderId", purchaseOrderId);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Pagamentos do Transação baseado no Pedido de Compra {purchaseOrderId}. Erro: {ex.Message}";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<PaymentDto>>> FindByTripId(Guid? tripId)
        {
            WebApiResponse<IEnumerable<PaymentDto>> result = new();

            try
            {
                var payments = await _repository.QueryAsync(
                    p => p.TripId == tripId,
                    true,
                    c => c.BusinessPartner,
                    o => o.Trip,
                    t => t.Transaction
                );
                result.Data = _mapper.Map<IEnumerable<PaymentDto>>(payments).OrderBy(_ => _.Date);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PaymentService.FindByTripId", tripId);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Pagamentos do Transação baseado na Viagem {tripId}. Erro: {ex.Message}";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<PaymentDto>>> FindByDriverId(Guid? driverId)
        {
            WebApiResponse<IEnumerable<PaymentDto>> result = new();

            try
            {
                var payments = await _repository.QueryAsync(
                    p => p.DriverId == driverId,
                    true,
                    c => c.Driver,
                    o => o.Trip,
                    t => t.Transaction
                );
                result.Data = _mapper.Map<IEnumerable<PaymentDto>>(payments).OrderBy(_ => _.Date);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PaymentService.FindByDriverId", driverId);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Pagamentos do Motorista {driverId}. Erro: {ex.Message}";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<PaymentDto>>> FindDelayed()
        {
            WebApiResponse<IEnumerable<PaymentDto>> result = new();

            try
            {
                var todayUtc = DateTime.UtcNow.Date;
                var tomorrowUtc = todayUtc.AddDays(1);

                var payments = await _repository.QueryAsync(
                    t =>
                        t.Status == PaymentStatus.Delayed
                        || (
                            t.Status != PaymentStatus.Approved
                            && t.Date != default(DateTime)
                            && t.Date < tomorrowUtc
                        ),
                    true,
                    t => t.Transaction,
                    t => t.BusinessPartner,
                    t => t.Order
                );

                result.Data = _mapper.Map<IEnumerable<PaymentDto>>(payments).OrderBy(_ => _.Date);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PaymentService.FindDelayed", null);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Pagamentos de Transação na base de dados. Erro: {ex.Message}";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<JsonObject>> GetPaymentsHistory(
            DateTime? start = null,
            DateTime? end = null
        )
        {
            WebApiResponse<JsonObject> result = new();

            try
            {
                var payments = await _repository.GetAllAsync();

                // Determine period: if start/end provided use them (normalize to month start/end), otherwise last12 months
                DateTime now = DateTime.UtcNow.Date;
                DateTime firstOfCurrentMonth = new DateTime(now.Year, now.Month, 1);

                var months = Enumerable
                    .Range(0, 12)
                    .Select(i => firstOfCurrentMonth.AddMonths(i - 11))
                    .ToList();
                DateTime periodStart = months.First();
                DateTime periodEnd = firstOfCurrentMonth.AddMonths(1);

                if (start.HasValue && end.HasValue)
                {
                    // Normalize provided dates to month boundaries
                    var s = start.Value.ToUniversalTime();
                    var e = end.Value.ToUniversalTime();

                    periodStart = new DateTime(s.Year, s.Month, 1);
                    // periodEnd should be first day of month after 'end'
                    var endMonthFirst = new DateTime(e.Year, e.Month, 1);
                    periodEnd = endMonthFirst.AddMonths(1);

                    // Rebuild months list based on provided range (inclusive months)
                    var monthCount =
                        ((periodEnd.Year - periodStart.Year) * 12)
                        + periodEnd.Month
                        - periodStart.Month;
                    months = Enumerable
                        .Range(0, monthCount)
                        .Select(i => periodStart.AddMonths(i))
                        .ToList();
                }

                // filtra apenas o período relevante e normaliza datas para o primeiro dia do mês
                var filtered = payments
                    .Where(t =>
                    {
                        var dt = t.Date.ToUniversalTime();
                        return dt >= periodStart && dt < periodEnd;
                    })
                    .Select(t => new
                    {
                        t.Type,
                        Month = new DateTime(
                            t.Date.ToUniversalTime().Year,
                            t.Date.ToUniversalTime().Month,
                            1
                        ),
                        t.Price,
                    });

                // agrupa por (Type, Month) e soma preços
                var grouped = filtered
                    .GroupBy(x => (x.Type, x.Month))
                    .ToDictionary(g => g.Key, g => g.Sum(x => x.Price));

                // gera as arrays na ordem dos meses (sem foreach)
                var incomingNodes = months
                    .Select(m =>
                        (JsonNode)
                            JsonValue.Create(
                                grouped.TryGetValue((PaymentType.Incoming, m), out var v) ? v : 0m
                            )
                    )
                    .ToArray();
                var outgoingNodes = months
                    .Select(m =>
                        (JsonNode)
                            JsonValue.Create(
                                grouped.TryGetValue((PaymentType.Outgoing, m), out var v) ? v : 0m
                            )
                    )
                    .ToArray();

                var response = new JsonObject
                {
                    ["incoming"] = new JsonArray(incomingNodes),
                    ["outgoing"] = new JsonArray(outgoingNodes),
                    ["categories"] = BuildCategoriesJson(months),
                    ["monthsData"] = BuildMonthsDataJson(months),
                };

                result.Data = response;
                result.Status = ResponseStatus.Success;
                result.Message = "Histórico de pagamentos gerado com sucesso.";
            }
            catch (Exception ex)
            {
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os dados no banco de dados. Erro: {ex.Message}";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<JsonObject>> GetPaymentsGroupByCategory(
            PaymentType? type = null,
            DateTime? start = null,
            DateTime? end = null
        )
        {
            var result = new WebApiResponse<JsonObject>();
            try
            {
                // Determine period: default last12 months
                DateTime now = DateTime.UtcNow.Date;
                DateTime firstOfCurrentMonth = new DateTime(now.Year, now.Month, 1);

                var months = Enumerable
                    .Range(0, 12)
                    .Select(i => firstOfCurrentMonth.AddMonths(i - 11))
                    .ToList();
                DateTime periodStart = months.First();
                DateTime periodEnd = firstOfCurrentMonth.AddMonths(1);

                if (start.HasValue && end.HasValue)
                {
                    var s = start.Value.ToUniversalTime();
                    var e = end.Value.ToUniversalTime();
                    periodStart = new DateTime(s.Year, s.Month, 1);
                    var endMonthFirst = new DateTime(e.Year, e.Month, 1);
                    periodEnd = endMonthFirst.AddMonths(1);
                }

                // Load transactions with payments
                var payments = await _repository.GetAllAsync();

                // Filter transactions by type (if provided), then flatten payments and filter by period
                var filteredPayments = payments.AsEnumerable();
                if (type.HasValue)
                {
                    filteredPayments = filteredPayments.Where(t => t.Type == type.Value);
                }

                var paymentDataForCharts = filteredPayments
                    .Select(p => new
                    {
                        Category = string.IsNullOrWhiteSpace(p.Category) ? "" : p.Category,
                        Price = p.Price,
                        Date = p.Date.ToUniversalTime(),
                    })
                    .Where(p => p.Date >= periodStart && p.Date < periodEnd)
                    .ToList();

                // Group by category and sum prices
                var grouped = paymentDataForCharts
                    .GroupBy(p => p.Category)
                    .Select(g => new { Category = g.Key, Total = g.Sum(x => x.Price) })
                    .OrderByDescending(x => x.Total)
                    .ToList();

                // Build json object with category => totalPrice
                var response = new JsonObject();
                foreach (var g in grouped)
                {
                    // use empty string when category is null
                    response[g.Category ?? string.Empty] = JsonValue.Create(g.Total);
                }

                result.Data = response;
                result.Status = ResponseStatus.Success;
                result.Message = "Pagamentos agrupadas por categoria geradas com sucesso.";
            }
            catch (Exception ex)
            {
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Pagamentos na base de dados. Erro: {ex.Message}";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        private JsonArray BuildCategoriesJson(IList<DateTime> months)
        {
            var arr = months
                .Select(m => JsonValue.Create($"{_monthNamesAbbr[m.Month - 1]} {m.Year}"))
                .Cast<JsonNode>()
                .ToArray();
            return new JsonArray(arr);
        }

        private JsonArray BuildMonthsDataJson(IList<DateTime> months)
        {
            var nodes = months
                .Select(m =>
                {
                    var obj = new JsonObject
                    {
                        ["abbr"] = JsonValue.Create(_monthNamesAbbr[m.Month - 1]),
                        ["full"] = JsonValue.Create(_monthNamesFull[m.Month - 1]),
                        ["yyyy"] = JsonValue.Create(m.Year),
                    };
                    return (JsonNode)obj;
                })
                .ToArray();

            return new JsonArray(nodes);
        }

        /// <summary>
        /// Ensure the payment status is consistent with the payment date.
        /// If the payment date (UTC date only) is before today's UTC date, set the status to Delayed.
        /// This enforces business rule regardless of what the caller provided.
        /// </summary>
        /// <param name="paymentDto"></param>
        private static void UpdatePaymentStatusByDate(PaymentDto paymentDto)
        {
            if (paymentDto == null || paymentDto.Status == PaymentStatus.Approved)
            {
                return;
            }

            var paymentDateUtc = paymentDto.Date;
            if (paymentDto.Date != DateTime.UtcNow)
            {
                paymentDateUtc = paymentDto.Date.ToUniversalTime();
            }

            var todayUtcDate = DateTime.UtcNow.Date;

            if (paymentDateUtc.Date < todayUtcDate)
            {
                paymentDto.Status = PaymentStatus.Delayed;
            }
        }

        #endregion Private methods
    }
}
