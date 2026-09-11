using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class ProductPhotoService : IProductPhotoService
    {
        #region Properties

        /// <summary>
        /// Repository object created to access the ProductPhoto registers on database using EntityFramework.
        /// </summary>
        private readonly IRepository<ProductPhoto> _repository;

        #endregion Properties

        #region Public methods

        /// <summary>
        /// ProductPhotoService constructor created to initialize the "_repository" using Dependency Injection.
        /// </summary>
        /// <param name="repository">IRepository<ProductPhoto> object used to initialize the internal variable using Dependency Injection.</param>
        public ProductPhotoService(IRepository<ProductPhoto> repository)
        {
            _repository = repository;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<ProductPhoto>> Add(ProductPhoto productPhoto)
        {
            WebApiResponse<ProductPhoto> result = new();

            try
            {
                await _repository.AddAsync(productPhoto);

                result.Data = productPhoto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Imagem {productPhoto.FileName} cadastrada com sucesso.";
            }
            catch (Exception ex)
            {
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar a Imagem {productPhoto.FileName} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<ProductPhoto>> Update(ProductPhoto productPhoto)
        {
            WebApiResponse<ProductPhoto> result = new();

            try
            {
                await _repository.UpdateAsync(productPhoto);

                result.Data = productPhoto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Imagem {productPhoto.FileName} atualizada com sucesso.";
            }
            catch (Exception ex)
            {
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados da Imagem {productPhoto.FileName} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<ProductPhoto>> Remove(ProductPhoto productPhoto)
        {
            WebApiResponse<ProductPhoto> result = new();

            try
            {
                await _repository.RemoveAsync(productPhoto);

                result.Data = productPhoto;
                result.Status = ResponseStatus.Success;
                result.Message = $"Imagem {productPhoto.FileName} removida com sucesso.";
            }
            catch (Exception ex)
            {
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover a Imagem {productPhoto.FileName} da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<ProductPhoto>> FindById(Guid? id)
        {
            WebApiResponse<ProductPhoto> result = new();

            try
            {
                result.Data = await _repository.GetByIdAsync(id);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Imagem {result.Data.FileName} encontrada com sucesso"
                        : $"Nenhuma Imagem com o ID {id} foi encontrada";
            }
            catch (Exception ex)
            {
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Imagems na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<ProductPhoto>> FindDefaultByProduct(Guid productId)
        {
            WebApiResponse<ProductPhoto> result = new();

            try
            {
                result.Data = (
                    await _repository.QueryAsync(_ => _.ProductId.Equals(productId) && _.IsDefault)
                )?.FirstOrDefault();
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Imagem {result.Data.FileName} encontrada com sucesso"
                        : $"Não foi encontrada nenhuma imagem padrão para o produto {productId}.";
            }
            catch (Exception ex)
            {
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Imagems na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<ProductPhoto>>> FindAllByProduct(
            Guid productId
        )
        {
            WebApiResponse<IEnumerable<ProductPhoto>> result = new();

            try
            {
                result.Data = await _repository.QueryAsync(_ => _.ProductId == productId);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Imagems na base de dados.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        #endregion Private methods
    }
}
