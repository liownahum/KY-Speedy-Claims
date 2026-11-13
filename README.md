# KY Speedy Claims

KY Speedy Claims helps an event's finance IC collect receipt submissions, organise them in Google Drive, and prepare each claimant's weekly claim document using the finance department's standard template.

**Status:** on 13 November 2026, browser-assisted native testing verified single-account setup, actual form-trigger processing, numbered receipt routing, weekly workbook reuse, PDF snapshots, existing-folder relocation, and recovery from a controlled render failure. A separate copied Setup Workbook also passed preparation, activation, a browser submission, status, empty retry, and PDF export through its Sheets menu. Earlier short/long voucher exports and basic multi-person submissions were user-reported. Multi-person batch export, wider recovery/access checks, concurrency, independent second-account installation, and the documentation website remain further work. See the [validation record](docs/live-validation.md) for tested builds and exact scope.

## Intended experience

A [guided Setup Workbook preview](docs/setup-workbook.md) now implements this setup/menu interface. Its copied-workbook workflow passed native testing under one account; an independent finance IC's installation remains to be tested. A maintainer installs its bound script once in a blank template; finance ICs then use their own copies. Follow the [User Guide](docs/UserGuide.md) for the workbook workflow, or the [standalone test guide](docs/form-pipeline-test.md) for an existing script-based installation.

The new **KY Categories** tab accepts each event's category names and letters. Prepare uses this list for required Expense category and Receipt type dropdowns and retains their values with each claim. This extension has local test coverage; the earlier native run does not validate its new submission fields. Connecting an existing finance tracker and assigning its category serials remain separate work.

1. A finance IC copies the setup workbook, enters event settings, and authorises setup.
2. Setup prepares the event's folders, submission form, registers, template copy, and automatic processing.
3. A claimant submits claim details and a receipt through Google Forms.
4. Processing assigns a receipt number, files the receipt, and adds the claim to the correct person's weekly document.
5. The finance IC reviews claims and uses the central register to prepare consolidated expenditure information.

Each event operates independently under its finance IC's Google account. Receipt numbering is shared across all people within an event, starting at 1. Across events, the reference is the event code plus receipt number, for example `CAMP26-000001`. Event codes must be distinct wherever records will be combined.

## Project documentation

- [User Guide](docs/UserGuide.md): setup, event folders, claimant submissions, weekly PDFs, retries, and troubleshooting.
- [Guided setup workbook](docs/setup-workbook.md): copy-based onboarding, finance menu actions, copy isolation, and maintainer packaging.
- [Developer Guide](docs/DeveloperGuide.md): architecture, data/state contracts, feature implementation, design choices, tests, requirements, and manual acceptance cases.
- [Requirements](docs/requirements.md): agreed behaviour and proposed details.
- [Decision log](docs/decisions.md): confirmed choices and unresolved questions.
- [Build roadmap](docs/roadmap.md): milestones and evidence needed before moving forward.
- [Voucher template findings](docs/voucher-template.md): verified fields, dynamic claim rows, and A4 PDF export requirements.
- [Prototype guide](docs/prototype.md): developer setup, synthetic voucher runs, test coverage, and remaining live checks.
- [Manual live test](docs/manual-test.md): one-file setup, existing-project updates, and Drive API v2/v3 compatibility.
- [Live validation record](docs/live-validation.md): confirmed short/long exports, tested build, evidence folder, and remaining scope.
- [Form pipeline live test](docs/form-pipeline-test.md): create the test event/form, add the receipt-upload question, activate, and verify browser-submitted claims.
- [Implementation iterations](docs/iterations.md): source commits, tested builds, and how to reproduce a script/manifest bundle.

## Current milestone

The official template has been supplied and inspected. Finance requires a printed payment voucher, so the submission output is a PDF prepared for printing. A blank full-page voucher has been verified as a single A4 PDF using an explicit sheet and print range.

Each weekly voucher must have exactly one input row per included claim. Delete unused input rows and add rows when needed, preserving the official headings, styling, totals, and signature sections. The original template's row counts are starting layouts, not claim limits.

The copy/fill/resize/export path has passed the user's short/long live tests, and basic multi-person submissions, folders, and numbering have been reported working. Native testing now also covers the single-claimant PDF batch path and relocation into an own-account normal Drive folder. Claims use submission weeks, Monday–Sunday in Singapore time. Multi-person exports, shared-folder access, additional recovery cases, concurrency, and independent second-account setup must still be proved before accepting the guided installer.

## Local development

Use Node.js 20 or later. No dependency installation is needed for the local checks:

```sh
npm run check
npm test
npm run bundle
```

`src/` is the Apps Script project. `test/` exercises vouchers, pipeline setup/activation, register persistence, submission grouping/numbering, file routing, and retry behaviour using in-memory Google service substitutes. These tests do not establish native Google layout fidelity, authorisation, trigger delivery, or file-upload behaviour.

The bundle command prepares a single Code.gs, appsscript.json, and quick-start guide under local/live-test. The bundled manifest uses Drive API v2; the importer supports either v2 or v3. Updating GitHub does not replace code already pasted into a Google project.

For the new submission test, use `npm run bundle -- /absolute/path/to/form-test --pipeline` to include the form-testing guide. Replace both the script and manifest; the pipeline requires Forms and trigger-management permissions too.

Use `npm run bundle -- --installer` for the setup-workbook bundle and its maintainer guide. It creates ignored `local/setup-workbook/`; no web-app deployment or new service scope is required.

The form defaults Congregation to Youth without asking the claimant. Set Script Property `PIPELINE_ASK_CONGREGATION` to `true` and rerun `setupClaimPipeline` to show the dropdown; remove the property or set it to `false` and rerun setup to return to Youth automatically. This setting can also be applied to an active form. See the [form guide](docs/form-pipeline-test.md#changing-the-congregation-setting).

Set `PIPELINE_PARENT_FOLDER_ID` to your existing event folder's ID or full folder link and run `setupClaimPipeline` to place the claims folder alongside your planning documents. This also relocates an existing installation's claims folder while retaining its files, links, and receipt numbers. Normal Drive folders shared with the IC are supported; Workspace Shared Drives are not. See the [event folder guide](docs/form-pipeline-test.md#choosing-the-event-folder) for access requirements and moving an installation.

Run `exportWeeklyClaimVouchers` to save a PDF in every current-week claimant's folder. People without claims in that Singapore submission week are skipped. The previous `exportLatestClaimVoucher` entry point now runs the same batch export. See the [weekly export guide](docs/form-pipeline-test.md#export-all-current-week-claimants) for results, retries, and PDF revisions.

Do not redesign the official output document. The input Google Form and internal registers are separate from that standardised document.

## Data and templates

This repository is for source code, documentation, approved blank templates, and synthetic examples. Real submissions, receipt images, payment details, credentials, and event records belong in the event's restricted Google Drive workspace.

A blank Excel template may be versioned here if permitted. A native Google Sheets master can remain in Drive, with its version and field mapping documented here. Never overwrite the official master during processing.

## Documentation website

GitHub Pages is planned as a handbook built from these docs. Publishing it is a later task; creating these files does not enable or publish a site.
