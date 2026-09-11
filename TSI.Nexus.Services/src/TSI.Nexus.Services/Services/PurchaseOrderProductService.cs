using AutoMapper;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class PurchaseOrderProductService : IPurchaseOrderProductService
    {
        #region Properties

        private readonly IRepository<PurchaseOrderProduct> _repository;
        private readonly IRepository<PurchaseOrder> _purchaseOrderRepository;
        private readonly IMapper _mapper;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        public PurchaseOrderProductService(
            IRepository<PurchaseOrderProduct> repository,
            IRepository<PurchaseOrder> purchaseOrderRepository,
            IMapper mapper,
            ILogService logService
        )
        {
            _repository = repository;
            _purchaseOrderRepository = purchaseOrderRepository;
            _mapper = mapper;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PurchaseOrderProductDto>> Add(
            PurchaseOrderProductDto purchaseOrderProductDto
        )
        {
            WebApiResponse<PurchaseOrderProductDto> result = new();

            try
            {
                var entity = _mapper.Map<PurchaseOrderProduct>(purchaseOrderProductDto);
                await _repository.AddAsync(entity);

                await RecalculateAndUpdatePurchaseOrderAsync(entity.PurchaseOrderId);

                purchaseOrderProductDto.Id = entity.Id;
                result.Data = purchaseOrderProductDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"Item do Pedido de Compra {purchaseOrderProductDto.Description} cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "PurchaseOrderProductService.Add",
                    purchaseOrderProductDto
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o Item do Pedido de Compra {purchaseOrderProductDto?.Description} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PurchaseOrderProductDto>> Update(
            PurchaseOrderProductDto purchaseOrderProductDto
        )
        {
            WebApiResponse<PurchaseOrderProductDto> result = new();

            try
            {
                var entity = _mapper.Map<PurchaseOrderProduct>(purchaseOrderProductDto);
                await _repository.UpdateAsync(entity);

                await RecalculateAndUpdatePurchaseOrderAsync(purchaseOrderProductDto.PurchaseOrderId);

                result.Data = purchaseOrderProductDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"Item do Pedido de Compra {purchaseOrderProductDto.Description} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "PurchaseOrderProductService.Update",
                    purchaseOrderProductDto
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do Item do Pedido de Compra {purchaseOrderProductDto?.Description} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PurchaseOrderProductDto>> Remove(
            PurchaseOrderProductDto purchaseOrderProductDto
        )
        {
            WebApiResponse<PurchaseOrderProductDto> result = new();

            try
            {
                var existing = await _repository.GetByIdAsync(purchaseOrderProductDto.Id);

                await _repository.RemoveAsync(existing);

                await RecalculateAndUpdatePurchaseOrderAsync(existing.PurchaseOrderId);

                result.Data = purchaseOrderProductDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"Item do Pedido de Compra {purchaseOrderProductDto.Description} removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "PurchaseOrderProductService.Remove",
                    purchaseOrderProductDto
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o Item do Pedido de Compra {purchaseOrderProductDto?.Description} da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<PurchaseOrderProductDto>>> FindAll()
        {
            WebApiResponse<IEnumerable<PurchaseOrderProductDto>> result = new();

            try
            {
                var items = await _repository.GetAllAsync(
                    op => op.PurchaseOrder,
                    op => op.PurchaseOrder.BusinessPartner,
                    op => op.Product
                );

                result.Data = _mapper.Map<IEnumerable<PurchaseOrderProductDto>>(items);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PurchaseOrderProductService.FindAll", null);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de itens do pedido de compra.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<PurchaseOrderProductDto>>> FindByPurchaseOrderId(
            Guid? purchaseOrderId
        )
        {
            WebApiResponse<IEnumerable<PurchaseOrderProductDto>> result = new();

            try
            {
                var items = await _repository.QueryAsync(
                    op => op.PurchaseOrderId == purchaseOrderId,
                    op => op.PurchaseOrder,
                    op => op.Product
                );
                result.Data = _mapper.Map<IEnumerable<PurchaseOrderProductDto>>(items);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "PurchaseOrderProductService.FindByPurchaseOrderId",
                    purchaseOrderId
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Itens do Pedido de Compra {purchaseOrderId}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<PurchaseOrderProductDto>>> FindByProductId(
            Guid? productId
        )
        {
            WebApiResponse<IEnumerable<PurchaseOrderProductDto>> result = new();

            try
            {
                var items = await _repository.QueryAsync(
                    op => op.ProductId == productId,
                    op => op.PurchaseOrder,
                    op => op.PurchaseOrder.BusinessPartner,
                    op => op.Product
                );

                result.Data = _mapper.Map<IEnumerable<PurchaseOrderProductDto>>(items);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "PurchaseOrderProductService.FindByProductId",
                    productId
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Itens do Pedido de Compra para o Produto {productId}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PurchaseOrderProductDto>> FindById(Guid? id)
        {
            WebApiResponse<PurchaseOrderProductDto> result = new();

            try
            {
                var item = await _repository.GetByIdAsync(id);
                result.Data = _mapper.Map<PurchaseOrderProductDto>(item);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Item do Pedido de Compra {result.Data.Description} encontrado com sucesso"
                        : $"Nenhum Item do Pedido de Compra com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "PurchaseOrderProductService.FindById", id);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Itens do Pedido de Compra na base de dados.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        private async Task RecalculateAndUpdatePurchaseOrderAsync(Guid purchaseOrderId)
        {
            var items = await _repository.QueryAsync(op => op.PurchaseOrderId == purchaseOrderId);
            var sum =
                items?.Sum(op =>
                    (op.Price * op.Quantity) - ((op.Price * op.Quantity) * op.Discount / 100m)
                ) ?? 0;

            var purchaseOrder = await _purchaseOrderRepository.GetByIdAsync(purchaseOrderId);

            if (purchaseOrder == null)
            {
                return;
            }

            purchaseOrder.Price = sum;
            await _purchaseOrderRepository.UpdateAsync(purchaseOrder);
        }

        #endregion Private methods
    }
}
