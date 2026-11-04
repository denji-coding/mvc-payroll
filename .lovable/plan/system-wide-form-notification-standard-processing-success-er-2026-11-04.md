# System-Wide Form Notification Standard (Processing → Success/Error Pop-ups)

## Goal

Every data form in the system shows one persistent pop-up notification (sonner) that transitions through the save, instead of inline button spinners:

1. On submit: a pop-up with a loading animation: **"Saving..."**
2. It stays visible while the data is being processed/saved.
3. On success it changes in place to: **"[Entity] created successfully"** / **"[Entity] updated successfully"** / **"[Entity] deleted successfully"** (keep the current per-entity texts).
4. On failure it changes in place to: **"Failed to save [Entity]. Please try again."** with the specific error message shown as the notification description.
5. Auto-dismiss: success ~4s, error ~5s. The Processing state shows for at least ~600ms so it doesn't flash.
6. Submit buttons keep their normal appearance — no spinner and no "Saving..." text swap — and duplicate clicks while processing are ignored.

Scope: **data forms only** (create/edit/update/delete across all modules). Login, first-time setup, and change-password screens keep their current behavior. The employee avatar upload keeps its existing upload indicator (a previous explicit request).

## Implementation

### 1. Shared notification helper — `src/lib/formNotifications.ts` (new)

- `notifyProcessing(message = "Saving...")` → persistent `toast.loading` (no auto-dismiss), returns the toast id.
- `notifySuccess(id, message)` → replaces the toast with `toast.success`, auto-dismiss.
- `notifyError(id, entityLabel, error?)` → replaces the toast with `toast.error("Failed to save " + entityLabel + ". Please try again.")`, the actual error message as description, auto-dismiss.
- Internal minimum display time (~600ms) before the transition fires.
- Exported map of entity labels (e.g. "Employee", "Position", "Branch") so texts stay consistent.

### 2. Wire it into every mutation hook

Each `useCreate*`, `useUpdate*`, `useDelete*` mutation starts the Processing toast on `onMutate` and transitions it in `onSuccess` / `onError`. Applies to:

- `usePositions`, `useBranches`, `useLeaveTypes`, `useHolidays`, `useEmployees`, `useEmployeeSalaryAdjustments`, `useEmployeeSchedule`, `useAnnouncements`, `useBenefitRates`, `useAttendance`, `useSettings`, `usePermissions`, `useCompanyInfo`, `useSalaryComponents`, `useUserRoles`
- `usePayroll` (run/approve periods already show success toasts — add the Processing state, keep existing success texts)
- `useLeaves` (submit/cancel/update requests). Leave the approval flow's existing locked modal processing indicator untouched.

Where a delete currently has no success toast, add "deleted successfully".

### 3. Remove inline spinners from submit buttons, guard duplicates

Buttons keep their normal look during processing; a submitting ref ignores re-clicks.

- `EmployeeForm.tsx` — remove spinner/"Saving..." swap on the save button; toast flow via helper (keeps the single-toast government-ID validation errors).
- `Profile.tsx` — profile save + password change buttons.
- `Settings.tsx` — company info save (replace the local "Saving..." state with the toast flow).
- `Employees.tsx` — delete-permanently button (spinner out, guard + toast flow).
- `Payroll.tsx` — Run / Process period and bulk-payslip buttons: remove inline "Processing..." spinner text, guard with `isPending` checks, notifications via helper. (Period status changes already have their own success texts — kept.)
- `Reports.tsx` — generate-report buttons: Processing toast ("Generating report...") replacing the inline spinner.

### 4. Verification

- Typecheck + build.
- Playwright on the live preview: create → edit → delete a Position and confirm the single pop-up transitions Processing → Success/Error and auto-dismisses; check the save button shows no spinner and double-clicks don't duplicate records.
- Spot-check Employee form save and Payroll run/process buttons.
