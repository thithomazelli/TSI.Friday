using System;
using System.IO;
using System.IO.Compression;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.WebAPI.Controllers
{
    [Authorize(Policy = "RequireAdmin")]
    [Route("api/[controller]")]
    [ApiController]
    public class DocumentTemplatesController : Controller
    {
        /// <summary>
        /// DocumentTemplateService object created to access the service model.
        /// </summary>
        private readonly IDocumentTemplateService _documentTemplateService;

        /// <summary>
        /// DocumentTemplatesController constructor create to initialize the "_documentTemplateService" using Dependency Injection.
        /// </summary>
        /// <param name="documentTemplateService">IDocumentTemplateService object used to initialize the internal variable using Dependency Injection.</param>
        public DocumentTemplatesController(IDocumentTemplateService documentTemplateService)
        {
            _documentTemplateService = documentTemplateService;
        }

        /// <summary>
        /// Add document template on database
        /// </summary>
        /// <param name="documentTemplate">Object to be added</param>
        [HttpPost]
        [Route("Add")]
        public async Task<IActionResult> Add([FromBody] DocumentTemplate documentTemplate)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _documentTemplateService.Add(documentTemplate);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Update document template available on database
        /// </summary>
        /// <param name="documentTemplate">Object to be updated</param>
        [HttpPut]
        [Route("Update")]
        public async Task<IActionResult> Update([FromBody] DocumentTemplate documentTemplate)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var webApiResponse = await _documentTemplateService.Update(documentTemplate);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Remove document template when it is identified on database
        /// </summary>
        /// <param name="documentTemplate">Object to be removed</param>
        [HttpDelete]
        [Route("Remove")]
        public async Task<IActionResult> Remove([FromBody] DocumentTemplate documentTemplate)
        {
            var webApiResponse = await _documentTemplateService.Remove(documentTemplate);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get all document templates available on database
        /// </summary>
        [HttpGet]
        [Route("GetAll")]
        public async Task<IActionResult> GetAll()
        {
            var webApiResponse = await _documentTemplateService.FindAll();
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get document template by id
        /// </summary>
        /// <param name="documentTemplateId">DocumentTemplate id to be used in the search</param>
        [HttpGet]
        [Route("GetById/{documentTemplateId}")]
        public async Task<IActionResult> GetById(Guid? documentTemplateId)
        {
            var webApiResponse = await _documentTemplateService.FindById(documentTemplateId);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Get document template by type
        /// </summary>
        /// <param name="type">DocumentTemplateType to be used in the search</param>
        [HttpGet]
        [Route("GetByType/{type}")]
        public async Task<IActionResult> GetByType(DocumentTemplateType type)
        {
            var webApiResponse = await _documentTemplateService.FindByType(type);
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Content-Type used for .docx files (Office Open XML WordprocessingML).
        /// </summary>
        private const string DocxContentType =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

        /// <summary>
        /// Content-Type used for the Letterhead type's JPG background artwork.
        /// </summary>
        private const string JpegContentType = "image/jpeg";

        /// <summary>
        /// Content-Type used for the Signature type's PNG signature image.
        /// </summary>
        private const string PngContentType = "image/png";

        /// <summary>
        /// Max accepted size for an uploaded template file (raw, compressed bytes as received).
        /// </summary>
        private const long MaxUploadBytes = 10 * 1024 * 1024; // 10 MB

        /// <summary>
        /// Max total size a .docx is allowed to expand to once decompressed, guarding against a
        /// zip bomb (a small archive whose entries decompress to a huge amount of data).
        /// </summary>
        private const long MaxDecompressedBytes = 50 * 1024 * 1024; // 50 MB

        /// <summary>
        /// Download the current template file for the given type
        /// </summary>
        /// <param name="type">DocumentTemplateType to be downloaded</param>
        [HttpGet]
        [Route("Download/{type}")]
        public async Task<IActionResult> Download(DocumentTemplateType type)
        {
            var webApiResponse = await _documentTemplateService.FindByType(type);

            if (webApiResponse.Status != ResponseStatus.Success || webApiResponse.Data == null)
            {
                return NotFound(webApiResponse.Message);
            }

            var bytes = await _documentTemplateService.GetFileBytes(type);
            if (bytes == null)
            {
                return NotFound($"O arquivo do template do tipo {type} não foi encontrado.");
            }

            return File(bytes, GetContentType(type), webApiResponse.Data.FileName);
        }

        /// <summary>
        /// Upload a new template file for the given type, replacing its Content. Every type is
        /// validated as a .docx (rejected unless it's a valid ZIP archive containing a
        /// word/document.xml entry - the OOXML WordprocessingML signature, which also rejects any
        /// leftover .html template from before this format switched) except Letterhead and
        /// Signature, which are validated by their image magic bytes since they're artwork, not
        /// text.
        /// </summary>
        /// <param name="type">DocumentTemplateType being replaced</param>
        /// <param name="file">The uploaded template file</param>
        [HttpPost]
        [Route("Upload/{type}")]
        public async Task<IActionResult> Upload(DocumentTemplateType type, IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("Nenhum arquivo foi enviado.");
            }

            if (file.Length > MaxUploadBytes)
            {
                return BadRequest("Arquivo excede o tamanho máximo permitido (10 MB).");
            }

            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            var content = memoryStream.ToArray();

            switch (type)
            {
                case DocumentTemplateType.Letterhead when !IsJpeg(content):
                    return BadRequest("O arquivo enviado não é uma imagem JPG válida.");
                case DocumentTemplateType.Signature when !IsPng(content):
                    return BadRequest("O arquivo enviado não é uma imagem PNG válida.");
                case DocumentTemplateType.Letterhead:
                case DocumentTemplateType.Signature:
                    break;
                default:
                    if (!IsDocx(content))
                    {
                        return BadRequest("O arquivo enviado não é um documento .docx válido.");
                    }
                    break;
            }

            var webApiResponse = await _documentTemplateService.UploadContent(
                type,
                file.FileName,
                content
            );
            return Ok(webApiResponse);
        }

        private static string GetContentType(DocumentTemplateType type) => type switch
        {
            DocumentTemplateType.Letterhead => JpegContentType,
            DocumentTemplateType.Signature => PngContentType,
            _ => DocxContentType,
        };

        /// <summary>
        /// Checks the ZIP signature and, inside the archive, the presence of word/document.xml -
        /// the entry every .docx (a ZIP of OOXML parts) must have - without needing a full OOXML
        /// parsing library on the backend just to validate an upload. Also sums each entry's
        /// declared uncompressed length and rejects the file if the total would exceed
        /// <see cref="MaxDecompressedBytes"/>, guarding against a zip bomb (a small archive that
        /// decompresses to a huge amount of data) - the sum comes from the ZIP's own entry
        /// headers, so this never actually inflates the entries to measure them.
        /// </summary>
        private static bool IsDocx(byte[] content)
        {
            if (content.Length < 4 || content[0] != 0x50 || content[1] != 0x4B
                || content[2] != 0x03 || content[3] != 0x04)
            {
                return false;
            }

            try
            {
                using var stream = new MemoryStream(content);
                using var archive = new ZipArchive(stream, ZipArchiveMode.Read);

                if (archive.GetEntry("word/document.xml") == null)
                {
                    return false;
                }

                long totalDecompressedSize = 0;
                foreach (var entry in archive.Entries)
                {
                    totalDecompressedSize += entry.Length;
                    if (totalDecompressedSize > MaxDecompressedBytes)
                    {
                        return false;
                    }
                }

                return true;
            }
            catch (InvalidDataException)
            {
                return false;
            }
        }

        /// <summary>
        /// Checks the JPEG magic bytes (SOI marker FF D8 FF) - enough to reject an obviously wrong
        /// file (a .docx, a PNG, a stray .html) without needing an imaging library on the backend
        /// just to validate an upload.
        /// </summary>
        private static bool IsJpeg(byte[] content) =>
            content.Length >= 3 && content[0] == 0xFF && content[1] == 0xD8 && content[2] == 0xFF;

        /// <summary>
        /// Checks the PNG signature (the 8-byte magic number every PNG file starts with) - enough
        /// to reject an obviously wrong file without needing an imaging library on the backend just
        /// to validate an upload.
        /// </summary>
        private static bool IsPng(byte[] content)
        {
            ReadOnlySpan<byte> pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
            return content.Length >= pngSignature.Length
                && content.AsSpan(0, pngSignature.Length).SequenceEqual(pngSignature);
        }
    }
}
