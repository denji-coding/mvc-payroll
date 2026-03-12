

## Plan: Fix Attendance Calculation, Notification Filtering, and Profile Layout

### 1. Fix Attendance & Payroll Half-Day Calculation

**Problem:** The current attendance terminal and payroll logic have issues with half-day detection. The terminal handles afternoon-only half-days but doesn't properly handle morning-only half-days (where an employee clocks morning_in/morning_out but never returns for afternoon). The payroll computation uses raw `hours_worked` from the attendance record without properly checking which sessions actually have data.

**Fix in `supabase/functions/rfid-attendance/index.ts`:**
- Add a new branch: if `existingRecord` has `morning_in` AND `morning_out` but NO `afternoon_in`, and the employee scans again, check the current time:
  - If current time is within afternoon session window → record as `afternoon_in` (existing behavior)
  - This already works via the `!existingRecord.afternoon_in` branch
- On afternoon_out (final scan): the half-day detection already checks `!morningIn && !morningOut`. Add check for morning-only: if `!afternoonIn` shouldn't happen since we're in the afternoon_out branch, but ensure the `isHalfDay` flag also checks if only morning was recorded
- The key fix: when computing `hours_worked` on afternoon_out, ensure morning-only scenario is impossible at that point (it already is since afternoon_out requires afternoon_in). The real issue is that `hours_worked` is only set on the final punch. For morning-only records that never get an afternoon punch, `hours_worked` stays NULL

**Fix in `supabase/functions/compute-payroll/index.ts`:**
- Instead of relying solely on `a.hours_worked`, compute hours from the actual session timestamps:
  - If `morning_in` AND `morning_out` exist: calculate morning hours = min(morning_out - morning_in, scheduled morning duration)
  - If `afternoon_in` AND `afternoon_out` exist: calculate afternoon hours = min(afternoon_out - afternoon_in, scheduled afternoon duration)
  - Sum the session hours (only sessions with both in/out)
  - If only one session has complete data → half day (hours = that session's hours only)
  - If `hours_worked` is NULL (employee never completed afternoon), still calculate from available morning session data
- This makes payroll independent of whether the terminal stored `hours_worked` correctly

### 2. Fix Notification Filtering by Portal Mode

**Problem:** When HR admin switches to employee portal view, they still see HR notifications (leave requests, etc.) instead of employee-specific notifications.

**Fix in `src/hooks/useNotifications.ts`:**
- Accept an additional parameter: `effectiveRole` from `useViewMode`
- Filter notifications based on role:
  - HR role types: `leave_request`, `leave_approved`, `leave_rejected` (from HR perspective)
  - Employee role types: `attendance`, `payroll_ready`, `leave_approved`, `leave_rejected`, `announcement`
- Apply `.in('type', allowedTypes)` filter to the query

**Fix in `src/components/layout/AppHeader.tsx`:**
- Import `useViewMode` and pass `effectiveRole` to `useNotifications`

### 3. Fix Profile Page Layout

**Problem:** The profile page uses `max-w-2xl` which constrains it to ~672px, leaving empty space on larger screens.

**Fix in `src/pages/Profile.tsx`:**
- Change `max-w-2xl` to `max-w-4xl` to better utilize available space
- Use a two-column grid layout on large screens: profile info card on one side, password change on the other

### Technical Details

**Payroll session-based calculation (compute-payroll):**
```text
For each attendance record:
  morningHours = 0, afternoonHours = 0
  if (morning_in && morning_out):
    morningHours = min(morning_out - morning_in, scheduledMorningHours)
  if (afternoon_in && afternoon_out):
    afternoonHours = min(afternoon_out - afternoon_in, scheduledAfternoonHours)
  totalHours = morningHours + afternoonHours
  (replaces using a.hours_worked)
```

**Notification type mapping:**
```text
HR admin view:    ['leave_request']
Employee view:    ['attendance', 'payroll_ready', 'leave_approved', 'leave_rejected', 'announcement']
```

**Files to modify:**
- `supabase/functions/compute-payroll/index.ts` — session-based hours calculation
- `supabase/functions/rfid-attendance/index.ts` — ensure morning-only records properly set hours_worked
- `src/hooks/useNotifications.ts` — add role-based filtering
- `src/components/layout/AppHeader.tsx` — pass effectiveRole to notifications hook
- `src/pages/Profile.tsx` — responsive layout fix

