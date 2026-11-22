using EventInitiatives.Mvc.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace EventInitiatives.Mvc.Controllers;

// بديل إداري لإنشاء حسابات الموظفين التي كانت تُنشأ من لوحة Supabase Authentication.
[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin/users")]
public class UserAdminController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    public UserAdminController(UserManager<ApplicationUser> userManager) => _userManager = userManager;

    public record CreateUserRequest(string Email, string Password);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request)
    {
        var email = request.Email.Trim();
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "البريد الإلكتروني وكلمة المرور مطلوبان." });

        var user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true };
        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
            return BadRequest(new { message = string.Join(" | ", result.Errors.Select(x => x.Description)) });

        await _userManager.AddToRoleAsync(user, "Employee");
        return Ok(new { email = user.Email, message = "تم إنشاء حساب الموظف." });
    }
}
