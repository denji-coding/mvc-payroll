# Project architecture decisions

- Keep downloaded DTR PDFs in jsPDF and browser-print DTRs in their print-only React view; both use the company branding with a built-in logo fallback, so each export path remains usable independently.
- Load the optional custom company logo asynchronously before saving a jsPDF DTR, because jsPDF needs embedded image data rather than an inaccessible remote image URL.
- Keep tabular reports and bulk payslips in react-pdf; this preserves automatic report pagination and the six-slip printable sheet layout.