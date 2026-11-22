using EventInitiatives.Mvc.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace EventInitiatives.Mvc.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly UserManager<ApplicationUser> _userManager;

    public AuthController(SignInManager<ApplicationUser> signInManager, UserManager<ApplicationUser> userManager)
    {
        _signInManager = signInManager;
        _userManager = userManager;
    }

    public record LoginRequest(string Email, string Password);

    [HttpPost("login"), AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var email = request.Email.Trim();
        var result = await _signInManager.PasswordSignInAsync(email, request.Password, true, false);
        if (!result.Succeeded)
            return Unauthorized(new { message = "البريد الإلكتروني أو كلمة المرور غير صحيحة." });

        var user = await _userManager.FindByEmailAsync(email);
        return Ok(new { user = new { email = user?.Email } });
    }

    [HttpGet("me"), Authorize]
    public IActionResult Me() => Ok(new { user = new { email = User.Identity?.Name } });

    [HttpPost("logout"), Authorize]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return Ok(new { success = true });
    }
}
