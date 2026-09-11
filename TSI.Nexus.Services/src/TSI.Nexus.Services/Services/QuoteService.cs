using System;
using System.Collections.Generic;
using System.Linq;
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
    public class QuoteService : IQuoteService
    {
        #region Properties

        private readonly IRepository<Quote> _repository;
        private readonly IRepository<QuoteTrip> _quoteTripRepository;
        private readonly ISequenceService _sequenceService;
        private readonly IMapper _mapper;
        private readonly ILogService _logService;
        private readonly IRepository<Product> _productRepository;
        private readonly IOrderService _orderService;
        private readonly ITripService _tripService;
        private readonly IFeatureToggleService _featureToggleService;
        #endregion Properties

        #region Public methods

        public QuoteService(
            IRepository<Quote> repository,
            IRepository<QuoteTrip> quoteTripRepository,
            ISequenceService sequenceService,
            IMapper mapper,
            ILogService logService,
            IRepository<Product> productRepository,
            IOrderService orderService,
            ITripService tripService,
            IFeatureToggleService featureToggleService
        )
        {
            _repository = repository;
            _quoteTripRepository = quoteTripRepository;
            _sequenceService = sequenceService;
            _mapper = mapper;
            _logService = logService;
            _productRepository = productRepository;
            _orderService = orderService;
            _tripService = tripService;
            _featureToggleService = featureToggleService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<QuoteDto>> Add(QuoteDto quoteDto)
        {
            WebApiResponse<QuoteDto> result = new();

            try
            {
                var prefix = BusinessPartnerPrefixGenerator.BuildPrefixFromBusinessPartnerName(quoteDto.BusinessPartnerName);
                var next = await _sequenceService.GetNextValue("QuoteNumberSeq");
                quoteDto.QuoteNumber = $"{prefix}-Q{next:D5}";
                quoteDto.Description = string.IsNullOrEmpty(quoteDto.Description)
                    ? $"Orçamento - {quoteDto.QuoteNumber}"
                    : quoteDto.Description;

                var entity = _mapper.Map<Quote>(quoteDto);
                await _repository.AddAsync(entity);

                if (quoteDto.Type == QuoteType.Trip && quoteDto.QuoteTrip != null)
                {
                    var quoteTripEntity = _mapper.Map<QuoteTrip>(quoteDto.QuoteTrip);
                    quoteTripEntity.QuoteId = entity.Id;
                    await _quoteTripRepository.AddAsync(quoteTripEntity);
                    entity.QuoteTrip = quoteTripEntity;
                }

                var responseDto = _mapper.Map<QuoteDto>(entity);

                result.Data = responseDto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Orçamento {quoteDto.QuoteNumber} cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteService.Add", quoteDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o Orçamento {quoteDto?.QuoteNumber} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<QuoteDto>> Update(QuoteDto quoteDto)
        {
            WebApiResponse<QuoteDto> result = new();

            try
            {
                var entity = _mapper.Map<Quote>(quoteDto);
                await _repository.UpdateAsync(entity);

                if (quoteDto.Type == QuoteType.Trip && quoteDto.QuoteTrip != null)
                {
                    var existingQuoteTrip = await _quoteTripRepository.FirstOrDefaultAsync(qt =>
                        qt.QuoteId == entity.Id
                    );

                    if (existingQuoteTrip != null)
                    {
                        var updatedQuoteTrip = _mapper.Map(quoteDto.QuoteTrip, existingQuoteTrip);
                        updatedQuoteTrip.QuoteId = entity.Id;
                        await _quoteTripRepository.UpdateAsync(updatedQuoteTrip);
                        entity.QuoteTrip = updatedQuoteTrip;
                    }
                    else
                    {
                        var newQuoteTrip = _mapper.Map<QuoteTrip>(quoteDto.QuoteTrip);
                        newQuoteTrip.QuoteId = entity.Id;
                        await _quoteTripRepository.AddAsync(newQuoteTrip);
                        entity.QuoteTrip = newQuoteTrip;
                    }
                }

                result.Data = _mapper.Map<QuoteDto>(entity);
                result.Status = ResponseStatus.Success;
                result.Message = $"Orçamento {quoteDto.QuoteNumber} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteService.Update", quoteDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do Orçamento {quoteDto?.QuoteNumber} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<QuoteDto>> Remove(QuoteDto quoteDto)
        {
            WebApiResponse<QuoteDto> result = new();

            try
            {
                var entity = await _repository.GetByIdAsync(quoteDto.Id, q => q.QuoteProducts);

                if (entity == null)
                {
                    _logService.LogException(
                        new Exception($"Orçamento {quoteDto.QuoteNumber} não encontrado."),
                        "QuoteService.Remove",
                        quoteDto
                    );
                    result.Data = null;
                    result.Status = ResponseStatus.Error;
                    result.Message = $"Orçamento {quoteDto.QuoteNumber} não encontrado.";
                    return result;
                }

                await _repository.RemoveAsync(entity);

                result.Data = quoteDto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Orçamento {quoteDto.QuoteNumber} removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteService.Remove", quoteDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o Orçamento {quoteDto?.QuoteNumber} da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<QuoteDto>>> FindAll()
        {
            WebApiResponse<IEnumerable<QuoteDto>> result = new();

            try
            {
                // asNoTracking: true - this is a pure list/grid read, never saved back.
                var quotes = await _repository.GetAllAsync(
                    true,
                    q => q.BusinessPartner,
                    q => q.QuoteProducts,
                    q => q.QuoteTrip.Vehicle,
                    q => q.QuoteTrip.Driver
                );

                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.FleetModule))
                {
                    quotes = quotes.Where(q => q.Type != QuoteType.Trip).ToList();
                }

                if (
                    !await _featureToggleService.IsEnabledAsync(
                        FeatureToggleKeys.Quote,
                        FeatureToggleKeys.QuotesModule
                    )
                )
                {
                    quotes = quotes.Where(q => q.Type != QuoteType.Product).ToList();
                }

                result.Data = _mapper.Map<IEnumerable<QuoteDto>>(quotes);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteService.FindAll", null);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Orçamentos na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        /// <inheritdoc />
        public async Task<WebApiResponse<PagedResult<QuoteDto>>> FindAllPaged(PagedRequest request)
        {
            WebApiResponse<PagedResult<QuoteDto>> result = new();

            try
            {
                var fleetModuleEnabled = await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.FleetModule);
                var quotesModuleEnabled = await _featureToggleService.IsEnabledAsync(
                    FeatureToggleKeys.Quote,
                    FeatureToggleKeys.QuotesModule
                );

                var filter = BuildFilter(request, fleetModuleEnabled, quotesModuleEnabled);
                var orderBy = BuildOrderBy(request);

                var (quotes, totalCount) = await _repository.GetPagedAsync(
                    skip: (Math.Max(request.Page, 1) - 1) * Math.Max(request.PageSize, 1),
                    take: Math.Max(request.PageSize, 1),
                    filter: filter,
                    orderBy: orderBy,
                    asNoTracking: true,
                    includes: [q => q.BusinessPartner]
                );

                result.Data = new PagedResult<QuoteDto>
                {
                    Items = _mapper.Map<IEnumerable<QuoteDto>>(quotes),
                    TotalCount = totalCount,
                };
                result.Status = ResponseStatus.Success;
                result.Message = $"{totalCount} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteService.FindAllPaged", request);
                result.Status = ResponseStatus.Error;
                result.Message = "Não foi possível acessar os registros de Orçamentos na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<QuoteDto>> FindById(Guid? id)
        {
            WebApiResponse<QuoteDto> result = new();

            try
            {
                var quote = await _repository.GetByIdAsync(
                    id,
                    q => q.BusinessPartner,
                    q => q.QuoteProducts,
                    q => q.QuoteTrip.Vehicle,
                    q => q.QuoteTrip.Driver
                );

                if (
                    quote?.Type == QuoteType.Trip
                    && !await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.FleetModule)
                )
                {
                    quote = null;
                }

                if (
                    quote?.Type == QuoteType.Product
                    && !await _featureToggleService.IsEnabledAsync(
                        FeatureToggleKeys.Quote,
                        FeatureToggleKeys.QuotesModule
                    )
                )
                {
                    quote = null;
                }

                result.Data = _mapper.Map<QuoteDto>(quote);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Orçamento {result.Data.QuoteNumber} encontrado com sucesso"
                        : $"Nenhum Orçamento com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteService.FindById", id);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Orçamentos na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<QuoteDto>> FindByQuoteNumber(string quoteNumber)
        {
            WebApiResponse<QuoteDto> result = new();

            try
            {
                var quote = await _repository.FirstOrDefaultAsync(
                    q => q.QuoteNumber == quoteNumber,
                    q => q.BusinessPartner
                );

                if (
                    quote?.Type == QuoteType.Trip
                    && !await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.FleetModule)
                )
                {
                    quote = null;
                }

                if (
                    quote?.Type == QuoteType.Product
                    && !await _featureToggleService.IsEnabledAsync(
                        FeatureToggleKeys.Quote,
                        FeatureToggleKeys.QuotesModule
                    )
                )
                {
                    quote = null;
                }

                result.Data = _mapper.Map<QuoteDto>(quote);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Orçamento {result.Data.QuoteNumber} encontrado com sucesso"
                        : $"Nenhum Orçamento com o número {quoteNumber} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteService.FindByQuoteNumber", quoteNumber);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível buscar o Orçamento pelo número {quoteNumber}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<QuoteDto>>> FindByBusinessPartnerId(
            Guid? businessPartnerId
        )
        {
            WebApiResponse<IEnumerable<QuoteDto>> result = new();

            try
            {
                var quotes = await _repository.QueryAsync(q =>
                    q.BusinessPartnerId == businessPartnerId
                );

                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.FleetModule))
                {
                    quotes = quotes.Where(q => q.Type != QuoteType.Trip).ToList();
                }

                if (
                    !await _featureToggleService.IsEnabledAsync(
                        FeatureToggleKeys.Quote,
                        FeatureToggleKeys.QuotesModule
                    )
                )
                {
                    quotes = quotes.Where(q => q.Type != QuoteType.Product).ToList();
                }

                result.Data = _mapper.Map<IEnumerable<QuoteDto>>(quotes);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "QuoteService.FindByBusinessPartnerId",
                    businessPartnerId
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Orçamentos do BusinessPartner {businessPartnerId}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<QuoteDto>>> FindByProductId(Guid? productId)
        {
            WebApiResponse<IEnumerable<QuoteDto>> result = new();

            try
            {
                var quotes = await _repository.QueryAsync(q =>
                    q.QuoteProducts.Any(qp => qp.ProductId == productId)
                );

                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.FleetModule))
                {
                    quotes = quotes.Where(q => q.Type != QuoteType.Trip).ToList();
                }

                if (
                    !await _featureToggleService.IsEnabledAsync(
                        FeatureToggleKeys.Quote,
                        FeatureToggleKeys.QuotesModule
                    )
                )
                {
                    quotes = quotes.Where(q => q.Type != QuoteType.Product).ToList();
                }

                result.Data = _mapper.Map<IEnumerable<QuoteDto>>(quotes);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteService.FindByProductId", productId);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Orçamentos relacionados ao Produto {productId}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<QuoteDto>> ConvertToOrder(QuoteDto quoteDto)
        {
            var result = new WebApiResponse<QuoteDto>();

            try
            {
                if (quoteDto == null)
                {
                    result.Status = ResponseStatus.Error;
                    result.Message = "Quote inválido.";
                    return result;
                }

                var outOfStock = new List<string>();
                var outOfStockIds = new HashSet<Guid>();

                // Batches the stock check into a single query instead of one GetByIdAsync per
                // line item - a quote with many products used to cost N round-trips here.
                var stockCheckProductIds = (
                    quoteDto.QuoteProducts ?? Enumerable.Empty<QuoteProductDto>()
                )
                    .Where(item =>
                        item.ProductType == ProductType.Sale
                        || item.ProductType == ProductType.Rental
                    )
                    .Select(item => item.ProductId)
                    .Distinct()
                    .ToList();

                var productsById = stockCheckProductIds.Count > 0
                    ? (
                        await _productRepository.QueryAsync(
                            p => stockCheckProductIds.Contains(p.Id),
                            true
                        )
                    ).ToDictionary(p => p.Id)
                    : new Dictionary<Guid, Product>();

                foreach (var item in quoteDto.QuoteProducts ?? Enumerable.Empty<QuoteProductDto>())
                {
                    if (
                        item.ProductType == ProductType.Sale
                        || item.ProductType == ProductType.Rental
                    )
                    {
                        productsById.TryGetValue(item.ProductId, out var product);
                        var available = product?.QuantityInStock ?? 0;
                        if (item.Quantity > available)
                        {
                            outOfStock.Add(
                                $"{product?.Name ?? product?.Sku} (necessário {item.Quantity}, disponível {available})"
                            );
                            outOfStockIds.Add(item.ProductId);
                        }
                    }
                }

                // Prepare filtered quote products for possible warning response
                var filteredQuoteProducts =
                    quoteDto
                        .QuoteProducts?.Where(qp => !outOfStockIds.Contains(qp.ProductId))
                        .ToList()
                    ?? new List<QuoteProductDto>();

                // Map all QuoteProducts -> OrderProductDtos
                var allOrderProducts =
                    quoteDto
                        .QuoteProducts?.Select(qp => new OrderProductDto
                        {
                            ProductId = qp.ProductId,
                            ProductName = qp.ProductName,
                            ProductSku = qp.ProductSku,
                            Quantity = qp.Quantity,
                            PreviousQuantity = qp.PreviousQuantity,
                            Discount = qp.Discount,
                            Price = qp.Price,
                            TotalPrice = qp.TotalPrice,
                            ProductType = qp.ProductType,
                            BusinessPartnerId = quoteDto.BusinessPartnerId,
                            BusinessPartnerName = quoteDto.BusinessPartnerName,
                        })
                        .ToList()
                    ?? new List<OrderProductDto>();

                // Build filtered list excluding out-of-stock items
                var filteredOrderProducts = allOrderProducts
                    .Where(op => !outOfStockIds.Contains(op.ProductId))
                    .ToList();

                // Map QuoteDto -> OrderDto (use filtered products)
                var orderDto = new OrderDto
                {
                    BusinessPartnerId = quoteDto.BusinessPartnerId,
                    BusinessPartnerName = quoteDto.BusinessPartnerName,
                    Date = DateTime.UtcNow,
                    Description = quoteDto.Description,
                    Discount = quoteDto.Discount,
                    Price = quoteDto.Price,
                    TotalPrice = quoteDto.TotalPrice,
                    QuoteId = quoteDto.Id,
                    QuoteNumber = quoteDto.QuoteNumber,
                    OrderProducts = filteredOrderProducts,
                };

                if (
                    quoteDto.TotalOfPayments > 0
                    || quoteDto.PaymentTotalPrice > 0m
                    || quoteDto.TotalOfExpenses > 0
                    || quoteDto.ExpenseTotalPrice > 0m
                )
                {
                    var transactionDto = new TransactionDto
                    {
                        Date = DateTime.UtcNow,
                        Description =
                            $"Transação do Pedido a partir do Orçamento {quoteDto.QuoteNumber}",
                        Status = PaymentStatus.Pending,
                        TotalOfPayments = quoteDto.TotalOfPayments,
                        PaymentTotalPrice = quoteDto.PaymentTotalPrice,
                        TotalOfExpenses = quoteDto.TotalOfExpenses,
                        ExpenseTotalPrice = quoteDto.ExpenseTotalPrice,
                        Condition = quoteDto.Condition,
                        Method = quoteDto.Method,
                        BusinessPartnerId = quoteDto.BusinessPartnerId,
                        OrderNumber = orderDto.QuoteNumber,
                        Type = PaymentType.Incoming,
                    };

                    orderDto.Transaction = transactionDto;
                }

                // If there are out of stock items, return a warning and include the filtered QuoteDto in Data (unless none remain)
                if (outOfStock.Any())
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message =
                        "Alguns produtos não possuem quantidade suficiente em estoque: "
                        + string.Join(", ", outOfStock)
                        + ". Deseja prosseguir sem eles?";

                    if (filteredQuoteProducts.Any())
                    {
                        var quoteForResponse = _mapper.Map<QuoteDto>(quoteDto);
                        quoteForResponse.QuoteProducts = filteredQuoteProducts;
                        result.Data = quoteForResponse;
                    }
                    else
                    {
                        result.Data = null;
                    }

                    return result;
                }

                // Call OrderService.Add
                var addResult = await _orderService.Add(orderDto);

                // set quote status to Converted and update repository
                var quoteEntity = await _repository.GetByIdAsync(quoteDto.Id, q => q.QuoteProducts);
                if (quoteEntity != null)
                {
                    quoteEntity.Status = QuoteStatus.Converted;
                    await _repository.UpdateAsync(quoteEntity);
                }

                // Prepare response using the updated quote entity
                var response = new WebApiResponse<QuoteDto>
                {
                    Data = _mapper.Map<QuoteDto>(quoteEntity ?? _mapper.Map<Quote>(quoteDto)),
                    Status = ResponseStatus.Success,
                    Message = "Orçamento convertido com sucesso",
                };

                return response;
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteService.ConvertToOrder", quoteDto);
                result.Status = ResponseStatus.Error;
                result.Message = "Erro ao converter orçamento para pedido.";
                return result;
            }
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<QuoteDto>> ConvertToTrip(QuoteDto quoteDto)
        {
            var result = new WebApiResponse<QuoteDto>();

            try
            {
                if (quoteDto == null)
                {
                    result.Status = ResponseStatus.Error;
                    result.Message = "Orçamento inválido.";
                    return result;
                }

                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.FleetModule))
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message =
                        "Não é possível converter em Viagem: o módulo de Frota está desabilitado.";
                    return result;
                }

                var tripDto = new TripDto
                {
                    BusinessPartnerId = quoteDto.BusinessPartnerId,
                    BusinessPartnerName = quoteDto.BusinessPartnerName,
                    Date = DateTime.UtcNow,
                    Discount = quoteDto.Discount,
                    Price = quoteDto.Price,
                    TotalPrice = quoteDto.TotalPrice,
                    QuoteNumber = quoteDto.QuoteNumber,
                };

                if (quoteDto.QuoteTrip != null)
                {
                    tripDto.Route = quoteDto.QuoteTrip.Route;
                    tripDto.DistanceKm = quoteDto.QuoteTrip.DistanceKm;
                    tripDto.DailyCount = quoteDto.QuoteTrip.DailyCount;
                    tripDto.TransportLicenseNumber = quoteDto.QuoteTrip.TransportLicenseNumber;
                    tripDto.TransportLicenseExpiryDate = quoteDto
                        .QuoteTrip
                        .TransportLicenseExpiryDate;
                    tripDto.VehicleId = quoteDto.QuoteTrip.VehicleId;
                    tripDto.DriverId = quoteDto.QuoteTrip.DriverId;
                }

                if (
                    quoteDto.TotalOfPayments > 0
                    || quoteDto.PaymentTotalPrice > 0m
                    || quoteDto.TotalOfExpenses > 0
                    || quoteDto.ExpenseTotalPrice > 0m
                )
                {
                    var transactionDto = new TransactionDto
                    {
                        Date = DateTime.UtcNow,
                        Description =
                            $"Transação da Viagem a partir do Orçamento {quoteDto.QuoteNumber}",
                        Status = PaymentStatus.Pending,
                        TotalOfPayments = quoteDto.TotalOfPayments,
                        PaymentTotalPrice = quoteDto.PaymentTotalPrice,
                        TotalOfExpenses = quoteDto.TotalOfExpenses,
                        ExpenseTotalPrice = quoteDto.ExpenseTotalPrice,
                        Condition = quoteDto.Condition,
                        Method = quoteDto.Method,
                        BusinessPartnerId = quoteDto.BusinessPartnerId,
                        TripNumber = tripDto.QuoteNumber,
                        Type = PaymentType.Incoming,
                    };

                    tripDto.Transaction = transactionDto;
                }

                await _tripService.Add(tripDto);

                // set quote status to Converted and update repository
                var quoteEntity = await _repository.GetByIdAsync(quoteDto.Id, q => q.QuoteProducts);
                if (quoteEntity != null)
                {
                    quoteEntity.Status = QuoteStatus.Converted;
                    await _repository.UpdateAsync(quoteEntity);
                }

                result.Data = _mapper.Map<QuoteDto>(quoteEntity ?? _mapper.Map<Quote>(quoteDto));
                result.Status = ResponseStatus.Success;
                result.Message = "Orçamento convertido em viagem com sucesso";

                return result;
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteService.ConvertToTrip", quoteDto);
                result.Status = ResponseStatus.Error;
                result.Message = "Erro ao converter orçamento para viagem.";
                return result;
            }
        }

        #endregion Public methods

        #region Private methods

        /// <summary>
        /// Known sort fields exposed by the Quotes grid, mapped to the Quote property they sort by.
        /// </summary>
        private static readonly Dictionary<string, Expression<Func<Quote, object>>> SortMap = new()
        {
            ["quoteNumber"] = q => q.QuoteNumber,
            ["type"] = q => q.Type,
            ["businessPartnerName"] = q => q.BusinessPartner.Name,
            ["description"] = q => q.Description,
            ["totalPrice"] = q => q.TotalPrice,
            ["date"] = q => q.Date,
            ["status"] = q => q.Status,
        };

        private static Func<IQueryable<Quote>, IOrderedQueryable<Quote>> BuildOrderBy(PagedRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.SortField) || !SortMap.TryGetValue(request.SortField, out var keySelector))
            {
                return null;
            }

            return request.SortDescending
                ? q => q.OrderByDescending(keySelector)
                : q => q.OrderBy(keySelector);
        }

        /// <summary>
        /// Combines the quick filter, the date-range filter and the status filter (the same panel
        /// the Quotes list already had client-side) with the two feature-toggle module gates
        /// FindAll() applies in-memory today - folded into the query here instead, so a disabled
        /// quote Type doesn't still count towards TotalCount or leak into a page.
        /// </summary>
        private static Expression<Func<Quote, bool>> BuildFilter(
            PagedRequest request,
            bool fleetModuleEnabled,
            bool quotesModuleEnabled
        )
        {
            var quickFilter = request.QuickFilter;
            var hasQuickFilter = !string.IsNullOrWhiteSpace(quickFilter);
            var startDate = request.StartDate?.Date;
            var endDate = request.EndDate?.Date;
            var statuses = EnumListParser.Parse<QuoteStatus>(request.Statuses);
            var hasStatusFilter = statuses.Count > 0;

            return q =>
                (fleetModuleEnabled || q.Type != QuoteType.Trip)
                && (quotesModuleEnabled || q.Type != QuoteType.Product)
                && (!hasQuickFilter
                    || q.QuoteNumber.Contains(quickFilter)
                    || q.Description.Contains(quickFilter)
                    || q.BusinessPartner.Name.Contains(quickFilter))
                && (startDate == null || q.CreateDate.Date >= startDate)
                && (endDate == null || q.CreateDate.Date <= endDate)
                && (!hasStatusFilter || statuses.Contains(q.Status));
        }

        #endregion Private methods
    }
}
