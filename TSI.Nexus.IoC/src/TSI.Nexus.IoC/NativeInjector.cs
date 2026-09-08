using AutoMapper;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Data.Interceptors;
using TSI.Nexus.Repository;
using TSI.Nexus.Repository.Overdue;
using TSI.Nexus.Services;
using TSI.Nexus.Services.Services;

namespace TSI.Nexus.IoC
{
    public static class NativeInjector
    {
        /// <summary>
        /// This method will be responsible to configure the dependency injections for every service class add on this project.
        /// </summary>
        /// <param name="services">Service collection received when the startup is executed</param>
        public static void RegisterServices(IServiceCollection services)
        {
            #region Mapping Profiles

            // Manual registration of AutoMapper without relying on AutoMapper.Extensions.Microsoft.DependencyInjection
            services.AddSingleton(sp =>
            {
                var loggerFactory = sp.GetRequiredService<ILoggerFactory>();
                var config = new MapperConfiguration(
                    cfg =>
                    {
                        cfg.ConstructServicesUsing(type => sp.GetService(type));
                        cfg.AddMaps(typeof(MappingProfile).Assembly); // escaneia todos os Profiles do assembly
                    },
                    loggerFactory
                );

                // opcional em ambiente de dev: config.AssertConfigurationIsValid();
                return config.CreateMapper(sp.GetService);
            });

            #endregion

            #region Infrastructure Services

            // IHttpContextAccessor is needed by CurrentUserService
            services.AddHttpContextAccessor();

            // Backs FeatureToggleService's in-memory cache (short TTL, invalidated on toggle
            // save) - registered as singleton so the cache is actually shared across requests,
            // regardless of FeatureToggleService's own (scoped) lifetime.
            services.AddMemoryCache();

            // CurrentUserService depends only on IHttpContextAccessor and can be registered as singleton
            // so interceptors (registered as singleton) can consume it when DbContext is being configured.
            services.AddSingleton<ICurrentUserService, CurrentUserService>();

            // Register EF interceptors as singletons so they can be requested from the root provider
            // during AddDbContextPool configuration without causing scoped->singleton captive dependency.
            services.AddSingleton<AuditingSaveChangesInterceptor>();
            services.AddSingleton<StockAdjustingSaveChangesInterceptor>();
            services.AddSingleton<MaintenancePartsStockAdjustingSaveChangesInterceptor>();
            services.AddSingleton<PurchaseOrderStockIncrementingSaveChangesInterceptor>();
            services.AddSingleton<FuelLogStockAdjustingSaveChangesInterceptor>();

            #endregion

            #region Services
            // register repository and service for overdue
            services.AddScoped<IOverdueRepository, OverdueRepository>();
            services.AddScoped<IOverdueService, OverdueService>();
            // register hosted service
            services.AddHostedService<OverdueStatusBackgroundService>();

            // register service and hosted service for vehicle maintenance overdue/auto-block
            services.AddScoped<IVehicleMaintenanceOverdueService, VehicleMaintenanceOverdueService>();
            services.AddHostedService<VehicleMaintenanceOverdueBackgroundService>();

            services.AddScoped<IAddressService, AddressService>();
            services.AddScoped<IAttachmentService, AttachmentService>();
            services.AddScoped<IBusinessPartnerService, BusinessPartnerService>();
            services.AddScoped<ICompanyService, CompanyService>();
            services.AddScoped<IDriverService, DriverService>();
            services.AddScoped<IEmailService, EmailService>();
            services.AddScoped<IIndividualService, IndividualService>();
            services.AddScoped<IJwtService, JwtService>();
            services.AddScoped<IOrderProductService, OrderProductService>();
            services.AddScoped<IOrderService, OrderService>();
            services.AddScoped<IPurchaseOrderProductService, PurchaseOrderProductService>();
            services.AddScoped<IPurchaseOrderService, PurchaseOrderService>();
            services.AddScoped<ITripService, TripService>();
            services.AddScoped<ITripDriverService, TripDriverService>();
            services.AddScoped<ITransactionService, TransactionService>();
            services.AddScoped<IPaymentService, PaymentService>();
            services.AddScoped<IPhotoService, PhotoService>();
            services.AddScoped<IProductPhotoService, ProductPhotoService>();
            services.AddScoped<ILogService, LogService>();
            services.AddScoped<IProductService, ProductService>();
            services.AddScoped<IQuoteService, QuoteService>();
            services.AddScoped<IQuoteProductService, QuoteProductService>();
            services.AddScoped<IUserManagerService, UserManagerService>();
            services.AddScoped<ISequenceService, SequenceService>();
            services.AddScoped<IDashboardService, DashboardService>();
            services.AddScoped<IVehicleService, VehicleService>();
            services.AddScoped<IVehicleMaintenanceService, VehicleMaintenanceService>();
            services.AddScoped<IVehicleMaintenanceProductService, VehicleMaintenanceProductService>();
            services.AddScoped<ITripLegService, TripLegService>();
            services.AddScoped<IQuoteTripLegService, QuoteTripLegService>();
            services.AddScoped<IPassengerService, PassengerService>();
            services.AddScoped<IFuelLogService, FuelLogService>();
            services.AddScoped<IServiceOrderService, ServiceOrderService>();
            services.AddScoped<ICommissionService, CommissionService>();
            services.AddScoped<IDocumentTemplateService, DocumentTemplateService>();
            services.AddScoped<IDocumentPdfGenerationService, DocumentPdfGenerationService>();
            services.AddScoped<IFeatureToggleService, FeatureToggleService>();
            services.AddScoped<IAlertConfigService, AlertConfigService>();
            services.AddScoped<ISelectableOptionService, SelectableOptionService>();
            services.AddScoped<IEventService, EventService>();
            services.AddScoped<IEventParticipantService, EventParticipantService>();

            #endregion Services

            #region Repositories

            services.AddScoped<IRepository<Address>, Repository<Address>>();
            services.AddScoped<IRepository<Attachment>, Repository<Attachment>>();
            services.AddScoped<IRepository<BusinessPartner>, Repository<BusinessPartner>>();
            services.AddScoped<IRepository<Company>, Repository<Company>>();
            services.AddScoped<IRepository<Driver>, Repository<Driver>>();
            services.AddScoped<IRepository<Individual>, Repository<Individual>>();
            services.AddScoped<IRepository<Order>, Repository<Order>>();
            services.AddScoped<IRepository<OrderProduct>, Repository<OrderProduct>>();
            services.AddScoped<IRepository<PurchaseOrder>, Repository<PurchaseOrder>>();
            services.AddScoped<IRepository<PurchaseOrderProduct>, Repository<PurchaseOrderProduct>>();
            services.AddScoped<IRepository<Trip>, Repository<Trip>>();
            services.AddScoped<IRepository<TripDriver>, Repository<TripDriver>>();
            services.AddScoped<IRepository<QuoteTrip>, Repository<QuoteTrip>>();
            services.AddScoped<IRepository<DocumentTemplate>, Repository<DocumentTemplate>>();
            services.AddScoped<IRepository<FeatureToggle>, Repository<FeatureToggle>>();
            services.AddScoped<IRepository<AlertConfig>, Repository<AlertConfig>>();
            services.AddScoped<IRepository<SelectableOption>, Repository<SelectableOption>>();
            services.AddScoped<IRepository<Event>, Repository<Event>>();
            services.AddScoped<IRepository<EventParticipant>, Repository<EventParticipant>>();
            services.AddScoped<IRepository<Transaction>, Repository<Transaction>>();
            services.AddScoped<IRepository<Payment>, Repository<Payment>>();
            services.AddScoped<IRepository<Product>, Repository<Product>>();
            services.AddScoped<IRepository<ProductPhoto>, Repository<ProductPhoto>>();
            services.AddScoped<IRepository<Quote>, Repository<Quote>>();
            services.AddScoped<IRepository<QuoteProduct>, Repository<QuoteProduct>>();
            services.AddScoped<IRepository<User>, Repository<User>>();
            services.AddScoped<IRepository<Sequence>, Repository<Sequence>>();
            services.AddScoped<IRepository<Vehicle>, Repository<Vehicle>>();
            services.AddScoped<IRepository<VehicleMaintenance>, Repository<VehicleMaintenance>>();
            services.AddScoped<
                IRepository<VehicleMaintenanceProduct>,
                Repository<VehicleMaintenanceProduct>
            >();
            services.AddScoped<IRepository<TripLeg>, Repository<TripLeg>>();
            services.AddScoped<IRepository<QuoteTripLeg>, Repository<QuoteTripLeg>>();
            services.AddScoped<IRepository<Passenger>, Repository<Passenger>>();
            services.AddScoped<IRepository<FuelLog>, Repository<FuelLog>>();
            services.AddScoped<IRepository<ServiceOrder>, Repository<ServiceOrder>>();
            services.AddScoped<IRepository<Commission>, Repository<Commission>>();

            #endregion Repositories
        }
    }
}
