# KY Speedy Claims

KY Speedy Claims helps an event's finance IC collect receipt submissions, organise them in Google Drive, and prepare each claimant's weekly claim document using the finance department's standard template.

**Status:** requirements and feasibility planning. No working automation or published documentation website is included yet.

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

## What comes first

Obtain the blank official claim template and confirm the finance department's required submission format. Then test form copying and receipt uploads under a second Google account before building the full installer.

Do not redesign the official output document. The input Google Form and internal registers are separate from that standardised document.

## Data and templates

This repository is for source code, documentation, approved blank templates, and synthetic examples. Real submissions, receipt images, payment details, credentials, and event records belong in the event's restricted Google Drive workspace.

A blank Excel template may be versioned here if permitted. A native Google Sheets master can remain in Drive, with its version and field mapping documented here. Never overwrite the official master during processing.

## Documentation website

GitHub Pages is planned as a handbook built from these docs. Publishing it is a later task; creating these files does not enable or publish a site.
