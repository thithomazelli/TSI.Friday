using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Models;

namespace TSI.Nexus.Data.Seed
{
    /// <summary>
    /// Populates the default DocumentTemplate metadata row for each <see
    /// cref="DocumentTemplateType"/> the first time the application runs, and makes sure the
    /// corresponding file exists on disk (copied from a resource embedded in this assembly - see
    /// the EmbeddedResource items in TSI.Nexus.Data.csproj). The Quote, Contract and ServiceOrder
    /// templates reproduce, in Word, the same layout the Angular document builders used to
    /// hardcode as HTML; that content now lives in the .docx files themselves and is read back by
    /// DocumentPdfGenerationService (TSI.Nexus.Services), not here. SalesOrder is a new, basic
    /// template, since Serodio doesn't have one yet. Letterhead (JPG background image drawn behind
    /// every page) and Signature (PNG signature image in the two-column signature block) are the
    /// two non-.docx types; an Admin can replace either the same way as the .docx templates, via
    /// the Upload endpoint.
    ///
    /// The actual file path (fixed name per type, e.g. "Quote.docx") is resolved the same way
    /// DocumentTemplateService.ResolveFilePath does - a configurable "DocumentTemplates:BasePath"
    /// outside the published output, so a manual redeploy doesn't wipe an Admin-uploaded template.
    /// This seeder only ever creates what's missing - it never overwrites a template an Admin has
    /// already edited, and never overwrites a file that already exists on disk.
    /// </summary>
    public static class DocumentTemplateSeeder
    {
        public static async Task SeedAsync(IServiceProvider services)
        {
            using var scope = services.CreateScope();
            var provider = scope.ServiceProvider;
            var logger = provider.GetService<ILoggerFactory>()?.CreateLogger("DocumentTemplateSeeder");

            try
            {
                var context = provider.GetRequiredService<MyDBContextEF>();
                var env = provider.GetRequiredService<IHostEnvironment>();
                var config = provider.GetRequiredService<IConfiguration>();

                foreach (var (type, name, fileName) in BuildDefaultTemplateManifest())
                {
                    var filePath = ResolveFilePath(env, config, type);
                    if (!File.Exists(filePath))
                    {
                        await File.WriteAllBytesAsync(filePath, ReadEmbeddedTemplate(fileName));
                        logger?.LogInformation(
                            "DocumentTemplateSeeder: wrote default .docx file for {Type} at {Path}",
                            type,
                            filePath
                        );
                    }

                    var alreadyExists = await context.DocumentTemplate.AnyAsync(d => d.Type == type);
                    if (alreadyExists)
                    {
                        continue;
                    }

                    await context.DocumentTemplate.AddAsync(
                        new DocumentTemplate { Type = type, Name = name, FileName = fileName }
                    );
                    logger?.LogInformation("DocumentTemplateSeeder: created default template for {Type}", type);
                }

                await context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "An error occurred while seeding the default document templates.");
            }
        }

        private static (DocumentTemplateType Type, string Name, string FileName)[] BuildDefaultTemplateManifest()
        {
            return
            [
                (DocumentTemplateType.Quote, "Orçamento", "orcamento.docx"),
                (DocumentTemplateType.Contract, "Contrato de Fretamento", "contrato.docx"),
                (DocumentTemplateType.ServiceOrder, "Ordem de Serviço", "ordem-de-servico.docx"),
                (DocumentTemplateType.SalesOrder, "Pedido de Venda", "pedido-de-venda.docx"),
                (DocumentTemplateType.Letterhead, "Papel Timbrado", "letterhead-a4.jpg"),
                (DocumentTemplateType.Signature, "Assinatura", "signature-warlen.png"),
            ];
        }

        /// <summary>
        /// Every type is a .docx template except Letterhead (JPG background artwork) and
        /// Signature (PNG signature image) - mirrors DocumentTemplateService.GetFileExtension
        /// (TSI.Nexus.Services).
        /// </summary>
        private static string GetFileExtension(DocumentTemplateType type) => type switch
        {
            DocumentTemplateType.Letterhead => ".jpg",
            DocumentTemplateType.Signature => ".png",
            _ => ".docx",
        };

        /// <summary>
        /// Mirrors DocumentTemplateService.ResolveFilePath (TSI.Nexus.Services) - kept as a small,
        /// independent duplicate rather than a shared reference, since TSI.Nexus.Data must not
        /// depend on TSI.Nexus.Services (WebAPI -> IoC -> Services -> Repository -> Data ->
        /// Contracts is a one-way dependency chain).
        /// </summary>
        private static string ResolveFilePath(IHostEnvironment env, IConfiguration config, DocumentTemplateType type)
        {
            var configuredPath = config["DocumentTemplates:BasePath"];
            string basePath;

            if (!string.IsNullOrWhiteSpace(configuredPath))
            {
                basePath = Path.IsPathRooted(configuredPath)
                    ? Path.GetFullPath(configuredPath)
                    : Path.GetFullPath(Path.Combine(env.ContentRootPath, configuredPath));
            }
            else
            {
                var dir = new DirectoryInfo(env.ContentRootPath);
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

                basePath = Path.GetFullPath(Path.Combine(found, "document-templates"));
            }

            Directory.CreateDirectory(basePath);
            return Path.Combine(basePath, $"{type}{GetFileExtension(type)}");
        }

        /// <summary>
        /// Reads a default template's bytes from the embedded .docx resources under
        /// Seed/DocumentTemplates - matched by file name suffix rather than a hardcoded full
        /// manifest name, so it doesn't depend on the assembly's root namespace staying exactly
        /// "TSI.Nexus.Data".
        /// </summary>
        private static byte[] ReadEmbeddedTemplate(string fileName)
        {
            var assembly = Assembly.GetExecutingAssembly();
            var resourceName = assembly
                .GetManifestResourceNames()
                .FirstOrDefault(n => n.EndsWith("." + fileName, StringComparison.OrdinalIgnoreCase));

            if (resourceName == null)
            {
                throw new InvalidOperationException(
                    $"Embedded document template '{fileName}' was not found in {assembly.FullName}."
                );
            }

            using var stream = assembly.GetManifestResourceStream(resourceName)!;
            using var memoryStream = new MemoryStream();
            stream.CopyTo(memoryStream);
            return memoryStream.ToArray();
        }
    }
}
