using System.Globalization;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Services.DocumentRendering;

namespace TSI.Nexus.Services
{
    /// <summary>
    /// Builds the scalar/block substitutions for each letterhead document (mirroring what
    /// quote-documents.ts / trip-documents.ts / order-documents.ts used to build as HTML on the
    /// frontend) and renders them via DocxPdfRenderer. See
    /// docs/spec-7-templates-docx-pdf-vetorial.md.
    /// </summary>
    public class DocumentPdfGenerationService : IDocumentPdfGenerationService
    {
        #region Company constants

        // Serodio's own data - this is a Serodio-specific fork (serodioturismo branch), same as
        // core/utilities/document-branding.ts on the frontend.
        private const string CompanyLegalName = "VIAÇÃO SERODIO TURISMO LTDA";
        private const string CompanyCnpj = "22.397.670/0001-26";
        private const string CompanyAddressLine = "Avenida Quinze de Janeiro, nº 542, Guarulhos - SP, CEP 04366-000";
        private const string CompanyWhatsapp = "(11) 98180-2113";
        private const string CompanyOfficeContactName = "WARLEN";

        #endregion

        #region Properties

        private readonly IQuoteService _quoteService;
        private readonly IOrderService _orderService;
        private readonly ITripService _tripService;
        private readonly IBusinessPartnerService _businessPartnerService;
        private readonly IVehicleService _vehicleService;
        private readonly IDriverService _driverService;
        private readonly ITripLegService _tripLegService;
        private readonly IPassengerService _passengerService;
        private readonly IServiceOrderService _serviceOrderService;
        private readonly IDocumentTemplateService _documentTemplateService;
        private readonly ILogService _logService;

        #endregion

        public DocumentPdfGenerationService(
            IQuoteService quoteService,
            IOrderService orderService,
            ITripService tripService,
            IBusinessPartnerService businessPartnerService,
            IVehicleService vehicleService,
            IDriverService driverService,
            ITripLegService tripLegService,
            IPassengerService passengerService,
            IServiceOrderService serviceOrderService,
            IDocumentTemplateService documentTemplateService,
            ILogService logService
        )
        {
            _quoteService = quoteService;
            _orderService = orderService;
            _tripService = tripService;
            _businessPartnerService = businessPartnerService;
            _vehicleService = vehicleService;
            _driverService = driverService;
            _tripLegService = tripLegService;
            _passengerService = passengerService;
            _serviceOrderService = serviceOrderService;
            _documentTemplateService = documentTemplateService;
            _logService = logService;
        }

        #region Public methods

