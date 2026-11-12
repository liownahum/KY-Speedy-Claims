# Voucher prototype

## Scope and status

The first implementation creates a separate native Google Sheets working copy of the official full payment voucher, fills synthetic claimant data, resizes to exactly one row per claim, calculates the total, and requests a PDF export of the resulting voucher range. The XLSX master is imported to a new file; a native Sheets master is copied. Neither path edits the source.

This is a developer-run prototype, not the final setup experience for finance ICs. It does not create a Google Form, install submission triggers, allocate receipt numbers, manage weekly document identities, approve claims, or send payments/emails. Sample receipt numbers are deliberately nonconsecutive to verify they survive resizing.

Local automated checks pass using Google service substitutes. The user's latest Google run created a one-claim PDF with total 12.50; visual review found a duplicated header and clipped voucher title. The next correction disables frozen-header repetition and ensures adequate title-row height. Corrected PDF layout, larger vouchers, conversion fidelity, and second-account installation still need verification. Every prototype result has `needsPrintReview: true`.

## Files

| File | Purpose |
| --- | --- |
| src/VoucherCore.js | Input validation, integer-cent totals, row/print planning, literal-text handling, synthetic data |
| src/Voucher.gs | Template checks, row resizing, formatting, helper-list preservation, PDF response checks |
| src/Prototype.gs | Manual synthetic run; creates a separate copy and saves a PDF |
| src/appsscript.json | V8 runtime, Advanced Drive v2 service, and Google access scopes; existing v3 configurations also work |

The full-page layout is the only supported base in this prototype. Template checks reject a changed layout, occupied inputs, filled signatures, missing congregation options, and attempts to render into the source file itself.

## Developer setup in Google

