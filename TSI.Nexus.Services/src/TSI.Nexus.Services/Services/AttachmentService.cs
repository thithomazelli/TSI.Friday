using AutoMapper;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;
using TSI.Nexus.Data;

namespace TSI.Nexus.Services
{
    public class AttachmentService : IAttachmentService
    {
        #region Properties

        private readonly IWebHostEnvironment _env;
        private readonly MyDBContextEF _db;
        private readonly IMapper _mapper;
        private readonly IConfiguration _config;
        private readonly IFeatureToggleService _featureToggleService;
        private readonly ILogService _logService;

        private readonly string _downloadUrlTemplate;

        private const long MaxBytes = 25 * 1024 * 1024; // 25 MB

        #endregion Properties

        #region Public methods

        public AttachmentService(
            IWebHostEnvironment env,
            MyDBContextEF db,
            IMapper mapper,
            IConfiguration config,
            IFeatureToggleService featureToggleService,
            ILogService logService
        )
        {
            _env = env ?? throw new ArgumentNullException(nameof(env));
            _db = db ?? throw new ArgumentNullException(nameof(db));
            _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
            _config = config ?? throw new ArgumentNullException(nameof(config));
            _featureToggleService =
                featureToggleService ?? throw new ArgumentNullException(nameof(featureToggleService));
            _logService = logService ?? throw new ArgumentNullException(nameof(logService));

            var baseUrl = _config["JWT:Issuer"]?.TrimEnd('/') ?? string.Empty;
            _downloadUrlTemplate = $"{baseUrl}/api/Attachments/GetFileById/{{0}}";
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<AttachmentResponseDto>> Add(
            AttachmentDto dto,
            string overridePath
        )
        {
            var response = new WebApiResponse<AttachmentResponseDto>();
            try
            {
                if (dto.File == null)
                {
                    response.Status = ResponseStatus.Error;
                    response.Message = "Arquivo obrigatório. Por favor envie um arquivo.";
                    return response;
                }

                if (dto.File.Length > MaxBytes)
                {
                    response.Status = ResponseStatus.Error;
                    response.Message = "Arquivo excede o tamanho máximo permitido (25 MB).";
                    return response;
                }

                // Resolve IDs from overridePath and parent chain
                await ResolveParentIdsAsync(dto, overridePath);

                var path = await BuildEntityPathAsync(dto);
                Directory.CreateDirectory(path);

                var fileName = SanitizeFileName(dto.File.FileName);
                var fullPath = Path.Combine(path, fileName);

                // If file already exists, add incremental suffix to avoid overwriting
                if (File.Exists(fullPath))
                {
                    var nameWithoutExt = Path.GetFileNameWithoutExtension(fileName);
                    var ext = Path.GetExtension(fileName);
                    var counter = 1;
                    do
                    {
                        fileName = $"{nameWithoutExt}({counter}){ext}";
                        fullPath = Path.Combine(path, fileName);
                        counter++;
                    } while (File.Exists(fullPath));
                }

                using (var stream = new FileStream(fullPath, FileMode.Create))
                {
                    await dto.File.CopyToAsync(stream);
                }

                var attachment = new Attachment
                {
                    FileName = fileName,
                    Path = Path.GetRelativePath(_env.ContentRootPath, fullPath),
                    BusinessPartnerId = dto.BusinessPartnerId,
                    OrderId = dto.OrderId,
                    PurchaseOrderId = dto.PurchaseOrderId,
                    VehicleId = dto.VehicleId,
                    DriverId = dto.DriverId,
                    VehicleMaintenanceId = dto.VehicleMaintenanceId,
                    TripId = dto.TripId,
                    TransactionId = dto.TransactionId,
                    PaymentId = dto.PaymentId,
                    ProductId = dto.ProductId,
                    UserId = dto.UserId,
                };

                await _db.Attachments.AddAsync(attachment);
                await _db.SaveChangesAsync();

                response.Data = MapToResponseDto(attachment);
                response.Status = ResponseStatus.Success;
                response.Message = "Arquivo salvo com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "AttachmentService.Add", dto);
                response.Status = ResponseStatus.Error;
                response.Message = "Erro ao salvar o arquivo.";
            }

            return response;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<AttachmentResponseDto>> Update(
            AttachmentDto dto,
            string overridePath
        )
        {
            var response = new WebApiResponse<AttachmentResponseDto>();
            try
            {
                if (dto.Id == null || dto.Id == Guid.Empty)
                {
                    response.Status = ResponseStatus.Error;
                    response.Message = "ID do anexo é obrigatório para atualização.";
                    return response;
                }

                var existing = await _db.Attachments.FindAsync(dto.Id.Value);
                if (existing == null)
                {
                    response.Status = ResponseStatus.Error;
                    response.Message = "Anexo não encontrado.";
                    return response;
                }

                // Resolve IDs from overridePath and parent chain
                await ResolveParentIdsAsync(dto, overridePath);

                // update file if provided
                if (dto.File != null)
                {
                    if (dto.File.Length > MaxBytes)
                    {
                        response.Status = ResponseStatus.Error;
                        response.Message = "Arquivo excede o tamanho máximo permitido (25 MB).";
                        return response;
                    }

                    var path = await BuildEntityPathAsync(dto);
                    Directory.CreateDirectory(path);
                    var fileName = SanitizeFileName(dto.File.FileName);
                    var fullPath = Path.Combine(path, fileName);

                    // If file already exists, add incremental suffix to avoid overwriting
                    if (File.Exists(fullPath))
                    {
                        var nameWithoutExt = Path.GetFileNameWithoutExtension(fileName);
                        var ext = Path.GetExtension(fileName);
                        var counter = 1;
                        do
                        {
                            fileName = $"{nameWithoutExt}({counter}){ext}";
                            fullPath = Path.Combine(path, fileName);
                            counter++;
                        } while (File.Exists(fullPath));
                    }

                    using (var stream = new FileStream(fullPath, FileMode.Create))
                    {
                        await dto.File.CopyToAsync(stream);
                    }

                    // delete old file
                    try
                    {
                        var oldFull = Path.Combine(_env.ContentRootPath, existing.Path);
                        if (File.Exists(oldFull))
                            File.Delete(oldFull);
                    }
                    catch { }

                    existing.FileName = fileName;
                    existing.Path = Path.GetRelativePath(_env.ContentRootPath, fullPath);
                }

                // update metadata
                existing.BusinessPartnerId = dto.BusinessPartnerId;
                existing.OrderId = dto.OrderId;
                existing.PurchaseOrderId = dto.PurchaseOrderId;
                existing.TripId = dto.TripId;
                existing.TransactionId = dto.TransactionId;
                existing.PaymentId = dto.PaymentId;
                existing.ProductId = dto.ProductId;
                existing.VehicleId = dto.VehicleId;
                existing.DriverId = dto.DriverId;
                existing.VehicleMaintenanceId = dto.VehicleMaintenanceId;
                existing.UserId = dto.UserId;

                _db.Attachments.Update(existing);
                await _db.SaveChangesAsync();

                response.Data = MapToResponseDto(existing);
                response.Status = ResponseStatus.Success;
                response.Message = "Arquivo atualizado com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "AttachmentService.Update", dto);
                response.Status = ResponseStatus.Error;
                response.Message = "Erro ao atualizar o arquivo.";
            }

            return response;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<AttachmentResponseDto>> Delete(Guid id)
        {
            var response = new WebApiResponse<AttachmentResponseDto>();
            try
            {
                var existing = await _db.Attachments.FindAsync(id);
                if (existing == null)
                {
                    response.Status = ResponseStatus.Error;
                    response.Message = "Anexo não encontrado.";
                    return response;
                }

                // delete file
                try
                {
                    var full = Path.Combine(_env.ContentRootPath, existing.Path);
                    if (File.Exists(full))
                        File.Delete(full);
                }
                catch { }

                var responseDto = MapToResponseDto(existing);

                _db.Attachments.Remove(existing);
                await _db.SaveChangesAsync();

                response.Data = responseDto;
                response.Status = ResponseStatus.Success;
                response.Message = "Arquivo removido com sucesso.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "AttachmentService.Delete", id);
                response.Status = ResponseStatus.Error;
                response.Message = "Erro ao remover o arquivo.";
            }

            return response;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<AttachmentResponseDto>> GetById(Guid id)
        {
            var response = new WebApiResponse<AttachmentResponseDto>();
            try
            {
                if (
                    !await _featureToggleService.IsEnabledAsync(
                        FeatureToggleKeys.Attachment,
                        FeatureToggleKeys.AttachmentsModule
                    )
                )
                {
                    response.Status = ResponseStatus.Success;
                    response.Message = "Não encontrado";
                    return response;
                }

                var data = await _db.Attachments.FindAsync(id);
                if (data == null)
                {
                    response.Status = ResponseStatus.Success;
                    response.Message = "Não encontrado";
                    return response;
                }

                response.Data = MapToResponseDto(data);
                response.Status = ResponseStatus.Success;
                response.Message = "Encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "AttachmentService.GetById", id);
                response.Status = ResponseStatus.Error;
                response.Message = "Erro ao buscar o anexo.";
            }
            return response;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<AttachmentFileResult>> GetFileById(Guid id)
        {
            var response = new WebApiResponse<AttachmentFileResult>();
            try
            {
                if (
                    !await _featureToggleService.IsEnabledAsync(
                        FeatureToggleKeys.Attachment,
                        FeatureToggleKeys.AttachmentsModule
                    )
                )
                {
                    response.Status = ResponseStatus.Error;
                    response.Message = "Anexo não encontrado.";
                    return response;
                }

                var attachment = await _db.Attachments.FindAsync(id);
                if (attachment == null)
                {
                    response.Status = ResponseStatus.Error;
                    response.Message = "Anexo não encontrado.";
                    return response;
                }

                var fullPath = Path.IsPathRooted(attachment.Path)
                    ? attachment.Path
                    : Path.GetFullPath(Path.Combine(_env.ContentRootPath, attachment.Path));

                if (!File.Exists(fullPath))
                {
                    response.Status = ResponseStatus.Error;
                    response.Message = "Arquivo não encontrado no disco.";
                    return response;
                }

                var stream = new FileStream(
                    fullPath,
                    FileMode.Open,
                    FileAccess.Read,
                    FileShare.Read
                );

                var provider = new FileExtensionContentTypeProvider();
                if (!provider.TryGetContentType(attachment.FileName, out var contentType))
                {
                    contentType = "application/octet-stream";
                }

                response.Data = new AttachmentFileResult
                {
                    Stream = stream,
                    ContentType = contentType,
                    FileName = attachment.FileName,
                };
                response.Status = ResponseStatus.Success;
                response.Message = "Arquivo localizado.";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "AttachmentService.GetFileById", id);
                response.Status = ResponseStatus.Error;
                response.Message = "Erro ao obter o arquivo.";
            }

            return response;
        }

        /// <inheritdoc />
        public Task<WebApiResponse<IEnumerable<AttachmentResponseDto>>> GetByBusinessPartnerId(
            Guid businessPartnerId
        )
        {
            return QueryAsync(q => q.Where(a => a.BusinessPartnerId == businessPartnerId));
        }

        /// <inheritdoc />
        public Task<WebApiResponse<IEnumerable<AttachmentResponseDto>>> GetByOrderId(Guid orderId)
        {
            return QueryAsync(q => q.Where(a => a.OrderId == orderId));
        }

        /// <inheritdoc />
        public Task<WebApiResponse<IEnumerable<AttachmentResponseDto>>> GetByTripId(Guid tripId)
        {
            return QueryAsync(q => q.Where(a => a.TripId == tripId));
        }

        /// <inheritdoc />
        public Task<WebApiResponse<IEnumerable<AttachmentResponseDto>>> GetByPurchaseOrderId(
            Guid purchaseOrderId
        )
        {
            return QueryAsync(q => q.Where(a => a.PurchaseOrderId == purchaseOrderId));
        }

        /// <inheritdoc />
        public Task<WebApiResponse<IEnumerable<AttachmentResponseDto>>> GetByTransactionId(
            Guid transactionId
        )
        {
            return QueryAsync(q => q.Where(a => a.TransactionId == transactionId));
        }

        /// <inheritdoc />
        public Task<WebApiResponse<IEnumerable<AttachmentResponseDto>>> GetByPaymentId(
            Guid paymentId
        )
        {
            return QueryAsync(q => q.Where(a => a.PaymentId == paymentId));
        }

        /// <inheritdoc />
        public Task<WebApiResponse<IEnumerable<AttachmentResponseDto>>> GetByProductId(
            Guid productId
        )
        {
            return QueryAsync(q => q.Where(a => a.ProductId == productId));
        }

        /// <inheritdoc />
        public Task<WebApiResponse<IEnumerable<AttachmentResponseDto>>> GetByVehicleId(
            Guid vehicleId
        )
        {
            return QueryAsync(q => q.Where(a => a.VehicleId == vehicleId));
        }

        /// <inheritdoc />
        public Task<WebApiResponse<IEnumerable<AttachmentResponseDto>>> GetByDriverId(
            Guid driverId
        )
        {
            return QueryAsync(q => q.Where(a => a.DriverId == driverId));
        }

        /// <inheritdoc />
        public Task<WebApiResponse<IEnumerable<AttachmentResponseDto>>> GetByVehicleMaintenanceId(
            Guid vehicleMaintenanceId
        )
        {
            return QueryAsync(q => q.Where(a => a.VehicleMaintenanceId == vehicleMaintenanceId));
        }

        /// <inheritdoc />
        public Task<WebApiResponse<IEnumerable<AttachmentResponseDto>>> GetByUserId(string userId)
        {
            return QueryAsync(q => q.Where(a => a.UserId == userId));
        }

        #endregion Public methods

        #region Private methods

        private AttachmentResponseDto MapToResponseDto(Attachment attachment)
        {
            // Extract folder path only (remove file name), normalize separators to forward slash
            var folderPath = string.IsNullOrWhiteSpace(attachment.Path)
                ? string.Empty
                : System.IO.Path.GetDirectoryName(attachment.Path)?.Replace('\\', '/')
                    ?? string.Empty;

            return new AttachmentResponseDto
            {
                Id = attachment.Id,
                FileName = attachment.FileName,
                Path = folderPath,
                DownloadUrl = string.Format(_downloadUrlTemplate, attachment.Id),
                BusinessPartnerId = attachment.BusinessPartnerId,
                OrderId = attachment.OrderId,
                PurchaseOrderId = attachment.PurchaseOrderId,
                TripId = attachment.TripId,
                TransactionId = attachment.TransactionId,
                PaymentId = attachment.PaymentId,
                ProductId = attachment.ProductId,
                VehicleId = attachment.VehicleId,
                DriverId = attachment.DriverId,
                VehicleMaintenanceId = attachment.VehicleMaintenanceId,
                UserId = attachment.UserId,
                CreateDate = attachment.CreateDate,
                ModifyDate = attachment.ModifyDate,
            };
        }

        private string ResolveBasePath(string configuredPath)
        {
            if (!string.IsNullOrWhiteSpace(configuredPath))
            {
                return Path.IsPathRooted(configuredPath)
                    ? Path.GetFullPath(configuredPath)
                    : Path.GetFullPath(Path.Combine(_env.ContentRootPath, configuredPath));
            }

            var dir = new DirectoryInfo(_env.ContentRootPath);
            var found = dir.FullName;
            while (dir != null && dir.FullName != dir.Root.FullName)
            {
                if (
                    Directory.Exists(Path.Combine(dir.FullName, ".git"))
                    || dir.GetFiles("*.sln").Any()
                    || string.Equals(dir.Name, "TSI.Nexus", StringComparison.OrdinalIgnoreCase)
                )
                {
                    found = dir.FullName;
                    break;
                }
                dir = dir.Parent;
            }

            return Path.GetFullPath(Path.Combine(found, configuredPath ?? "attachments"));
        }

        /// <summary>
        /// Resolves the full chain of parent IDs on the DTO.
        /// If overridePath is provided (e.g. "BusinessPartners/Name/Orders/TEA-00022"),
        /// parses it to extract entity identifiers and fill the DTO IDs.
        /// Then resolves remaining parent IDs up the chain:
        /// OrderNumber → resolves OrderId
        /// Payment → fills TransactionId, OrderId, BusinessPartnerId
        /// Transaction → fills OrderId, BusinessPartnerId
        /// Order → fills BusinessPartnerId
        /// </summary>
        private async Task ResolveParentIdsAsync(AttachmentDto dto, string overridePath)
        {
            // Parse overridePath to extract entity identifiers
            if (!string.IsNullOrWhiteSpace(overridePath))
            {
                await ParseOverridePathAsync(dto, overridePath);
            }

            // Resolve OrderId from OrderNumber when OrderId is not provided
            if (dto.OrderId == null && !string.IsNullOrWhiteSpace(dto.OrderNumber))
            {
                var order = await _db.Order.FirstOrDefaultAsync(o =>
                    o.OrderNumber == dto.OrderNumber
                );
                if (order != null)
                {
                    dto.OrderId = order.Id;
                    dto.BusinessPartnerId ??= order.BusinessPartnerId;
                }
            }

            // Resolve PurchaseOrderId from PurchaseOrderNumber when PurchaseOrderId is not provided
            if (dto.PurchaseOrderId == null && !string.IsNullOrWhiteSpace(dto.PurchaseOrderNumber))
            {
                var purchaseOrder = await _db.PurchaseOrder.FirstOrDefaultAsync(o =>
                    o.PurchaseOrderNumber == dto.PurchaseOrderNumber
                );
                if (purchaseOrder != null)
                {
                    dto.PurchaseOrderId = purchaseOrder.Id;
                    dto.BusinessPartnerId ??= purchaseOrder.BusinessPartnerId;
                }
            }

            // Resolve TripId from TripNumber when TripId is not provided
            if (dto.TripId == null && !string.IsNullOrWhiteSpace(dto.TripNumber))
            {
                var trip = await _db.Trip.FirstOrDefaultAsync(t =>
                    t.TripNumber == dto.TripNumber
                );
                if (trip != null)
                {
                    dto.TripId = trip.Id;
                    dto.BusinessPartnerId ??= trip.BusinessPartnerId;
                }
            }

            // Payment → Transaction → Order/PurchaseOrder → BusinessPartner
            if (dto.PaymentId != null && dto.TransactionId == null)
            {
                var payment = await _db.Payment.FindAsync(dto.PaymentId.Value);
                if (payment != null)
                {
                    dto.TransactionId = payment.TransactionId;
                    dto.OrderId ??= payment.OrderId;
                    dto.PurchaseOrderId ??= payment.PurchaseOrderId;
                    dto.TripId ??= payment.TripId;
                    dto.BusinessPartnerId ??= payment.BusinessPartnerId;
                }
            }

            // Transaction → Order/PurchaseOrder/Trip → BusinessPartner
            if (
                dto.TransactionId != null
                && (
                    dto.OrderId == null
                    || dto.PurchaseOrderId == null
                    || dto.TripId == null
                    || dto.BusinessPartnerId == null
                )
            )
            {
                var transaction = await _db.Transaction.FindAsync(dto.TransactionId.Value);
                if (transaction != null)
                {
                    dto.OrderId ??= transaction.OrderId;
                    dto.PurchaseOrderId ??= transaction.PurchaseOrderId;
                    dto.TripId ??= transaction.TripId;
                    dto.BusinessPartnerId ??= transaction.BusinessPartnerId;
                }
            }

            // Order → BusinessPartner
            if (dto.OrderId != null && dto.BusinessPartnerId == null)
            {
                var order = await _db.Order.FindAsync(dto.OrderId.Value);
                if (order != null)
                {
                    dto.BusinessPartnerId = order.BusinessPartnerId;
                }
            }

            // PurchaseOrder → BusinessPartner
            if (dto.PurchaseOrderId != null && dto.BusinessPartnerId == null)
            {
                var purchaseOrder = await _db.PurchaseOrder.FindAsync(dto.PurchaseOrderId.Value);
                if (purchaseOrder != null)
                {
                    dto.BusinessPartnerId = purchaseOrder.BusinessPartnerId;
                }
            }

            // Trip → BusinessPartner
            if (dto.TripId != null && dto.BusinessPartnerId == null)
            {
                var trip = await _db.Trip.FindAsync(dto.TripId.Value);
                if (trip != null)
                {
                    dto.BusinessPartnerId = trip.BusinessPartnerId;
                }
            }
        }

        /// <summary>
        /// Parses the overridePath to extract entity identifiers.
        /// Expected patterns:
        ///   BusinessPartners/{BpName}
        ///   BusinessPartners/{BpName}/Orders/{OrderNumber}
        ///   BusinessPartners/{BpName}/Transactions/{TransactionId}
        ///   BusinessPartners/{BpName}/Transactions/{TransactionId}/Payments/{PaymentId}
        ///   Products/{ProductName}
        ///   Users/{UserId}
        /// </summary>
        private async Task ParseOverridePathAsync(AttachmentDto dto, string overridePath)
        {
            // Normalize separators and split
            var segments = overridePath
                .Replace('\\', '/')
                .Split('/', StringSplitOptions.RemoveEmptyEntries);

            if (segments.Length < 2)
                return;

            var root = segments[0];

            if (
                root.Equals("BusinessPartners", StringComparison.OrdinalIgnoreCase)
                && segments.Length >= 2
            )
            {
                // Resolve BusinessPartnerId from name
                var bpName = segments[1];
                if (dto.BusinessPartnerId == null)
                {
                    var bp = await _db.BusinessPartner.FirstOrDefaultAsync(b => b.Name == bpName);
                    dto.BusinessPartnerId ??= bp?.Id;
                }

                if (segments.Length >= 4)
                {
                    var entityType = segments[2];
                    var entityValue = segments[3];

                    if (entityType.Equals("Orders", StringComparison.OrdinalIgnoreCase))
                    {
                        // entityValue is OrderNumber (e.g. "TEA-00022")
                        dto.OrderNumber ??= entityValue;
                    }
                    else if (entityType.Equals("PurchaseOrders", StringComparison.OrdinalIgnoreCase))
                    {
                        // entityValue is PurchaseOrderNumber (e.g. "FOR-00022")
                        dto.PurchaseOrderNumber ??= entityValue;
                    }
                    else if (entityType.Equals("Trips", StringComparison.OrdinalIgnoreCase))
                    {
                        // entityValue is TripNumber (e.g. "SER-V00022")
                        dto.TripNumber ??= entityValue;
                    }
                    else if (entityType.Equals("Transactions", StringComparison.OrdinalIgnoreCase))
                    {
                        // entityValue is TransactionId (Guid)
                        if (
                            dto.TransactionId == null
                            && Guid.TryParse(entityValue, out var transId)
                        )
                        {
                            dto.TransactionId = transId;
                        }

                        // Check for Payments sub-folder
                        if (
                            segments.Length >= 6
                            && segments[4].Equals("Payments", StringComparison.OrdinalIgnoreCase)
                        )
                        {
                            if (dto.PaymentId == null && Guid.TryParse(segments[5], out var payId))
                            {
                                dto.PaymentId = payId;
                            }
                        }
                    }
                }
            }
            else if (
                root.Equals("Products", StringComparison.OrdinalIgnoreCase)
                && segments.Length >= 2
            )
            {
                // Resolve ProductId from name
                var productName = segments[1];
                if (dto.ProductId == null)
                {
                    var product = await _db.Product.FirstOrDefaultAsync(p => p.Name == productName);
                    dto.ProductId ??= product?.Id;
                }
            }
            else if (
                root.Equals("Vehicles", StringComparison.OrdinalIgnoreCase)
                && segments.Length >= 2
            )
            {
                // Resolve VehicleId from plate
                var plate = segments[1];
                if (dto.VehicleId == null)
                {
                    var vehicle = await _db.Vehicle.FirstOrDefaultAsync(v => v.Plate == plate);
                    dto.VehicleId ??= vehicle?.Id;
                }

                // Check for Maintenances sub-folder (VehicleMaintenanceId, a Guid segment - there's
                // no human-friendly number for a maintenance the way OrderNumber/TripNumber are)
                if (
                    segments.Length >= 4
                    && segments[2].Equals("Maintenances", StringComparison.OrdinalIgnoreCase)
                    && dto.VehicleMaintenanceId == null
                    && Guid.TryParse(segments[3], out var maintenanceId)
                )
                {
                    dto.VehicleMaintenanceId = maintenanceId;
                }
            }
            else if (
                root.Equals("Drivers", StringComparison.OrdinalIgnoreCase)
                && segments.Length >= 2
            )
            {
                // Resolve DriverId from name
                var driverName = segments[1];
                if (dto.DriverId == null)
                {
                    var driver = await _db.Driver.FirstOrDefaultAsync(d => d.Name == driverName);
                    dto.DriverId ??= driver?.Id;
                }
            }
            else if (
                root.Equals("Users", StringComparison.OrdinalIgnoreCase)
                && segments.Length >= 2
            )
            {
                dto.UserId ??= segments[1];
            }
        }

        private static string SanitizeFileName(string input) => FileNameSanitizer.Sanitize(input);

        private async Task<WebApiResponse<IEnumerable<AttachmentResponseDto>>> QueryAsync(
            Func<IQueryable<Attachment>, IQueryable<Attachment>> query
        )
        {
            var response = new WebApiResponse<IEnumerable<AttachmentResponseDto>>();
            try
            {
                // AsNoTracking: every GetBy*Id caller maps straight to a DTO, never saves back.
                // ToListAsync (was ToList): this blocked a thread pool thread on I/O instead of
                // yielding it back for the duration of the query.
                var q = query(_db.Attachments.AsNoTracking().AsQueryable());
                var attachments = await q.ToListAsync();
                response.Data = attachments.Select(MapToResponseDto);
                response.Status = ResponseStatus.Success;
                response.Message = "Encontrado";
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "AttachmentService.Query", null);
                response.Status = ResponseStatus.Error;
                response.Message = "Erro ao consultar anexos.";
            }
            return response;
        }

        /// <summary>
        /// Builds the target folder path based on the DTO fields.
        /// Assumes ResolveParentIdsAsync has already been called, so all IDs are available.
        /// </summary>
        private async Task<string> BuildEntityPathAsync(AttachmentDto dto)
        {
            var baseConfigured = _config["Attachments:BasePath"] ?? "attachments";
            var basePath = ResolveBasePath(baseConfigured);

            // Resolve business partner name
            string bpName = null;
            if (dto.BusinessPartnerId != null)
            {
                var bp = await _db.BusinessPartner.FindAsync(dto.BusinessPartnerId.Value);
                bpName = bp != null ? SanitizeFileName(bp.Name) : null;
            }

            // Payment → BusinessPartners/{BpName}/Transactions/{TransactionId}/Payments/{PaymentId}
            if (dto.PaymentId != null && bpName != null)
            {
                var transactionFolder = dto.TransactionId?.ToString() ?? "unknown";
                var paymentFolder = dto.PaymentId.ToString();
                return Path.Combine(
                    basePath,
                    "BusinessPartners",
                    bpName,
                    "Transactions",
                    transactionFolder,
                    "Payments",
                    paymentFolder
                );
            }

            // Transaction → BusinessPartners/{BpName}/Transactions/{TransactionId}
            if (dto.TransactionId != null && bpName != null)
            {
                var transactionFolder = dto.TransactionId.ToString();
                return Path.Combine(
                    basePath,
                    "BusinessPartners",
                    bpName,
                    "Transactions",
                    transactionFolder
                );
            }

            // Order → BusinessPartners/{BpName}/Orders/{OrderNumber}
            if (dto.OrderId != null && bpName != null)
            {
                var order = await _db.Order.FindAsync(dto.OrderId.Value);
                var orderFolder =
                    order != null && !string.IsNullOrWhiteSpace(order.OrderNumber)
                        ? SanitizeFileName(order.OrderNumber)
                        : dto.OrderId.ToString();
                return Path.Combine(basePath, "BusinessPartners", bpName, "Orders", orderFolder);
            }

            // PurchaseOrder → BusinessPartners/{BpName}/PurchaseOrders/{PurchaseOrderNumber}
            if (dto.PurchaseOrderId != null && bpName != null)
            {
                var purchaseOrder = await _db.PurchaseOrder.FindAsync(dto.PurchaseOrderId.Value);
                var purchaseOrderFolder =
                    purchaseOrder != null
                    && !string.IsNullOrWhiteSpace(purchaseOrder.PurchaseOrderNumber)
                        ? SanitizeFileName(purchaseOrder.PurchaseOrderNumber)
                        : dto.PurchaseOrderId.ToString();
                return Path.Combine(
                    basePath,
                    "BusinessPartners",
                    bpName,
                    "PurchaseOrders",
                    purchaseOrderFolder
                );
            }

            // Trip → BusinessPartners/{BpName}/Trips/{TripNumber}
            if (dto.TripId != null && bpName != null)
            {
                var trip = await _db.Trip.FindAsync(dto.TripId.Value);
                var tripFolder =
                    trip != null && !string.IsNullOrWhiteSpace(trip.TripNumber)
                        ? SanitizeFileName(trip.TripNumber)
                        : dto.TripId.ToString();
                return Path.Combine(basePath, "BusinessPartners", bpName, "Trips", tripFolder);
            }

            // BusinessPartner → BusinessPartners/{BpName}
            if (dto.BusinessPartnerId != null && bpName != null)
                return Path.Combine(basePath, "BusinessPartners", bpName);

            // Product → Products/{ProductName}
            if (dto.ProductId != null)
            {
                var product = await _db.Product.FindAsync(dto.ProductId.Value);
                var productFolder =
                    product != null && !string.IsNullOrWhiteSpace(product.Name)
                        ? SanitizeFileName(product.Name)
                        : dto.ProductId.ToString();
                return Path.Combine(basePath, "Products", productFolder);
            }

            // VehicleMaintenance → Vehicles/{Plate}/Maintenances/{MaintenanceId}
            if (dto.VehicleMaintenanceId != null)
            {
                var maintenance = await _db.VehicleMaintenance.FindAsync(
                    dto.VehicleMaintenanceId.Value
                );
                var maintenanceVehicle =
                    maintenance != null
                        ? await _db.Vehicle.FindAsync(maintenance.VehicleId)
                        : null;
                var maintenanceVehicleFolder =
                    maintenanceVehicle != null && !string.IsNullOrWhiteSpace(maintenanceVehicle.Plate)
                        ? SanitizeFileName(maintenanceVehicle.Plate)
                        : maintenance?.VehicleId.ToString() ?? "Unknown";
                return Path.Combine(
                    basePath,
                    "Vehicles",
                    maintenanceVehicleFolder,
                    "Maintenances",
                    dto.VehicleMaintenanceId.ToString()
                );
            }

            // Vehicle → Vehicles/{Plate}
            if (dto.VehicleId != null)
            {
                var vehicle = await _db.Vehicle.FindAsync(dto.VehicleId.Value);
                var vehicleFolder =
                    vehicle != null && !string.IsNullOrWhiteSpace(vehicle.Plate)
                        ? SanitizeFileName(vehicle.Plate)
                        : dto.VehicleId.ToString();
                return Path.Combine(basePath, "Vehicles", vehicleFolder);
            }

            // Driver → Drivers/{Name}
            if (dto.DriverId != null)
            {
                var driver = await _db.Driver.FindAsync(dto.DriverId.Value);
                var driverFolder =
                    driver != null && !string.IsNullOrWhiteSpace(driver.Name)
                        ? SanitizeFileName(driver.Name)
                        : dto.DriverId.ToString();
                return Path.Combine(basePath, "Drivers", driverFolder);
            }

            // User → Users/{UserId}
            if (!string.IsNullOrWhiteSpace(dto.UserId))
                return Path.Combine(basePath, "Users", SanitizeFileName(dto.UserId));

            // fallback
            return basePath;
        }

        #endregion Private methods
    }
}
