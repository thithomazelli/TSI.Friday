using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class AlertConfigService : IAlertConfigService
    {
        #region Properties

        private readonly IRepository<AlertConfig> _repository;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        public AlertConfigService(IRepository<AlertConfig> repository, ILogService logService)
        {
            _repository = repository;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<AlertConfig>>> FindAll()
        {
            WebApiResponse<IEnumerable<AlertConfig>> result = new();

            try
            {
                var alertConfigs = await _repository.GetAllAsync();

                result.Data = alertConfigs;
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "AlertConfigService.FindAll", null);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Alertas na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<AlertConfig>> SetEnabled(string key, bool enabled)
        {
            WebApiResponse<AlertConfig> result = new();

            try
            {
                var alertConfig = await _repository.FirstOrDefaultAsync(a => a.Key == key);

                if (alertConfig == null)
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message = $"Nenhum Alerta com a chave {key} foi encontrado.";
                    return result;
                }

                alertConfig.Enabled = enabled;
                await _repository.UpdateAsync(alertConfig);

                result.Data = alertConfig;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"Alerta {alertConfig.Name} {(enabled ? "ativado" : "desativado")} com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "AlertConfigService.SetEnabled", key);
                result.Status = ResponseStatus.Error;
                result.Message = $"Não foi possível atualizar o Alerta {key}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<AlertConfig>> SetThresholdDays(string key, int thresholdDays)
        {
            WebApiResponse<AlertConfig> result = new();

            try
            {
                var alertConfig = await _repository.FirstOrDefaultAsync(a => a.Key == key);

                if (alertConfig == null)
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message = $"Nenhum Alerta com a chave {key} foi encontrado.";
                    return result;
                }

                alertConfig.ThresholdDays = thresholdDays;
                await _repository.UpdateAsync(alertConfig);

                result.Data = alertConfig;
                result.Status = ResponseStatus.Success;
                result.Message = $"Prazo do Alerta {alertConfig.Name} atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "AlertConfigService.SetThresholdDays", key);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar o prazo do Alerta {key}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<bool> IsEnabledAsync(string key)
        {
            try
            {
                var alertConfig = await _repository.FirstOrDefaultAsync(a => a.Key == key);
                return alertConfig?.Enabled ?? true;
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "AlertConfigService.IsEnabledAsync", key);
                return true;
            }
        }

        /// <inheritdoc />
        public async Task<int> GetThresholdDaysAsync(string key, int defaultValue)
        {
            try
            {
                var alertConfig = await _repository.FirstOrDefaultAsync(a => a.Key == key);
                return alertConfig?.ThresholdDays ?? defaultValue;
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "AlertConfigService.GetThresholdDaysAsync", key);
                return defaultValue;
            }
        }

        #endregion Public methods
    }
}
