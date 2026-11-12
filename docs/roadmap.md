# Build roadmap

## Milestone 0: Document the scope

**Current work:** capture the agreed workflow, separate confirmed decisions from proposals, and identify the evidence needed for a build.

Deliverables: README, [requirements](requirements.md), [decision log](decisions.md), and this roadmap. These are planning documents, not a working installation.

## Milestone 1: Prove the template and account setup

This is the first implementation milestone. Use synthetic claim data and two Google accounts representing different finance ICs.

Progress on 12 November 2026: source template inspected, original field ranges and row counts documented, and a blank full voucher exported and visually checked as one A4 page. User confirmed printed submission via PDF, Group = Congregation, and exactly one input row per claim by adding/deleting input rows. See [template findings](voucher-template.md). Filling/resizing a disposable copy, conversion testing, and second-account setup are still outstanding.

### Official template check

- Obtain the blank original and identify the header cells, claim-entry range, formulas, signatures, and print area.
- Confirm the required finance submission format.
- Fill one synthetic claimant and receipt, deleting surplus unused input rows while preserving the official labels, styling, total, and signature areas.
- Compare the generated/exported result visually with the official original.
- Implement the confirmed dynamic-row rule: exactly one input row per included claim; add rows before the total when needed. Keep receipt identities stable, preserve helper lists and validation, and update footer/formula/print boundaries.
- Verify that only the chosen payment voucher range is exported. A generic export of this workbook produced three Letter-size pages and split the full voucher's totals/signature area; explicitly scoped A4 export produced one intact full-voucher page.
- Test 1, 2, 7, 8, 30, and 31 claims plus a larger multi-page voucher. Check exact row counts, all claim values, totals, footer positions, helper-list preservation, and readable PDF pagination. Test long names, payment details, and descriptions while retaining the official labels and signature lines.

### Independent installation check

- Copy the prepared submission form under the second IC's account.
- Test the receipt-upload question and identify the owner and destination of the uploaded file.
- Connect the new response destination and install the processing trigger under that IC.
- Confirm an actual browser-submitted test response reaches only that event's resources.
- Confirm the second event continues to function without the first IC granting access to live records.
- If form copying cannot reliably initialise uploads, document and validate the short manual step.

Do not treat a programmatically submitted FormResponse as proof of trigger behaviour: Google documents that script/API submissions do not trigger the usual form-submit automation.

**Exit evidence:** one correctly rendered claim example, a recorded second-account test, and a precise onboarding sequence including unavoidable user actions.

## Milestone 2: Complete one event's claim processing

Build configuration, registers, claimant lookup, global-within-event numbering, receipt routing, weekly document creation, and claim-row insertion.

Acceptance scenarios:

| Scenario | Required result |
| --- | --- |
| First claim from a new person | Person folder, receipts folder, and weekly document created; header and first row filled. |
| Same person and week | Existing resources reused; one new claim row inserted before the total, with formula and footer updated. |
| Same person and a new week | New weekly document; existing person and receipts folders reused. |
| Different people submit together | Distinct receipt numbers; no duplicate folders or weekly documents. |
| Same submission processed again | Same assigned number; no duplicate rows or files. |
| Failure after a number/file/row is created | Recovery resumes with saved IDs and number; completed actions are not repeated. |
| Different event | Separate data and sequence; event code distinguishes the receipt reference. |
| Week boundary and late purchase | Routing follows the explicitly chosen rule and timezone. |
| Only one claim | Exactly one input row; unused input rows removed; total, signature areas, and helper values preserved. |
| More claims than the template's initial rows | Add input rows to the same weekly voucher, preserving every receipt and updating totals, validation, footer positions, and print range. |
| Long voucher spans physical pages | Every claim is legible and printed once; totals/signature area remains usable. Starting row count does not force a separate voucher. |

**Exit evidence:** successful real Forms-to-Drive-to-Sheets tests with synthetic data, including recovery and concurrent submissions.

## Milestone 3: Package guided setup

- Provide event inputs in the Setup Workbook.
- Create/configure the event folder, template copy, registers, response destination, form, and triggers.
- Save resource IDs, settings, and software/template versions for that installation.
- Make repeated or interrupted setup reuse its resources.
- Display a setup summary and a test-submission check.
- Provide an on-demand voucher PDF action with explicit sheet/range/paper settings and a saved submission revision.
- Document ownership, authorisation, recovery, and handover.

**Exit evidence:** a second person can install and submit a working test claim using only the guide and setup interface, without editing source code or file IDs.

## Milestone 4: Publish the handbook and pilot

Write claimant instructions, the finance IC operating guide, troubleshooting, and release notes. Publish the approved documentation to GitHub Pages. Keep live records and personal information out of the site and repository.

Run one pilot event and resolve operational issues before wider rollout. Track upgrades explicitly so an existing event does not silently change its template or behaviour mid-process.

## Deferred work

Receipt OCR, automatic payment, income collection, cross-event accounting integration, and richer approval dashboards are separate future decisions.

References: [Google trigger restrictions](https://developers.google.com/apps-script/guides/triggers/installable), [GitHub Pages setup and visibility](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).
