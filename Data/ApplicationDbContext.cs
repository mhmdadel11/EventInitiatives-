using EventInitiatives.Mvc.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace EventInitiatives.Mvc.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }
    public DbSet<EventItem> Events => Set<EventItem>();
    public DbSet<EventMedia> EventMedia => Set<EventMedia>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<EventItem>()
            .HasMany(x => x.Media)
            .WithOne(x => x.Event)
            .HasForeignKey(x => x.EventId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Entity<EventItem>().HasIndex(x => x.StartDate);
        builder.Entity<EventMedia>().HasIndex(x => x.EventId);
    }
}
