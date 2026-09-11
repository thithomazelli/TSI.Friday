using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TSI.Nexus.Contracts.Models;

namespace TSI.Nexus.Data
{
    public static class DatabaseSeeder
    {
        public static async Task SeedAsync(IServiceProvider services)
        {
            using var scope = services.CreateScope();
            var provider = scope.ServiceProvider;

            var logger = provider.GetService<ILoggerFactory>()?.CreateLogger("DatabaseSeeder");

            try
            {
                var userManager = provider.GetRequiredService<UserManager<User>>();
                var roleManager = provider.GetRequiredService<RoleManager<IdentityRole>>();
                var config = provider.GetRequiredService<IConfiguration>();
                var env = provider.GetRequiredService<IHostEnvironment>();

                // ensure roles
                var roles = new[] { "Master", "Admin", "User" };
                foreach (var role in roles)
                {
                    if (!await roleManager.RoleExistsAsync(role))
                    {
                        var roleResult = await roleManager.CreateAsync(new IdentityRole(role));
                        if (!roleResult.Succeeded)
                        {
                            logger?.LogError("Failed to create role '{Role}': {Errors}", role, string.Join(';', roleResult.Errors));
                        }
                        else
                        {
                            logger?.LogInformation("Role '{Role}' created", role);
                        }
                    }
                }

                // Ensure initial users: Admin (Master role) plus the named Admin-role accounts.
                // UserName always equals Email, except "admin" itself: it's a technical/system
                // account with no real mailbox, so its "email" is just the literal string "admin".
                //
                // Password is resolved lazily (see ResolveSeedPassword) instead of hardcoded here:
                // a fixed, year-derived password committed to source and identical across every
                // environment (including Production) is a real credential-guessing risk. The
                // DevFallbackPassword below only ever applies outside Production, so local/demo
                // setup stays exactly as convenient as before.
                var year = DateTime.UtcNow.Year;
                var initialUsers = new[]
                {
                    (
                        UserName: "admin",
                        Email: "admin",
                        FirstName: "Admin",
                        LastName: "",
                        Role: "Master",
                        PasswordConfigKey: "Seed:AdminPassword",
                        DevFallbackPassword: $"!tsi@{year}",
                        // Earlier seed revisions created this account as "Admin" or "admin@local".
                        LegacyUserNames: new[] { "Admin", "admin@local" }
                    ),
                    (
                        UserName: "thiago.thomazelli@gmail.com",
                        Email: "thiago.thomazelli@gmail.com",
                        FirstName: "Thiago",
                        LastName: "Thomazelli",
                        Role: "Admin",
                        PasswordConfigKey: "Seed:ThiagoPassword",
                        DevFallbackPassword: $"tsi@{year}",
                        // Earlier seed revisions created this account as "Thiago" with password "tsi".
                        LegacyUserNames: new[] { "Thiago" }
                    ),
                    (
                        UserName: "leonardothomazellif@gmail.com",
                        Email: "leonardothomazellif@gmail.com",
                        FirstName: "Leonardo",
                        LastName: "Thomazelli",
                        Role: "Admin",
                        PasswordConfigKey: "Seed:LeonardoPassword",
                        DevFallbackPassword: $"tsi@{year}",
                        // Earlier seed revisions created this account as "Leonardo" with password "tsi".
                        LegacyUserNames: new[] { "Leonardo" }
                    ),
                };

                foreach (var initialUser in initialUsers)
                {
                    var existing = await userManager.FindByNameAsync(initialUser.UserName);

                    // One-time migration: find an account created under an earlier seed revision's
                    // username so it gets renamed/repaired in place instead of duplicated. Once
                    // renamed, the lookup above matches directly on future runs and this is skipped
                    // -- so a password the person later changes themselves is never touched again.
                    var isMigration = false;
                    if (existing == null)
                    {
                        foreach (var legacyUserName in initialUser.LegacyUserNames)
                        {
                            existing = await userManager.FindByNameAsync(legacyUserName);
                            if (existing != null)
                            {
                                isMigration = true;
                                break;
                            }
                        }
                    }

                    if (existing == null)
                    {
                        var user = new User
                        {
                            UserName = initialUser.UserName,
                            Email = initialUser.Email,
                            EmailConfirmed = true,
                            FirstName = initialUser.FirstName,
                            LastName = initialUser.LastName,
                        };

                        var seedPassword = ResolveSeedPassword(
                            config,
                            env,
                            logger,
                            initialUser.PasswordConfigKey,
                            initialUser.UserName,
                            initialUser.DevFallbackPassword
                        );
                        var result = await userManager.CreateAsync(user, seedPassword);
                        if (!result.Succeeded)
                        {
                            logger?.LogError(
                                "Failed to create user '{UserName}': {Errors}",
                                initialUser.UserName,
                                string.Join(';', result.Errors)
                            );
                            continue;
                        }

                        logger?.LogInformation("User '{UserName}' created", initialUser.UserName);

                        var addRoleResult = await userManager.AddToRoleAsync(user, initialUser.Role);
                        if (!addRoleResult.Succeeded)
                        {
                            logger?.LogError(
                                "Failed to add user '{UserName}' to role '{Role}': {Errors}",
                                initialUser.UserName,
                                initialUser.Role,
                                string.Join(';', addRoleResult.Errors)
                            );
                        }
                    }
                    else if (isMigration)
                    {
                        var setUserNameResult = await userManager.SetUserNameAsync(
                            existing,
                            initialUser.UserName
                        );
                        var setEmailResult = await userManager.SetEmailAsync(
                            existing,
                            initialUser.Email
                        );
                        existing.EmailConfirmed = true;
                        var updateResult = await userManager.UpdateAsync(existing);

                        if (await userManager.HasPasswordAsync(existing))
                        {
                            await userManager.RemovePasswordAsync(existing);
                        }
                        var migratedPassword = ResolveSeedPassword(
                            config,
                            env,
                            logger,
                            initialUser.PasswordConfigKey,
                            initialUser.UserName,
                            initialUser.DevFallbackPassword
                        );
                        var addPasswordResult = await userManager.AddPasswordAsync(
                            existing,
                            migratedPassword
                        );

                        if (
                            !setUserNameResult.Succeeded
                            || !setEmailResult.Succeeded
                            || !updateResult.Succeeded
                            || !addPasswordResult.Succeeded
                        )
                        {
                            logger?.LogError(
                                "Failed to migrate legacy user onto '{UserName}'",
                                initialUser.UserName
                            );
                        }
                        else
                        {
                            logger?.LogInformation(
                                "Migrated legacy user onto '{UserName}'",
                                initialUser.UserName
                            );
                        }

                        if (!await userManager.IsInRoleAsync(existing, initialUser.Role))
                        {
                            var addRoleResult = await userManager.AddToRoleAsync(
                                existing,
                                initialUser.Role
                            );
                            if (!addRoleResult.Succeeded)
                            {
                                logger?.LogError(
                                    "Failed to add migrated user '{UserName}' to role '{Role}': {Errors}",
                                    initialUser.UserName,
                                    initialUser.Role,
                                    string.Join(';', addRoleResult.Errors)
                                );
                            }
                        }
                    }
                    else
                    {
                        logger?.LogInformation("User '{UserName}' already exists", initialUser.UserName);

                        if (!await userManager.IsInRoleAsync(existing, initialUser.Role))
                        {
                            var addRoleResult = await userManager.AddToRoleAsync(existing, initialUser.Role);
                            if (!addRoleResult.Succeeded)
                            {
                                logger?.LogError(
                                    "Failed to add existing user '{UserName}' to role '{Role}': {Errors}",
                                    initialUser.UserName,
                                    initialUser.Role,
                                    string.Join(';', addRoleResult.Errors)
                                );
                            }
                        }
                    }
                }

                // Ensure every group + entity feature toggle exists. All enabled by default, so
                // this never changes the behaviour of a database that already has real data --
                // it only ever fills in rows that don't exist yet.
                var context = provider.GetRequiredService<MyDBContextEF>();
                var featureToggles = new[]
                {
                    // Groups
                    (
                        Key: FeatureToggleKeys.FleetModule,
                        Name: "Módulo de Frota / Viagens",
                        Description: "Controla a exibição de Viagens, Veículos, Motoristas, Ordens de Serviço e demais dados de frota em todo o sistema.",
                        GroupKey: (string?)null
                    ),
                    (
                        Key: FeatureToggleKeys.FinanceModule,
                        Name: "Financeiro / Relatórios",
                        Description: "Controla a exibição de Transações, Pagamentos e Relatórios em todo o sistema.",
                        GroupKey: (string?)null
                    ),
                    (
                        Key: FeatureToggleKeys.QuotesModule,
                        Name: "Orçamentos",
                        Description: "Controla a exibição de Orçamentos do tipo Produto em todo o sistema.",
                        GroupKey: (string?)null
                    ),
                    (
                        Key: FeatureToggleKeys.SalesOrdersModule,
                        Name: "Pedidos de Venda",
                        Description: "Controla a exibição de Pedidos de Venda em todo o sistema.",
                        GroupKey: (string?)null
                    ),
                    (
                        Key: FeatureToggleKeys.PurchaseOrdersModule,
                        Name: "Pedidos de Compra",
                        Description: "Controla a exibição de Pedidos de Compra em todo o sistema.",
                        GroupKey: (string?)null
                    ),
                    (
                        Key: FeatureToggleKeys.AttachmentsModule,
                        Name: "Anexos",
                        Description: "Controla a exibição de Anexos em todo o sistema.",
                        GroupKey: (string?)null
                    ),
                    (
                        Key: FeatureToggleKeys.AgendaModule,
                        Name: "Agenda / Calendário",
                        Description: "Controla a exibição da Agenda em todo o sistema: a tela própria, a aba Agenda em cada entidade, e o sino de próximos eventos na navbar.",
                        GroupKey: (string?)null
                    ),
                    // Fleet/Viagens entities
                    (Key: FeatureToggleKeys.Trip, Name: "Viagens", Description: "Controla a exibição de Viagens.", GroupKey: FeatureToggleKeys.FleetModule),
                    (Key: FeatureToggleKeys.TripLeg, Name: "Trechos de Viagem", Description: "Controla a exibição de Trechos de Viagem.", GroupKey: FeatureToggleKeys.FleetModule),
                    (Key: FeatureToggleKeys.QuoteTripLeg, Name: "Itinerário do Orçamento de Viagem", Description: "Controla a exibição do Itinerário em Orçamentos de Viagem.", GroupKey: FeatureToggleKeys.FleetModule),
                    (Key: FeatureToggleKeys.Passenger, Name: "Passageiros", Description: "Controla a exibição de Passageiros.", GroupKey: FeatureToggleKeys.FleetModule),
                    (Key: FeatureToggleKeys.Driver, Name: "Motoristas", Description: "Controla a exibição de Motoristas.", GroupKey: FeatureToggleKeys.FleetModule),
                    (Key: FeatureToggleKeys.Vehicle, Name: "Veículos", Description: "Controla a exibição de Veículos.", GroupKey: FeatureToggleKeys.FleetModule),
                    (Key: FeatureToggleKeys.FuelLog, Name: "Abastecimentos", Description: "Controla a exibição de Abastecimentos.", GroupKey: FeatureToggleKeys.FleetModule),
                    (Key: FeatureToggleKeys.VehicleMaintenance, Name: "Manutenções", Description: "Controla a exibição de Manutenções de Veículo.", GroupKey: FeatureToggleKeys.FleetModule),
                    (Key: FeatureToggleKeys.ServiceOrder, Name: "Ordens de Serviço", Description: "Controla a exibição de Ordens de Serviço.", GroupKey: FeatureToggleKeys.FleetModule),
                    (Key: FeatureToggleKeys.Commission, Name: "Comissões", Description: "Controla a exibição de Comissões de Motorista.", GroupKey: FeatureToggleKeys.FleetModule),
                    (Key: FeatureToggleKeys.DriverLicenseAlert, Name: "Alerta de CNH a Vencer", Description: "Controla a exibição do alerta de CNH a vencer na navbar.", GroupKey: FeatureToggleKeys.FleetModule),
                    (Key: FeatureToggleKeys.VehicleBlockedAlert, Name: "Alerta de Veículos Bloqueados", Description: "Controla a exibição do alerta de veículos bloqueados na navbar.", GroupKey: FeatureToggleKeys.FleetModule),
                    // Financeiro entities
                    (Key: FeatureToggleKeys.Transaction, Name: "Transações", Description: "Controla a exibição de Transações.", GroupKey: FeatureToggleKeys.FinanceModule),
                    (Key: FeatureToggleKeys.Payment, Name: "Pagamentos", Description: "Controla a exibição de Pagamentos.", GroupKey: FeatureToggleKeys.FinanceModule),
                    (Key: FeatureToggleKeys.PaymentAlert, Name: "Alerta de Pagamentos", Description: "Controla a exibição do alerta de pagamentos atrasados/pendentes na navbar.", GroupKey: FeatureToggleKeys.FinanceModule),
                    // Orçamentos entities
                    (Key: FeatureToggleKeys.Quote, Name: "Orçamentos (Produto)", Description: "Controla a exibição de Orçamentos do tipo Produto.", GroupKey: FeatureToggleKeys.QuotesModule),
                    // Pedidos de Venda entities
                    (Key: FeatureToggleKeys.Order, Name: "Pedidos de Venda", Description: "Controla a exibição de Pedidos de Venda.", GroupKey: FeatureToggleKeys.SalesOrdersModule),
                    (Key: FeatureToggleKeys.OrderProduct, Name: "Itens de Pedido", Description: "Controla a exibição de Itens de Pedido.", GroupKey: FeatureToggleKeys.SalesOrdersModule),
                    // Pedidos de Compra entities
                    (Key: FeatureToggleKeys.PurchaseOrder, Name: "Pedidos de Compra", Description: "Controla a exibição de Pedidos de Compra.", GroupKey: FeatureToggleKeys.PurchaseOrdersModule),
                    (Key: FeatureToggleKeys.StockAlert, Name: "Alerta de Estoque", Description: "Controla a exibição do alerta de produtos sem estoque ou com estoque baixo na navbar.", GroupKey: FeatureToggleKeys.PurchaseOrdersModule),
                    // Anexos entities
                    (Key: FeatureToggleKeys.Attachment, Name: "Anexos", Description: "Controla a exibição de Anexos.", GroupKey: FeatureToggleKeys.AttachmentsModule),
                    // Agenda entities
                    (Key: FeatureToggleKeys.Event, Name: "Eventos", Description: "Controla a exibição de Eventos da Agenda.", GroupKey: FeatureToggleKeys.AgendaModule),
                    (Key: FeatureToggleKeys.UpcomingEventAlert, Name: "Alerta de Próximos Eventos", Description: "Controla a exibição do alerta de próximos eventos na navbar.", GroupKey: FeatureToggleKeys.AgendaModule),
                };

                foreach (var toggle in featureToggles)
                {
                    var exists = await context.FeatureToggle.AnyAsync(f => f.Key == toggle.Key);
                    if (!exists)
                    {
                        await context.FeatureToggle.AddAsync(
                            new FeatureToggle
                            {
                                Key = toggle.Key,
                                Name = toggle.Name,
                                Description = toggle.Description,
                                GroupKey = toggle.GroupKey,
                                Enabled = true,
                            }
                        );
                        logger?.LogInformation("FeatureToggle '{Key}' created (enabled)", toggle.Key);
                    }
                }

                await context.SaveChangesAsync();

                // Ensure every alert config exists. All enabled by default, with the current
                // hardcoded lead time as the initial ThresholdDays, so seeding never changes the
                // alert's real-world behaviour - it only makes it editable from now on.
                var alertConfigs = new[]
                {
                    (
                        Key: AlertConfigKeys.VehicleMaintenanceOverdue,
                        Name: "Manutenção de Veículo Vencida",
                        Description: "Alerta disparado quando a data agendada de uma manutenção de veículo passa sem ela ser concluída; o veículo é bloqueado automaticamente.",
                        ThresholdDays: (int?)null
                    ),
                    (
                        Key: AlertConfigKeys.DashboardOverdueReturns,
                        Name: "Devoluções em Atraso",
                        Description: "Alerta disparado quando itens de pedido (aluguel) ou pagamentos passam da data de vencimento sem serem concluídos.",
                        ThresholdDays: (int?)null
                    ),
                    (
                        Key: AlertConfigKeys.DriverLicenseExpiry,
                        Name: "Licença de Motorista a Vencer",
                        Description: "Alerta disparado quando a licença de transporte (CNH) de um motorista já expirou ou expira dentro do prazo configurado.",
                        ThresholdDays: (int?)60
                    ),
                    (
                        Key: AlertConfigKeys.UpcomingEventReminder,
                        Name: "Próximos Eventos",
                        Description: "Alerta disparado para eventos da Agenda que começam dentro do prazo configurado.",
                        ThresholdDays: (int?)1
                    ),
                };

                foreach (var alertConfig in alertConfigs)
                {
                    var exists = await context.AlertConfig.AnyAsync(a => a.Key == alertConfig.Key);
                    if (!exists)
                    {
                        await context.AlertConfig.AddAsync(
                            new AlertConfig
                            {
                                Key = alertConfig.Key,
                                Name = alertConfig.Name,
                                Description = alertConfig.Description,
                                ThresholdDays = alertConfig.ThresholdDays,
                                Enabled = true,
                            }
                        );
                        logger?.LogInformation("AlertConfig '{Key}' created (enabled)", alertConfig.Key);
                    }
                }

                await context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                var logger2 = services.GetService<ILoggerFactory>()?.CreateLogger("DatabaseSeeder");
                logger2?.LogError(ex, "An error occurred while seeding the database.");
            }
        }

