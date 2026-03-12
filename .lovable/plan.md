

## Plan: Fix Late Minutes Calculation (Grace Period Deduction)

**Problem:** When calculating late minutes, the code checks if the employee exceeded the grace period correctly, but then calculates the late minutes from the scheduled start time instead of from the end of the grace period.

Example with schedule 9:00 AM, grace period 5 min, clock-in at 9:08 AM:
- Current logic: `lateMinutes = 548 - 540 = 8` (wrong)
- Correct logic: `lateMinutes = 548 - 540 - 5 = 3` (only minutes beyond grace)

**Fix in `supabase/functions/rfid-attendance/index.ts`:**

Three locations need the same fix — subtract `grace_period_minutes` from the late calculation:

1. **Line 265** (morning_in, no existing record):
   `lateMinutes = currentMinutes - scheduledMorningMinutes - settings.grace_period_minutes`

2. **Line 240** (afternoon_in, no existing record — afternoon-only half-day):
   `lateMinutes = currentMinutes - scheduledAfternoonMinutes - settings.grace_period_minutes`

3. **Line 303** (afternoon_in, existing record — 3rd punch):
   `afternoonLateMinutes = currentMinutes - scheduledAfternoonMinutes - settings.grace_period_minutes`

No other files need changes.

