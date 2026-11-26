# PDF layout updates

- [x] Align printed and downloaded DTR headers with the Reports header.
- [x] Move report titles and generation timestamps; remove the company/system footer label.
- [x] Add the company logo to each bulk payslip without changing the six-per-page layout.
- [x] Inspect generated PDF pages and logos.

# DTR remarks and icon hover labels

- [x] Leave absent and rest-day remarks blank in the DTR table, print view, and PDF.
- [x] Center the report footer page count.
- [x] Label icon-only actions on hover and replace the Leave Credits visibility icons with activation controls.

# Payroll records modal

- [x] Remove the Payroll Records tab; the periods table eye icon now opens payroll records in a modal.

# Report and DTR refinements

- [x] Replace government EE/ER columns with payroll deduction columns and rename payroll Days.
- [x] Remove the DTR absent summary and equalize Remarks column width.
- [x] Match the downloaded payroll summary header to Reports.
- [x] Rename the employee payslips download title and verify sample PDF layouts; authenticated page verification unavailable because no requesting-user session could be minted.
- [x] Fix first-time admin setup on a fresh system

# Attendance terminal corrections

- [x] Preserve terminal input when returning from another browser tab.
- [x] Correct EMP-666075 lookup feedback without changing its employment status.
- [x] Allow revealing the terminal key saved on this device in Settings.
- [x] Verify terminal behavior and employee lookup.

# Early-out confirmation

- [x] Add read-only confirmation before early Morning Out and Afternoon Out; preserve all validations.
- [x] Confirm saves Out and undertime; Cancel saves nothing; verified both sessions through manual and RFID input with temporary records removed.

# Leave upload and ordering

- [x] Replace only the certificate upload control with image-only drag-and-drop selection; retain previews.
- [x] Display newly created leave types first in Leave Credits without changing creation or deduction processes.
- [x] Verify image selection through the browse control, image-only rules, and authenticated Leave Credits ordering against creation dates; previews remain unchanged.
