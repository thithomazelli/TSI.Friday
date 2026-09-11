using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class VehicleMaintenanceService : IVehicleMaintenanceService
    {
        #region Properties

        private readonly IRepository<VehicleMaintenance> _repository;
        private readonly IRepository<Vehicle> _vehicleRepository;
        private readonly IFeatureToggleService _featureToggleService;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        public VehicleMaintenanceService(
            IRepository<VehicleMaintenance> repository,
            IRepository<Vehicle> vehicleRepository,
            IFeatureToggleService featureToggleService,
            ILogService logService
        )
        {
            _repository = repository;
            _vehicleRepository = vehicleRepository;
            _featureToggleService = featureToggleService;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<VehicleMaintenance>> Add(VehicleMaintenance maintenance)
        {
            WebApiResponse<VehicleMaintenance> result = new();

            try
            {
                if (
                    maintenance.Status == MaintenanceStatus.Scheduled
                    && maintenance.ScheduledDate.Date < DateTime.UtcNow.Date
                )
                {
                    maintenance.Status = MaintenanceStatus.Overdue;
                }

                await _repository.AddAsync(maintenance);
                await SyncVehicleStatusAsync(maintenance.VehicleId);

                result.Data = maintenance;
                result.Status = ResponseStatus.Success;
                result.Message = "Manutenção cadastrada com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "VehicleMaintenanceService.Add", maintenance);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar a Manutenção na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<VehicleMaintenance>> Update(VehicleMaintenance maintenance)
        {
            WebApiResponse<VehicleMaintenance> result = new();

            try
            {
                if (
                    maintenance.Status == MaintenanceStatus.Completed
                    && maintenance.CompletedDate == null
                )
                {
                    maintenance.CompletedDate = DateTime.UtcNow;
                }

                // Load the tracked entity (with its parts) so the incoming VehicleMaintenanceProducts
                // can be reconciled against the ones already persisted, instead of resending the
                // whole collection blind - UpdateAsync's Entry(entity).State = Modified does not
                // cascade into navigation collections on its own.
                var existing = await _repository.GetByIdAsync(
                    maintenance.Id,
                    m => m.VehicleMaintenanceProducts
                );

                existing.Type = maintenance.Type;
                existing.Description = maintenance.Description;
                existing.ScheduledDate = maintenance.ScheduledDate;
                existing.CompletedDate = maintenance.CompletedDate;
                existing.OdometerAtService = maintenance.OdometerAtService;
                existing.Cost = maintenance.Cost;
                existing.Status = maintenance.Status;

                SyncMaintenanceProducts(existing, maintenance.VehicleMaintenanceProducts);

                await _repository.UpdateAsync(existing);
                await SyncVehicleStatusAsync(existing.VehicleId);

                result.Data = existing;
                result.Status = ResponseStatus.Success;
                result.Message = "Manutenção atualizada com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "VehicleMaintenanceService.Update", maintenance);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar a Manutenção na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<VehicleMaintenance>> Remove(VehicleMaintenance maintenance)
        {
            WebApiResponse<VehicleMaintenance> result = new();

            try
            {
                await _repository.RemoveAsync(maintenance);
                await SyncVehicleStatusAsync(maintenance.VehicleId);

                result.Data = maintenance;
                result.Status = ResponseStatus.Success;
                result.Message = "Manutenção removida com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "VehicleMaintenanceService.Remove", maintenance);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover a Manutenção da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<VehicleMaintenance>>> FindAll()
        {
            WebApiResponse<IEnumerable<VehicleMaintenance>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.VehicleMaintenance, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                result.Data = await _repository.GetAllAsync(
                    m => m.Vehicle,
                    m => m.VehicleMaintenanceProducts
                );
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "VehicleMaintenanceService.FindAll", null);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Manutenção na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<VehicleMaintenance>> FindById(Guid? id)
        {
            WebApiResponse<VehicleMaintenance> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.VehicleMaintenance, FeatureToggleKeys.FleetModule))
                {
                    result.Data = null;
                    result.Status = ResponseStatus.Success;
                    result.Message = $"Nenhuma Manutenção com o ID {id} foi encontrada";
                    return result;
                }

                result.Data = await _repository.GetByIdAsync(
                    id,
                    m => m.Vehicle,
                    m => m.VehicleMaintenanceProducts
                );
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? "Manutenção encontrada com sucesso"
                        : $"Nenhuma Manutenção com o ID {id} foi encontrada";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "VehicleMaintenanceService.FindById", id);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Manutenção na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<VehicleMaintenance>>> FindByVehicle(
            Guid vehicleId
        )
        {
            WebApiResponse<IEnumerable<VehicleMaintenance>> result = new();

            try
            {
                if (!await _featureToggleService.IsEnabledAsync(FeatureToggleKeys.VehicleMaintenance, FeatureToggleKeys.FleetModule))
                {
                    result.Data = [];
                    result.Status = ResponseStatus.Success;
                    result.Message = "0 registro(s) encontrado(s).";
                    return result;
                }

                result.Data = await _repository.QueryAsync(
                    _ => _.VehicleId == vehicleId,
                    m => m.VehicleMaintenanceProducts
                );
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data.Count()} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "VehicleMaintenanceService.FindByVehicle", vehicleId);

                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Manutenção na base de dados.";
            }

            return result;
        }

        #endregion Public methods

        #region Private methods

        /// <summary>
        /// Reconciles the tracked VehicleMaintenanceProducts collection against the parts sent by
        /// the client: removes lines no longer present, updates the ones that still are, and adds
        /// the new ones (identified by an empty/default Id) - mirroring the staging grid, which
        /// lets the user add/remove parts both when creating and when editing a Maintenance.
        /// </summary>
        private static void SyncMaintenanceProducts(
            VehicleMaintenance existing,
            ICollection<VehicleMaintenanceProduct> incoming
        )
        {
            incoming ??= new List<VehicleMaintenanceProduct>();
            var incomingIds = incoming.Where(p => p.Id != Guid.Empty).Select(p => p.Id).ToHashSet();

            foreach (
                var current in existing
                    .VehicleMaintenanceProducts.Where(p => !incomingIds.Contains(p.Id))
                    .ToList()
            )
            {
                existing.VehicleMaintenanceProducts.Remove(current);
            }

            foreach (var line in incoming)
            {
                var current =
                    line.Id != Guid.Empty
                        ? existing.VehicleMaintenanceProducts.FirstOrDefault(p => p.Id == line.Id)
                        : null;

                if (current != null)
                {
                    current.Description = line.Description;
                    current.Quantity = line.Quantity;
                    current.Price = line.Price;
                    current.Discount = line.Discount;
                    current.ProductId = line.ProductId;
                }
                else
                {
                    existing.VehicleMaintenanceProducts.Add(
                        new VehicleMaintenanceProduct
                        {
                            Description = line.Description,
                            Quantity = line.Quantity,
                            Price = line.Price,
                            Discount = line.Discount,
                            VehicleMaintenanceId = existing.Id,
                            ProductId = line.ProductId,
                        }
                    );
                }
            }
        }

        /// <summary>
        /// Blocks the Vehicle when it has any pending (InProgress/Overdue) maintenance, or releases
        /// it back to Available when there is none, keeping Vehicle.Status in sync with its
        /// maintenance history without requiring the caller to manage it manually.
        /// </summary>
        private async Task SyncVehicleStatusAsync(Guid vehicleId)
        {
            var vehicles = await _vehicleRepository.QueryAsync(v => v.Id == vehicleId);
            var vehicle = vehicles.FirstOrDefault();

            if (vehicle == null || vehicle.Status == VehicleStatus.Inactive)
            {
                return;
            }

            var hasPendingMaintenance = await _repository.AnyAsync(m =>
                m.VehicleId == vehicleId
                && (
                    m.Status == MaintenanceStatus.InProgress
                    || m.Status == MaintenanceStatus.Overdue
                )
            );

            var desiredStatus = hasPendingMaintenance
                ? VehicleStatus.Blocked
                : VehicleStatus.Available;

            if (vehicle.Status != desiredStatus)
            {
                vehicle.Status = desiredStatus;
                await _vehicleRepository.UpdateAsync(vehicle);
            }
        }

        #endregion Private methods
    }
}
