

## Fix: Vercel 404 on `/attendance-terminal` Route

### Root Cause
This is a **client-side routing issue**. Your app is a Single Page Application (SPA) using React Router. When you navigate directly to `/attendance-terminal` (or refresh the page), Vercel's server looks for an actual file at that path — there isn't one, so it returns 404. The app only works when navigated from the root `/` because React Router handles it client-side.

### Fix
Create a `vercel.json` file at the project root that tells Vercel to rewrite all routes to `index.html`, letting React Router handle them:

**Create `vercel.json`:**
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

That's it — one file, one rule. After redeploying, all routes (including `/attendance-terminal`) will load correctly.

### Why This Happens
- **SPAs** have one HTML file (`index.html`) and use JavaScript to render different "pages"
- **Static hosting** (Vercel, Netlify, etc.) serves files by path — `/attendance-terminal` maps to no file
- The rewrite rule tells the server: "for any path, serve `index.html` and let the JS router decide what to show"

### Warning Signs for the Future
- Any SPA deployed to static hosting needs this configuration
- If you add new routes later, they'll work automatically with this rewrite rule
- Netlify uses `_redirects` file instead; each host has its own syntax

