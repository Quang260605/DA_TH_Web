## Context

The `TienTrinhNguoiDung` model (User Lesson Progress) has an `AnhVeNguoiDungUrl` field configured with `[StringLength(255)]`, limiting its length to 255 characters. However, the `LessonController` attempts to save Base64-encoded images (8-15KB) into this field. Entity Framework Core throws a `DbUpdateException` during database insert, preventing lesson submissions from being saved.

This is a straightforward data model fix—removing the artificial constraint and ensuring the database column can store the intended data size.

## Goals / Non-Goals

**Goals:**
- Allow full Base64-encoded images (8-15KB+) to be stored without truncation
- Ensure lesson submission feature works end-to-end without database errors
- Prevent future developers from re-adding the StringLength constraint

**Non-Goals:**
- Optimize image storage (e.g., compress, use blob storage) - out of scope
- Change the Base64 format or introduce a new image persistence layer
- Affect other image fields in the system
- Add new features or image processing capabilities

## Decisions

**Decision: Remove `[StringLength(255)]` attribute**
- **Why**: The constraint is artificial and conflicts with the actual data being saved. Removing it allows Entity Framework Core to auto-map to `NVARCHAR(MAX)` on SQL Server, which accommodates any reasonable image size.
- **Alternatives considered:**
  - Increase StringLength to 16000 (max for SQL Server VARCHAR) - Still a hard limit; future-proofing requires `NVARCHAR(MAX)`
  - Store images as BLOB/binary - Out of scope; would require API changes. Base64 is acceptable for development

**Decision: Use EF Core auto-mapping to NVARCHAR(MAX)**
- **Why**: Entity Framework Core's default behavior for unrestricted strings is SQL Server's `NVARCHAR(MAX)`, which supports up to 2GB of data. No explicit configuration needed.
- **Alternatives considered:**
  - Add `[Column(TypeName = "NVARCHAR(MAX)")]` explicitly - Unnecessary; EF Core does this automatically
  - Use `.HasColumnType()` in OnModelCreating - Same result; keeping the model simple is preferred

**Decision: Single EF Core migration**
- **Why**: A single migration cleanly documents the schema change and can be replayed on production. Rollback is simple (revert migration).
- **Alternatives considered:**
  - Multiple small migrations - Unnecessary complexity for a single-column change
  - No migration (just change attribute) - Risk of schema/model mismatch

## Risks / Trade-offs

**Risk: Database schema change on production**
- **Mitigation**: Migration is backward-compatible (expanding VARCHAR to NVARCHAR(MAX) is safe). No data loss occurs since the column is new (no existing data). Test on staging environment first.

**Risk: Large image uploads could impact database performance**
- **Mitigation**: This is a theoretical risk at current scale. If proven to be an issue, implement image compression or external storage (CDN) separately. This fix doesn't preclude that future optimization.

**Risk: String length validation should occur at the application layer, not the database**
- **Mitigation**: If image size limits are desired, implement explicit validation in the controller (e.g., max 15KB). The database should trust that validation.

## Migration Plan

1. **Create EF Core migration**: `dotnet ef migrations add RemoveStringLengthFromAnhVeNguoiDungUrl`
   - Migration will alter the `AnhVeNguoiDungUrl` column from `VARCHAR(255)` to `NVARCHAR(MAX)`
   
2. **Apply migration**: `dotnet ef database update`

3. **Test**: Submit a lesson with a large drawing (10KB+ Base64) and verify:
   - No database error
   - Image is retrieved correctly from database
   - API returns 200 OK

4. **Rollback strategy** (if needed): `dotnet ef database update <previous-migration>`
   - Reverses to previous schema state

## Open Questions

- Should image size be validated at the controller layer (e.g., max 15KB)? Currently no explicit limit other than database column size.
- Should a separate task be created for adding unit tests for lesson submission with large images?
