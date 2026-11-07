# Project architecture decisions

- Keep downloaded DTR PDFs in jsPDF and browser-print DTRs in their print-only React view; both use the company branding with a built-in logo fallback, so each export path remains usable independently.
- Load the optional custom company logo asynchronously before saving a jsPDF DTR, because jsPDF needs embedded image data rather than an inaccessible remote image URL.
- Keep tabular reports and bulk payslips in react-pdf; this preserves automatic report pagination and the six-slip printable sheet layout.
- Keep the period-specific payroll summary in jsPDF with a repeated Reports-style company header and asynchronous custom-logo embedding; this preserves its signature table while matching company branding.- Route every data-form save/delete through `src/lib/formNotifications.ts` (one sonner toast that goes from processing to success or error, updated in place by toast id); buttons keep their normal look and block repeat clicks instead of showing spinners, so feedback stays the same everywhere.
