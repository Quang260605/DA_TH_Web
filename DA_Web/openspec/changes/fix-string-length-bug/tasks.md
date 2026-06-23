## 1. Model Changes

- [ ] 1.1 Remove `[StringLength(255)]` attribute from `TienTrinhNguoiDung.AnhVeNguoiDungUrl` field
- [ ] 1.2 Verify model file compiles without errors
- [ ] 1.3 Confirm EF Core recognizes the change (no explicit `[Column]` attribute needed)

## 2. Database Migration

- [ ] 2.1 Run `dotnet ef migrations add RemoveStringLengthFromAnhVeNguoiDungUrl`
- [ ] 2.2 Review generated migration file for correctness (should alter AnhVeNguoiDungUrl column)
- [ ] 2.3 Run `dotnet ef database update` to apply migration
- [ ] 2.4 Verify database schema change using SQL Server Management Studio or query

## 3. Manual Testing

- [ ] 3.1 Start the application with `dotnet run`
- [ ] 3.2 Create a test Base64 image (8-15KB) representing a drawing
- [ ] 3.3 Submit a lesson with the large Base64 image via `POST /api/lesson/submit`
- [ ] 3.4 Verify submission returns 200 OK (no DbUpdateException)
- [ ] 3.5 Query the database to confirm image data is stored completely (not truncated)
- [ ] 3.6 Retrieve lesson via GET endpoint and verify image is intact

## 4. Code Review

- [ ] 4.1 Review model changes for any other StringLength constraints that might need attention
- [ ] 4.2 Check if LessonController needs any validation (e.g., max image size)
- [ ] 4.3 Verify no other fields in TienTrinhNguoiDung have similar truncation issues

## 5. Documentation & Cleanup

- [ ] 5.1 Add comment in model explaining why StringLength is removed and NVARCHAR(MAX) is used
- [ ] 5.2 Update any related documentation (if exists) about lesson submission limits
- [ ] 5.3 Ensure project builds cleanly (`dotnet build`)

## 6. Verification

- [ ] 6.1 Run existing tests (if any) to ensure no regressions
- [ ] 6.2 Test multiple lesson submissions in sequence to ensure consistency
- [ ] 6.3 Confirm no database warnings or errors in logs during testing
