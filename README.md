# KY Speedy Claims

KY Speedy Claims helps an event's finance IC collect receipt submissions, organise them in Google Drive, and prepare each claimant's weekly claim document using the finance department's standard template.

**Status:** the user confirmed successful one-line and long voucher exports in a live Google Apps Script run on 12 November 2026. The voucher prototype is validated for those manual cases; see the linked validation record for build and evidence details. Form submission processing, guided event setup, second-account installation, and the documentation website are not implemented/verified yet.

## Intended experience

1. A finance IC copies the setup workbook, enters event settings, and authorises setup.
2. Setup prepares the event's folders, submission form, registers, template copy, and automatic processing.
3. A claimant submits claim details and a receipt through Google Forms.
4. Processing assigns a receipt number, files the receipt, and adds the claim to the correct person's weekly document.
5. The finance IC reviews claims and uses the central register to prepare consolidated expenditure information.

Each event operates independently under its finance IC's Google account. Receipt numbering is shared across all people within an event, starting at 1. Across events, the reference is the event code plus receipt number, for example `CAMP26-000001`. Event codes must be distinct wherever records will be combined.

## Project documentation

- [Requirements](docs/requirements.md): agreed behaviour and proposed details.
- [Decision log](docs/decisions.md): confirmed choices and unresolved questions.
- [Build roadmap](docs/roadmap.md): milestones and evidence needed before moving forward.
- [Voucher template findings](docs/voucher-template.md): verified fields, dynamic claim rows, and A4 PDF export requirements.
- [Prototype guide](docs/prototype.md): developer setup, synthetic voucher runs, test coverage, and remaining live checks.
- [Manual live test](docs/manual-test.md): one-file setup, existing-project updates, and Drive API v2/v3 compatibility.
- [Live validation record](docs/live-validation.md): confirmed short/long exports, tested build, evidence folder, and remaining scope.

## Current milestone

The official template has been supplied and inspected. Finance requires a printed payment voucher, so the submission output is a PDF prepared for printing. A blank full-page voucher has been verified as a single A4 PDF using an explicit sheet and print range.

Each weekly voucher must have exactly one input row per included claim. Delete unused input rows and add rows when needed, preserving the official headings, styling, totals, and signature sections. The original template's row counts are starting layouts, not claim limits.

The copy/fill/resize/export path has passed the user's short/long live tests. Next is claim intake: connect form submissions to the event register, receipt numbering/routing, and the appropriate person's weekly voucher. Form-upload ownership and independent second-account setup must also be proved before accepting the guided installer.

## Local development

Use Node.js 20 or later. No dependency installation is needed for the local checks:

```sh
npm run check
npm test
npm run bundle
```

`src/` is the Apps Script project. `test/` exercises the pure voucher planner, rendering adapter, PDF response handling, and copy/conversion runner using in-memory Google service substitutes. These tests do not establish native Google layout fidelity.

The bundle command prepares a single Code.gs, appsscript.json, and quick-start guide under local/live-test. The bundled manifest uses Drive API v2; the importer supports either v2 or v3. Updating GitHub does not replace code already pasted into a Google project.

Do not redesign the official output document. The input Google Form and internal registers are separate from that standardised document.

## Data and templates

This repository is for source code, documentation, approved blank templates, and synthetic examples. Real submissions, receipt images, payment details, credentials, and event records belong in the event's restricted Google Drive workspace.

A blank Excel template may be versioned here if permitted. A native Google Sheets master can remain in Drive, with its version and field mapping documented here. Never overwrite the official master during processing.

## Documentation website

GitHub Pages is planned as a handbook built from these docs. Publishing it is a later task; creating these files does not enable or publish a site.
