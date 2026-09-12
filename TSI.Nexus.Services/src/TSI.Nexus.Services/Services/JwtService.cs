using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Collections.Generic;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;

namespace TSI.Nexus.Services
{
    public class JwtService : IJwtService
    {
        private readonly IConfiguration _config;
        private readonly SymmetricSecurityKey _jwtKey;

        public JwtService(IConfiguration config)
        {
            _config = config;

            // jwtKey is used for both encripting and descripting the JWT token
            _jwtKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["JWT:Key"]));
        }

        /// <inheritdoc />
        public string CreateJWT(User user, IEnumerable<string>? roles = null)
        {
            var userClaims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id),
                new(ClaimTypes.Name, user.UserName),
                new(ClaimTypes.Email, user.Email),
                new(ClaimTypes.GivenName, user.FirstName),
                new(ClaimTypes.Surname, user.LastName)
            };

            // include roles as claims
            if (roles != null)
            {
                foreach (var role in roles)
                {
                    userClaims.Add(new Claim(ClaimTypes.Role, role));
                }
            }

            var credentials = new SigningCredentials(_jwtKey, SecurityAlgorithms.HmacSha256Signature);

            // Determine expiration: prefer minutes if configured, otherwise days, otherwise default60 minutes
            var now = DateTime.UtcNow;
            DateTime expires;
            var minutesSetting = _config["JWT:ExpiresInMinutes"];
            if (!string.IsNullOrEmpty(minutesSetting) && int.TryParse(minutesSetting, out var minutes))
            {
                expires = now.AddMinutes(minutes);
            }
            else
            {
                var daysSetting = _config["JWT:ExpiresInDays"];
                if (!string.IsNullOrEmpty(daysSetting) && int.TryParse(daysSetting, out var days))
                {
                    expires = now.AddDays(days);
                }
                else
                {
                    // fallback default
                    expires = now.AddMinutes(60);
                }
            }

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(userClaims),
                Expires = expires,
                SigningCredentials = credentials,
                Issuer = _config["JWT:Issuer"],
                Audience = _config["JWT:Audience"],
            };

            var tokenHandler = new JwtSecurityTokenHandler();
            var jwt = tokenHandler.CreateToken(tokenDescriptor);

            return tokenHandler.WriteToken(jwt);
        }
    }
}
