using System.IO;
using System.IO.Compression;
using System.Text;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;
using TSI.Nexus.WebAPI.Controllers;

namespace TSI.Nexus.WebAPI.Tests.Controllers
{
    public class DocumentTemplatesControllerTests
    {
        private readonly DocumentTemplatesController _controller;
        private readonly Mock<IDocumentTemplateService> _documentTemplateServiceMock;
        private readonly IList<DocumentTemplate> _templatesMock;

        public DocumentTemplatesControllerTests()
        {
            _documentTemplateServiceMock = new Mock<IDocumentTemplateService>();
            _controller = new DocumentTemplatesController(_documentTemplateServiceMock.Object);

            _templatesMock = new List<DocumentTemplate>
            {
                new DocumentTemplate
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    Type = DocumentTemplateType.Quote,
                    Name = "Orçamento",
                    FileName = "orcamento.docx",
                },
                new DocumentTemplate
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    Type = DocumentTemplateType.Contract,
                    Name = "Contrato de Fretamento",
                    FileName = "contrato.docx",
                },
            };
        }

        /// <summary>
        /// Builds a minimal but real .docx (a ZIP archive with a word/document.xml entry) so tests
        /// exercise the same validation the controller applies to a real upload, instead of relying
        /// on the file extension alone.
        /// </summary>
        private static byte[] BuildDocxBytes()
        {
            using var stream = new MemoryStream();
            using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
            {
                var entry = archive.CreateEntry("word/document.xml");
                using var writer = new StreamWriter(entry.Open());
                writer.Write("<w:document xmlns:w=\"x\"><w:body/></w:document>");
            }
            return stream.ToArray();
        }

        [Fact]
        public async Task GetAll_ShouldReturnOkWithData_WhenServiceReturnsTemplates()
        {
            // Arrange
            var expected = new WebApiResponse<IEnumerable<DocumentTemplate>>
            {
                Data = _templatesMock,
                Status = ResponseStatus.Success,
                Message = $"{_templatesMock.Count} registro(s) encontrado(s).",
            };

            _documentTemplateServiceMock.Setup(s => s.FindAll()).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetAll();

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<DocumentTemplate>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _documentTemplateServiceMock.Verify(s => s.FindAll(), Times.Once);
        }

        [Fact]
        public async Task GetByType_ShouldReturnOkWithTemplate_WhenServiceReturnsTemplate()
        {
            // Arrange
            var template = _templatesMock.First(t => t.Type == DocumentTemplateType.Quote);
            var expected = new WebApiResponse<DocumentTemplate>
            {
                Data = template,
                Status = ResponseStatus.Success,
                Message = $"Template {template.Name} encontrado com sucesso",
            };

            _documentTemplateServiceMock
                .Setup(s => s.FindByType(DocumentTemplateType.Quote))
                .ReturnsAsync(expected);

            // Act
            var result = await _controller.GetByType(DocumentTemplateType.Quote);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<DocumentTemplate>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _documentTemplateServiceMock.Verify(
                s => s.FindByType(DocumentTemplateType.Quote),
                Times.Once
            );
        }

        [Fact]
        public async Task Add_ShouldReturnOkWithCreatedTemplate_WhenModelIsValid()
        {
            // Arrange
            var template = new DocumentTemplate
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                Type = DocumentTemplateType.SalesOrder,
                Name = "Pedido de Venda",
                FileName = "pedido-de-venda.docx",
            };
            var expected = new WebApiResponse<DocumentTemplate>
            {
                Data = template,
                Status = ResponseStatus.Success,
                Message = $"Template {template.Name} cadastrado com sucesso.",
            };

            _documentTemplateServiceMock.Setup(s => s.Add(template)).ReturnsAsync(expected);

            // Act
            var result = await _controller.Add(template);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<DocumentTemplate>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _documentTemplateServiceMock.Verify(s => s.Add(template), Times.Once);
        }

        [Fact]
        public async Task Add_ShouldReturnBadRequest_WhenModelIsInvalid()
        {
            // Arrange
            var template = new DocumentTemplate();
            _controller.ModelState.AddModelError("Name", "Name is required");

            // Act
            var result = await _controller.Add(template);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var modelState = Assert.IsType<SerializableError>(badRequest.Value);
            Assert.True(modelState.ContainsKey("Name"));

            _documentTemplateServiceMock.Verify(
                s => s.Add(It.IsAny<DocumentTemplate>()),
                Times.Never
            );
        }

        [Fact]
        public async Task Update_ShouldReturnOkWithUpdatedTemplate_WhenModelIsValid()
        {
            // Arrange
            var template = _templatesMock.First();
            var expected = new WebApiResponse<DocumentTemplate>
            {
                Data = template,
                Status = ResponseStatus.Success,
                Message = $"Template {template.Name} atualizado com sucesso.",
            };

            _documentTemplateServiceMock.Setup(s => s.Update(template)).ReturnsAsync(expected);

            // Act
            var result = await _controller.Update(template);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<DocumentTemplate>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _documentTemplateServiceMock.Verify(s => s.Update(template), Times.Once);
        }

        [Fact]
        public async Task Update_ShouldReturnBadRequest_WhenModelIsInvalid()
        {
            // Arrange
            var template = new DocumentTemplate();
            _controller.ModelState.AddModelError("Name", "Name is required");

            // Act
            var result = await _controller.Update(template);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var modelState = Assert.IsType<SerializableError>(badRequest.Value);
            Assert.True(modelState.ContainsKey("Name"));

            _documentTemplateServiceMock.Verify(
                s => s.Update(It.IsAny<DocumentTemplate>()),
                Times.Never
            );
        }

        [Fact]
        public async Task Remove_ShouldReturnOkWithRemovedTemplate_WhenMethodIsCalled()
        {
            // Arrange
            var template = _templatesMock.First();
            var expected = new WebApiResponse<DocumentTemplate>
            {
                Data = template,
                Status = ResponseStatus.Success,
                Message = $"Template {template.Name} removido com sucesso.",
            };

            _documentTemplateServiceMock.Setup(s => s.Remove(template)).ReturnsAsync(expected);

            // Act
            var result = await _controller.Remove(template);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<DocumentTemplate>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _documentTemplateServiceMock.Verify(s => s.Remove(template), Times.Once);
        }

        [Fact]
        public async Task GetById_ShouldReturnOkWithTemplate_WhenServiceReturnsTemplate()
        {
            // Arrange
            var template = _templatesMock.First();
            var expected = new WebApiResponse<DocumentTemplate>
            {
                Data = template,
                Status = ResponseStatus.Success,
                Message = $"Template {template.Name} encontrado com sucesso",
            };

            _documentTemplateServiceMock
                .Setup(s => s.FindById(template.Id))
                .ReturnsAsync(expected);

            // Act
            var result = await _controller.GetById(template.Id);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<DocumentTemplate>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _documentTemplateServiceMock.Verify(s => s.FindById(template.Id), Times.Once);
        }

        [Fact]
        public async Task Download_ShouldReturnFile_WhenTemplateIsFound()
        {
            // Arrange
            var template = _templatesMock.First(t => t.Type == DocumentTemplateType.Quote);
            var expected = new WebApiResponse<DocumentTemplate>
            {
                Data = template,
                Status = ResponseStatus.Success,
                Message = $"Template {template.Name} encontrado com sucesso",
            };
            var fileBytes = BuildDocxBytes();

            _documentTemplateServiceMock
                .Setup(s => s.FindByType(DocumentTemplateType.Quote))
                .ReturnsAsync(expected);
            _documentTemplateServiceMock
                .Setup(s => s.GetFileBytes(DocumentTemplateType.Quote))
                .ReturnsAsync(fileBytes);

            // Act
            var result = await _controller.Download(DocumentTemplateType.Quote);

            // Assert
            var fileResult = Assert.IsType<FileContentResult>(result);
            Assert.Equal(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                fileResult.ContentType
            );
            Assert.Equal(template.FileName, fileResult.FileDownloadName);
            Assert.Equal(fileBytes, fileResult.FileContents);
        }

        [Fact]
        public async Task Download_ShouldReturnNotFound_WhenTemplateIsNotFound()
        {
            // Arrange
            var expected = new WebApiResponse<DocumentTemplate>
            {
                Data = null,
                Status = ResponseStatus.Error,
                Message = "Template não encontrado",
            };

            _documentTemplateServiceMock
                .Setup(s => s.FindByType(DocumentTemplateType.Quote))
                .ReturnsAsync(expected);

            // Act
            var result = await _controller.Download(DocumentTemplateType.Quote);

            // Assert
            var notFound = Assert.IsType<NotFoundObjectResult>(result);
            Assert.Equal("Template não encontrado", notFound.Value);
        }

        [Fact]
        public async Task Download_ShouldReturnNotFound_WhenFileIsMissingFromDisk()
        {
            // Arrange
            var template = _templatesMock.First(t => t.Type == DocumentTemplateType.Quote);
            var expected = new WebApiResponse<DocumentTemplate>
            {
                Data = template,
                Status = ResponseStatus.Success,
                Message = $"Template {template.Name} encontrado com sucesso",
            };

            _documentTemplateServiceMock
                .Setup(s => s.FindByType(DocumentTemplateType.Quote))
                .ReturnsAsync(expected);
            _documentTemplateServiceMock
                .Setup(s => s.GetFileBytes(DocumentTemplateType.Quote))
                .ReturnsAsync((byte[])null);

            // Act
            var result = await _controller.Download(DocumentTemplateType.Quote);

            // Assert
            Assert.IsType<NotFoundObjectResult>(result);
        }

        [Fact]
        public async Task Upload_ShouldReturnBadRequest_WhenFileIsNull()
        {
            // Act
            var result = await _controller.Upload(DocumentTemplateType.Quote, null);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal("Nenhum arquivo foi enviado.", badRequest.Value);

            _documentTemplateServiceMock.Verify(
                s => s.UploadContent(It.IsAny<DocumentTemplateType>(), It.IsAny<string>(), It.IsAny<byte[]>()),
                Times.Never
            );
        }

        [Fact]
        public async Task Upload_ShouldReturnBadRequest_WhenFileIsEmpty()
        {
            // Arrange
            var fileMock = new Mock<IFormFile>();
            fileMock.Setup(f => f.Length).Returns(0);

            // Act
            var result = await _controller.Upload(DocumentTemplateType.Quote, fileMock.Object);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal("Nenhum arquivo foi enviado.", badRequest.Value);

            _documentTemplateServiceMock.Verify(
                s => s.UploadContent(It.IsAny<DocumentTemplateType>(), It.IsAny<string>(), It.IsAny<byte[]>()),
                Times.Never
            );
        }

        [Fact]
        public async Task Upload_ShouldReturnBadRequest_WhenFileExceedsMaxUploadSize()
        {
            // Arrange
            var fileMock = new Mock<IFormFile>();
            fileMock.Setup(f => f.Length).Returns(10 * 1024 * 1024 + 1);
            fileMock.Setup(f => f.FileName).Returns("grande.docx");

            // Act
            var result = await _controller.Upload(DocumentTemplateType.Quote, fileMock.Object);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal("Arquivo excede o tamanho máximo permitido (10 MB).", badRequest.Value);

            _documentTemplateServiceMock.Verify(
                s => s.UploadContent(It.IsAny<DocumentTemplateType>(), It.IsAny<string>(), It.IsAny<byte[]>()),
                Times.Never
            );
        }

        [Fact]
        public async Task Upload_ShouldReturnBadRequest_WhenDocxDecompressesBeyondSizeGuard()
        {
            // Arrange - a legitimate word/document.xml entry plus one oversized entry whose
            // declared uncompressed length exceeds the 50 MB zip-bomb guard; the entry content is
            // all zeros so it compresses to almost nothing while still reporting its true size.
            using var stream = new MemoryStream();
            using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
            {
                var docEntry = archive.CreateEntry("word/document.xml");
                using (var writer = new StreamWriter(docEntry.Open()))
                {
                    writer.Write("<w:document xmlns:w=\"x\"><w:body/></w:document>");
                }

                var bigEntry = archive.CreateEntry("big.bin", CompressionLevel.Fastest);
                using var entryStream = bigEntry.Open();
                var buffer = new byte[1024 * 1024];
                for (var i = 0; i < 51; i++)
                {
                    entryStream.Write(buffer, 0, buffer.Length);
                }
            }
            var bytes = stream.ToArray();
            var fileMock = BuildFileMock(bytes, "orcamento-bomba.docx");

            // Act
            var result = await _controller.Upload(DocumentTemplateType.Quote, fileMock.Object);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal("O arquivo enviado não é um documento .docx válido.", badRequest.Value);

            _documentTemplateServiceMock.Verify(
                s => s.UploadContent(It.IsAny<DocumentTemplateType>(), It.IsAny<string>(), It.IsAny<byte[]>()),
                Times.Never
            );
        }

        [Fact]
        public async Task Upload_ShouldReturnBadRequest_WhenFileIsNotDocx()
        {
            // Arrange
            var bytes = Encoding.UTF8.GetBytes("<h1>Novo Orçamento</h1>");
            var fileMock = BuildFileMock(bytes, "novo-orcamento.html");

            // Act
            var result = await _controller.Upload(DocumentTemplateType.Quote, fileMock.Object);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal("O arquivo enviado não é um documento .docx válido.", badRequest.Value);

            _documentTemplateServiceMock.Verify(
                s => s.UploadContent(It.IsAny<DocumentTemplateType>(), It.IsAny<string>(), It.IsAny<byte[]>()),
                Times.Never
            );
        }

        [Fact]
        public async Task Download_ShouldUseJpegContentType_WhenTemplateTypeIsLetterhead()
        {
            // Arrange
            var template = new DocumentTemplate
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000004"),
                Type = DocumentTemplateType.Letterhead,
                Name = "Papel Timbrado",
                FileName = "letterhead-a4.jpg",
            };
            var expected = new WebApiResponse<DocumentTemplate>
            {
                Data = template,
                Status = ResponseStatus.Success,
                Message = $"Template {template.Name} encontrado com sucesso",
            };
            var fileBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 };

            _documentTemplateServiceMock
                .Setup(s => s.FindByType(DocumentTemplateType.Letterhead))
                .ReturnsAsync(expected);
            _documentTemplateServiceMock
                .Setup(s => s.GetFileBytes(DocumentTemplateType.Letterhead))
                .ReturnsAsync(fileBytes);

            // Act
            var result = await _controller.Download(DocumentTemplateType.Letterhead);

            // Assert
            var fileResult = Assert.IsType<FileContentResult>(result);
            Assert.Equal("image/jpeg", fileResult.ContentType);
            Assert.Equal(fileBytes, fileResult.FileContents);
        }

        [Fact]
        public async Task Upload_ShouldReturnBadRequest_WhenLetterheadFileIsNotJpeg()
        {
            // Arrange
            var bytes = BuildDocxBytes();
            var fileMock = BuildFileMock(bytes, "papel-timbrado.docx");

            // Act
            var result = await _controller.Upload(DocumentTemplateType.Letterhead, fileMock.Object);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal("O arquivo enviado não é uma imagem JPG válida.", badRequest.Value);

            _documentTemplateServiceMock.Verify(
                s => s.UploadContent(It.IsAny<DocumentTemplateType>(), It.IsAny<string>(), It.IsAny<byte[]>()),
                Times.Never
            );
        }

        [Fact]
        public async Task Upload_ShouldReturnOkWithUpdatedTemplate_WhenLetterheadFileIsValidJpeg()
        {
            // Arrange
            var bytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10 };
            var fileMock = BuildFileMock(bytes, "novo-timbrado.jpg");

            var template = new DocumentTemplate
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000004"),
                Type = DocumentTemplateType.Letterhead,
                Name = "Papel Timbrado",
                FileName = "novo-timbrado.jpg",
            };
            var expected = new WebApiResponse<DocumentTemplate>
            {
                Data = template,
                Status = ResponseStatus.Success,
                Message = $"Template {template.Name} atualizado com sucesso.",
            };

            _documentTemplateServiceMock
                .Setup(s =>
                    s.UploadContent(DocumentTemplateType.Letterhead, "novo-timbrado.jpg", bytes)
                )
                .ReturnsAsync(expected);

            // Act
            var result = await _controller.Upload(DocumentTemplateType.Letterhead, fileMock.Object);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<DocumentTemplate>>(ok.Value);
            response.Should().BeEquivalentTo(expected);

            _documentTemplateServiceMock.Verify(
                s => s.UploadContent(DocumentTemplateType.Letterhead, "novo-timbrado.jpg", bytes),
                Times.Once
            );
        }

        [Fact]
        public async Task Download_ShouldUsePngContentType_WhenTemplateTypeIsSignature()
        {
            // Arrange
            var template = new DocumentTemplate
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000005"),
                Type = DocumentTemplateType.Signature,
                Name = "Assinatura",
                FileName = "signature-warlen.png",
            };
            var expected = new WebApiResponse<DocumentTemplate>
            {
                Data = template,
                Status = ResponseStatus.Success,
                Message = $"Template {template.Name} encontrado com sucesso",
            };
            var fileBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };

            _documentTemplateServiceMock
                .Setup(s => s.FindByType(DocumentTemplateType.Signature))
                .ReturnsAsync(expected);
            _documentTemplateServiceMock
                .Setup(s => s.GetFileBytes(DocumentTemplateType.Signature))
                .ReturnsAsync(fileBytes);

            // Act
            var result = await _controller.Download(DocumentTemplateType.Signature);

            // Assert
            var fileResult = Assert.IsType<FileContentResult>(result);
            Assert.Equal("image/png", fileResult.ContentType);
            Assert.Equal(fileBytes, fileResult.FileContents);
        }

        [Fact]
        public async Task Upload_ShouldReturnBadRequest_WhenSignatureFileIsNotPng()
        {
            // Arrange
            var bytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }; // valid JPEG, invalid PNG
            var fileMock = BuildFileMock(bytes, "assinatura.jpg");

            // Act
            var result = await _controller.Upload(DocumentTemplateType.Signature, fileMock.Object);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal("O arquivo enviado não é uma imagem PNG válida.", badRequest.Value);

            _documentTemplateServiceMock.Verify(
                s => s.UploadContent(It.IsAny<DocumentTemplateType>(), It.IsAny<string>(), It.IsAny<byte[]>()),
                Times.Never
            );
        }

        [Fact]
        public async Task Upload_ShouldReturnOkWithUpdatedTemplate_WhenSignatureFileIsValidPng()
        {
            // Arrange
            var bytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01 };
            var fileMock = BuildFileMock(bytes, "nova-assinatura.png");

            var template = new DocumentTemplate
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000005"),
                Type = DocumentTemplateType.Signature,
                Name = "Assinatura",
                FileName = "nova-assinatura.png",
            };
            var expected = new WebApiResponse<DocumentTemplate>
            {
                Data = template,
                Status = ResponseStatus.Success,
                Message = $"Template {template.Name} atualizado com sucesso.",
            };

            _documentTemplateServiceMock
                .Setup(s =>
                    s.UploadContent(DocumentTemplateType.Signature, "nova-assinatura.png", bytes)
                )
                .ReturnsAsync(expected);

            // Act
            var result = await _controller.Upload(DocumentTemplateType.Signature, fileMock.Object);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<DocumentTemplate>>(ok.Value);
            response.Should().BeEquivalentTo(expected);

            _documentTemplateServiceMock.Verify(
                s => s.UploadContent(DocumentTemplateType.Signature, "nova-assinatura.png", bytes),
                Times.Once
            );
        }

        [Fact]
        public async Task Upload_ShouldReturnOkWithUpdatedTemplate_WhenFileIsValid()
        {
            // Arrange
            var bytes = BuildDocxBytes();
            var fileMock = BuildFileMock(bytes, "novo-orcamento.docx");

            var template = _templatesMock.First(t => t.Type == DocumentTemplateType.Quote);
            var expected = new WebApiResponse<DocumentTemplate>
            {
                Data = template,
                Status = ResponseStatus.Success,
                Message = $"Template {template.Name} atualizado com sucesso.",
            };

            _documentTemplateServiceMock
                .Setup(s =>
                    s.UploadContent(DocumentTemplateType.Quote, "novo-orcamento.docx", bytes)
                )
                .ReturnsAsync(expected);

            // Act
            var result = await _controller.Upload(DocumentTemplateType.Quote, fileMock.Object);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<DocumentTemplate>>(ok.Value);
            response.Should().BeEquivalentTo(expected);

            _documentTemplateServiceMock.Verify(
                s => s.UploadContent(DocumentTemplateType.Quote, "novo-orcamento.docx", bytes),
                Times.Once
            );
        }

        /// <summary>
        /// Mocks an IFormFile whose CopyToAsync writes the given bytes into the destination stream,
        /// matching how the controller now reads the upload (Upload no longer uses OpenReadStream).
        /// </summary>
        private static Mock<IFormFile> BuildFileMock(byte[] bytes, string fileName)
        {
            var fileMock = new Mock<IFormFile>();
            fileMock.Setup(f => f.Length).Returns(bytes.Length);
            fileMock.Setup(f => f.FileName).Returns(fileName);
            fileMock
                .Setup(f => f.CopyToAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
                .Returns<Stream, CancellationToken>((target, _) => target.WriteAsync(bytes, 0, bytes.Length));
            return fileMock;
        }
    }
}
