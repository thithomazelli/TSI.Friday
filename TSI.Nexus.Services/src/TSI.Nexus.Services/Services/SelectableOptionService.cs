using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class SelectableOptionService : ISelectableOptionService
    {
        #region Properties

        private readonly IRepository<SelectableOption> _repository;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        public SelectableOptionService(
            IRepository<SelectableOption> repository,
            ILogService logService
        )
        {
            _repository = repository;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<SelectableOption>> Add(SelectableOption option)
        {
            WebApiResponse<SelectableOption> result = new();

            try
            {
                if (
                    await _repository.AnyAsync(o =>
                        o.Group == option.Group
                        && o.Value.ToLower() == option.Value.ToLower()
                    )
                )
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message = $"A opção \"{option.Value}\" já existe nessa lista.";
                    return result;
                }

                await _repository.AddAsync(option);

                result.Data = option;
                result.Status = ResponseStatus.Success;
                result.Message = $"Opção \"{option.Value}\" adicionada com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "SelectableOptionService.Add", option);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível adicionar a opção \"{option?.Value}\" na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<SelectableOption>> Update(SelectableOption option)
        {
            WebApiResponse<SelectableOption> result = new();

            try
            {
                await _repository.UpdateAsync(option);

                result.Data = option;
                result.Status = ResponseStatus.Success;
                result.Message = $"Opção \"{option.Value}\" atualizada com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "SelectableOptionService.Update", option);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar a opção \"{option?.Value}\" na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<SelectableOption>> Remove(SelectableOption option)
        {
            WebApiResponse<SelectableOption> result = new();

            try
            {
                await _repository.RemoveAsync(option);

                result.Data = option;
                result.Status = ResponseStatus.Success;
                result.Message = $"Opção \"{option.Value}\" removida com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "SelectableOptionService.Remove", option);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover a opção \"{option?.Value}\" da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<SelectableOption>>> FindAll()
        {
            WebApiResponse<IEnumerable<SelectableOption>> result = new();

            try
            {
                var options = await _repository.GetAllAsync();

                result.Data = options.OrderBy(o => o.Group).ThenBy(o => o.Value);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "SelectableOptionService.FindAll", null);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de opções na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<SelectableOption>>> FindByGroup(
            SelectableOptionGroup group
        )
        {
            WebApiResponse<IEnumerable<SelectableOption>> result = new();

            try
            {
                var options = await _repository.QueryAsync(o => o.Group == group);

                result.Data = options.OrderBy(o => o.Value);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "SelectableOptionService.FindByGroup", group);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de opções na base de dados.";
            }

            return result;
        }

        #endregion Public methods
    }
}
