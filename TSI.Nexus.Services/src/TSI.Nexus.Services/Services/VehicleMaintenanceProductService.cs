using AutoMapper;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services
{
    public class VehicleMaintenanceProductService : IVehicleMaintenanceProductService
    {
        #region Properties

        private readonly IRepository<VehicleMaintenanceProduct> _repository;
        private readonly IMapper _mapper;
        private readonly ILogService _logService;

        #endregion Properties

        #region Public methods

        public VehicleMaintenanceProductService(
            IRepository<VehicleMaintenanceProduct> repository,
            IMapper mapper,
            ILogService logService
        )
        {
            _repository = repository;
            _mapper = mapper;
            _logService = logService;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<VehicleMaintenanceProductDto>> Add(
            VehicleMaintenanceProductDto vehicleMaintenanceProductDto
        )
        {
            WebApiResponse<VehicleMaintenanceProductDto> result = new();

            try
            {
                var entity = _mapper.Map<VehicleMaintenanceProduct>(vehicleMaintenanceProductDto);
                await _repository.AddAsync(entity);

                vehicleMaintenanceProductDto.Id = entity.Id;
                result.Data = vehicleMaintenanceProductDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"Peça {vehicleMaintenanceProductDto.Description} cadastrada na Manutenção com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "VehicleMaintenanceProductService.Add",
                    vehicleMaintenanceProductDto
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível cadastrar a Peça {vehicleMaintenanceProductDto?.Description} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<VehicleMaintenanceProductDto>> Update(
            VehicleMaintenanceProductDto vehicleMaintenanceProductDto
        )
        {
            WebApiResponse<VehicleMaintenanceProductDto> result = new();

            try
            {
                var entity = _mapper.Map<VehicleMaintenanceProduct>(vehicleMaintenanceProductDto);
                await _repository.UpdateAsync(entity);

                result.Data = vehicleMaintenanceProductDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"Peça {vehicleMaintenanceProductDto.Description} atualizada com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "VehicleMaintenanceProductService.Update",
                    vehicleMaintenanceProductDto
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível atualizar os dados da Peça {vehicleMaintenanceProductDto?.Description} na base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<VehicleMaintenanceProductDto>> Remove(
            VehicleMaintenanceProductDto vehicleMaintenanceProductDto
        )
        {
            WebApiResponse<VehicleMaintenanceProductDto> result = new();

            try
            {
                var existing = await _repository.GetByIdAsync(vehicleMaintenanceProductDto.Id);

                await _repository.RemoveAsync(existing);

                result.Data = vehicleMaintenanceProductDto;
                result.Status = ResponseStatus.Success;
                result.Message =
                    $"Peça {vehicleMaintenanceProductDto.Description} removida com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "VehicleMaintenanceProductService.Remove",
                    vehicleMaintenanceProductDto
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível remover a Peça {vehicleMaintenanceProductDto?.Description} da base de dados.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<VehicleMaintenanceProductDto>>> FindAll()
        {
            WebApiResponse<IEnumerable<VehicleMaintenanceProductDto>> result = new();

            try
            {
                var items = await _repository.GetAllAsync(
                    vmp => vmp.VehicleMaintenance,
                    vmp => vmp.VehicleMaintenance.Vehicle,
                    vmp => vmp.Product
                );

                result.Data = _mapper.Map<IEnumerable<VehicleMaintenanceProductDto>>(items);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "VehicleMaintenanceProductService.FindAll", null);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de peças da manutenção.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<
            WebApiResponse<IEnumerable<VehicleMaintenanceProductDto>>
        > FindByVehicleMaintenanceId(Guid? vehicleMaintenanceId)
        {
            WebApiResponse<IEnumerable<VehicleMaintenanceProductDto>> result = new();

            try
            {
                var items = await _repository.QueryAsync(
                    vmp => vmp.VehicleMaintenanceId == vehicleMaintenanceId,
                    vmp => vmp.VehicleMaintenance,
                    vmp => vmp.Product
                );
                result.Data = _mapper.Map<IEnumerable<VehicleMaintenanceProductDto>>(items);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "VehicleMaintenanceProductService.FindByVehicleMaintenanceId",
                    vehicleMaintenanceId
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar as Peças da Manutenção {vehicleMaintenanceId}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<IEnumerable<VehicleMaintenanceProductDto>>> FindByProductId(
            Guid? productId
        )
        {
            WebApiResponse<IEnumerable<VehicleMaintenanceProductDto>> result = new();

            try
            {
                var items = await _repository.QueryAsync(
                    vmp => vmp.ProductId == productId,
                    vmp => vmp.VehicleMaintenance,
                    vmp => vmp.VehicleMaintenance.Vehicle,
                    vmp => vmp.Product
                );

                result.Data = _mapper.Map<IEnumerable<VehicleMaintenanceProductDto>>(items);
                result.Status = ResponseStatus.Success;
                result.Message = $"{result.Data?.Count() ?? 0} registro(s) encontrado(s).";
            }
            catch (Exception ex)
            {
                _logService.LogException(
                    ex,
                    "VehicleMaintenanceProductService.FindByProductId",
                    productId
                );
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar as Peças da Manutenção para o Produto {productId}.";
            }

            return result;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<VehicleMaintenanceProductDto>> FindById(Guid? id)
        {
            WebApiResponse<VehicleMaintenanceProductDto> result = new();

            try
            {
                var item = await _repository.GetByIdAsync(id);
                result.Data = _mapper.Map<VehicleMaintenanceProductDto>(item);
                result.Status = ResponseStatus.Success;
                result.Message =
                    result.Data != null
                        ? $"Peça {result.Data.Description} encontrada com sucesso"
                        : $"Nenhuma Peça com o ID {id} foi encontrada";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "VehicleMaintenanceProductService.FindById", id);
                result.Status = ResponseStatus.Error;
                result.Message =
                    $"Não foi possível acessar os registros de Peças da Manutenção na base de dados.";
            }

            return result;
        }

        #endregion Public methods
    }
}
