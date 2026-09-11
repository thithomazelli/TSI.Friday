using Microsoft.AspNetCore.Hosting;
using Moq;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Services;

namespace TSI.Nexus.Services.Tests.Services
{
    public class LogServiceTests : IDisposable
    {
        private readonly string _tempContentRoot;
        private readonly Mock<IWebHostEnvironment> _envMock;
        private readonly Mock<ICurrentUserService> _currentUserServiceMock;
        private readonly LogService _service;

        public LogServiceTests()
        {
            _tempContentRoot = Path.Combine(Path.GetTempPath(), "LogServiceTests_" + Guid.NewGuid());
            Directory.CreateDirectory(_tempContentRoot);

            _envMock = new Mock<IWebHostEnvironment>();
            _envMock.SetupGet(e => e.ContentRootPath).Returns(_tempContentRoot);

            _currentUserServiceMock = new Mock<ICurrentUserService>();
            _currentUserServiceMock.Setup(s => s.GetUserName()).Returns("jane.doe");

            _service = new LogService(_envMock.Object, _currentUserServiceMock.Object);
        }

        public void Dispose()
        {
            if (Directory.Exists(_tempContentRoot))
            {
                Directory.Delete(_tempContentRoot, recursive: true);
            }
        }

        [Fact]
        public void Constructor_ShouldThrowArgumentNullException_WhenEnvIsNull()
        {
            Assert.Throws<ArgumentNullException>(
                () => new LogService(null!, _currentUserServiceMock.Object)
            );
        }

        [Fact]
        public void LogException_ShouldWriteLogFile_WithOperationAndExceptionDetails()
        {
            var exception = new InvalidOperationException("Something went wrong");

            _service.LogException(exception, "TestOperation");

            var logFile = FindLogFile();
            Assert.NotNull(logFile);
            var content = File.ReadAllText(logFile!);
            Assert.Contains("Operation: TestOperation", content);
            Assert.Contains("User: jane.doe", content);
            Assert.Contains("ExceptionType: " + typeof(InvalidOperationException).FullName, content);
            Assert.Contains("Message: Something went wrong", content);
        }

        [Fact]
        public void LogException_ShouldIncludeSerializedPayload_WhenProvided()
        {
            var exception = new Exception("Failure");

            _service.LogException(exception, "TestOperation", new { OrderId = 42, Name = "Test" });

            var content = File.ReadAllText(FindLogFile()!);
            Assert.Contains("Payload:", content);
            Assert.Contains("\"OrderId\": 42", content);
        }

        [Fact]
        public void LogException_ShouldRedactSensitiveFields_InSerializedPayload()
        {
            var exception = new Exception("Failure");

            _service.LogException(
                exception,
                "TestOperation",
                new
                {
                    Email = "user@example.com",
                    Password = "correct-horse-battery-staple",
                    NewPassword = "another-secret",
                    Token = "reset-token-value",
                    Nested = new { ApiKey = "nested-secret" },
                }
            );

            var content = File.ReadAllText(FindLogFile()!);
            Assert.Contains("\"Email\": \"user@example.com\"", content);
            Assert.Contains("\"Password\": \"***REDACTED***\"", content);
            Assert.Contains("\"NewPassword\": \"***REDACTED***\"", content);
            Assert.Contains("\"Token\": \"***REDACTED***\"", content);
            Assert.Contains("\"ApiKey\": \"***REDACTED***\"", content);
            Assert.DoesNotContain("correct-horse-battery-staple", content);
            Assert.DoesNotContain("another-secret", content);
            Assert.DoesNotContain("reset-token-value", content);
            Assert.DoesNotContain("nested-secret", content);
        }

        [Fact]
        public void LogException_ShouldIncludeInnerExceptionDetails()
        {
            var inner = new InvalidOperationException("Inner failure");
            var outer = new Exception("Outer failure", inner);

            _service.LogException(outer, "TestOperation");

            var content = File.ReadAllText(FindLogFile()!);
            Assert.Contains("--- Inner Exception ---", content);
            Assert.Contains("Message: Inner failure", content);
        }

        [Fact]
        public void LogException_ShouldLogUnknownUser_WhenCurrentUserServiceReturnsNull()
        {
            _currentUserServiceMock.Setup(s => s.GetUserName()).Returns((string)null!);

            _service.LogException(new Exception("Failure"), "TestOperation");

            var content = File.ReadAllText(FindLogFile()!);
            Assert.Contains("User: (unknown)", content);
        }

        [Fact]
        public void LogException_ShouldLogUnknownUser_WhenCurrentUserServiceThrows()
        {
            _currentUserServiceMock.Setup(s => s.GetUserName()).Throws(new Exception("boom"));

            _service.LogException(new Exception("Failure"), "TestOperation");

            var content = File.ReadAllText(FindLogFile()!);
            Assert.Contains("User: (unknown)", content);
        }

        [Fact]
        public void LogException_ShouldNotThrow_WhenPayloadSerializationFails()
        {
            var cyclic = new CyclicPayload();
            cyclic.Self = cyclic;

            var exception = Record.Exception(
                () => _service.LogException(new Exception("Failure"), "TestOperation", cyclic)
            );

            Assert.Null(exception);
        }

        [Fact]
        public void LogException_ShouldNotThrow_WhenLogsDirectoryCannotBeWritten()
        {
            var invalidEnvMock = new Mock<IWebHostEnvironment>();
            // NUL-byte makes any resulting path invalid on POSIX systems, forcing Directory.CreateDirectory to throw.
            invalidEnvMock.SetupGet(e => e.ContentRootPath).Returns("/invalid\0path");
            var service = new LogService(invalidEnvMock.Object, _currentUserServiceMock.Object);

            var exception = Record.Exception(
                () => service.LogException(new Exception("Failure"), "TestOperation")
            );

            Assert.Null(exception);
        }

        private class CyclicPayload
        {
            public CyclicPayload? Self { get; set; }
        }

        private string? FindLogFile()
        {
            return Directory
                .GetFiles(_tempContentRoot, "*.log", SearchOption.AllDirectories)
                .OrderByDescending(File.GetLastWriteTimeUtc)
                .FirstOrDefault();
        }
    }
}
