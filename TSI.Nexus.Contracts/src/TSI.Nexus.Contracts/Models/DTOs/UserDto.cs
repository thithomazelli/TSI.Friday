using System;

namespace TSI.Nexus.Contracts.Models.DTOs
{
    public class UserDto
    {
        public string Id { get; set; }

        public DateTime CreateDate { get; set; }

        public string CreateUserId { get; set; }

        public DateTime ModifyDate { get; set; }

        public string ModifyUserId { get; set; }

        public string UserName { get; set; }

        public string Email { get; set; }

        public bool EmailConfirmed { get; set; }

        public string FirstName { get; set; }

        public string LastName { get; set; }

        public string JWT { get; set; }

        public string Photo { get; set; }

        public string Role { get; set; }

        public string Theme { get; set; }

        public string Language { get; set; }
    }
}
