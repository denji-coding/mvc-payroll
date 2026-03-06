

## Plan: Export Data Dictionary & ERD as PDF

### Approach
Create a utility function `generateDataDictionaryPdf.ts` that uses the existing `jsPDF` + `jspdf-autotable` libraries to produce a downloadable PDF containing:

1. **Title page** with project name, generation date
2. **Data Dictionary** — one table per database table, listing column name, type, nullable, default, and description
3. **ERD section** — since Mermaid diagrams cannot be rendered natively into jsPDF, we will create a simplified text-based relationship diagram using autotable rows showing `Parent Table → Child Table (FK column)`

### Implementation

**New file: `src/lib/generateDataDictionaryPdf.ts`**
- Parse the schema from `src/integrations/supabase/types.ts` at build time is impractical; instead, hardcode the data dictionary content (all 22 tables with columns, types, constraints) directly in the generator, matching the previously provided data dictionary.
- For each table, render an `autoTable` with columns: Column, Type, Nullable, Default, Description.
- Add a "Relationships" section with a table showing all foreign key relationships.
- Export a `generateDataDictionaryPdf()` function that creates and downloads the PDF.

**Trigger**: Add a button on the existing UI (e.g., a utility page or accessible from Settings) or provide a standalone callable function. Since the user is viewing the ERD diagram currently, the simplest approach is to add a "Download PDF" button somewhere accessible — likely on the **Settings** page or as a developer/admin utility.

Given the user's request seems like a one-time export, I'll create the generator and wire a "Download Data Dictionary PDF" button into the **Settings** page under a new "Database Documentation" section.

### File Changes

| File | Change |
|------|--------|
| `src/lib/generateDataDictionaryPdf.ts` | **New** — PDF generator with all table schemas and relationships hardcoded |
| `src/pages/Settings.tsx` | Add "Export Data Dictionary PDF" button |

### Key Details
- All 22 tables documented with full column details
- Relationship table covers all FK references
- Single PDF download, ~10-15 pages
- Uses existing jsPDF + jspdf-autotable (no new dependencies)

