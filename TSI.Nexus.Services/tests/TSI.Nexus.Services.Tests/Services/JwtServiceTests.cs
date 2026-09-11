using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using Moq;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Services;

namespace TSI.Nexus.Services.Tests.Services
{
    public class JwtServiceTests
    {
        private static User NewUser() =>
            new()
            {
                Id = Guid.NewGuid().ToString(),
                UserName = "jane.doe",
                Email = "jane.doe@example.com",
                FirstName = "Jane",
                LastName = "Doe",
            };

        private static IConfiguration BuildConfig(Dictionary<string, string?> values) =>
            new ConfigurationBuilder().AddInMemoryCollection(values).Build();

        [Fact]
        public void CreateJWT_ShouldIncludeUserClaims()
        {
            var config = BuildConfig(
                new()
                {
                    ["JWT:Key"] = "super-secret-test-key-with-enough-length-1234567890",
                    ["JWT:Issuer"] = "TSI.Nexus.Tests",
                    ["JWT:Audience"] = "TSI.Nexus.Tests.Client",
                }
            );
            var service = new JwtService(config);
            var user = NewUser();

            var result = service.CreateJWT(user);

            // JwtSecurityTokenHandler.CreateToken remaps standard ClaimTypes.* URIs to short JWT
            // claim names on write (e.g. NameIdentifier -> "nameid") per its default outbound map -
            // look claims up through that same map instead of the original long-form ClaimTypes.
            var map = JwtSecurityTokenHandler.DefaultOutboundClaimTypeMap;
            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(result.Token);
            Assert.Equal(user.Id, jwt.Claims.First(c => c.Type == map[ClaimTypes.NameIdentifier]).Value);
            Assert.Equal(user.UserName, jwt.Claims.First(c => c.Type == map[ClaimTypes.Name]).Value);
            Assert.Equal(user.Email, jwt.Claims.First(c => c.Type == map[ClaimTypes.Email]).Value);
            Assert.Equal(user.FirstName, jwt.Claims.First(c => c.Type == map[ClaimTypes.GivenName]).Value);
            Assert.Equal(user.LastName, jwt.Claims.First(c => c.Type == map[ClaimTypes.Surname]).Value);
            Assert.Equal("TSI.Nexus.Tests", jwt.Issuer);
            Assert.Equal("TSI.Nexus.Tests.Client", jwt.Audiences.Single());
            Assert.DoesNotContain(jwt.Claims, c => c.Type == map[ClaimTypes.Role]);
        }

        [Fact]
        public void CreateJWT_ShouldIncludeRoleClaims_WhenRolesProvided()
        {
            var config = BuildConfig(
                new() { ["JWT:Key"] = "super-secret-test-key-with-enough-length-1234567890" }
            );
            var service = new JwtService(config);

            var result = service.CreateJWT(NewUser(), new[] { "Master", "Administrator" });

            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(result.Token);
            var roleClaimType = JwtSecurityTokenHandler.DefaultOutboundClaimTypeMap[ClaimTypes.Role];
            var roles = jwt.Claims.Where(c => c.Type == roleClaimType).Select(c => c.Value).ToList();
            Assert.Contains("Master", roles);
            Assert.Contains("Administrator", roles);
        }

        [Fact]
        public void CreateJWT_ShouldUseExpiresInMinutes_WhenConfigured()
        {
            var config = BuildConfig(
                new()
                {
                    ["JWT:Key"] = "super-secret-test-key-with-enough-length-1234567890",
                    ["JWT:ExpiresInMinutes"] = "30",
                }
            );
            var service = new JwtService(config);
            var before = DateTime.UtcNow;

            var result = service.CreateJWT(NewUser());

            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(result.Token);
            Assert.InRange(jwt.ValidTo, before.AddMinutes(29), before.AddMinutes(31));
            Assert.Equal(jwt.ValidTo, result.ExpiresAtUtc, TimeSpan.FromSeconds(1));
        }

        [Fact]
        public void CreateJWT_ShouldUseExpiresInDays_WhenMinutesNotConfigured()
        {
            var config = BuildConfig(
                new()
                {
                    ["JWT:Key"] = "super-secret-test-key-with-enough-length-1234567890",
                    ["JWT:ExpiresInDays"] = "2",
                }
            );
            var service = new JwtService(config);
            var before = DateTime.UtcNow;

            var result = service.CreateJWT(NewUser());

            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(result.Token);
            Assert.InRange(jwt.ValidTo, before.AddDays(2).AddMinutes(-1), before.AddDays(2).AddMinutes(1));
        }

        [Fact]
        public void CreateJWT_ShouldFallBackToSixtyMinutes_WhenNoExpirationConfigured()
        {
            var config = BuildConfig(
                new() { ["JWT:Key"] = "super-secret-test-key-with-enough-length-1234567890" }
            );
            var service = new JwtService(config);
            var before = DateTime.UtcNow;

            var result = service.CreateJWT(NewUser());

            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(result.Token);
            Assert.InRange(jwt.ValidTo, before.AddMinutes(59), before.AddMinutes(61));
        }

        [Fact]
        public void CreateJWT_ShouldFallBackToSixtyMinutes_WhenExpirationSettingsAreNotParseable()
        {
            var config = BuildConfig(
                new()
                {
                    ["JWT:Key"] = "super-secret-test-key-with-enough-length-1234567890",
                    ["JWT:ExpiresInMinutes"] = "not-a-number",
                    ["JWT:ExpiresInDays"] = "also-not-a-number",
                }
            );
            var service = new JwtService(config);
            var before = DateTime.UtcNow;

            var result = service.CreateJWT(NewUser());

            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(result.Token);
            Assert.InRange(jwt.ValidTo, before.AddMinutes(59), before.AddMinutes(61));
        }
    }
}
