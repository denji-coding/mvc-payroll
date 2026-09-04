# Fix white screen in Chrome (older browser support)

## What is happening

The app bundles the PDF preview library (`pdfjs-dist` v6) and its setup code at the **top level** of two components (`LeaveApprovalLetterDialog`, `PdfReportPreviewDialog`). Because these are imported directly by pages, that code lands in the main JavaScript bundle that loads on every page — including the login page.

`pdfjs-dist` v6 is written with very recent JavaScript syntax. On an older or non-updated Chrome, the browser cannot even parse that bundle, so nothing renders at all — a blank white screen. The build currently has no browser target set and no fallback bundle, so nothing catches this.

## The fix

1. **Isolate the PDF code**
   Load `pdfjs-dist` on demand (dynamic import inside the preview components, worker set at that moment) instead of at module load. A browser that cannot handle the PDF viewer then only fails the PDF preview — the rest of the system still loads and works.

2. **Build for older browsers**
   Set an explicit older build target in `vite.config.ts` and add a legacy build (`@vitejs/plugin-legacy` with core-js polyfills) so outdated Chrome/Edge/Safari receive a compatible bundle plus the modern one. Add a matching `browserslist` entry in `package.json`.

3. **Never show a blank screen again**
   Add a top-level error boundary around the app that renders a readable "Something went wrong / Reload" panel instead of a white page, and keep the existing `Promise.withResolvers` / `Promise.try` polyfills in `src/main.tsx` (extend with the polyfills the legacy plugin does not cover).

4. **Graceful PDF fallback**
   If the PDF viewer cannot start on a given browser, the preview dialog shows a message with "Download PDF" / "Open in new tab" buttons rather than an endless loading state.

## Technical notes

- Files touched: `vite.config.ts`, `package.json` (add `@vitejs/plugin-legacy`, `browserslist`), `src/main.tsx`, `src/App.tsx` (error boundary), new `src/components/ErrorBoundary.tsx`, `src/components/reports/PdfReportPreviewDialog.tsx`, `src/components/leaves/LeaveApprovalLetterDialog.tsx`.
- No changes to business logic, leave deductions, payroll, or database.
- Verification: production build, then load the built app and confirm the login page renders and the report/leave-letter previews still work.