1. Create a standalone project at [Google Apps Script](https://script.google.com/).
2. Add the source from VoucherCore.js, Voucher.gs, and Prototype.gs as script files. The local CommonJS export guard in VoucherCore.js is inactive in Apps Script.
3. Enable manifest visibility in Project Settings and use src/appsscript.json as the project's manifest. Confirm Drive API is enabled under Services with identifier Drive. The supplied manifest uses v2 to match the reported dropdown; the code also supports an existing v3 configuration. A standard Cloud project may also require enabling Drive API in its Cloud console.
4. In Project Settings, configure the script properties below as needed. Leaving them unset uses the supplied template and creates a new prototype output folder.
5. Run `runVoucherPrototype` and complete Google's authorisation flow under the intended developer/IC account. The function creates sample files only. Google access is not configured by merging this repository.
6. Open the workbook and PDF links in the execution log, complete the visual checks below, and record the result.

An optional clasp configuration example is included for developers who already use Google's clasp CLI. Copy .clasp.json.example to .clasp.json and supply your project ID; the actual local configuration and authentication files are ignored by Git. No particular clasp version or CLI installation is required for the editor-based workflow.

For one-file setup, run `npm run bundle` to generate Code.gs, appsscript.json, and START-HERE.md under local/live-test (ignored by Git). Supply a destination with `npm run bundle -- /path/to/output`. The bundle combines the exact current source files and validates the combined script before writing it. See the [manual test guide](manual-test.md), including how to update an already-created Google project.

### Drive API compatibility

The initial live run reported only v2 in the service dropdown and failed at `Drive.Files.create`. That was a version mismatch: v3 exposes create, while v2 exposes insert and uses different title/parent metadata. The importer now detects the installed method before creating an output folder, uses v2 insert with `convert: true` when appropriate, and retains support for v3 create. It does not retry an upload failure through another version, which could duplicate files. Native Sheets sources continue to use DriveApp.makeCopy without requiring the Advanced Drive importer.

Keep v2 if that is what the project offers; replacing the pasted Code.gs is sufficient for an existing v2 project. A missing/incompatible service fails with a setup message before output resources are created. The corrected import still needs a successful native Google run.

### Script properties

| Property | Default | Meaning |
| --- | --- | --- |
| PROTOTYPE_TEMPLATE_ID | User-supplied Drive template ID | XLSX or native Sheets source; must match the inspected full-voucher layout |
| PROTOTYPE_CLAIM_COUNT | 1 | Synthetic run size, 1-200; this is a prototype runner guard, not a production claim limit |
| PROTOTYPE_OUTPUT_FOLDER_ID | Unset | Existing destination folder, or create a uniquely named prototype folder |

The synthetic name is `SAMPLE - DO NOT SUBMIT`, the payment field is `SAMPLE ONLY - NOT PAYABLE`, and the fixture date is 12 November 2026. This fixed test date does not decide the production voucher-date policy. Runs use unique names and do not overwrite earlier files. Incomplete copies are retained and their link logged for inspection. No automatic cleanup deletes files.

The manifest requests Drive access to read the specified master and create files, Sheets access to fill the working copy, and external-request access to export PDF. It requests no email or payment integration. Using these scopes still requires Google's authorisation; local tests use synthetic substitutes and no Google credentials.

## Row and formatting behaviour

- Preserve congregation options in a hidden helper tab before deleting whole worksheet rows. Remove imported dropdown rules from the source row-style snapshot and original input cells before resizing. After copying styles, clear any surviving rules in the final input range, bind strict congregation validation to the preserved helper, and flush before writing claim values.
- Retain a clean input-row style before resizing, then apply it to all final input rows.
- Delete surplus input rows or insert extra rows before the total. Rebuild the total range, retaining the official positive-total/blank behaviour.
- Keep receipt numbers from the supplied data; never derive them from the new row position.
- In the working copy only, merge C:F within each existing visible Description column so text can wrap across its intended width. Merge the blank name/payment input spans for the same reason. Headings, visible column divisions, and source master remain unchanged.
- Apply conservative row heights without truncating strings. Oversized text that cannot fit the prototype's row-height bound is rejected for review rather than silently clipped.
- Keep approval and verification input areas blank. Prototype execution is not an approval.
- Ensure the two title areas have enough height for the imported font. The source's single-row PAYMENT VOUCHER title uses a 24-point font in a 12.75-point row, which can clip after conversion/export.
- Clear frozen rows in the working copy and disable frozen-row repetition in the PDF request. The initial combination of ten frozen header rows and a bounded PDF range is the likely source of the duplicated header seen in the one-claim PDF. Request A4 portrait with fit-to-width, excluding other tabs and column-X helpers. Repeated headings for continuation pages are intentionally disabled pending a separately verified pagination design; page breaks and totals/signature placement still need native review.

Each render starts from a fresh copy. Updating an already-rendered weekly document and recovering an interrupted live submission are future processor work. Re-running the synthetic prototype creates a new sample, not an in-place update.

## Local verification

Run `npm run check` and `npm test` with Node.js 20+. No npm dependencies are required. CI runs these commands on pushes and pull requests.

Automated coverage includes 1, 2, 7, 8, 30, 31, and 75 claims; exact claim counts; footer movement; stable receipt IDs; cent totals; preserved congregation helpers; valid dates; literal formula-looking input; invalid/occupied templates; v2/v3 copy/conversion branches; setup checks before resource creation; no cross-version retry after an upload error; unchanged source identity; and refusal to save HTTP failures or non-PDF responses as vouchers.

The in-memory adapter models row shifts across all columns, so tests exercise deletion of the original helper-list location as well as preservation of its separate copy. It is not a full implementation of Sheets formatting or formula recalculation. PDF response tests use synthetic bytes and do not create a rendered document.

The next user-run live test reached rendering but rejected G11 under an old data-validation rule. The original renderer installed its replacement dropdown after writing claims. The fix installs it before writing, with explicit clearing around row/style operations. The test adapter now enforces strict dropdowns: the previous renderer reproduces the G11 rejection after row deletion, while the corrected renderer passes and still rejects unknown congregations. Native PDF layout remains unverified pending rerun.

## Required native run matrix

Run fresh samples with 1, 2, 7, 8, 30, 31, and 75 claims. For each run, verify:

1. Source template unchanged; work created in a different file.
2. Exactly N claim rows, with all receipt numbers and values retained.
3. Total matches the synthetic integer-cent total; last claim is included.
4. Congregation dropdown remains usable after both deletion and insertion.
5. Name, payment placeholder, description, and decimal amounts are legible without clipping.
6. Total, Prepared by, Payment approved by, and Verified by appear below the final claim row.
7. PDF includes only the payment voucher on A4 pages, at readable size, with no truncated claims or helper cells.
8. The first page has exactly one header, and both title lines are fully visible. For longer vouchers, inspect continuation-page context and totals/signature placement. Repeated frozen headings are disabled; continuation-page headings need a separately verified design before production acceptance.

After the basic matrix, test long names/descriptions and repeat under another IC account. Store test evidence privately in Drive or a local ignored directory; do not commit live financial records.

References: [Google PDF generation sample](https://developers.google.com/apps-script/samples/automations/generate-pdfs), [Advanced Drive service](https://developers.google.com/apps-script/advanced/drive), [Drive conversion/import](https://developers.google.com/workspace/drive/api/guides/manage-uploads#import_to_google_docs_types).
