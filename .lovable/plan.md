

# Plan: Enhance Password Reset Email

## Problem
The password reset email has several issues visible in the uploaded screenshot:
1. `=20` artifacts appear (quoted-printable encoding of trailing whitespace in template literals)
2. Company name shows "MVC Corporation" instead of "Migrants Venture Corporation"
3. Subject line includes "- MVC Corporation HR Portal" which should be removed
4. Email uses blue color scheme instead of the system's dark green palette
5. The "Login to Portal" button needs enhancement

## Changes

### File: `supabase/functions/forgot-password/index.ts`

**1. Fix `=20` artifacts**
Convert the HTML template from a multi-line template literal to an array of strings joined with `.join('')` (per project convention in memory).

**2. Update company name**
- "MVC Corporation" → "Migrants Venture Corporation" everywhere in the template
- "MVC Corporation HR Team" → "Migrants Venture Corporation HR Team"
- Footer copyright: "MVC Corporation" → "Migrants Venture Corporation"

**3. Update email subject (line 210)**
- From: `"Password Reset - MVC Corporation HR Portal"`
- To: `"Password Reset"`

**4. Update sender name (line 208)**
- From: `MVC Corporation <${gmailUser}>`
- To: `Migrants Venture Corporation <${gmailUser}>`

**5. Apply system color palette**
Replace blue (`#0066cc`) with the system's dark green primary color (`hsl(142, 64%, 24%)` ≈ `#165C26`):
- `.header` background: `#0066cc` → `#165C26`
- `.temp-password` color: `#0066cc` → `#165C26`
- `.button` background: `#0066cc` → `#165C26`

Keep the warning box amber as-is (it's appropriate for warnings).

**6. Enhance the login button**
- Larger padding, rounded corners, bold text
- Add hover-friendly styling and make it more prominent
- Change text from "Login to Portal" to "Login to Employee Portal"

