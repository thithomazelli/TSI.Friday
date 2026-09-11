using Microsoft.Extensions.Configuration;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;

namespace TSI.Nexus.Services
{
    public class VehicleMaintenanceOverdueService : IVehicleMaintenanceOverdueService
    {
        private readonly IRepository<VehicleMaintenance> _maintenanceRepository;
        private readonly IRepository<Vehicle> _vehicleRepository;
        private readonly IAlertConfigService _alertConfigService;
        private readonly string _systemUserId;

        #region Public methods

        public VehicleMaintenanceOverdueService(
            IRepository<VehicleMaintenance> maintenanceRepository,
            IRepository<Vehicle> vehicleRepository,
            IAlertConfigService alertConfigService,
            IConfiguration configuration
        )
        {
            _maintenanceRepository = maintenanceRepository;
            _vehicleRepository = vehicleRepository;
            _alertConfigService = alertConfigService;
            _systemUserId = configuration["OverdueSystemUserId"] ?? "overdue-batch";
        }

        /// <inheritdoc />
        public async Task<VehicleMaintenanceOverdueResult> RunOverdueUpdateAsync()
        {
            if (!await _alertConfigService.IsEnabledAsync(AlertConfigKeys.VehicleMaintenanceOverdue))
            {
                return new VehicleMaintenanceOverdueResult
                {
                    MaintenancesUpdated = 0,
                    VehiclesBlocked = 0,
                };
            }

            var today = DateTime.UtcNow.Date;

            var overdueMaintenances = await _maintenanceRepository.QueryAsync(m =>
                m.Status == MaintenanceStatus.Scheduled && m.ScheduledDate < today
            );

            var vehicleIdsToBlock = new HashSet<Guid>();

            foreach (var maintenance in overdueMaintenances)
            {
                maintenance.Status = MaintenanceStatus.Overdue;
                maintenance.ModifyDate = DateTime.UtcNow;
                maintenance.ModifyUserId = _systemUserId;
                vehicleIdsToBlock.Add(maintenance.VehicleId);
            }

            // One SaveChanges for every overdue maintenance in this run, instead of one
            // round-trip per row (this can run over the whole fleet on every scheduled tick).
            if (overdueMaintenances.Count > 0)
            {
                await _maintenanceRepository.UpdateRangeAsync(overdueMaintenances);
            }

            var blockedCount = 0;
            if (vehicleIdsToBlock.Count > 0)
            {
                // One query for every candidate vehicle instead of one SELECT per vehicle.
                var vehicles = await _vehicleRepository.QueryAsync(v =>
                    vehicleIdsToBlock.Contains(v.Id)
                );
                var vehiclesToBlock = vehicles
                    .Where(v =>
                        v.Status != VehicleStatus.Blocked && v.Status != VehicleStatus.Inactive
                    )
                    .ToList();

                foreach (var vehicle in vehiclesToBlock)
                {
                    vehicle.Status = VehicleStatus.Blocked;
                    vehicle.ModifyDate = DateTime.UtcNow;
                    vehicle.ModifyUserId = _systemUserId;
                }

                // One SaveChanges for every vehicle blocked in this run, instead of one per row.
                if (vehiclesToBlock.Count > 0)
                {
                    await _vehicleRepository.UpdateRangeAsync(vehiclesToBlock);
                }

                blockedCount = vehiclesToBlock.Count;
            }

            return new VehicleMaintenanceOverdueResult
            {
                MaintenancesUpdated = overdueMaintenances.Count,
                VehiclesBlocked = blockedCount,
            };
        }

        #endregion Public methods
    }
}