        /// <summary>
        /// Resolves the password used to create/repair one of the fixed initial accounts (called
        /// only inside the branches that actually need it, so a live Production account that
        /// already exists never triggers this - see SeedAsync). Precedence: an explicit
        /// <paramref name="configKey"/> value (e.g. a deploy-time env var) always wins; outside
        /// Production, falls back to the same predictable dev-convenience password this seeder
        /// always used; in Production with nothing configured, generates a random one-time
        /// password and logs it once instead of using a fixed, source-committed value that would
        /// be identical across every deployment of this app.
        /// </summary>
        private static string ResolveSeedPassword(
            IConfiguration config,
            IHostEnvironment env,
            ILogger? logger,
            string configKey,
            string userName,
            string devFallbackPassword
        )
        {
            var configured = config[configKey];
            if (!string.IsNullOrWhiteSpace(configured))
            {
                return configured;
            }

            if (!env.IsProduction())
            {
                return devFallbackPassword;
            }

            var generated = GenerateRandomPassword();
            logger?.LogWarning(
                "SEED: no {ConfigKey} configured in Production - generated a random initial "
                    + "password for '{UserName}': {Password}. Log in and change it immediately; "
                    + "this will not be shown again.",
                configKey,
                userName,
                generated
            );
            return generated;
        }

        private static string GenerateRandomPassword()
        {
            const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
            var bytes = RandomNumberGenerator.GetBytes(24);
            var builder = new StringBuilder(bytes.Length);
            foreach (var b in bytes)
            {
                builder.Append(chars[b % chars.Length]);
            }
            return builder.ToString();
        }
    }
}
