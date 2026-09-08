using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;
using TSI.Nexus.WebAPI.Controllers;

namespace TSI.Nexus.WebAPI.Tests.Controllers
{
    public class TripsControllerTests
    {
        private readonly TripsController _controller;
        private readonly Mock<ITripService> _tripServiceMock;
        private readonly Mock<IDocumentPdfGenerationService> _documentPdfGenerationServiceMock;
        private readonly IList<TripDto> _tripsMock;

        public TripsControllerTests()
        {
            _tripServiceMock = new Mock<ITripService>();
            _documentPdfGenerationServiceMock = new Mock<IDocumentPdfGenerationService>();
            _controller = new TripsController(_tripServiceMock.Object, _documentPdfGenerationServiceMock.Object);

            _tripsMock = new List<TripDto>
            {
                new TripDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    TripNumber = "SER-V001",
                    BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                },
                new TripDto
                {
                    Id = Guid.Parse("00000000-0000-0000-0000-000000000002"),
                    TripNumber = "SER-V002",
                    BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                },
            };
        }

        [Fact]
        public async Task GetAll_ShouldReturnOkWithData_WhenServiceReturnsTrips()
        {
            // Arrange
            var expected = new WebApiResponse<IEnumerable<TripDto>>
            {
                Data = _tripsMock,
                Status = ResponseStatus.Success,
                Message = $"{_tripsMock.Count} registro(s) encontrado(s).",
            };

            _tripServiceMock.Setup(s => s.FindAll()).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetAll();

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<TripDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _tripServiceMock.Verify(s => s.FindAll(), Times.Once);
        }

        [Fact]
        public async Task GetById_ShouldReturnOkWithTrip_WhenServiceReturnsTrip()
        {
            // Arrange
            var id = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var trip = _tripsMock.First(t => t.Id == id);
            var expected = new WebApiResponse<TripDto>
            {
                Data = trip,
                Status = ResponseStatus.Success,
                Message = $"Viagem {trip.TripNumber} encontrada com sucesso",
            };

            _tripServiceMock.Setup(s => s.FindById(id)).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetById(id);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<TripDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _tripServiceMock.Verify(s => s.FindById(id), Times.Once);
        }

        [Fact]
        public async Task Add_ShouldReturnOkWithCreatedTrip_WhenModelIsValid()
        {
            // Arrange
            var trip = new TripDto
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000003"),
                TripNumber = "SER-V003",
                BusinessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000002"),
            };
            var expected = new WebApiResponse<TripDto>
            {
                Data = trip,
                Status = ResponseStatus.Success,
                Message = $"Viagem {trip.TripNumber} cadastrada com sucesso.",
            };

            _tripServiceMock.Setup(s => s.Add(trip)).ReturnsAsync(expected);

