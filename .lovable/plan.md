# My Leaves — Mobile Card Layout

Replace the table on the My Leaves page with a stacked card list when the screen is mobile (<1024px, the project's existing breakpoint). Desktop keeps the current table unchanged.

## Card layout (matches the reference image)

Each leave request becomes one bordered card, split into two areas:

- Left: leave type in large bold text, pay status ("With Pay" / "Without Pay") underneath, then a calendar icon with the date range ("Aug 17, 2026 – Aug 19, 2026") and a clock icon with the day count ("3 days").
- Right: status badge (HR Approved / Pending / Rejected / Cancelled) on top, and below it an outlined "HR Comment" button plus a solid green "View PDF" button. Button color follows the status (green for approved, red outline for rejected).
- HR Comment button only appears when a comment exists; View PDF only for HR-approved requests; pending requests show the existing Cancel action instead.
- Above the list, a small header line with a calendar icon: "N leave requests found".
- Empty state: "No leave requests found".

## Technical notes

- Use the existing `useIsMobile` hook in `src/pages/Leaves.tsx` to switch between the `DataTable` and the new card list.
- Cards render from the same `filteredLeaves` data and reuse the existing handlers: `setHrComment`, `openLetter`, and `cancelLeave` — no data-fetching or business logic changes.
- Keep the month filter and search behavior; on mobile the search input stays above the card list.
- Styling uses existing semantic tokens (primary green, destructive red) — no hardcoded colors.
