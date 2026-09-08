using System;
using System.IO;
using System.Linq.Expressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services.Tests.Services
{
    public class DocumentTemplateServiceTests : IDisposable
    {
        private readonly DocumentTemplateService _service;
        private readonly Mock<IRepository<DocumentTemplate>> _repository;
        private readonly Mock<ILogService> _logServiceMock;
        private readonly string _tempBasePath;

        public DocumentTemplateServiceTests()
        {
            _repository = new Mock<IRepository<DocumentTemplate>>();
            _logServiceMock = new Mock<ILogService>();

            _tempBasePath = Path.Combine(Path.GetTempPath(), "DocumentTemplateServiceTests_" + Guid.NewGuid());

            var envMock = new Mock<IWebHostEnvironment>();
            envMock.Setup(e => e.ContentRootPath).Returns(_tempBasePath);

            var configMock = new Mock<IConfiguration>();
            var basePathSection = new Mock<IConfigurationSection>();
            basePathSection.Setup(s => s.Value).Returns(_tempBasePath);
            configMock.Setup(c => c.GetSection("DocumentTemplates:BasePath")).Returns(basePathSection.Object);
            configMock.Setup(c => c["DocumentTemplates:BasePath"]).Returns(_tempBasePath);

            _service = new DocumentTemplateService(
                _repository.Object,
                _logServiceMock.Object,
                envMock.Object,
                configMock.Object
            );
        }

        public void Dispose()
        {
            if (Directory.Exists(_tempBasePath))
            {
                Directory.Delete(_tempBasePath, recursive: true);
            }
        }

        [Fact]
        public async Task DocumentTemplateService_Add_ShouldAddTemplateSuccessfully_WhenTypeIsNotYetRegistered()
        {
            // Arrange
            var documentTemplate = new DocumentTemplate
            {
                Type = DocumentTemplateType.Quote,
                Name = "Orçamento",
                FileName = "orcamento.docx",
            };

            _repository
                .Setup(r => r.AnyAsync(It.IsAny<Expression<Func<DocumentTemplate, bool>>>()))
                .ReturnsAsync(false);
            _repository
                .Setup(r => r.AddAsync(It.IsAny<DocumentTemplate>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.Add(documentTemplate);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _repository.Verify(r => r.AddAsync(It.IsAny<DocumentTemplate>()), Times.Once);
        }

        [Fact]
        public async Task DocumentTemplateService_Add_ShouldReturnWarningAndNotAdd_WhenTypeAlreadyRegistered()
        {
            // Arrange
            var documentTemplate = new DocumentTemplate
            {
                Type = DocumentTemplateType.Quote,
                Name = "Orçamento",
                FileName = "orcamento.docx",
            };

            _repository
                .Setup(r => r.AnyAsync(It.IsAny<Expression<Func<DocumentTemplate, bool>>>()))
                .ReturnsAsync(true);

            // Act
            var result = await _service.Add(documentTemplate);

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _repository.Verify(r => r.AddAsync(It.IsAny<DocumentTemplate>()), Times.Never);
        }

        [Fact]
        public async Task DocumentTemplateService_Add_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var documentTemplate = new DocumentTemplate { Type = DocumentTemplateType.Quote, Name = "Orçamento" };
            _repository
                .Setup(r => r.AnyAsync(It.IsAny<Expression<Func<DocumentTemplate, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Add(documentTemplate);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
            _logServiceMock.Verify(
                _ => _.LogException(It.IsAny<Exception>(), "DocumentTemplateService.Add", documentTemplate),
                Times.Once
            );
        }

        [Fact]
        public async Task DocumentTemplateService_Update_ShouldUpdateTemplateSuccessfully()
        {
            // Arrange
            var documentTemplate = new DocumentTemplate { Type = DocumentTemplateType.Quote, Name = "Orçamento" };

            // Act
            var result = await _service.Update(documentTemplate);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _repository.Verify(r => r.UpdateAsync(documentTemplate), Times.Once);
        }

        [Fact]
        public async Task DocumentTemplateService_Update_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var documentTemplate = new DocumentTemplate { Type = DocumentTemplateType.Quote, Name = "Orçamento" };
            _repository.Setup(r => r.UpdateAsync(documentTemplate)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Update(documentTemplate);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task DocumentTemplateService_Remove_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var documentTemplate = new DocumentTemplate { Type = DocumentTemplateType.Quote, Name = "Orçamento" };
            _repository.Setup(r => r.RemoveAsync(documentTemplate)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.Remove(documentTemplate);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task DocumentTemplateService_FindById_ShouldReturnTemplate_WhenFound()
        {
            // Arrange
            var id = Guid.NewGuid();
            var documentTemplate = new DocumentTemplate { Id = id, Name = "Orçamento" };
            _repository.Setup(r => r.GetByIdAsync(id)).ReturnsAsync(documentTemplate);

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("Template Orçamento encontrado com sucesso", result.Message);
        }

        [Fact]
        public async Task DocumentTemplateService_FindById_ShouldReturnNoData_WhenNotFound()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository.Setup(r => r.GetByIdAsync(id)).ReturnsAsync((DocumentTemplate)null!);

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task DocumentTemplateService_FindById_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository.Setup(r => r.GetByIdAsync(id)).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.FindById(id);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task DocumentTemplateService_FindAll_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository.Setup(r => r.GetAllAsync()).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task DocumentTemplateService_FindByType_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<DocumentTemplate, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.FindByType(DocumentTemplateType.Quote);

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task DocumentTemplateService_UploadContent_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<DocumentTemplate, bool>>>()))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _service.UploadContent(
                DocumentTemplateType.Quote,
                "f.docx",
                new byte[] { 0x50, 0x4B, 0x03, 0x04 }
            );

            // Assert
            Assert.Equal(ResponseStatus.Error, result.Status);
        }

        [Fact]
        public async Task DocumentTemplateService_FindByType_ShouldReturnTemplate_WhenTypeIsRegistered()
        {
            // Arrange
            var documentTemplate = new DocumentTemplate
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Type = DocumentTemplateType.Contract,
                Name = "Contrato de Fretamento",
                FileName = "contrato.docx",
            };

            _repository
                .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<DocumentTemplate, bool>>>()))
                .ReturnsAsync(documentTemplate);

            // Act
            var result = await _service.FindByType(DocumentTemplateType.Contract);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(documentTemplate, result.Data);
        }

        [Fact]
        public async Task DocumentTemplateService_FindByType_ShouldReturnNoData_WhenTypeIsNotRegistered()
        {
            // Arrange
            _repository
                .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<DocumentTemplate, bool>>>()))
                .ReturnsAsync((DocumentTemplate)null);

            // Act
            var result = await _service.FindByType(DocumentTemplateType.SalesOrder);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Null(result.Data);
        }

        [Fact]
        public async Task DocumentTemplateService_UploadContent_ShouldWriteFileAndReplaceFileName_WhenTypeIsRegistered()
        {
            // Arrange
            var documentTemplate = new DocumentTemplate
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Type = DocumentTemplateType.ServiceOrder,
                Name = "Ordem de Serviço",
                FileName = "old-file.docx",
            };

            _repository
                .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<DocumentTemplate, bool>>>()))
                .ReturnsAsync(documentTemplate);
            _repository
                .Setup(r => r.UpdateAsync(It.IsAny<DocumentTemplate>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.UploadContent(
                DocumentTemplateType.ServiceOrder,
                "new-file.docx",
                new byte[] { 0x02 }
            );

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal("new-file.docx", result.Data.FileName);
            _repository.Verify(r => r.UpdateAsync(It.IsAny<DocumentTemplate>()), Times.Once);

            var writtenBytes = await _service.GetFileBytes(DocumentTemplateType.ServiceOrder);
            Assert.Equal(new byte[] { 0x02 }, writtenBytes);
        }

        [Fact]
        public async Task DocumentTemplateService_UploadContent_ShouldReturnWarning_WhenTypeIsNotRegistered()
        {
            // Arrange
            _repository
                .Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<DocumentTemplate, bool>>>()))
                .ReturnsAsync((DocumentTemplate)null);

            // Act
            var result = await _service.UploadContent(
                DocumentTemplateType.SalesOrder,
                "file.docx",
                new byte[] { 0x50, 0x4B, 0x03, 0x04 }
            );

            // Assert
            Assert.Equal(ResponseStatus.Warning, result.Status);
            _repository.Verify(r => r.UpdateAsync(It.IsAny<DocumentTemplate>()), Times.Never);
        }

        [Fact]
        public async Task DocumentTemplateService_GetFileBytes_ShouldReturnNull_WhenFileDoesNotExist()
        {
            // Act
            var result = await _service.GetFileBytes(DocumentTemplateType.Quote);

            // Assert
            Assert.Null(result);
        }

        [Fact]
        public async Task DocumentTemplateService_FindAll_ShouldReturnAllTemplates()
        {
            // Arrange
            var templates = new List<DocumentTemplate>
            {
                new DocumentTemplate { Type = DocumentTemplateType.Quote, Name = "Orçamento" },
                new DocumentTemplate { Type = DocumentTemplateType.Contract, Name = "Contrato" },
            };

            _repository.Setup(r => r.GetAllAsync()).ReturnsAsync(templates);

            // Act
            var result = await _service.FindAll();

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            Assert.Equal(2, result.Data.Count());
        }

        [Fact]
        public async Task DocumentTemplateService_Remove_ShouldRemoveTemplateSuccessfully()
        {
            // Arrange
            var documentTemplate = new DocumentTemplate
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                Type = DocumentTemplateType.Quote,
                Name = "Orçamento",
            };

            _repository
                .Setup(r => r.RemoveAsync(It.IsAny<DocumentTemplate>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _service.Remove(documentTemplate);

            // Assert
            Assert.Equal(ResponseStatus.Success, result.Status);
            _repository.Verify(r => r.RemoveAsync(It.IsAny<DocumentTemplate>()), Times.Once);
        }
    }
}
