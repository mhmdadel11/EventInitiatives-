using EventInitiatives.Mvc.Data;
using EventInitiatives.Mvc.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using EventInitiatives.Mvc.Services;

namespace EventInitiatives.Mvc.Controllers;

[ApiController]
[Authorize]
[Route("api/events")]
public class EventsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly SupabaseStorage _storage;

    public EventsController(ApplicationDbContext db, SupabaseStorage storage)
    {
        _db = db;
        _storage = storage;
    }

    public sealed class EventDto
    {
        public string? Id { get; set; }
        public string? Name { get; set; }
        public string? Type { get; set; }
        public string? Organizer { get; set; }
        public string? StartDate { get; set; }
        public string? EndDate { get; set; }
        public string? StartTime { get; set; }
        public string? EndTime { get; set; }
        public string? Location { get; set; }
        public string? Owner { get; set; }
        public string? Audience { get; set; }
        public string? Status { get; set; }
        public bool IsScheduled { get; set; }
        public string? Description { get; set; }
        public string? Notes { get; set; }
        public List<string>? ImagesDataUrls { get; set; }
    }

    private static object ToDto(EventItem e) => new
    {
        id = e.Id,
        name = e.Name,
        type = e.Type,
        organizer = e.Organizer,
        startDate = e.StartDate,
        endDate = e.EndDate,
        startTime = e.StartTime,
        endTime = e.EndTime,
        location = e.Location,
        owner = e.Owner,
        audience = e.Audience,
        status = e.Status,
        isScheduled = e.IsScheduled,
        description = e.Description,
        notes = e.Notes,
        imagesDataUrls = e.Media.OrderBy(m => m.CreatedAt).Select(m => m.FilePath).ToList(),
        imageDataUrl = e.Media.OrderBy(m => m.CreatedAt).Select(m => m.FilePath).FirstOrDefault(),
        createdAtUtc = e.CreatedAt,
        updatedAtUtc = e.UpdatedAt
    };

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var events = await _db.Events.Include(x => x.Media)
            .OrderBy(x => x.StartDate).ThenBy(x => x.CreatedAt).ToListAsync();
        return Ok(events.Select(ToDto));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] EventDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "اسم المنشور مطلوب." });

        var item = Map(dto, new EventItem
        {
            Id = string.IsNullOrWhiteSpace(dto.Id) ? Guid.NewGuid().ToString() : dto.Id.Trim()
        });
        item.CreatedAt = DateTime.UtcNow;
        item.UpdatedAt = DateTime.UtcNow;
        AddMedia(item, dto.ImagesDataUrls);
        _db.Events.Add(item);
        await _db.SaveChangesAsync();
        return Ok(ToDto(item));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] EventDto dto)
    {
        var item = await _db.Events.Include(x => x.Media).FirstOrDefaultAsync(x => x.Id == id);
        if (item is null) return NotFound(new { message = "المنشور غير موجود." });
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "اسم المنشور مطلوب." });

        Map(dto, item);
        item.UpdatedAt = DateTime.UtcNow;

        var incoming = (dto.ImagesDataUrls ?? new List<string>())
            .Where(IsSafeLocalUploadUrl).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var removed = item.Media.Where(m => !incoming.Contains(m.FilePath)).ToList();
        foreach (var media in removed)
        {
            await DeleteUploadedFileAsync(media.FilePath);
            _db.EventMedia.Remove(media);
        }

        var existing = item.Media.Select(m => m.FilePath).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var path in incoming.Where(path => !existing.Contains(path)))
            item.Media.Add(CreateMedia(path));

        await _db.SaveChangesAsync();
        return Ok(ToDto(item));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var item = await _db.Events.Include(x => x.Media).FirstOrDefaultAsync(x => x.Id == id);
        if (item is null) return NotFound();
        foreach (var media in item.Media) await DeleteUploadedFileAsync(media.FilePath);
        _db.Events.Remove(item);
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    private static EventItem Map(EventDto dto, EventItem item)
    {
        item.Name = dto.Name?.Trim() ?? "";
        item.Type = dto.Type ?? "فعالية";
        item.Organizer = dto.Organizer ?? "";
        item.StartDate = dto.StartDate ?? DateTime.Today.ToString("yyyy-MM-dd");
        item.EndDate = dto.EndDate ?? item.StartDate;
        item.StartTime = dto.StartTime ?? "";
        item.EndTime = dto.EndTime ?? "";
        item.Location = dto.Location ?? "";
        item.Owner = dto.Owner ?? "";
        item.Audience = dto.Audience ?? "";
        item.Status = dto.Status is "done" or "notdone" ? dto.Status : "pending";
        item.IsScheduled = dto.IsScheduled;
        item.Description = dto.Description ?? "";
        item.Notes = dto.Notes ?? "";
        return item;
    }

    private static void AddMedia(EventItem item, List<string>? paths)
    {
        foreach (var path in (paths ?? new()).Where(IsSafeLocalUploadUrl).Distinct(StringComparer.OrdinalIgnoreCase))
            item.Media.Add(CreateMedia(path));
    }

    private static EventMedia CreateMedia(string path) => new()
    {
        FilePath = path,
        FileName = Path.GetFileName(path),
        MimeType = Path.GetExtension(path).ToLowerInvariant()
    };

    private static bool IsSafeLocalUploadUrl(string path) =>
        !string.IsNullOrWhiteSpace(path) &&
        path.StartsWith("/api/media/file/", StringComparison.OrdinalIgnoreCase) &&
        !path.Contains("..", StringComparison.Ordinal);

    private async Task DeleteUploadedFileAsync(string path)
    {
        if (!IsSafeLocalUploadUrl(path)) return;
        var objectPath = path["/api/media/file/".Length..];
        await _storage.DeleteAsync(objectPath);
    }
}
