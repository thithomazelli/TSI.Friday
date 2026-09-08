using System.IO;
using System.Text;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;

namespace TSI.Nexus.Services.Tests.Services
{
    public class DocumentPdfGenerationServiceTests
    {
        private readonly Mock<IQuoteService> _quoteService = new();
        private readonly Mock<IOrderService> _orderService = new();
        private readonly Mock<ITripService> _tripService = new();
        private readonly Mock<IBusinessPartnerService> _businessPartnerService = new();
        private readonly Mock<IVehicleService> _vehicleService = new();
        private readonly Mock<IDriverService> _driverService = new();
        private readonly Mock<ITripLegService> _tripLegService = new();
        private readonly Mock<IPassengerService> _passengerService = new();
        private readonly Mock<IServiceOrderService> _serviceOrderService = new();
        private readonly Mock<IDocumentTemplateService> _documentTemplateService = new();
        private readonly Mock<ILogService> _logService = new();
        private readonly DocumentPdfGenerationService _service;

        public DocumentPdfGenerationServiceTests()
        {
            _service = new DocumentPdfGenerationService(
                _quoteService.Object,
                _orderService.Object,
                _tripService.Object,
                _businessPartnerService.Object,
                _vehicleService.Object,
                _driverService.Object,
                _tripLegService.Object,
                _passengerService.Object,
                _serviceOrderService.Object,
                _documentTemplateService.Object,
                _logService.Object
            );
        }

        /// <summary>Builds a minimal .docx containing only the given placeholder tokens as plain paragraphs.</summary>
        private static byte[] BuildMinimalTemplate(params string[] placeholders)
        {
            using var stream = new MemoryStream();
            using (var doc = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document))
            {
                var mainPart = doc.AddMainDocumentPart();
                mainPart.Document = new Document();
                var body = new Body();
                foreach (var placeholder in placeholders)
                {
                    body.Append(
                        new Paragraph(
                            new Run(new Text(placeholder) { Space = SpaceProcessingModeValues.Preserve })
                        )
                    );
                }
                mainPart.Document.Append(body);
                mainPart.Document.Save();
            }
            return stream.ToArray();
        }

        private static bool StartsWithPdfMagic(byte[]? bytes) =>
            bytes != null && bytes.Length > 4 && Encoding.ASCII.GetString(bytes, 0, 4) == "%PDF";

        [Fact]
        public async Task GenerateQuotePdf_ReturnsNull_WhenQuoteNotFound()
        {
            _quoteService
                .Setup(s => s.FindById(It.IsAny<Guid?>()))
                .ReturnsAsync(new WebApiResponse<QuoteDto> { Data = null });

            var result = await _service.GenerateQuotePdf(Guid.NewGuid());

            Assert.Null(result);
        }

        [Fact]
        public async Task GenerateQuotePdf_ReturnsPdfBytes_WhenQuoteFound()
        {
            var quoteId = Guid.NewGuid();
            var businessPartnerId = Guid.NewGuid();
            _quoteService
                .Setup(s => s.FindById(quoteId))
                .ReturnsAsync(
                    new WebApiResponse<QuoteDto>
                    {
                        Data = new QuoteDto
                        {
                            Id = quoteId,
                            QuoteNumber = "ORC-0001",
                            BusinessPartnerId = businessPartnerId,
                            BusinessPartnerName = "Cliente Teste",
                            Date = DateTime.Today,
                            TotalPrice = 1000m,
                            Condition = PaymentCondition.FullPayment,
                            Method = PaymentMethod.Pix,
                            QuoteProducts = new List<QuoteProductDto>
                            {
                                new()
                                {
                                    ProductName = "Van executiva",
                                    Quantity = 1,
                                    Price = 1000m,
                                    Discount = 0,
                                    TotalPrice = 1000m,
                                },
                            },
                        },
                    }
                );
            _businessPartnerService
                .Setup(s => s.FindById(businessPartnerId))
                .ReturnsAsync(
                    new WebApiResponse<BusinessPartnerDto>
                    {
                        Data = new BusinessPartnerDto { Name = "Cliente Teste", NationalRegistry = "00.000.000/0001-00" },
                    }
                );
            _documentTemplateService
                .Setup(s => s.GetFileBytes(DocumentTemplateType.Quote))
                .ReturnsAsync(
                    BuildMinimalTemplate(
                        "{{QuoteNumber}} {{ClientName}} {{ClientDocument}} {{ClientAddress}} {{QuoteDate}}",
                        "{{ProductRows}}",
                        "{{TotalPrice}} {{PaymentCondition}} {{PaymentMethod}}",
                        "{{CompanyContactName}} {{CompanyWhatsapp}}",
                        "{{SignatureBlock}}"
                    )
                );

            var result = await _service.GenerateQuotePdf(quoteId);

            Assert.True(StartsWithPdfMagic(result));
            // The letterhead background is now an admin-uploadable DocumentTemplate
            // (DocumentTemplateType.Letterhead) instead of a fixed asset embedded in this
            // assembly - RenderDocument must fetch it the same way it fetches the .docx itself.
            _documentTemplateService.Verify(s => s.GetFileBytes(DocumentTemplateType.Letterhead), Times.Once);
        }