            // Act
            var result = await _controller.Add(trip);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<TripDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _tripServiceMock.Verify(s => s.Add(trip), Times.Once);
        }

        [Fact]
        public async Task GetByBusinessPartnerId_ShouldReturnOkWithData_WhenServiceReturnsTrips()
        {
            // Arrange
            var businessPartnerId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var expected = new WebApiResponse<IEnumerable<TripDto>>
            {
                Data = _tripsMock,
                Status = ResponseStatus.Success,
                Message = $"{_tripsMock.Count} registro(s) encontrado(s).",
            };

            _tripServiceMock
                .Setup(s => s.FindByBusinessPartnerId(businessPartnerId))
                .ReturnsAsync(expected);

            // Act
            var result = await _controller.GetByBusinessPartnerId(businessPartnerId);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<TripDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _tripServiceMock.Verify(s => s.FindByBusinessPartnerId(businessPartnerId), Times.Once);
        }

        [Fact]
        public async Task Add_ShouldReturnBadRequest_WhenModelIsInvalid()
        {
            // Arrange
            var trip = new TripDto();
            _controller.ModelState.AddModelError(
                "BusinessPartnerId",
                "BusinessPartnerId is required"
            );

            // Act
            var result = await _controller.Add(trip);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var modelState = Assert.IsType<SerializableError>(badRequest.Value);
            Assert.True(modelState.ContainsKey("BusinessPartnerId"));

            _tripServiceMock.Verify(s => s.Add(It.IsAny<TripDto>()), Times.Never);
        }

        [Fact]
        public async Task Update_ShouldReturnOkWithUpdatedTrip_WhenModelIsValid()
        {
            // Arrange
            var trip = _tripsMock.First();
            var expected = new WebApiResponse<TripDto>
            {
                Data = trip,
                Status = ResponseStatus.Success,
                Message = $"Viagem {trip.TripNumber} atualizada com sucesso.",
            };

            _tripServiceMock.Setup(s => s.Update(trip)).ReturnsAsync(expected);

            // Act
            var result = await _controller.Update(trip);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<TripDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _tripServiceMock.Verify(s => s.Update(trip), Times.Once);
        }

        [Fact]
        public async Task Update_ShouldReturnBadRequest_WhenModelIsInvalid()
        {
            // Arrange
            var trip = new TripDto();
            _controller.ModelState.AddModelError(
                "BusinessPartnerId",
                "BusinessPartnerId is required"
            );

            // Act
            var result = await _controller.Update(trip);

            // Assert
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var modelState = Assert.IsType<SerializableError>(badRequest.Value);
            Assert.True(modelState.ContainsKey("BusinessPartnerId"));

            _tripServiceMock.Verify(s => s.Update(It.IsAny<TripDto>()), Times.Never);
        }

        [Fact]
        public async Task Remove_ShouldReturnOkWithRemovedTrip_WhenMethodIsCalled()
        {
            // Arrange
            var trip = _tripsMock.First();
            var expected = new WebApiResponse<TripDto>
            {
                Data = trip,
                Status = ResponseStatus.Success,
                Message = $"Viagem {trip.TripNumber} removida com sucesso.",
            };

            _tripServiceMock.Setup(s => s.Remove(trip)).ReturnsAsync(expected);

            // Act
            var result = await _controller.Remove(trip);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<TripDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _tripServiceMock.Verify(s => s.Remove(trip), Times.Once);
        }

        [Fact]
        public async Task GetByTripNumber_ShouldReturnOkWithTrip_WhenServiceReturnsTrip()
        {
            // Arrange
            var trip = _tripsMock.First();
            var expected = new WebApiResponse<TripDto>
            {
                Data = trip,
                Status = ResponseStatus.Success,
                Message = $"Viagem {trip.TripNumber} encontrada com sucesso",
            };

            _tripServiceMock
                .Setup(s => s.FindByTripNumber(trip.TripNumber))
                .ReturnsAsync(expected);

            // Act
            var result = await _controller.GetByTripNumber(trip.TripNumber);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<TripDto>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _tripServiceMock.Verify(s => s.FindByTripNumber(trip.TripNumber), Times.Once);
        }

        [Fact]
        public async Task GetByDriverId_ShouldReturnOkWithData_WhenServiceReturnsTrips()
        {
            // Arrange
            var driverId = Guid.NewGuid();
            var expected = new WebApiResponse<IEnumerable<TripDto>>
            {
                Data = _tripsMock,
                Status = ResponseStatus.Success,
                Message = $"{_tripsMock.Count} registro(s) encontrado(s).",
            };

            _tripServiceMock.Setup(s => s.FindByDriverId(driverId)).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetByDriverId(driverId);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<TripDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _tripServiceMock.Verify(s => s.FindByDriverId(driverId), Times.Once);
        }

        [Fact]
        public async Task GetByVehicleId_ShouldReturnOkWithData_WhenServiceReturnsTrips()
        {
            // Arrange
            var vehicleId = Guid.NewGuid();
            var expected = new WebApiResponse<IEnumerable<TripDto>>
            {
                Data = _tripsMock,
                Status = ResponseStatus.Success,
                Message = $"{_tripsMock.Count} registro(s) encontrado(s).",
            };

            _tripServiceMock.Setup(s => s.FindByVehicleId(vehicleId)).ReturnsAsync(expected);

            // Act
            var result = await _controller.GetByVehicleId(vehicleId);

            // Assert
            var ok = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<WebApiResponse<IEnumerable<TripDto>>>(ok.Value);
            response.Should().BeEquivalentTo(expected);
            _tripServiceMock.Verify(s => s.FindByVehicleId(vehicleId), Times.Once);
        }

        [Fact]
        public async Task ContractPdf_ShouldReturnFile_WhenTripExists()
        {
            var tripId = Guid.NewGuid();
            var pdfBytes = new byte[] { 0x25, 0x50, 0x44, 0x46 };
            _documentPdfGenerationServiceMock.Setup(s => s.GenerateContractPdf(tripId)).ReturnsAsync(pdfBytes);

            var result = await _controller.ContractPdf(tripId);

            var fileResult = Assert.IsType<FileContentResult>(result);
            Assert.Equal("application/pdf", fileResult.ContentType);
            Assert.Equal(pdfBytes, fileResult.FileContents);
        }

        [Fact]
        public async Task ContractPdf_ShouldReturnNotFound_WhenTripDoesNotExist()
        {
            var tripId = Guid.NewGuid();
            _documentPdfGenerationServiceMock.Setup(s => s.GenerateContractPdf(tripId)).ReturnsAsync((byte[]?)null);

            var result = await _controller.ContractPdf(tripId);

            Assert.IsType<NotFoundObjectResult>(result);
        }

        [Fact]
        public async Task ServiceOrderPdf_ShouldReturnFile_WhenTripExists()
        {
            var tripId = Guid.NewGuid();
            var pdfBytes = new byte[] { 0x25, 0x50, 0x44, 0x46 };
            _documentPdfGenerationServiceMock.Setup(s => s.GenerateServiceOrderPdf(tripId)).ReturnsAsync(pdfBytes);

            var result = await _controller.ServiceOrderPdf(tripId);

            var fileResult = Assert.IsType<FileContentResult>(result);
            Assert.Equal("application/pdf", fileResult.ContentType);
            Assert.Equal(pdfBytes, fileResult.FileContents);
        }

        [Fact]
        public async Task ServiceOrderPdf_ShouldReturnNotFound_WhenTripDoesNotExist()
        {
            var tripId = Guid.NewGuid();
            _documentPdfGenerationServiceMock.Setup(s => s.GenerateServiceOrderPdf(tripId)).ReturnsAsync((byte[]?)null);

            var result = await _controller.ServiceOrderPdf(tripId);

            Assert.IsType<NotFoundObjectResult>(result);
        }
    }
}
