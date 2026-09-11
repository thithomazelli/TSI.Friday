using System.Collections.Generic;
using TSI.Nexus.Contracts.Models;

namespace TSI.Nexus.Contracts.Interfaces
{
    /// <summary>
    /// 
    /// </summary>
    public interface IJwtService
    {
        /// <summary>
        /// Create a JWT for the provided user. Optionally receive roles to include on the token.
        /// </summary>
        /// <param name="user"></param>
        /// <param name="roles"></param>
        /// <returns></returns>
        string CreateJWT(User user, IEnumerable<string>? roles = null);
    }
}