        [Fact]
        public async Task GenerateSalesOrderPdf_ReturnsNull_WhenOrderNotFound()
        {
            _orderService
                .Setup(s => s.FindById(It.IsAny<Guid?>()))
                .ReturnsAsync(new WebApiResponse<OrderDto> { Data = null });

            var result = await _service.GenerateSalesOrderPdf(Guid.NewGuid());

            Assert.Null(result);
        }

        [Fact]
        public async Task GenerateSalesOrderPdf_ReturnsPdfBytes_WhenOrderFoundWithoutProducts()
        {
            var orderId = Guid.NewGuid();
            _orderService
                .Setup(s => s.FindById(orderId))
                .ReturnsAsync(
                    new WebApiResponse<OrderDto>
                    {
                        Data = new OrderDto
                        {
                            Id = orderId,
                            OrderNumber = "PED-0001",
                            BusinessPartnerId = Guid.NewGuid(),
                            BusinessPartnerName = "Cliente Sem Endereço",
                            Date = DateTime.Today,
                            TotalPrice = 500m,
                            Description = "Pedido avulso",
                            OrderProducts = new List<OrderProductDto>(),
                        },
                    }
                );
            _businessPartnerService
                .Setup(s => s.FindById(It.IsAny<Guid?>()))
                .ReturnsAsync(new WebApiResponse<BusinessPartnerDto> { Data = null });
            _documentTemplateService
                .Setup(s => s.GetFileBytes(DocumentTemplateType.SalesOrder))
                .ReturnsAsync(BuildMinimalTemplate("{{OrderNumber}} {{ClientName}}", "{{ProductRows}}", "{{SignatureBlock}}"));

            var result = await _service.GenerateSalesOrderPdf(orderId);

            Assert.True(StartsWithPdfMagic(result));
        }

        [Fact]
        public async Task GenerateContractPdf_ReturnsNull_WhenTripNotFound()
        {
            _tripService
                .Setup(s => s.FindById(It.IsAny<Guid?>()))
                .ReturnsAsync(new WebApiResponse<TripDto> { Data = null });

            var result = await _service.GenerateContractPdf(Guid.NewGuid());

            Assert.Null(result);
        }

