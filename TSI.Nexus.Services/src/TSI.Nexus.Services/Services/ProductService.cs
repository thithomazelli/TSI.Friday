using System.Linq.Expressions;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class ProductService : IProductService
    {
        #region Properties

        /// <summary>
        /// Repository object created to access the Product registers on database using EntityFramework.
        /// </summary>
        private readonly IRepository<Product> _repository;
        private readonly IRepository<OrderProduct> _orderProductRepository;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        /// <summary>
        /// ProductService constructor created to initialize the "_repository" using Dependency Injection.
        /// </summary>
        /// <param name="repository">IRepository<Product> object used to initialize the internal variable using Dependency Injection.</param>
        public ProductService(
            IRepository<Product> repository,
            IRepository<OrderProduct> orderProductRepository,
            ILogService logService
        )
        {
            _repository = repository;
            _orderProductRepository = orderProductRepository;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Product>> Add(Product product)
        {
            WebApiResponse<Product> result = new();

            try
            {
                var productDuplicatedMessage = await CheckIfProductIsDuplicatedAndGetErrorMessage(
                    product
                );

                if (!string.IsNullOrEmpty(productDuplicatedMessage))
                {
                    result.Status = ResponseStatus.Error;
                    result.Message = productDuplicatedMessage;
                    return result;
                }

                await _repository.AddAsync(product);

                result.Data = product;
                result.Status = ResponseStatus.Success;
                result.Message = $"Produto {product.Name} cadastrado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "ProductService.Add", product);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar o Produto {product.Name} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Product>> Update(Product product)
        {
            WebApiResponse<Product> result = new();

            try
            {
                var productDuplicatedMessage = await CheckIfProductIsDuplicatedAndGetErrorMessage(
                    product
                );

                if (!string.IsNullOrEmpty(productDuplicatedMessage))
                {
                    var ex = new Exception(productDuplicatedMessage);
                    _logService.LogException(ex, "ProductService.Update", product);

                    result.Status = ResponseStatus.Error;
                    result.Message = productDuplicatedMessage;
                    return result;
                }

                await _repository.UpdateAsync(product);

                result.Data = product;
                result.Status = ResponseStatus.Success;
                result.Message = $"Produto {product.Name} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "ProductService.Update", product);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados do Produto {product.Name} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Product>> Remove(Product product)
        {
            WebApiResponse<Product> result = new();

            try
            {
                if (await _orderProductRepository.AnyAsync(_ => _.ProductId == product.Id))
                {
                    var message =
                        $"Produto {product.Name} não pode ser removido pois está vinculado à um ou mais pedidos.";
                    var ex = new Exception(message);
                    _logService.LogException(ex, "ProductService.Remove", product);

                    result.Data = product;
                    result.Status = ResponseStatus.Warning;
                    result.Message = message;
                    ;
                    return result;
                }

                await _repository.RemoveAsync(product);

                result.Data = product;
                result.Status = ResponseStatus.Success;
                result.Message = $"Produto {product.Name} removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "ProductService.Remove", product);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover o Produto {product.Name} da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<Product>>> FindAll()
        {
            WebApiResponse<IEnumerable<Product>> result = new();

            try
            {
                result.Data = await _repository.GetAllAsync();
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "ProductService.FindAll", null);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Produtos na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<PagedResult<Product>>> FindAllPaged(PagedRequest request)
        {
            WebApiResponse<PagedResult<Product>> result = new();

            try
            {
                var filter = BuildFilter(request);
                var orderBy = BuildOrderBy(request);

                var (products, totalCount) = await _repository.GetPagedAsync(
                    skip: (Math.Max(request.Page, 1) - 1) * Math.Max(request.PageSize, 1),
                    take: Math.Max(request.PageSize, 1),
                    filter: filter,
                    orderBy: orderBy,
                    asNoTracking: true
                );

                result.Data = new PagedResult<Product> { Items = products, TotalCount = totalCount };
                result.Status = ResponseStatus.Success;
                result.Message = $"{totalCount} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "ProductService.FindAllPaged", request);
                result.Status = ResponseStatus.Error;
                result.Message = "Não foi possível acessar os registros de Produtos na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Product>> FindById(Guid? id)
        {
            WebApiResponse<Product> result = new();

            try
            {
                result.Data = await _repository.GetByIdAsync(id);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Produto {result.Data.Name} encontrado com sucesso"
                        : $"Nenhum Produto com o ID {id} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "ProductService.FindById", id);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Produtos na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<Product>> FindBySku(string sku)
        {
            WebApiResponse<Product> result = new();

            try
            {
                result.Data = await _repository.FirstOrDefaultAsync(_ => _.Sku.Equals(sku));
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Produto {result.Data.Name} encontrado com sucesso"
                        : $"Nenhum Produto com Sku {sku} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "ProductService.FindBySku", sku);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Produtos na base de dados.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        /// <summary>
        /// Known sort fields exposed by the Products grid, mapped to the Product property they
        /// sort by - an unrecognized SortField (or none) falls back to the repository's own
        /// default (CreateDate) ordering.
        /// </summary>
        private static readonly Dictionary<string, Expression<Func<Product, object>>> SortMap = new()
        {
            ["sku"] = p => p.Sku,
            ["name"] = p => p.Name,
            ["quantityInStock"] = p => p.QuantityInStock,
            ["price"] = p => p.Price,
            ["category"] = p => p.Category,
            ["unit"] = p => p.Unit,
            ["type"] = p => p.Type,
        };

        /// <summary>
        /// Combines the quick filter (OR across the grid's own visible text columns) with the
        /// low-stock filter the navbar stock alert's "ver todos" link applies - same "&lt;=3" rule
        /// the client-side version used, now applied server-side alongside pagination.
        /// </summary>
        private static Expression<Func<Product, bool>> BuildFilter(PagedRequest request)
        {
            var quickFilter = request.QuickFilter;
            var hasQuickFilter = !string.IsNullOrWhiteSpace(quickFilter);
            var lowStockOnly = request.LowStockOnly == true;

            return p =>
                (!hasQuickFilter
                    || p.Sku.Contains(quickFilter)
                    || p.Name.Contains(quickFilter)
                    || p.Category.Contains(quickFilter))
                && (!lowStockOnly || p.QuantityInStock <= 3);
        }

        private static Func<IQueryable<Product>, IOrderedQueryable<Product>> BuildOrderBy(
            PagedRequest request
        )
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
        /// Should verify if the Product is already being registered on the database.
        /// </summary>
        /// <param name="product">The Product object that is being added or updated.</param>
        /// <returns>The error message when Product is duplicated. Otherwise an empty string.</returns>
        private async Task<string> CheckIfProductIsDuplicatedAndGetErrorMessage(Product product)
        {
            if (await IsNameDuplicated(product))
            {
                return $"Já existe um Produto cadastrado com Nome {product.Name}.";
            }

            if (await IsSkuDuplicated(product))
            {
                return $"Já existe um Produto cadastrado com Sku {product.Sku}.";
            }

            return string.Empty;
        }

        /// <summary>
        /// Should verify if the Product name is already being used by another register on the database.
        /// </summary>
        /// <param name="product">The Product object that is being added or updated.</param>
        /// <returns>True when the Name is duplicated; Otherwise false.</returns>
        private Task<bool> IsNameDuplicated(Product product)
        {
            return _repository.AnyAsync(_ => _.Id != product.Id && _.Name == product.Name);
        }

        /// <summary>
        /// Should verify if the Product sku is already being used by another register on the database.
        /// </summary>
        /// <param name="product">The Product object that is being added or updated.</param>
        /// <returns>True when the sku is duplicated; Otherwise false.</returns>
        private Task<bool> IsSkuDuplicated(Product product)
        {
            return _repository.AnyAsync(_ =>
                _.Id != product.Id && !string.IsNullOrEmpty(_.Sku) && _.Sku == product.Sku
            );
        }

        #endregion Private methods
    }
}
