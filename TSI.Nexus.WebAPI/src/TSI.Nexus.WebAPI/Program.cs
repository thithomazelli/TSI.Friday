using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Data;
using TSI.Nexus.Data.Interceptors;
using TSI.Nexus.Data.Seed;
using TSI.Nexus.IoC;

var builder = WebApplication.CreateBuilder(args);

// Optional, git-ignored file for local secrets (connection strings, JWT key, MailJet keys).
// Loaded after appsettings.{Environment}.json so it overrides them, but before environment
// variables/user-secrets, keeping the usual ASP.NET Core precedence for those.
builder.Configuration.AddJsonFile(
    "appsettings.Local.json",
    optional: true,
    reloadOnChange: true
);

// Add services to the container.

builder
    .Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        // Several entity pairs have bidirectional EF Core navigation properties
        // (Vehicle<->VehicleMaintenance, Commission<->ServiceOrder, ...) that get fixed up on
        // both sides when loaded into the same tracked DbContext, producing a reference cycle
        // the serializer can't walk. IgnoreCycles just omits the back-reference instead of
        // throwing, without changing the JSON shape (no $id/$values wrappers) for the rest of
        // the payload the Angular app already expects.
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Register Services from Native Injector
// (this includes the hosted background services - OverdueStatusBackgroundService and
// VehicleMaintenanceOverdueBackgroundService - no need to register them again here)
NativeInjector.RegisterServices(builder.Services);

// Add DbContext with interceptor
builder.Services.AddDbContextPool<MyDBContextEF>(
    (sp, options) =>
    {
        var mySqlConnectionStr = builder.Configuration.GetConnectionString("DefaultConnection");
        options.UseMySQL(mySqlConnectionStr);
        options.AddInterceptors(sp.GetRequiredService<AuditingSaveChangesInterceptor>());
        options.AddInterceptors(sp.GetRequiredService<StockAdjustingSaveChangesInterceptor>());
        options.AddInterceptors(
            sp.GetRequiredService<MaintenancePartsStockAdjustingSaveChangesInterceptor>()
        );
        options.AddInterceptors(
            sp.GetRequiredService<PurchaseOrderStockIncrementingSaveChangesInterceptor>()
        );
        options.AddInterceptors(
            sp.GetRequiredService<FuelLogStockAdjustingSaveChangesInterceptor>()
        );
    }
);

// set default overdue interval if not present
builder.Configuration["OverdueCheckIntervalSeconds"] ??= "60";

// Configure Indentity core
builder
    .Services.AddIdentityCore<User>(options =>
    {
        // Password config
        options.Password.RequiredLength = 6;
        options.Password.RequireDigit = false;
        options.Password.RequireLowercase = false;
        options.Password.RequireUppercase = false;
        options.Password.RequireNonAlphanumeric = false;

        // Sign In config
        options.SignIn.RequireConfirmedEmail = true;

        // Lockout config: paired with UserManagerService.Login passing lockoutOnFailure: true -
        // without this, wrong-password attempts were never counted at all, so an attacker (or a
        // credential-stuffing script) could try passwords against this weak policy indefinitely.
        options.Lockout.AllowedForNewUsers = true;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    })
    .AddRoles<IdentityRole>() // be able to add roles
    .AddEntityFrameworkStores<MyDBContextEF>() // providing our context
    .AddRoleManager<RoleManager<IdentityRole>>() // be able to make use of RoleManager
    .AddSignInManager<SignInManager<User>>() // make use of Signin manager
    .AddUserManager<UserManager<User>>() // make use of UserManager to create new users
    .AddDefaultTokenProviders(); // be able to reate tokens for email confirmations

builder
    .Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            // validate the token based on the key we have provided inside appsetting
            ValidateIssuerSigningKey = true,
            // the issuer singning key based on JWT:Key
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["JWT:Key"])
            ),
            // the issuer which in here is the api project url
            ValidIssuer = builder.Configuration["JWT:Issuer"],
            // validate the issuer (who ever is issuing the JWT)
            ValidateIssuer = true,
            // the audience is the Angular app that's meant to consume the token
            ValidAudience = builder.Configuration["JWT:Audience"],
            // validate the audience (rejects a token minted for/replayed against a different app,
            // should this JWT signing key ever end up shared between services)
            ValidateAudience = true,
            // ensure role claims are read from ClaimTypes.Role
            RoleClaimType = System.Security.Claims.ClaimTypes.Role,
        };
    });

