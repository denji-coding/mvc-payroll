# Mobile Card Layouts for My Attendance & My Payslips

Add stacked card lists for mobile (<1024px, the project's existing breakpoint) on the My Attendance and My Payslips pages. Desktop keeps the current tables unchanged. No data, query, or business-logic changes.

## My Payslips — mobile card (matches image 1)

Replaces the payroll history table on mobile. One card per payroll record:

- Left: month/year block ("APR / 2026") in a light green tile.
- Right: period range title ("Apr 1 – Apr 30, 2026"), then a row with a calendar icon + "Pay Date" and the date on the right, then a row with a check icon + "Status" and the status badge on the right.
- Bottom: two full-width buttons — outlined "View Payslip" (eye icon) and solid green "Download PDF" (download icon). Download stays disabled/"Pending" when the period is not approved or paid.
- "Manual" badge still shown next to the period when applicable.
- Empty state: "No payslips found for {year}".

## My Attendance — mobile card (matches image 2)

Replaces the attendance records table on mobile. One card per day record:

- Header row: date tile on the left ("AUG / 08 / SAT") tinted by status (green present, amber late, red absent), and the status badge on the right.
- Body: two columns split by a divider — AM (in/out) and PM (in/out). Each time shows the time above and a small "IN" (green) / "OUT" (red) label. Missing punches show "-".
- If there is no attendance record content (absent), show a centered calendar icon with "No attendance record" instead of the AM/PM grid.
- Footer rows: clock icon + "Total Hours" with the value ("8h 01m", derived from the existing hours_worked value), and a check icon + "Status" with the status text colored to match.
- Above the list: a small header line with a calendar icon "N records found".
- Empty state: "No attendance records found".

## Technical notes

- Use the existing `useIsMobile` hook (1024px) in both pages to switch between `DataTable` and the card list, same pattern already used on the My Leaves page.
- New presentational components: `src/components/payslips/MobilePayslipList.tsx` and `src/components/attendance/MobileAttendanceList.tsx`. They receive the already-fetched records plus the existing handlers (`setViewRecord`, `handleDownloadPayslip`; status badge/half-day helpers for attendance) as props.
- Keep the year selector (payslips) and month selector (attendance) visible on mobile above the card list.
- Total Hours formatting reuses the existing `hours_worked` field, rendered as "Xh YYm"; no recomputation of attendance logic.
- Styling uses existing semantic tokens (primary green, success, warning, destructive) — no hardcoded colors.