        /// <inheritdoc />
        public async Task<byte[]?> GenerateQuotePdf(Guid quoteId)
        {
            try
            {
                var quoteResponse = await _quoteService.FindById(quoteId);
                if (quoteResponse.Data == null)
                {
                    return null;
                }
                var quote = quoteResponse.Data;

                var businessPartner = await FindBusinessPartnerOrNull(quote.BusinessPartnerId);
                var clientName = businessPartner?.Name ?? quote.BusinessPartnerName ?? "-";

                var productRows = quote.QuoteProducts.Count > 0
                    ? quote
                        .QuoteProducts.Select(item => new[]
                        {
                            item.ProductName ?? "-",
                            item.Quantity.ToString(CultureInfo.InvariantCulture),
                            FormatCurrency(item.Price),
                            FormatCurrency(item.Discount),
                            FormatCurrency(item.TotalPrice),
                        })
                        .ToList()
                    : new List<string[]>
                    {
                        new[]
                        {
                            string.IsNullOrWhiteSpace(quote.Description)
                                ? "Conforme descrito na proposta."
                                : quote.Description,
                        },
                    };

                var tokens = new Dictionary<string, string>
                {
                    ["QuoteNumber"] = quote.QuoteNumber ?? "-",
                    ["ClientName"] = clientName,
                    ["ClientDocument"] = PartnerDocument(businessPartner),
                    ["ClientAddress"] = PartnerAddress(businessPartner),
                    ["QuoteDate"] = FormatDate(quote.Date),
                    ["TotalPrice"] = FormatCurrency(quote.TotalPrice),
                    ["PaymentCondition"] = PaymentConditionLabel(quote.Condition),
                    ["PaymentMethod"] = PaymentMethodLabel(quote.Method),
                    ["CompanyContactName"] = CompanyOfficeContactName,
                    ["CompanyWhatsapp"] = CompanyWhatsapp,
                };
                var blocks = new Dictionary<string, DocxBlock>
                {
                    ["ProductRows"] = DocxBlock.ForTable(productRows),
                    ["SignatureBlock"] = BuildSignatureBlock(clientName, await GetSignatureBytesAsync()),
                };

                return await RenderDocument(DocumentTemplateType.Quote, tokens, blocks);
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "DocumentPdfGenerationService.GenerateQuotePdf", quoteId);
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<byte[]?> GenerateSalesOrderPdf(Guid orderId)
        {
            try
            {
                var orderResponse = await _orderService.FindById(orderId);
                if (orderResponse.Data == null)
                {
                    return null;
                }
                var order = orderResponse.Data;

                var businessPartner = await FindBusinessPartnerOrNull(order.BusinessPartnerId);
                var clientName = businessPartner?.Name ?? order.BusinessPartnerName ?? "-";

                var productRows = order.OrderProducts.Count > 0
                    ? order
                        .OrderProducts.Select(item => new[]
                        {
                            item.ProductName ?? "-",
                            item.Quantity.ToString(CultureInfo.InvariantCulture),
                            FormatCurrency(item.Price),
                            FormatCurrency(item.Discount),
                            FormatCurrency(item.TotalPrice),
                        })
                        .ToList()
                    : new List<string[]>
                    {
                        new[]
                        {
                            string.IsNullOrWhiteSpace(order.Description)
                                ? "Conforme descrito no pedido."
                                : order.Description,
                        },
                    };

                var tokens = new Dictionary<string, string>
                {
                    ["OrderNumber"] = order.OrderNumber ?? "-",
                    ["ClientName"] = clientName,
                    ["ClientDocument"] = PartnerDocument(businessPartner),
                    ["ClientAddress"] = PartnerAddress(businessPartner),
                    ["OrderDate"] = FormatDate(order.Date),
                    ["TotalPrice"] = FormatCurrency(order.TotalPrice),
                    ["PaymentMethod"] = PaymentMethodLabel(order.Transaction?.Method),
                    ["CompanyContactName"] = CompanyOfficeContactName,
                    ["CompanyWhatsapp"] = CompanyWhatsapp,
                };
                var blocks = new Dictionary<string, DocxBlock>
                {
                    ["ProductRows"] = DocxBlock.ForTable(productRows),
                    ["SignatureBlock"] = BuildSignatureBlock(clientName, await GetSignatureBytesAsync()),
                };

                return await RenderDocument(DocumentTemplateType.SalesOrder, tokens, blocks);
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "DocumentPdfGenerationService.GenerateSalesOrderPdf", orderId);
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<byte[]?> GenerateContractPdf(Guid tripId)
        {
            try
            {
                var tripResponse = await _tripService.FindById(tripId);
                if (tripResponse.Data == null)
                {
                    return null;
                }
                var trip = tripResponse.Data;

                var businessPartner = await FindBusinessPartnerOrNull(trip.BusinessPartnerId);
                var vehicle = trip.VehicleId.HasValue ? await FindVehicleOrNull(trip.VehicleId.Value) : null;
                var tripLegs = (await _tripLegService.FindByTrip(tripId)).Data?.ToList() ?? new List<TripLeg>();

                var contratanteName = businessPartner?.Name ?? trip.BusinessPartnerName ?? "-";
                var kmExcedente = vehicle != null ? FormatCurrency(vehicle.PricePerKm) : "a combinar";
                var diariaExtra = vehicle != null ? FormatCurrency(vehicle.DailyRate) : "a combinar";
                var limiteKm =
                    trip.DistanceKm > 0
                        ? $"{trip.DistanceKm} quilômetros"
                        : "a definir conforme o roteiro";
                var sinal = FormatCurrency(trip.TotalPrice * 0.2m);
                var saldo = FormatCurrency(trip.TotalPrice * 0.8m);

                var legRows = tripLegs.Count > 0
                    ? tripLegs
                        .OrderBy(l => l.SequenceNumber)
                        .Select(leg => new[]
                        {
                            leg.SequenceNumber.ToString(CultureInfo.InvariantCulture),
                            leg.Origin,
                            leg.Destination,
                            FormatDateTime(leg.DepartureDate),
                            $"{leg.DistanceKm} km",
                        })
                        .ToList()
                    : new List<string[]>
                    {
                        new[]
                        {
                            string.IsNullOrWhiteSpace(trip.Route)
                                ? "Roteiro conforme combinado com o cliente."
                                : trip.Route,
                        },
                    };

                var tokens = new Dictionary<string, string>
                {
                    ["TripNumber"] = trip.TripNumber ?? "-",
                    ["CompanyLegalName"] = CompanyLegalName,
                    ["CompanyCnpj"] = CompanyCnpj,
                    ["CompanyAddress"] = CompanyAddressLine,
                    ["ContratanteName"] = contratanteName,
                    ["ContratanteDocument"] = PartnerDocument(businessPartner),
                    ["ContratanteAddress"] = PartnerAddress(businessPartner),
                    ["TotalPrice"] = FormatCurrency(trip.TotalPrice),
                    ["LimiteKm"] = limiteKm,
                    ["KmExcedente"] = kmExcedente,
                    ["DiariaExtra"] = diariaExtra,
                    ["Sinal"] = sinal,
                    ["Saldo"] = saldo,
                    ["VehicleInfo"] = VehicleInfo(vehicle),
                    ["TripDate"] = FormatDate(trip.Date),
                };
                var blocks = new Dictionary<string, DocxBlock>
                {
                    ["LegRows"] = DocxBlock.ForTable(legRows),
                    ["SignatureBlock"] = BuildContractSignatureBlock(contratanteName, await GetSignatureBytesAsync()),
                };

                return await RenderDocument(DocumentTemplateType.Contract, tokens, blocks);
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "DocumentPdfGenerationService.GenerateContractPdf", tripId);
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<byte[]?> GenerateServiceOrderPdf(Guid tripId)
        {
            try
            {
                var tripResponse = await _tripService.FindById(tripId);
                if (tripResponse.Data == null)
                {
                    return null;
                }
                var trip = tripResponse.Data;

                var vehicle = trip.VehicleId.HasValue ? await FindVehicleOrNull(trip.VehicleId.Value) : null;
                var driver = trip.DriverId.HasValue ? await FindDriverOrNull(trip.DriverId.Value) : null;
                var passengerCount = (await _passengerService.FindByTrip(tripId)).Data?.Count() ?? 0;

                decimal? commissionAmount = null;
                if (trip.DriverId.HasValue)
                {
                    var serviceOrders = (await _serviceOrderService.FindByDriver(trip.DriverId.Value)).Data;
                    var matching = serviceOrders?.FirstOrDefault(so => so.TripId == tripId);
                    commissionAmount = matching?.Commission?.Amount;
                }

                var commissionRows =
                    commissionAmount != null
                        ? new List<string[]> { new[] { "VALOR COMISSÃO", FormatCurrency(commissionAmount) } }
                        : new List<string[]>();

                var tokens = new Dictionary<string, string>
                {
                    ["TripNumber"] = trip.TripNumber ?? "-",
                    ["DriverName"] = driver?.Name ?? "-",
                    ["VehicleInfo"] = vehicle != null ? $"{vehicle.Plate} - {vehicle.Brand} {vehicle.Model}" : "-",
                    ["TripDate"] = FormatDate(trip.Date),
                    ["Route"] = string.IsNullOrWhiteSpace(trip.Route) ? "-" : trip.Route,
                    ["DistanceKm"] = $"{trip.DistanceKm} km",
                    ["PassengerCount"] = passengerCount.ToString(CultureInfo.InvariantCulture),
                    ["CompanyWhatsapp"] = CompanyWhatsapp,
                    ["CompanyContactName"] = CompanyOfficeContactName,
                    ["CompanyLegalName"] = CompanyLegalName,
                };
                var blocks = new Dictionary<string, DocxBlock>
                {
                    ["CommissionRow"] = DocxBlock.ForTable(commissionRows),
                };

                return await RenderDocument(DocumentTemplateType.ServiceOrder, tokens, blocks);
            }
            catch (Exception ex)
            {
                _logService.LogException(ex, "DocumentPdfGenerationService.GenerateServiceOrderPdf", tripId);
                throw;
            }
        }

        #endregion

        #region Rendering

        private async Task<byte[]?> RenderDocument(
            DocumentTemplateType type,
            Dictionary<string, string> tokens,
            Dictionary<string, DocxBlock> blocks
        )
        {
            var templateBytes = await _documentTemplateService.GetFileBytes(type);
            if (templateBytes == null)
            {
                throw new InvalidOperationException($"Nenhum template .docx encontrado para o tipo {type}.");
            }

            var input = new DocxPdfInput
            {
                TemplateBytes = templateBytes,
                ScalarTokens = tokens,
                Blocks = blocks,
            };

            // Both the letterhead and the signature are admin-uploadable DocumentTemplates rather
            // than fixed assets embedded in this assembly - DocxPdfRenderer already tolerates a
            // null/empty background (renders without one) so a missing letterhead file here
            // degrades gracefully instead of failing every document. The signature is handled the
            // same way, but one level up (see GetSignatureBytesAsync/BuildSignatureBlock): it's
            // not part of DocxPdfInput, since it's injected into a DocxBlock built before
            // RenderDocument runs, not drawn as a page background.
            var letterheadBytes = await _documentTemplateService.GetFileBytes(DocumentTemplateType.Letterhead);
            return DocxPdfRenderer.Render(input, letterheadBytes);
        }

        /// <summary>
        /// The PNG signature image used by BuildSignatureBlock/BuildContractSignatureBlock - an
        /// admin-uploadable DocumentTemplate (DocumentTemplateType.Signature) rather than a fixed
        /// asset embedded in this assembly, so an Admin can replace it without a code change.
        /// </summary>
        private async Task<byte[]?> GetSignatureBytesAsync() =>
            await _documentTemplateService.GetFileBytes(DocumentTemplateType.Signature);

        private static DocxBlock BuildSignatureBlock(string otherPartyName, byte[]? signatureBytes)
        {
            var left = new List<DocxBlockElement>();
            // A missing/empty signature file (never uploaded yet, or removed) degrades to just the
            // company name - same "skip rather than fail" tolerance as the letterhead background.
            if (signatureBytes is { Length: > 0 })
            {
                left.Add(new DocxImageElement(signatureBytes, 35));
            }
            left.Add(new DocxParagraphElement(new[] { new DocxTextRun(CompanyLegalName) }, "center"));

            var right = new List<DocxBlockElement>
            {
                new DocxParagraphElement(Array.Empty<DocxTextRun>(), "center"),
                new DocxParagraphElement(new[] { new DocxTextRun(otherPartyName) }, "center"),
            };
            return DocxBlock.ForParagraphs(new List<DocxBlockRow> { DocxBlockRow.TwoColumns(left, right) });
        }

        private static DocxBlock BuildContractSignatureBlock(string contratanteName, byte[]? signatureBytes)
        {
            var left = new List<DocxBlockElement>();
            if (signatureBytes is { Length: > 0 })
            {
                left.Add(new DocxImageElement(signatureBytes, 35));
            }
            left.Add(
                new DocxParagraphElement(
                    new[] { new DocxTextRun($"{CompanyLegalName}\nCONTRATADA") },
                    "center"
                )
            );

            var right = new List<DocxBlockElement>
            {
                new DocxParagraphElement(Array.Empty<DocxTextRun>(), "center"),
                new DocxParagraphElement(
                    new[] { new DocxTextRun($"{contratanteName}\nCONTRATANTE") },
                    "center"
                ),
            };
            return DocxBlock.ForParagraphs(new List<DocxBlockRow> { DocxBlockRow.TwoColumns(left, right) });
        }

        #endregion

        #region Lookups (mirror the frontend's catchError(() => null) fallbacks)

        private async Task<BusinessPartnerDto?> FindBusinessPartnerOrNull(Guid? id)
        {
            if (!id.HasValue)
            {
                return null;
            }
            try
            {
                return (await _businessPartnerService.FindById(id)).Data;
            }
            catch
            {
                return null;
            }
        }

        private async Task<Vehicle?> FindVehicleOrNull(Guid id)
        {
            try
            {
                return (await _vehicleService.FindById(id)).Data;
            }
            catch
            {
                return null;
            }
        }

        private async Task<Driver?> FindDriverOrNull(Guid id)
        {
            try
            {
                return (await _driverService.FindById(id)).Data;
            }
            catch
            {
                return null;
            }
        }

        #endregion

        #region Formatting helpers (mirror quote-documents.ts / trip-documents.ts / order-documents.ts)

        private static string FormatCurrency(decimal? value) =>
            (value ?? 0).ToString("C", CultureInfo.GetCultureInfo("pt-BR"));

        private static string FormatDate(DateTime? value) =>
            value.HasValue ? value.Value.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) : "-";

        private static string FormatDateTime(DateTime? value) =>
            value.HasValue
                ? $"{value.Value:dd/MM/yyyy} às {value.Value:HH:mm}"
                : "-";

        private static string PartnerDocument(BusinessPartnerDto? partner)
        {
            if (partner == null)
            {
                return "-";
            }
            if (!string.IsNullOrWhiteSpace(partner.NationalRegistry))
            {
                return partner.NationalRegistry;
            }
            if (!string.IsNullOrWhiteSpace(partner.SocialSecurityCard))
            {
                return partner.SocialSecurityCard;
            }
            return "-";
        }

        private static string PartnerAddress(BusinessPartnerDto? partner)
        {
            var address = partner?.Addresses?.FirstOrDefault(a => a.IsDefault) ?? partner?.Addresses?.FirstOrDefault();
            if (address == null)
            {
                return "-";
            }
            var number = address.Number > 0 ? address.Number.ToString(CultureInfo.InvariantCulture) : "s/n";
            return $"{address.Street}, nº {number} - {address.City}/{address.State}";
        }

        private static string VehicleInfo(Vehicle? vehicle) =>
            vehicle != null
                ? $"{vehicle.Plate} - {vehicle.Brand} {vehicle.Model} ({vehicle.SeatCapacity} lugares)"
                : "A definir";

        private static string PaymentConditionLabel(PaymentCondition condition) =>
            condition switch
            {
                PaymentCondition.FullPayment => "À vista",
                PaymentCondition.InInstallments => "Parcelado",
                _ => "A combinar",
            };

        private static string PaymentMethodLabel(PaymentMethod? method) =>
            method switch
            {
                PaymentMethod.Cash => "Dinheiro",
                PaymentMethod.Pix => "Pix",
                PaymentMethod.CreditCard => "Cartão de Crédito",
                _ => "A combinar",
            };

        #endregion
    }
}
