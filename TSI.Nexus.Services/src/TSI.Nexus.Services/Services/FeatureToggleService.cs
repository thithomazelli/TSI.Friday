using Microsoft.Extensions.Caching.Memory;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class FeatureToggleService : IFeatureToggleService
    {
        #region Properties

        /// <summary>
        /// FeatureToggleService constructor created to initialize the "_repository" using Dependency Injection.
        /// </summary>
        private readonly IRepository<FeatureToggle> _repository;
        private readonly ILogService _logService;
        private readonly IMemoryCache _cache;

        // IsEnabledAsync(key, groupKey) - used to gate nearly every write/read endpoint in the
        // app - was hitting the database twice per call with no caching at all, on every single
        // request. Multiplied by a screen that (before being fixed) fetched its own data 2-4x on
        // load, viewing one record could cost 6+ avoidable round-trips just for toggle checks.
        // Short TTL keeps an admin's toggle flip from taking too long to take effect app-wide.
        private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(30);
        private const string CacheKeyPrefix = "FeatureToggle:";

        #endregion Properties

        #region Public methods

        /// <summary>
        /// FeatureToggleService constructor created to initialize the "_repository" using Dependency Injection.
        /// </summary>
        /// <param name="repository">IRepository<FeatureToggle> object used to initialize the internal variable using Dependency Injection.</param>
        public FeatureToggleService(IRepository<FeatureToggle> repository, ILogService logService, IMemoryCache cache)
        {
            _repository = repository;
            _logService = logService;
            _cache = cache;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<FeatureToggle>>> FindAll()
        {
            WebApiResponse<IEnumerable<FeatureToggle>> result = new();

            try
            {
                var featureToggles = await _repository.GetAllAsync();

                result.Data = featureToggles;
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "FeatureToggleService.FindAll", null);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Feature Toggle na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<FeatureToggle>> FindByKey(string key)
        {
            WebApiResponse<FeatureToggle> result = new();

            try
            {
                var featureToggle = await _repository.FirstOrDefaultAsync(f => f.Key == key);

                result.Data = featureToggle;
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Feature Toggle {result.Data.Name} encontrado com sucesso"
                        : $"Nenhum Feature Toggle com a chave {key} foi encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "FeatureToggleService.FindByKey", key);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível buscar o Feature Toggle pela chave {key}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<FeatureToggle>> SetEnabled(string key, bool enabled)
        {
            WebApiResponse<FeatureToggle> result = new();

            try
            {
                var featureToggle = await _repository.FirstOrDefaultAsync(f => f.Key == key);

                if (featureToggle == null)
                {
                    result.Status = ResponseStatus.Warning;
                    result.Message = $"Nenhum Feature Toggle com a chave {key} foi encontrado.";
                    return result;
                }

                featureToggle.Enabled = enabled;
                await _repository.UpdateAsync(featureToggle);
                _cache.Remove(CacheKeyPrefix + key);

                result.Data = featureToggle;
                result.Status = ResponseStatus.Success;
                result.Message = $"Módulo {featureToggle.Name} {(enabled ? "ativado" : "desativado")} com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "FeatureToggleService.SetEnabled", key);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar o Feature Toggle {key}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<bool> IsEnabledAsync(string key)
        {
            try
            {
                return await IsToggleEnabledOrDefaultAsync(key);
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "FeatureToggleService.IsEnabledAsync", key);
                return true;
            }
        }

        /// <inheritdoc />
        public async Task<bool> IsEnabledAsync(string key, string groupKey)
        {
            try
            {
                if (!await IsToggleEnabledOrDefaultAsync(key))
                {
                    return false;
                }

                return await IsToggleEnabledOrDefaultAsync(groupKey);
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "FeatureToggleService.IsEnabledAsync", key);
                return true;
            }
        }

        #endregion Public methods

        #region Private methods

        private async Task<bool> IsToggleEnabledOrDefaultAsync(string key)
        {
            var cacheKey = CacheKeyPrefix + key;
            if (_cache.TryGetValue(cacheKey, out bool cachedEnabled))
            {
                return cachedEnabled;
            }

            var featureToggle = await _repository.FirstOrDefaultAsync(f => f.Key == key);
            var enabled = featureToggle?.Enabled ?? true;
            _cache.Set(cacheKey, enabled, CacheDuration);
            return enabled;
        }

        #endregion Private methods
    }
}
