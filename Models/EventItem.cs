using System.ComponentModel.DataAnnotations;

namespace EventInitiatives.Mvc.Models;

public class EventItem
{
    [Key, MaxLength(64)]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [MaxLength(120)] public string Name { get; set; } = "";
    [MaxLength(80)] public string Type { get; set; } = "فعالية";
    [MaxLength(150)] public string Organizer { get; set; } = "";
    [MaxLength(10)] public string StartDate { get; set; } = DateTime.Today.ToString("yyyy-MM-dd");
    [MaxLength(10)] public string EndDate { get; set; } = DateTime.Today.ToString("yyyy-MM-dd");
    [MaxLength(10)] public string StartTime { get; set; } = "";
    [MaxLength(10)] public string EndTime { get; set; } = "";
    [MaxLength(200)] public string Location { get; set; } = "";
    [MaxLength(150)] public string Owner { get; set; } = "";
    [MaxLength(200)] public string Audience { get; set; } = "";
    [MaxLength(20)] public string Status { get; set; } = "pending";
    public bool IsScheduled { get; set; }
    public string Description { get; set; } = "";
    public string Notes { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<EventMedia> Media { get; set; } = new List<EventMedia>();
}

public class EventMedia
{
    public int Id { get; set; }
    [MaxLength(64)] public string EventId { get; set; } = "";
    public EventItem? Event { get; set; }
    [MaxLength(500)] public string FilePath { get; set; } = "";
    [MaxLength(255)] public string FileName { get; set; } = "";
    [MaxLength(120)] public string MimeType { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
