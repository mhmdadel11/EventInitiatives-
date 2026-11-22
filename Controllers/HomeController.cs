using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EventInitiatives.Mvc.Controllers;

[Authorize]
public class HomeController : Controller
{
    public IActionResult Index() => View();

    [AllowAnonymous]
    public IActionResult Error() => Content("حدث خطأ غير متوقع.");
}
