## Why

The `AnhVeNguoiDungUrl` field in the lesson submission flow is configured with `[StringLength(255)]`, but the application attempts to save Base64-encoded images (typically 8-15KB). This causes **DbUpdateException** when users submit lessons with large drawings, preventing the submission from being saved to the database and crashing the feature.

## What Changes

- Remove `[StringLength(255)]` attribute from `TienTrinhNguoiDung.AnhVeNguoiDungUrl` to allow unrestricted string length
- Verify Entity Framework Core automatically maps the field to `NVARCHAR(MAX)` for SQL Server
- Create a migration to update the database schema
- Test lesson submission with large Base64 images to confirm data persists

## Capabilities

### New Capabilities
<!-- None - this is purely a bug fix to existing capability -->

### Modified Capabilities
- `education-grading`: Fix data truncation in lesson submission. The system SHALL store full Base64-encoded drawing images without truncation or data loss.

## Impact

**Affected Files:**
- `Models/GiaoDucModule/TienTrinhNguoiDung.cs` - Remove StringLength attribute
- `Controllers/LessonController.cs` - Submission code that saves images

**Affected Endpoints:**
- `POST /api/lesson/submit` - Lesson submission with drawing

**Database:**
- Migration needed to change `AnhVeNguoiDungUrl` column from `VARCHAR(255)` to `NVARCHAR(MAX)`
- No data migration needed (no existing data in this field)

**User Impact:**
- Users can now successfully submit lessons with drawings without database errors
- Fixes critical bug that prevents lesson feature from working
