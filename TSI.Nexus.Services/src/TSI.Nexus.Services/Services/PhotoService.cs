using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Configuration;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services.Services
{
    /// <summary>
    /// Handles entity profile photos: saves the file to a dedicated _photos folder
    /// and updates the Photo field on the entity.
    /// Attachments (general files) are managed by AttachmentService.
    /// </summary>
    public class PhotoService : IPhotoService
    {
        #region Properties

        private readonly IWebHostEnvironment _env;
        private readonly IRepository<BusinessPartner> _businessPartnerRepository;
        private readonly IRepository<Product> _productRepository;
        private readonly IRepository<User> _userRepository;
        private readonly IRepository<Vehicle> _vehicleRepository;
        private readonly IRepository<Driver> _driverRepository;
        private readonly IConfiguration _configuration;

        private static readonly string[] AllowedExts = { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
        private const long MaxBytes = 5 * 1024 * 1024; // 5 MB
        #endregion Properties

        #region Public methods

        public PhotoService(
            IWebHostEnvironment env,
            IRepository<BusinessPartner> businessPartnerRepository,
            IRepository<Product> productRepository,
            IRepository<User> userRepository,
            IRepository<Vehicle> vehicleRepository,
            IRepository<Driver> driverRepository,
            IConfiguration configuration
        )
        {
            _env = env ?? throw new ArgumentNullException(nameof(env));
            _businessPartnerRepository =
                businessPartnerRepository
                ?? throw new ArgumentNullException(nameof(businessPartnerRepository));
            _productRepository =
                productRepository ?? throw new ArgumentNullException(nameof(productRepository));
            _userRepository =
                userRepository ?? throw new ArgumentNullException(nameof(userRepository));
            _vehicleRepository =
                vehicleRepository ?? throw new ArgumentNullException(nameof(vehicleRepository));
            _driverRepository =
                driverRepository ?? throw new ArgumentNullException(nameof(driverRepository));
            _configuration =
                configuration ?? throw new ArgumentNullException(nameof(configuration));
        }

        /// <inheritdoc />
        public async Task<string> UploadImageAsync(
            string entityFolder,
            Guid entityId,
            IFormFile file
        )
        {
            var dirPath = await BuildPhotoPathAsync(entityFolder, entityId);
            Directory.CreateDirectory(dirPath);

            // Retrieve the current photo name from the entity before any changes
            var previousFileName = await GetCurrentPhotoAsync(entityFolder, entityId);

            if (file == null)
            {
                DeletePhoto(dirPath, previousFileName);
                await UpdateEntityPhotoAsync(entityFolder, entityId, null);
                return string.Empty;
            }

            var ext = Path.GetExtension(file.FileName)?.ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(ext) || !AllowedExts.Contains(ext))
                throw new ArgumentException("Unsupported file extension");

            if (file.Length > MaxBytes)
                throw new ArgumentException("File too large");

            var fileName = SanitizeFileName(file.FileName);

            // Delete previous photo if it exists and is different from the new one
            DeletePhoto(dirPath, previousFileName);

            var finalPath = Path.Combine(dirPath, fileName);

            using (var stream = new FileStream(finalPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            await UpdateEntityPhotoAsync(entityFolder, entityId, fileName);

            return fileName;
        }

        /// <inheritdoc />
        public async Task<WebApiResponse<AttachmentFileResult>> GetPhotoFileAsync(
            string entity,
            Guid entityId,
            string fileName
        )
        {
            var response = new WebApiResponse<AttachmentFileResult>();

            if (string.IsNullOrWhiteSpace(fileName))
            {
                response.Status = ResponseStatus.Error;
                response.Message = "File name is required";
                return response;
            }

            var dirPath = await BuildPhotoPathAsync(entity, entityId);
            var fullPath = Path.Combine(dirPath, SanitizeFileName(fileName));

            if (!File.Exists(fullPath))
            {
                response.Status = ResponseStatus.Error;
                response.Message = "Photo not found";
                return response;
            }

            var provider = new FileExtensionContentTypeProvider();
            if (!provider.TryGetContentType(fullPath, out var contentType))
            {
                contentType = "application/octet-stream";
            }

            var stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);

            response.Data = new AttachmentFileResult
            {
                Stream = stream,
                ContentType = contentType,
                FileName = Path.GetFileName(fullPath),
            };
            response.Status = ResponseStatus.Success;
            response.Message = "Photo found";

            return response;
        }

        #endregion Public methods

        #region Private methods

        /// <summary>
        /// Builds the photo storage path resolving entity name when applicable:
        ///   BusinessPartner(s) → {basePath}/BusinessPartners/{Name}
        ///   Product(s)  → {basePath}/Products/{entityId}
        ///   User(s)            → {basePath}/Users/{entityId}
        ///   Vehicle(s)         → {basePath}/Vehicles/{entityId}
        ///   Driver(s)          → {basePath}/Drivers/{entityId}
        /// entityFolder comes straight from the (authenticated, but otherwise untrusted) request -
        /// an allow-list here, instead of a catch-all default that combined it into the path
        /// as-is, is what stops "../../.." or an absolute path from escaping basePath.
        /// </summary>
        private async Task<string> BuildPhotoPathAsync(string entityFolder, Guid entityId)
        {
            var basePath = ResolveBasePath();

            switch (entityFolder)
            {
                case "BusinessPartner":
                case "BusinessPartners":
                {
                    var bp = await _businessPartnerRepository.GetByIdAsync(entityId);
                    var folderName = bp != null ? SanitizeFileName(bp.Name) : entityId.ToString();
                    return Path.Combine(basePath, "BusinessPartners", folderName);
                }
                case "Product":
                case "Products":
                    return Path.Combine(basePath, "Products", entityId.ToString());
                case "User":
                case "Users":
                    return Path.Combine(basePath, "Users", entityId.ToString());
                case "Vehicle":
                case "Vehicles":
                    return Path.Combine(basePath, "Vehicles", entityId.ToString());
                case "Driver":
                case "Drivers":
                    return Path.Combine(basePath, "Drivers", entityId.ToString());
                default:
                    throw new ArgumentException("Unknown entity folder", nameof(entityFolder));
            }
        }

        private string ResolveBasePath()
        {
            var configuredPath = _configuration["Attachments:BasePath"] ?? "attachments";

            if (!string.IsNullOrWhiteSpace(configuredPath))
            {
                return Path.IsPathRooted(configuredPath)
                    ? Path.GetFullPath(configuredPath)
                    : Path.GetFullPath(Path.Combine(_env.ContentRootPath, configuredPath));
            }

            return Path.GetFullPath(Path.Combine(_env.ContentRootPath, "attachments"));
        }

        private static string SanitizeFileName(string input) => FileNameSanitizer.Sanitize(input);

        /// <summary>
        /// Deletes a specific photo file from the directory.
        /// </summary>
        private void DeletePhoto(string dirPath, string fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName))
                return;

            var fullPath = Path.Combine(dirPath, SanitizeFileName(fileName));
            try
            {
                if (File.Exists(fullPath))
                    File.Delete(fullPath);
            }
            catch
            { /* ignore */
            }
        }

        /// <summary>
        /// Retrieves the current Photo value from the entity.
        /// </summary>
        private async Task<string> GetCurrentPhotoAsync(string entityFolder, Guid entityId)
        {
            switch (entityFolder)
            {
                case "BusinessPartner":
                case "BusinessPartners":
                {
                    var bp = await _businessPartnerRepository.GetByIdAsync(entityId);
                    return bp.Photo;
                }
                case "User":
                case "Users":
                {
                    var user = await _userRepository.GetByIdAsync(entityId.ToString());
                    return user.Photo;
                }
                case "Product":
                case "Products":
                {
                    var product = await _productRepository.GetByIdAsync(entityId);
                    return product.Photo;
                }
                case "Vehicle":
                case "Vehicles":
                {
                    var vehicle = await _vehicleRepository.GetByIdAsync(entityId);
                    return vehicle.Photo;
                }
                case "Driver":
                case "Drivers":
                {
                    var driver = await _driverRepository.GetByIdAsync(entityId);
                    return driver.Photo;
                }
                default:
                    return string.Empty;
            }
        }

        private async Task UpdateEntityPhotoAsync(
            string entityFolder,
            Guid entityId,
            string fileName
        )
        {
            switch (entityFolder)
            {
                case "BusinessPartner":
                case "BusinessPartners":
                {
                    var bp = await _businessPartnerRepository.GetByIdAsync(entityId);
                    if (bp != null)
                    {
                        bp.Photo = fileName;
                        await _businessPartnerRepository.UpdateAsync(bp);
                    }
                    break;
                }
                case "User":
                case "Users":
                {
                    var user = await _userRepository.GetByIdAsync(entityId.ToString());
                    if (user != null)
                    {
                        user.Photo = fileName;
                        await _userRepository.UpdateAsync(user);
                    }
                    break;
                }
                case "Product":
                case "Products":
                {
                    var product = await _productRepository.GetByIdAsync(entityId);
                    if (product != null)
                    {
                        product.Photo = fileName;
                        await _productRepository.UpdateAsync(product);
                    }
                    break;
                }
                case "Vehicle":
                case "Vehicles":
                {
                    var vehicle = await _vehicleRepository.GetByIdAsync(entityId);
                    if (vehicle != null)
                    {
                        vehicle.Photo = fileName;
                        await _vehicleRepository.UpdateAsync(vehicle);
                    }
                    break;
                }
                case "Driver":
                case "Drivers":
                {
                    var driver = await _driverRepository.GetByIdAsync(entityId);
                    if (driver != null)
                    {
                        driver.Photo = fileName;
                        await _driverRepository.UpdateAsync(driver);
                    }
                    break;
                }
                default:
                    throw new ArgumentException("Unknown entity folder", nameof(entityFolder));
            }
        }

        #endregion Private methods
    }
}
