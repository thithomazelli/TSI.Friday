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

            return File(bytes, DocxContentType, webApiResponse.Data.FileName);
        }

        /// <summary>
        /// Upload a new template file for the given type, replacing its Content. Only .docx files
        /// are accepted - the upload is rejected if the file isn't a valid ZIP archive containing
        /// a word/document.xml entry (the OOXML WordprocessingML signature), which also rejects
        /// any leftover .html template from before this format switched.
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

            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            var content = memoryStream.ToArray();

            if (!IsDocx(content))
            {
                return BadRequest("O arquivo enviado não é um documento .docx válido.");
            }

            var webApiResponse = await _documentTemplateService.UploadContent(
                type,
                file.FileName,
                content
            );
            return Ok(webApiResponse);
        }

        /// <summary>
        /// Checks the ZIP signature and, inside the archive, the presence of word/document.xml -
        /// the entry every .docx (a ZIP of OOXML parts) must have - without needing a full OOXML
        /// parsing library on the backend just to validate an upload.
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
                return archive.GetEntry("word/document.xml") != null;
            }
            catch (InvalidDataException)
            {
                return false;
            }
        }
    }
}
