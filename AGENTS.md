# Project architecture decisions

- Keep downloaded DTR PDFs in jsPDF and browser-print DTRs in their print-only React view; both use the company branding with a built-in logo fallback, so each export path remains usable independently.
- Load the optional custom company logo asynchronously before saving a jsPDF DTR, because jsPDF needs embedded image data rather than an inaccessible remote image URL.
- Keep tabular reports and bulk payslips in react-pdf; this preserves automatic report pagination and the six-slip printable sheet layout.
- Keep the period-specific payroll summary in jsPDF with a repeated Reports-style company header and asynchronous custom-logo embedding; this preserves its signature table while matching company branding.- Route every data-form save/delete through `src/lib/formNotifications.ts` (one sonner toast that goes from processing to success or error, updated in place by toast id); buttons keep their normal look and block repeat clicks instead of showing spinners, so feedback stays the same everywhere.
- Mirror every database change into `supabase/schema/initial_schema.sql` in the same task, so a fresh install always matches the live database.
- Server functions that use privileged database access must verify the caller (terminal secret, signed-in admin via is_admin, service key, or private cron token); a bare "Bearer" prefix is never proof of identity.
- Terminal queries do not refetch on browser focus; background polling keeps records current without interrupting input.
- Attendance lookup distinguishes missing employees from non-active employees, retaining the active-only attendance restriction.
- Settings may reveal only the device-local terminal key, never retrieve the server secret.
- Early-out confirmation is read-only until confirmed, bound to the date, attendance record and Out action; re-run terminal validations on confirmation and sum session undertime in Philippine time to prevent stale punches and lost morning undertime.
- Keep certificate selection in a dedicated upload control and sort leave types locally in Leave Credits, so previews, submissions, and other leave selectors retain their behavior.