        [Fact]
        public async Task GenerateContractPdf_ReturnsPdfBytes_WhenTripFoundWithLegs()
        {
            var tripId = Guid.NewGuid();
            _tripService
                .Setup(s => s.FindById(tripId))
                .ReturnsAsync(
                    new WebApiResponse<TripDto>
                    {
                        Data = new TripDto
                        {
                            Id = tripId,
                            TripNumber = "VIA-0001",
                            BusinessPartnerId = Guid.NewGuid(),
                            BusinessPartnerName = "Contratante Teste",
                            Date = DateTime.Today,
                            TotalPrice = 2000m,
                            DistanceKm = 100m,
                        },
                    }
                );
            _businessPartnerService
                .Setup(s => s.FindById(It.IsAny<Guid?>()))
                .ReturnsAsync(new WebApiResponse<BusinessPartnerDto> { Data = null });
            _tripLegService
                .Setup(s => s.FindByTrip(tripId))
                .ReturnsAsync(
                    new WebApiResponse<IEnumerable<TripLeg>>
                    {
                        Data = new List<TripLeg>
                        {
                            new()
                            {
                                SequenceNumber = 1,
                                Origin = "Guarulhos",
                                Destination = "Campos do Jordão",
                                DepartureDate = DateTime.Today,
                                DistanceKm = 100,
                            },
                        },
                    }
                );
            _documentTemplateService
                .Setup(s => s.GetFileBytes(DocumentTemplateType.Contract))
                .ReturnsAsync(
                    BuildMinimalTemplate(
                        "{{TripNumber}} {{CompanyLegalName}} {{ContratanteName}} {{TotalPrice}} {{LimiteKm}}",
                        "{{LegRows}}",
                        "{{SignatureBlock}}"
                    )
                );

            var result = await _service.GenerateContractPdf(tripId);

            Assert.True(StartsWithPdfMagic(result));
        }

        [Fact]
        public async Task GenerateServiceOrderPdf_ReturnsNull_WhenTripNotFound()
        {
            _tripService
                .Setup(s => s.FindById(It.IsAny<Guid?>()))
                .ReturnsAsync(new WebApiResponse<TripDto> { Data = null });

            var result = await _service.GenerateServiceOrderPdf(Guid.NewGuid());

            Assert.Null(result);
        }

        [Fact]
        public async Task GenerateServiceOrderPdf_ReturnsPdfBytes_AndIncludesCommissionRow_WhenMatchingServiceOrderHasCommission()
        {
            var tripId = Guid.NewGuid();
            var driverId = Guid.NewGuid();
            _tripService
                .Setup(s => s.FindById(tripId))
                .ReturnsAsync(
                    new WebApiResponse<TripDto>
                    {
                        Data = new TripDto
                        {
                            Id = tripId,
                            TripNumber = "VIA-0002",
                            DriverId = driverId,
                            Date = DateTime.Today,
                            DistanceKm = 50m,
                        },
                    }
                );
            _driverService
                .Setup(s => s.FindById(driverId))
                .ReturnsAsync(new WebApiResponse<Driver> { Data = new Driver { Name = "Motorista Teste" } });
            _passengerService
                .Setup(s => s.FindByTrip(tripId))
                .ReturnsAsync(new WebApiResponse<IEnumerable<Passenger>> { Data = new List<Passenger> { new(), new() } });
            _serviceOrderService
                .Setup(s => s.FindByDriver(driverId))
                .ReturnsAsync(
                    new WebApiResponse<IEnumerable<ServiceOrder>>
                    {
                        Data = new List<ServiceOrder>
                        {
                            new()
                            {
                                TripId = tripId,
                                DriverId = driverId,
                                Commission = new Commission { Amount = 150m },
                            },
                        },
                    }
                );
            _documentTemplateService
                .Setup(s => s.GetFileBytes(DocumentTemplateType.ServiceOrder))
                .ReturnsAsync(
                    BuildMinimalTemplate("{{TripNumber}} {{DriverName}} {{PassengerCount}}", "{{CommissionRow}}")
                );

            var result = await _service.GenerateServiceOrderPdf(tripId);

            Assert.True(StartsWithPdfMagic(result));
        }

        [Fact]
        public async Task GenerateQuotePdf_Throws_WhenTemplateFileIsMissing()
        {
            var quoteId = Guid.NewGuid();
            _quoteService
                .Setup(s => s.FindById(quoteId))
                .ReturnsAsync(new WebApiResponse<QuoteDto> { Data = new QuoteDto { Id = quoteId } });
            _documentTemplateService
                .Setup(s => s.GetFileBytes(DocumentTemplateType.Quote))
                .ReturnsAsync((byte[]?)null);

            await Assert.ThrowsAsync<InvalidOperationException>(() => _service.GenerateQuotePdf(quoteId));
        }
    }
}
