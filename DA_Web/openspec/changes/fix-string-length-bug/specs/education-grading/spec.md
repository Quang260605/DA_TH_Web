## MODIFIED Requirements

### Requirement: Lesson Drawing Submission with Image Storage
The system SHALL allow users to submit completed lessons with Base64-encoded drawing images and store them without truncation or data loss.

#### Scenario: User submits large drawing image
- **WHEN** user submits a lesson with a Base64-encoded drawing (8-15KB)
- **THEN** the system accepts the submission and persists the full image to the database without truncation

#### Scenario: Image is retrievable after submission
- **WHEN** lesson submission is queried from the database
- **THEN** the stored image data is complete and matches the original submission

#### Scenario: System handles multiple submissions
- **WHEN** multiple users submit lessons with different image sizes (1KB to 15KB+)
- **THEN** all images are stored completely without truncation or size limits

