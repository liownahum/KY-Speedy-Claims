# Voucher prototype

## Scope and status

The first implementation creates a separate native Google Sheets working copy of the official full payment voucher, fills synthetic claimant data, resizes to exactly one row per claim, calculates the total, and requests a PDF export of the resulting voucher range. The XLSX master is imported to a new file; a native Sheets master is copied. Neither path edits the source.

This is a developer-run prototype, not the final setup experience for finance ICs. It does not create a Google Form, install submission triggers, allocate receipt numbers, manage weekly document identities, approve claims, or send payments/emails. Sample receipt numbers are deliberately nonconsecutive to verify they survive resizing.

Local automated checks pass using Google service substitutes. Live Drive conversion, native Sheets calculations, field wrapping, PDF pagination, and second-account installation have not yet been verified. Every prototype result has `needsPrintReview: true`.

## Files

| File | Purpose |
| --- | --- |
| src/VoucherCore.js | Input validation, integer-cent totals, row/print planning, literal-text handling, synthetic data |
| src/Voucher.gs | Template checks, row resizing, formatting, helper-list preservation, PDF response checks |
| src/Prototype.gs | Manual synthetic run; creates a separate copy and saves a PDF |
| src/appsscript.json | V8 runtime, Advanced Drive v3 service, and Google access scopes |

The full-page layout is the only supported base in this prototype. Template checks reject a changed layout, occupied inputs, filled signatures, missing congregation options, and attempts to render into the source file itself.

## Developer setup in Google

1. Create a standalone project at [Google Apps Script](https://script.google.com/).
2. Add the source from VoucherCore.js, Voucher.gs, and Prototype.gs as script files. The local CommonJS export guard in VoucherCore.js is inactive in Apps Script.
3. Enable manifest visibility in Project Settings and use src/appsscript.json as the project's manifest. Confirm Advanced Drive API v3 is enabled under Services. A standard Cloud project may also require enabling Drive API in its Cloud console.
4. In Project Settings, configure the script properties below as needed. Leaving them unset uses the supplied template and creates a new prototype output folder.
5. Run `runVoucherPrototype` and complete Google's authorisation flow under the intended developer/IC account. The function creates sample files only. Google access is not configured by merging this repository.
6. Open the workbook and PDF links in the execution log, complete the visual checks below, and record the result.

An optional clasp configuration example is included for developers who already use Google's clasp CLI. Copy .clasp.json.example to .clasp.json and supply your project ID; the actual local configuration and authentication files are ignored by Git. No particular clasp version or CLI installation is required for the editor-based workflow.

### Script properties

| Property | Default | Meaning |
| --- | --- | --- |
| PROTOTYPE_TEMPLATE_ID | User-supplied Drive template ID | XLSX or native Sheets source; must match the inspected full-voucher layout |
| PROTOTYPE_CLAIM_COUNT | 1 | Synthetic run size, 1-200; this is a prototype runner guard, not a production claim limit |
| PROTOTYPE_OUTPUT_FOLDER_ID | Unset | Existing destination folder, or create a uniquely named prototype folder |

The synthetic name is `SAMPLE - DO NOT SUBMIT`, the payment field is `SAMPLE ONLY - NOT PAYABLE`, and the fixture date is 12 November 2026. This fixed test date does not decide the production voucher-date policy. Runs use unique names and do not overwrite earlier files. Incomplete copies are retained and their link logged for inspection. No automatic cleanup deletes files.

The manifest requests Drive access to read the specified master and create files, Sheets access to fill the working copy, and external-request access to export PDF. It requests no email or payment integration. Using these scopes still requires Google's authorisation; local tests use synthetic substitutes and no Google credentials.

## Row and formatting behaviour

- Preserve congregation options in a hidden helper tab before deleting whole worksheet rows. Reapply validation to the final input range.
- Retain a clean input-row style before resizing, then apply it to all final input rows.
- Delete surplus input rows or insert extra rows before the total. Rebuild the total range, retaining the official positive-total/blank behaviour.
- Keep receipt numbers from the supplied data; never derive them from the new row position.
- In the working copy only, merge C:F within each existing visible Description column so text can wrap across its intended width. Merge the blank name/payment input spans for the same reason. Headings, visible column divisions, and source master remain unchanged.
- Apply conservative row heights without truncating strings. Oversized text that cannot fit the prototype's row-height bound is rejected for review rather than silently clipped.
- Keep approval and verification input areas blank. Prototype execution is not an approval.
- Freeze the first ten rows to repeat the voucher heading/table header in the PDF; request A4 portrait with fit-to-width, excluding other tabs and column-X helpers. Actual page breaks, repeated-heading behaviour, and keeping totals/signatures together need native visual verification.

Each render starts from a fresh copy. Updating an already-rendered weekly document and recovering an interrupted live submission are future processor work. Re-running the synthetic prototype creates a new sample, not an in-place update.

## Local verification

Run `npm run check` and `npm test` with Node.js 20+. No npm dependencies are required. CI runs these commands on pushes and pull requests.

Automated coverage includes 1, 2, 7, 8, 30, 31, and 75 claims; exact claim counts; footer movement; stable receipt IDs; cent totals; preserved congregation helpers; valid dates; literal formula-looking input; invalid/occupied templates; copy/conversion branches; unchanged source identity; and refusal to save HTTP failures or non-PDF responses as vouchers.

The in-memory adapter models row shifts across all columns, so tests exercise deletion of the original helper-list location as well as preservation of its separate copy. It is not a full implementation of Sheets formatting or formula recalculation. PDF response tests use synthetic bytes and do not create a rendered document.

## Required native run matrix

Run fresh samples with 1, 2, 7, 8, 30, 31, and 75 claims. For each run, verify:

1. Source template unchanged; work created in a different file.
2. Exactly N claim rows, with all receipt numbers and values retained.
3. Total matches the synthetic integer-cent total; last claim is included.
4. Congregation dropdown remains usable after both deletion and insertion.
5. Name, payment placeholder, description, and decimal amounts are legible without clipping.
6. Total, Prepared by, Payment approved by, and Verified by appear below the final claim row.
7. PDF includes only the payment voucher on A4 pages, at readable size, with no truncated claims or helper cells.
8. Long vouchers have usable repeated headings and a usable totals/signature block. Record any awkward page break before accepting the exporter for live claims.

After the basic matrix, test long names/descriptions and repeat under another IC account. Store test evidence privately in Drive or a local ignored directory; do not commit live financial records.

References: [Google PDF generation sample](https://developers.google.com/apps-script/samples/automations/generate-pdfs), [Advanced Drive service](https://developers.google.com/apps-script/advanced/drive), [Drive conversion/import](https://developers.google.com/workspace/drive/api/guides/manage-uploads#import_to_google_docs_types).
