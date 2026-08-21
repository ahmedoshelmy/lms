# Session syllabus — data model

Replaces the earlier `course-sessions.schema.sql`, which was written as T-SQL before
the backend was available. The backend is **PostgreSQL + EF Core 10, code-first**, so
the schema is defined by an entity and a fluent configuration, and the DDL is produced
by a migration rather than written by hand.

Conventions below follow `lms-backend/AGENTS.md`: file-scoped namespaces, `required` on
non-nullable reference properties, `UseIdentityAlwaysColumn()` on keys, manual DTO
mapping, and the repository → service → thin-controller layering.

---

## 1. Where it attaches

On `CourseLevel`, not `Session`.

The syllabus is a property of the course level: "Python level 1, session 6 is about for
loops" holds every time any group runs that level. A `Session` row is one *instance* of
that — a particular group, on a particular Tuesday, with a particular instructor.
Attaching the syllabus to the instance would duplicate it per group and let two groups
disagree about what session 6 is.

## 2. How a scheduled session finds its syllabus

No foreign key. `Session` already carries `SessionNumber`, and its `GroupCourse` carries
`CourseLevelId`:

```
CourseLevelSession.CourseLevelId == session.GroupCourse.CourseLevelId
CourseLevelSession.SessionNumber == session.SessionNumber
```

A stored pointer would be worse: sessions get regenerated, cancelled and shifted, and the
FK would rot on every reschedule.

> **Use `Session.SessionNumber`, not `GroupCourse.CurrentSessionNumber`.**
> `CurrentSessionNumber` is the group's overall progress pointer, so it is identical on
> every session of a group course. Joining on it would return the same syllabus row for a
> whole term of that group's sessions. `ScheduleSessionDto` exposes both, which makes the
> mistake easy to make — it was made once already in the frontend badge.

Standalone trial and makeup sessions have `GroupCourseId == null` and therefore no
syllabus. That is correct: they are not part of a curriculum.

---

## 3. Entity

`src/LMS.Core/Entities/CourseLevelSession.cs`

```csharp
namespace LMS.Core.Entities;

public class CourseLevelSession
{
    public int Id { get; set; }
    public int CourseLevelId { get; set; }

    /// <summary>Position in the curriculum. Matches Session.SessionNumber.</summary>
    public int SessionNumber { get; set; }

    public required string Title { get; set; }

    /// <summary>Concepts taught, stored as a Postgres text[].</summary>
    public List<string> KeyConcepts { get; set; } = [];

    /// <summary>In-class activities, stored as a Postgres text[].</summary>
    public List<string> Activities { get; set; } = [];

    /// <summary>The take-home task set at the end of the session.</summary>
    public string? Task { get; set; }

    public string? SteamTopic { get; set; }
    public List<string> SteamVideoUrls { get; set; } = [];
    public string? KahootUrl { get; set; }

    /// <summary>Link to the instructor's slides or PDF.</summary>
    public string? MaterialUrl { get; set; }

    /// <summary>Plain-language summary written for parents.</summary>
    public string? ParentSummary { get; set; }

    /// <summary>One follow-up suggestion for parents to try at home.</summary>
    public string? ParentHomeActivity { get; set; }

    /// <summary>Parent-facing fields are hidden until this is set.</summary>
    public bool IsPublished { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public CourseLevel? CourseLevel { get; set; }
}
```

Add the inverse on `CourseLevel`:

```csharp
public ICollection<CourseLevelSession> Sessions { get; set; } = new List<CourseLevelSession>();
```

**Why `List<string>` and not JSON:** Npgsql maps `List<string>` to a native `text[]`
column with no serialisation layer, and it stays queryable. These three lists are short,
display-only, and always read whole — a child table would add three joins to every read
and buy nothing. Promote `KeyConcepts` to its own table only if you later need to search
across concepts.

---

## 4. DbContext configuration

`src/LMS.Infrastructure/Data/LmsDbContext.cs` — DbSet alongside the others:

