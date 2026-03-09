

## Plan: Add Medical Certificates Tab in Settings

### Overview
Add a new "Medical Certificates" tab in the Settings page (HR-only) that lists all leave requests with uploaded medical certificates, showing employee info, leave details, and a preview/download link.

### Changes

1. **`src/pages/Settings.tsx`**
   - Add a new `TabsTrigger` for "Medical Certs" (HR-only, after "Permissions")
   - Add corresponding `TabsContent` rendering a new `MedicalCertificatesTab` component
   - Create `MedicalCertificatesTab` function component within the file that:
     - Fetches `leave_requests` joined with `employees` where `medical_certificate_url IS NOT NULL`
     - Displays a DataTable with columns: Employee Name, Leave Type, Date Range, Status, View action
     - "View" button opens a Dialog showing the medical certificate image via signed URL (reusing the same `createSignedUrl` pattern from LeaveApprovals)
     - Uses the `FileText` icon (already imported) in the card header

### Technical Notes
- No database changes needed -- existing RLS on `leave_requests` already grants HR admin full access
- Signed URLs from the `medical-certificates` storage bucket with 5-minute expiry
- Follows existing Settings tab pattern for consistency