// Add authorization policies
builder.Services.AddAuthorization(options =>
{
    // Master sees/does everything Admin does, plus the toggle panel (RequireMaster below) --
    // so every Admin-gated endpoint accepts Master too.
    options.AddPolicy("RequireAdmin", policy => policy.RequireRole("Admin", "Master"));
    options.AddPolicy("RequireMaster", policy => policy.RequireRole("Master"));
});

// Rate-limits the anonymous auth endpoints (login/register/forgot-password/reset-password) that
// Identity's own lockout doesn't cover by itself - lockout only kicks in once a *specific known
// account* has failed enough times, so it does nothing against a credential-stuffing script
// spraying different e-mails, or someone hammering /register or /reset-password. Keyed per client
// IP so one abusive caller doesn't exhaust the limit for everyone else.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(
        "auth",
        httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                }
            )
    );
});

builder.Services.AddCors();
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = actionContext =>
    {
        var errors = actionContext
            .ModelState.Where(_ => _.Value.Errors.Count > 0)
            .SelectMany(_ => _.Value.Errors)
            .Select(_ => _.ErrorMessage)
            .ToArray();

        var toReturn = new { Errors = errors };

        return new BadRequestObjectResult(toReturn);
    };
});

var app = builder.Build();

// Seed database
try
{
    DatabaseSeeder.SeedAsync(app.Services).GetAwaiter().GetResult();
}
catch
{
    // swallow to not break startup
}

// Seed the default document templates (Orçamento, Contrato, OS, Pedido de Venda) used to
// generate PDFs. Only inserts a template when its type doesn't exist yet - never overwrites one
// an Admin has already edited.
try
{
    DocumentTemplateSeeder.SeedAsync(app.Services).GetAwaiter().GetResult();
}
catch
{
    // swallow to not break startup
}

// Seed the default values for the admin-editable dropdown option lists (address type, product
// category, transaction category), and rewrite any Address/Product row still holding one of the
// old hardcoded English keys to the new Portuguese label.
try
{
    SelectableOptionSeeder.SeedAsync(app.Services).GetAwaiter().GetResult();
}
catch
{
    // swallow to not break startup
}

// Optional demo data (fake business partners, quotes, orders, fleet, etc.) for presenting the
// app on a clean database. Never runs unless explicitly enabled - and never in Production, even
// if the flag is set by mistake - and it's a no-op once real data exists (see DemoDataSeeder).
if (builder.Configuration.GetValue<bool>("SeedDemoData") && !app.Environment.IsProduction())
{
    try
    {
        DemoDataSeeder.SeedAsync(app.Services).GetAwaiter().GetResult();
    }
    catch
    {
        // swallow to not break startup
    }
}

// Ensure attachments directory exists (files served only via authenticated API endpoints)
string configuredAttachments = builder.Configuration["Attachments:BasePath"];
string attachmentsPath;
if (!string.IsNullOrWhiteSpace(configuredAttachments))
{
    attachmentsPath = Path.IsPathRooted(configuredAttachments)
        ? Path.GetFullPath(configuredAttachments)
        : Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, configuredAttachments));
}
else
{
    attachmentsPath = Path.GetFullPath(
        Path.Combine(app.Environment.ContentRootPath, "attachments")
    );
}
Directory.CreateDirectory(attachmentsPath);

// Configure the HTTP request pipeline.
// UseCors must run before UseExceptionHandler: middleware registered earlier wraps
// middleware registered later, so an unhandled exception caught by UseExceptionHandler still
// unwinds back out through UseCors's response header logic. With the order reversed, error
// responses (500s) go out with no Access-Control-Allow-Origin header, and the browser reports
// a misleading CORS failure instead of the real error.
app.UseCors(opt =>
    opt.AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()
        .WithOrigins(builder.Configuration["JWT:ClientUrl"])
);

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(
            new { message = "An unexpected error occurred. Please try again later." }
        );
    });
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseRateLimiter();

// adding UseAuthentication into our pipeline and this should come before UseAuthorization
// Authentication verifies the identity of a user or service, and authorization determines their access rights.
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