```csharp
public DbSet<CourseLevelSession> CourseLevelSessions => Set<CourseLevelSession>();
```

and in `OnModelCreating`, following the existing block style:

```csharp
// CourseLevelSession Configuration
modelBuilder.Entity<CourseLevelSession>(entity =>
{
    entity.HasKey(e => e.Id);
    entity.Property(e => e.Id).UseIdentityAlwaysColumn();
    entity.Property(e => e.Title).IsRequired().HasMaxLength(200);
    entity.Property(e => e.Task).HasMaxLength(1000);
    entity.Property(e => e.SteamTopic).HasMaxLength(200);
    entity.Property(e => e.KahootUrl).HasMaxLength(500);
    entity.Property(e => e.MaterialUrl).HasMaxLength(500);
    entity.Property(e => e.ParentHomeActivity).HasMaxLength(1000);

    // One row per session per level. This is what makes re-importing the seed
    // safe: without it a second run duplicates every syllabus.
    entity.HasIndex(e => new { e.CourseLevelId, e.SessionNumber }).IsUnique();

    entity.HasOne(e => e.CourseLevel)
        .WithMany(c => c.Sessions)
        .HasForeignKey(e => e.CourseLevelId)
        .OnDelete(DeleteBehavior.Cascade);
});
```

`Cascade` here, unlike the `Restrict` used on `CourseLevel → GroupCourse`: a syllabus row
has no meaning without its level, and deleting it destroys no historical record. A
`GroupCourse` does, which is why that one is restricted.

Then:

```bash
dotnet ef migrations add AddCourseLevelSessions -p src/LMS.Infrastructure -s src/LMS.Api
dotnet ef database update -p src/LMS.Infrastructure -s src/LMS.Api
```

---

## 5. Importing the seed

`docs/course-sessions.seed.json` — 17 levels, 186 sessions. Every level has
`courseLevelId: null`, because those ids live in the database. Resolve on
`topicName` + `level`:

```sql
SELECT t."Name" AS topic, cl."Level", cl."Id"
FROM   "CourseLevels" cl
JOIN   "Topics" t ON t."Id" = cl."TopicId"
ORDER  BY t."Name", cl."Level";
```

Two mismatches to expect, both from the Drive folder names:

- AI is foldered `Level One` / `Level two`; the seed normalises these to 1 and 2.
- Where a level is duplicated, the seed uses the `new` folder, per instruction.

Make the import idempotent by matching on `(CourseLevelId, SessionNumber)` and updating
rather than inserting, so re-running after copy edits does not duplicate.

The seed also carries `sessionCount` per level, taken from the material. Worth comparing
against `CourseLevels.SessionCount` before importing — where they disagree, the database
is likely stale.

---

## 6. Remaining layers

Following the existing pattern, a complete feature needs:

| Layer | File |
|---|---|
| Repository interface | `LMS.Core/Interfaces/ICourseLevelSessionRepository.cs` |
| Repository | `LMS.Infrastructure/Repositories/CourseLevelSessionRepository.cs` |
| Service interface | `LMS.Application/Interfaces/ICourseLevelSessionService.cs` |
| Service | `LMS.Application/Services/CourseLevelSessionService.cs` |
| DTOs | `LMS.Core/DTOs/CourseLevels/CourseLevelSessionDto.cs`, `UpdateCourseLevelSessionDto.cs` |
| Controller | extend `CourseLevelsController` rather than adding a new one |
| DI | register the repository in `LMS.Infrastructure/DependencyInjection.cs` |

Suggested endpoints:

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/course-levels/{id}/sessions` | Admin, Instructor | Full syllabus for a level |
| PUT | `/api/course-levels/{id}/sessions/{number}` | Admin | Edit one session |
| GET | `/api/schedule/sessions/{id}/syllabus` | Any | Syllabus for a scheduled session, resolved through its GroupCourse |

The third endpoint is what the schedule and session-detail screens call. It must return
only published parent fields to a Student caller, and everything to staff — otherwise
half-written summaries leak the moment the feature ships.
