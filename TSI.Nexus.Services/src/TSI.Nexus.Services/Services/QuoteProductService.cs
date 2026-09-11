using AutoMapper;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class QuoteProductService : IQuoteProductService
    {
        #region Properties

        private readonly IRepository<QuoteProduct> _repository;
        private readonly IRepository<Quote> _quoteRepository;
        private readonly IMapper _mapper;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        public QuoteProductService(
            IRepository<QuoteProduct> repository,
            IRepository<Quote> quoteRepository,
            IMapper mapper,
            ILogService logService
        )
        {
            _repository = repository;
            _quoteRepository = quoteRepository;
            _mapper = mapper;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<QuoteProductDto>> Add(QuoteProductDto quoteProductDto)
        {
            WebApiResponse<QuoteProductDto> result = new();

            try
            {
                var entity = _mapper.Map<QuoteProduct>(quoteProductDto);
                await _repository.AddAsync(entity);

                // Recalculate quote price
                await RecalculateAndUpdateQuoteAsync(entity.QuoteId);

                // AddAsync populates entity.Id (DB-generated); the incoming DTO still has
                // whatever Id it arrived with (Guid.Empty for a new record).
                quoteProductDto.Id = entity.Id;
                result.Data = quoteProductDto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Item do Orçamento cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteProductService.Add", quoteProductDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o Item do Orçamento na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<QuoteProductDto>> Update(QuoteProductDto quoteProductDto)
        {
            WebApiResponse<QuoteProductDto> result = new();

            try
            {
                var entity = _mapper.Map<QuoteProduct>(quoteProductDto);
                await _repository.UpdateAsync(entity);

                // Recalculate quote price
                await RecalculateAndUpdateQuoteAsync(entity.QuoteId);

                result.Data = quoteProductDto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Item do Orçamento atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteProductService.Update", quoteProductDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do Item do Orçamento na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<QuoteProductDto>> Remove(QuoteProductDto quoteProductDto)
        {
            WebApiResponse<QuoteProductDto> result = new();

            try
            {
                var existing = await _repository.GetByIdAsync(quoteProductDto.Id);

                await _repository.RemoveAsync(existing);

                // Recalculate quote price
                await RecalculateAndUpdateQuoteAsync(existing.QuoteId);

                result.Data = quoteProductDto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Item do Orçamento removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteProductService.Remove", quoteProductDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o Item do Orçamento da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<QuoteProductDto>>> FindAll()
        {
            WebApiResponse<IEnumerable<QuoteProductDto>> result = new();

            try
            {
                var items = await _repository.GetAllAsync(
                    qp => qp.Quote,
                    qp => qp.Quote.BusinessPartner,
                    qp => qp.Product
                );

                result.Data = _mapper.Map<IEnumerable<QuoteProductDto>>(items);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteProductService.FindAll", null);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de itens do orçamento.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<QuoteProductDto>>> FindByOrderId(Guid? orderId)
        {
            WebApiResponse<IEnumerable<QuoteProductDto>> result = new();

            try
            {
                var items = await _repository.QueryAsync(
                    qp => qp.QuoteId == orderId,
                    qp => qp.Quote,
                    qp => qp.Product
                );
                result.Data = _mapper.Map<IEnumerable<QuoteProductDto>>(items);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteProductService.FindByOrderId", orderId);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Itens do Orçamento {orderId}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<QuoteProductDto>>> FindByProductId(
            Guid? productId
        )
        {
            WebApiResponse<IEnumerable<QuoteProductDto>> result = new();

            try
            {
                var items = await _repository.QueryAsync(
                    qp => qp.ProductId == productId,
                    qp => qp.Quote,
                    qp => qp.Quote.BusinessPartner,
                    qp => qp.Product
                );

                result.Data = _mapper.Map<IEnumerable<QuoteProductDto>>(items);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteProductService.FindByProductId", productId);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Itens do Orçamento para o Produto {productId}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<QuoteProductDto>> FindById(Guid? id)
        {
            WebApiResponse<QuoteProductDto> result = new();

            try
            {
                var item = await _repository.GetByIdAsync(id);
                result.Data = _mapper.Map<QuoteProductDto>(item);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Item do Orçamento encontrado com sucesso"
                        : $"Nenhum Item do Orçamento com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteProductService.FindById", id);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Itens do Orçamento na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<QuoteProductDto>>> FindDelayed()
        {
            WebApiResponse<IEnumerable<QuoteProductDto>> result = new();

            try
            {
                var todayUtc = DateTime.UtcNow.Date;
                var tomorrowUtc = todayUtc.AddDays(1);

                var items = await _repository.QueryAsync(
                    qp =>
                        qp.Status == OrderProductStatus.Delayed
                        || (
                            qp.Status != OrderProductStatus.Returned
                            && qp.Quote != null
                            && qp.Quote.Date != default(DateTime)
                            && qp.Quote.Date < tomorrowUtc
                        ),
                    qp => qp.Quote,
                    qp => qp.Quote.BusinessPartner,
                    qp => qp.Product
                );

                result.Data = _mapper.Map<IEnumerable<QuoteProductDto>>(items);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "QuoteProductService.FindDelayed", null);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Itens do Orçamento.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        private async Task RecalculateAndUpdateQuoteAsync(Guid quoteId)
        {
            var items = await _repository.QueryAsync(qp => qp.QuoteId == quoteId);
            var sum =
                items?.Sum(qp =>
                    (qp.Price * qp.Quantity) - ((qp.Price * qp.Quantity) * qp.Discount / 100m)
                ) ?? 0;

            var quote = await _quoteRepository.GetByIdAsync(quoteId);

            if (quote == null)
            {
                return;
            }

            quote.Price = sum;
            await _quoteRepository.UpdateAsync(quote);
        }

        #endregion Private methods
    }
}
