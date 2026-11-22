using EventInitiatives.Mvc.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EventInitiatives.Mvc.Controllers;

[ApiController]
[Authorize]
[Route("api/media")]
public class MediaController : ControllerBase
{
    private readonly SupabaseStorage _storage;
    public MediaController(SupabaseStorage storage) => _storage = storage;

    [HttpPost("upload")]
    [RequestSizeLimit(60 * 1024 * 1024)]
    public async Task<IActionResult> Upload(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest(new { message = "لم يتم اختيار ملف." });
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var images = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
        var videos = new[] { ".mp4", ".webm", ".mov", ".m4v" };
        var image = images.Contains(ext); var video = videos.Contains(ext);
        if (!image && !video) return BadRequest(new { message = "نوع الملف غير مسموح." });
        if (file.Length > (video ? 50L : 20L) * 1024 * 1024) return BadRequest(new { message = "حجم الملف أكبر من الحد المسموح." });
        var now = DateTime.UtcNow; var objectPath = $"{now:yyyy}/{now:MM}/{Guid.NewGuid():N}{ext}";
        await using var stream = file.OpenReadStream();
        await _storage.UploadAsync(objectPath, stream, file.ContentType ?? "application/octet-stream", ct);
        return Ok(new { url = "/api/media/file/" + objectPath });
    }

    [HttpGet("file/{year}/{month}/{fileName}")]
    public async Task<IActionResult> GetFile(string year, string month, string fileName, CancellationToken ct)
    {
        if (!int.TryParse(year, out var y) || y < 2000 || y > 2100 || !int.TryParse(month, out var m) || m < 1 || m > 12 || fileName != Path.GetFileName(fileName)) return NotFound();
        try { var result = await _storage.DownloadAsync($"{y:0000}/{m:00}/{fileName}", ct); return File(result.Stream, result.ContentType ?? "application/octet-stream", enableRangeProcessing: true); }
        catch (FileNotFoundException) { return NotFound(); }
    }
}
