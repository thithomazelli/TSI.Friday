using System;

namespace TSI.Nexus.Contracts.Models
{
    /// <summary>
    /// A freshly minted JWT together with its expiration, so callers that need to schedule a
    /// renewal or set a cookie's lifetime don't have to re-decode the token to find out when it
    /// expires.
    /// </summary>
    public record JwtToken(string Token, DateTime ExpiresAtUtc);
}
