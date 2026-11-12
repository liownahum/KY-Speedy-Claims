# Requirements

This document distinguishes user requirements from implementation proposals. Unconfirmed choices are listed in the [decision log](decisions.md).

## Problem

Different events have different finance ICs. Each IC needs an independent claims workflow without manually assembling folders, spreadsheets, and automation. Within an event, claims must connect consistently to their weekly claim documents, receipt images, and consolidated expenditure records.

## Confirmed requirements

### Event independence and setup

- Different finance ICs can operate separate event installations.
- Automate creation and configuration of the files and folders needed for an event as far as Google permits.
- The IC should use a guided interface rather than edit source code or manually connect file IDs.
- Preserve documentation of the system, plan, and decisions in this repository.

### Standard weekly claim document

- One weekly claim spreadsheet per claimant, created when first needed.
- Header contains the claimant's full name and payment details.
- Claim columns are receipt number, description, group, and amount.
- Description combines event title and item description.
- Use the finance department's standardised template, preserving its labels, column layout, styling, totals, and signature sections.
- The claim input section must contain exactly one row per included claim. For one claim, delete all other unused input rows. Add input rows when more are needed. This resizing is explicitly authorised by the user.
- Shift the totals and footer with the resized input section, update the total formula to cover all included claims, and derive the print range from the resulting layout. The original input-row count is not a limit and does not require a separate voucher.
- Preserve each existing receipt number when resizing; receipt numbers are independent of worksheet row positions.
- Preserve helper lists and apply the intended row styling and congregation validation to all new input rows. Deleting unused rows must not destroy helper data.
- The official document labels the group column Congregation; the user confirmed these are the same field.
- Export the payment voucher as a PDF when preparing physical submission. Preserve the template's signature/approval areas for the proper signatories.
- Select the intended voucher sheet and print range explicitly, and validate A4 pagination. Do not export unrelated worksheets or dropdown helper cells.
- Retain the editable weekly source and associate exported submission PDFs with their source revision.

### Submission processing

- Collect the claim's information and a receipt picture using Google Forms.
- Find the claimant; create their named folder if it does not exist.
- Find their spreadsheet for the relevant week; create it from the template and fill the header if needed.
- Add the new claim to that weekly document.
- Store receipts in a receipts subfolder within the person's folder.
- Rename the receipt using the allocated receipt number, retaining its file extension.
- Use that same receipt number in the claim document and central register.

### Numbering

- Each event has a separate sequence starting at 1.
- All people within the event share that sequence; it does not reset per person or week.
- The cross-event reference combines event code and receipt number.
- Example: `CAMP26-000001` and `DINNER26-000001` are different references.
- Event codes must be distinct within the reporting scope when collating multiple events.

## Proposed first-version design

These details are proposals until confirmed or validated by the feasibility prototype.

### Inputs

| Input | Proposed use |
| --- | --- |
| Verified email or member ID | Stable claimant identity; names are display labels |
| Full name | Folder label and Pay to field; use name as stated by the template, without collecting an NRIC number |
| Payment details | Bank A/c/PayNow field; exact structured input and update policy still to be chosen |
| Purchase date | Expense date retained separately from submission time |
| Event title | Description component; may be preconfigured per event |
| Item description | Description component |
| Congregation | Official template's group field; validate options against the intended congregation list |
| Amount claimed | Positive amount in the configured currency |
| Receipt upload | Required image; decide whether to accept PDF and multiple pages |

One submission represents one receipt and one claim row. Multiple pages of the same receipt, if supported, share a receipt number with page suffixes on their filenames. Multiple independent receipts require separate submissions. Allocation of one receipt across multiple groups is outside the initial proposal and needs a separate design if required.

### Registers and configuration

The proposed event workbook stores:

- Event configuration: event ID/code, name, owner, groups, currency, timezone, week rule, and installed software/template versions.
- People: stable identity, display name, payment profile, and folder IDs.
- Claims: submission ID, receipt number/reference, claimant, dates, week, description, group, amount, and file/document links.
- Weekly documents: claimant + week, document ID, header snapshot, and open/closed state.
- Processing state: allocated number, completed stages, errors, and recovery information.

Keep the original form responses as an input record. Store Drive IDs rather than relying on folder names as lookup keys.

### Processing reliability

- Protect shared number allocation and resource creation against simultaneous submissions.
- Persist the submission-to-receipt-number assignment so retries reuse it.
- Prevent repeated processing of a submission from creating duplicate rows, receipts, or weekly documents.
- Record partial progress: Drive and Sheets updates are not one atomic operation.
- Provide a way to find and retry incomplete submissions.
- Retain voided numbers with their reason; do not recycle them.
- Detecting repeated processing is separate from flagging a person who submits the same receipt in a new submission.
- Re-running setup must reuse existing resources and avoid duplicate processing triggers.

### Access and ownership

The IC authorises their installation under the account intended to operate the event. Registers and payment details are restricted to authorised finance users. Any claimant access must be limited to their own appropriate documents. Handover of automation requires explicit treatment because sharing a file does not transfer the trigger creator's identity.

## Boundaries

- This workflow collects claims and supports expenditure reporting; income collection needs a separate design.
- Approval, payment execution, receipt OCR, and cross-event accounting integration are not initial implementation commitments.
- Approved/paid weeks, corrections, payment-detail changes, and duplicates need explicit rules before operational use.
- A documentation site does not execute the Google automation.
- See [voucher template findings](voucher-template.md) for original ranges, authorised row resizing, and export evidence. Filled-voucher PDFs, resizing, and Google Sheets conversion remain to be tested.

## Known platform constraints to validate

- Google Forms API cannot create file-upload questions. Prototype copying a prepared form into another IC's account. Provide a guided manual upload-question step if necessary.
- File-upload questions require Google sign-in; upload forms cannot be stored in a Shared Drive.
- Automatic triggers run as their creator. The IC must authorise access; this cannot be silently automated.
- Check the chosen Google account's permissions and quotas during the prototype.

References: [Forms upload questions](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms#fileuploadquestion), [upload requirements](https://support.google.com/docs/answer/7322334?hl=en), [automatic triggers](https://developers.google.com/apps-script/guides/triggers/installable), [upload routing example](https://developers.google.com/apps-script/samples/automations/upload-files), [locking example](https://developers.google.com/apps-script/reference/lock/lock), [quotas](https://developers.google.com/apps-script/guides/services/quotas).
