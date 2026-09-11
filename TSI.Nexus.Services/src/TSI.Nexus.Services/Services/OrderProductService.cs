using AutoMapper;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class OrderProductService : IOrderProductService
    {
        #region Properties

        /// <summary>
        /// Repository object created to access the OrderProduct registers on database using EntityFramework.
        /// </summary>
        private readonly IRepository<OrderProduct> _repository;
        private readonly IRepository<Order> _orderRepository;
        private readonly IMapper _mapper;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        /// <summary>
        /// OrderProductService constructor created to initialize the "_repository" using Dependency Injection.
        /// </summary>
        /// <param name="repository">IRepository<OrderProduct> object used to initialize the internal variable using Dependency Injection.</param>
        public OrderProductService(
            IRepository<OrderProduct> repository,
            IRepository<Order> orderRepository,
            IMapper mapper,
            ILogService logService
        )
        {
            _repository = repository;
            _orderRepository = orderRepository;
            _mapper = mapper;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<OrderProductDto>> Add(OrderProductDto orderProductDto)
        {
            WebApiResponse<OrderProductDto> result = new();

            try
            {
                var orderProductEntity = _mapper.Map<OrderProduct>(orderProductDto);
                await _repository.AddAsync(orderProductEntity);

                // Recalculate order price and update order
                await RecalculateAndUpdateOrderAsync(orderProductEntity.OrderId);

                // AddAsync populates orderProductEntity.Id (DB-generated); the incoming DTO still
                // has whatever Id it arrived with (Guid.Empty for a new record).
                orderProductDto.Id = orderProductEntity.Id;
                result.Data = orderProductDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"Item do Pedido {orderProductDto.Description} cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "OrderProductService.Add", orderProductDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o Item do Pedido {orderProductDto?.Description} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<OrderProductDto>> Update(OrderProductDto orderProductDto)
        {
            WebApiResponse<OrderProductDto> result = new();

            try
            {
                var entity = _mapper.Map<OrderProduct>(orderProductDto);
                await _repository.UpdateAsync(entity);

                // Recalculate order price and update order
                await RecalculateAndUpdateOrderAsync(orderProductDto.OrderId);

                result.Data = orderProductDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"Item do Pedido {orderProductDto.Description} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "OrderProductService.Update", orderProductDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do Item do Pedido {orderProductDto?.Description} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<OrderProductDto>> Remove(OrderProductDto orderProductDto)
        {
            WebApiResponse<OrderProductDto> result = new();

            try
            {
                var existing = await _repository.GetByIdAsync(orderProductDto.Id);

                await _repository.RemoveAsync(existing);

                // Recalculate order price and update order
                await RecalculateAndUpdateOrderAsync(existing.OrderId);

                result.Data = orderProductDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"Item do Pedido {orderProductDto.Description} removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "OrderProductService.Remove", orderProductDto);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o Item do Pedido {orderProductDto?.Description} da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<OrderProductDto>>> FindAll()
        {
            WebApiResponse<IEnumerable<OrderProductDto>> result = new();

            try
            {
                var orders = await _repository.GetAllAsync(
                    op => op.Order,
                    op => op.Order.BusinessPartner,
                    op => op.Product
                );

                result.Data = _mapper.Map<IEnumerable<OrderProductDto>>(orders);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "OrderProductService.FindAll", null);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de itens do pedido.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<OrderProductDto>>> FindByOrderId(Guid? orderId)
        {
            WebApiResponse<IEnumerable<OrderProductDto>> result = new();

            try
            {
                var items = await _repository.QueryAsync(
                    op => op.OrderId == orderId,
                    op => op.Order,
                    op => op.Product
                );
                result.Data = _mapper.Map<IEnumerable<OrderProductDto>>(items);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "OrderProductService.FindByOrderId", orderId);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Itens do Pedido {orderId}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<OrderProductDto>>> FindByProductId(
            Guid? productId
        )
        {
            WebApiResponse<IEnumerable<OrderProductDto>> result = new();

            try
            {
                var items = await _repository.QueryAsync(
                    op => op.ProductId == productId,
                    op => op.Order,
                    op => op.Order.BusinessPartner,
                    op => op.Product
                );

                result.Data = _mapper.Map<IEnumerable<OrderProductDto>>(items);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "OrderProductService.FindByProductId", productId);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os Itens do Pedido para o Produto {productId}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<OrderProductDto>> FindById(Guid? id)
        {
            WebApiResponse<OrderProductDto> result = new();

            try
            {
                var item = await _repository.GetByIdAsync(id);
                result.Data = _mapper.Map<OrderProductDto>(item);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Item do Pedido {result.Data.Description} encontrado com sucesso"
                        : $"Nenhum Item do Pedido com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "OrderProductService.FindById", id);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Itens do Pedido na base de dados.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        private async Task RecalculateAndUpdateOrderAsync(Guid orderId)
        {
            var items = await _repository.QueryAsync(op => op.OrderId == orderId);
            var sum =
                items?.Sum(op =>
                    (op.Price * op.Quantity) - ((op.Price * op.Quantity) * op.Discount / 100m)
                ) ?? 0;

            var order = await _orderRepository.GetByIdAsync(orderId);

            if (order == null)
            {
                return;
            }

            order.Price = sum;
            await _orderRepository.UpdateAsync(order);
        }

        #endregion Private methods
    }
}
