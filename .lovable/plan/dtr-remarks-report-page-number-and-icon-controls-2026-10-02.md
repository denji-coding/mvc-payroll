# DTR remarks, report page number, and icon controls

## Changes
1. Leave the Remarks cell blank for absent days and non-duty weekends in the DTR screen table and both printed/downloaded DTRs. Keep the day/date rows, weekend shading, absence totals, and other remarks (such as late, half-day, and leave) unchanged.
2. Center “Page 1 of 1” (and other page counts) in the footer of every generated Reports PDF. Keep the existing Prepared By information and generated date placement.
3. Audit icon-only buttons across the system and give each a meaningful action name on hover, including controls that currently have no title. Preserve existing visible button labels and avoid duplicate tooltip text on already-labeled controls; ensure icon-only actions also have accessible names.
4. Replace the Leave Credits active/inactive eye imagery with an action-appropriate deactivate/activate icon pair, keeping the existing toggle behavior and status labels.

## Technical approach and verification
- Update the three DTR render paths: screen table, browser-print view, and downloaded PDF generator. Do not change attendance or payroll calculations.
- Use the shared Reports PDF document for footer alignment. For icon-only controls, use the existing tooltip pattern or concise native titles where appropriate, and inspect shared controls plus page-specific actions.
- Check representative DTR dates (absent, weekend, leave, late), a generated report with page count, Leave Credits toggling, and icon hover labels in desktop and mobile layouts where applicable.