# KY Speedy Claims User Guide

KY Speedy Claims collects event expenses through a Google Form, numbers and files receipts, and prepares a weekly payment voucher for each claimant. This guide explains how a finance IC sets up an event, how claimants submit expenses, and how the IC checks and exports the results.

The current version is operated through Google Apps Script. A guided Setup Workbook is planned but is not available yet. Claimants only need the submission form; they do not install the script.

## Contents

- [Before you start](#before-you-start)
- [Set up an event](#set-up-an-event)
- [Choose the event folder](#choose-the-event-folder)
- [Choose whether to ask for congregation](#choose-whether-to-ask-for-congregation)
- [Submit an expense](#submit-an-expense)
- [Find claims and receipts](#find-claims-and-receipts)
- [Create the weekly PDFs](#create-the-weekly-pdfs)
- [Retry incomplete submissions](#retry-incomplete-submissions)
- [Update an existing installation](#update-an-existing-installation)
- [Troubleshooting](#troubleshooting)
- [Function reference](#function-reference)
- [Current limits](#current-limits)

## Before you start

You will need:

- The Google account that will operate the event. Use this same account for setup, activation, and routine finance actions.
- A current KY Speedy Claims bundle containing `Code.gs` and `appsscript.json`, supplied by the maintainer.
- Access to the approved blank payment-voucher template. The supplied template is the default; ask the maintainer if your account cannot open it.
- An event code, for example `CAMP26`, and an event title, for example `Youth Camp 2026`.
- Optionally, an existing event folder in Google Drive, with permission to add files and folders there.
- Fictional claimant details and sample receipts for the first test.

Use a separate Apps Script project for each event. Event codes must be distinct wherever expense records will be combined.

Claim files contain payment information. Choose the event folder's audience accordingly: files inside a shared folder can inherit its permissions. A normal Drive folder shared with you is supported. A Google Workspace **Shared Drive** is not supported for this installation because its form contains a file-upload question. See [Google's folder-sharing guidance](https://support.google.com/drive/answer/7166529?co=GENIE.Platform%3DDesktop&hl=en) and [file-upload restrictions](https://support.google.com/docs/answer/7322334?hl=en).

## Set up an event

### 1. Install the supplied script

1. Open [Google Apps Script](https://script.google.com/) using the event's operating account.
2. Create a new standalone project and give it an event-specific name, such as `KY Claims - CAMP26`.
3. Open `Code.gs`, replace its contents with the complete supplied `Code.gs`, and save. Do not add another copy of the same program in a second script file.
4. Open **Project Settings** and enable **Show appsscript.json manifest file in editor**.
5. Return to the editor, open `appsscript.json`, replace it with the supplied manifest, and save.
6. Check **Services** for **Drive API**, with the identifier **Drive**. The supplied manifest uses Drive API v2. Keep that version if it is already installed; you do not need to find v3. If the service is missing, add Drive API. A separately managed Google Cloud project may also need its Drive API enabled by its administrator.

You do not need to publish a web app or use the **Deploy** button for this workflow.

### 2. Enter the event settings

In **Project Settings → Script Properties**, add the settings you need and save them before running setup.

| Property | What to enter | If left unset |
| --- | --- | --- |
| `PIPELINE_EVENT_CODE` | A short code such as `CAMP26`. Use up to 40 letters, digits, underscores, or hyphens, starting with a letter or digit. Letters are converted to uppercase. | `TEST` |
| `PIPELINE_EVENT_TITLE` | The event name, up to 150 characters. This appears in claim descriptions. | `KY Claims Test` |
| `PIPELINE_PARENT_FOLDER_ID` | The existing event folder's full Drive folder link or folder ID. | A new claims folder in My Drive. |
| `PIPELINE_ASK_CONGREGATION` | `true` to show a required Congregation dropdown; `false` to use Youth automatically. | Youth automatically, with no question. |
| `PIPELINE_TEMPLATE_ID` | Optional: the Drive file ID of an approved, blank template matching the supported layout. This setting takes an ID, not a full link. | The supplied master, or `PROTOTYPE_TEMPLATE_ID` if that older setting exists in this project. |

For example, set the event code to `CAMP26`, title to `Youth Camp 2026`, paste the planning folder's link into `PIPELINE_PARENT_FOLDER_ID`, and leave the congregation property absent for a Youth-only event.

Do not change the event code or title after setup. For another event, create another project. Do not edit or delete the program's internal `KY_CLAIM_PIPELINE` and `KY_CLAIM_RETRY_CURSOR` properties.

### 3. Create the event resources

1. Return to the editor.
2. In the function selector beside **Run**, select **setupClaimPipeline**.
3. Click **Run**. Review and complete Google's authorisation prompts for your event's project. The program needs Drive, Sheets, Forms, trigger-management, and PDF-export access.
4. Open the **Execution log** after the run finishes.

Successful setup reports a stage of `ADD_RECEIPT_UPLOAD_THEN_ACTIVATE` and these links:

| Log field | Use |
| --- | --- |
| `formEditUrl` | Open the form editor to add the receipt-upload question. |
| `formSubmitUrl` | The link claimants will use after activation. |
| `registerUrl` | Open the finance register to check processing results. |
| `folderUrl` | Open the claims folder containing the event's finance resources. |
| `parentFolderUrl` | Open the chosen event/planning folder, if one was configured. |

The unfinished form stays closed. Setup creates a separate template copy and never fills the original master. If setup is interrupted, keep the project and its saved settings, fix the reported problem, and run setup again. Do not start over by deleting its files.

### 4. Add the receipt-upload question

Open `formEditUrl` and add exactly one question with these settings:

| Setting | Value |
| --- | --- |
| Question title | `Receipt` |
| Question type | **File upload** |
| Required | On |
| Maximum number of files | **1** |
| Allowed file types | **Image** and **PDF** |
| Maximum file size | Choose a suitable limit, such as 10 MB. |

Google's form service does not create this upload question for the program. The activation check finds the upload question, but you must check its Required, file-count, type, and size settings yourself.

In the form's **Settings → Responses**, check email collection and choose **Verified** so it collects the signed-in account's address. Keep **Limit to 1 response** off: a claimant needs a separate submission for each receipt. No additional email question is needed. Check that responder access permits the intended claimants, including external accounts if required.

### 5. Activate the form

1. Return to Apps Script.
2. Select **activateClaimPipeline** and click **Run**.
3. Check that the log reports `stage: ACTIVE`.

Activation opens the form and installs its submission trigger. Repeating activation reuses that trigger. Do not manually run `onClaimFormSubmit`; it is called when someone submits the actual form in a browser.

### 6. Check the first submissions

Use the real `formSubmitUrl` in a browser. Submit fictional name/payment details, a sample receipt, and an amount of `12.50`. Submit another receipt using the same account and exactly the same name/payment details, with an amount of `7.25`.

In a fresh event, expect:

- Receipt numbers 1 and 2 across the event.
- Both processed Claims rows marked `DONE`.
- One claimant folder and one Receipts subfolder.
- One weekly workbook containing exactly two expense rows and a total of **19.75**.
- Receipt files named with their assigned numbers and extensions, such as `1.jpg` and `2.pdf`.

Another claimant should receive the next event-wide number and a separate claimant folder. If this event already has claims, expect the next unused numbers rather than starting again at 1.

Only share `formSubmitUrl` with claimants. The form editor, register, and claims folder are finance resources; they are not automatically made available to every claimant.

## Choose the event folder

Set `PIPELINE_PARENT_FOLDER_ID` to an existing normal Drive folder's link or ID and rerun **setupClaimPipeline**. The program places its claims folder inside that event folder, alongside the planning documents.

```text
Event planning folder
├── Planning documents
└── KY Claims Test - CAMP26 - <event suffix>
    ├── Claims Register
    ├── Submission form
    ├── Pristine voucher template
    ├── Claimant A
    │   ├── Receipts
    │   ├── Weekly workbook
    │   └── Exported PDF snapshots
    └── Claimant B
        ├── Receipts
        ├── Weekly workbook
        └── Exported PDF snapshots
```

The diagram shows the program's organised finance resources. Google also manages the form's initial upload-storage folder before processing moves individual receipts into claimant folders.

For an existing installation, setup moves the **same claims folder and its contents**. It preserves file IDs, links, receipt numbers, and processing records; the active form remains open. Other planning documents stay where they are. Check `parentFolderUrl` and `folderUrl` afterward.

If the destination is invalid, read-only, inaccessible, or in the trash, setup stops. It does not silently create a substitute in My Drive. Fix access and rerun setup in the same project.

Removing the property later leaves the existing claims folder in its current location. To move it elsewhere, set a different event folder and rerun setup. Do not select the claims folder itself or one of its children as its parent.

## Choose whether to ask for congregation

| `PIPELINE_ASK_CONGREGATION` | Applied behaviour |
| --- | --- |
| `true` | One required Congregation dropdown, using the voucher template's options. |
| `false`, blank, `null`, or missing | No Congregation question; Youth is entered automatically in the register and voucher. |

After editing the property, run **setupClaimPipeline** again. Running **activateClaimPipeline** also applies this setting. Case and surrounding spaces in `true` are ignored. `showClaimPipelineStatus` reports `askCongregation` and `defaultCongregation` for the setting that has been applied.

Review outstanding submissions before changing modes: responses not yet recorded as claims are interpreted using the applied form settings. Claims already saved retain their congregation when retried. Youth must be an allowed option in the template before the question can be disabled. The official voucher's Congregation column remains in both modes.

## Submit an expense

Claimants open the event's submission link and sign in to Google. Submit one receipt per response.

| Field | What to enter |
| --- | --- |
| Collected email | Confirm the intended signed-in account. This address identifies the claimant. |
| Full name (as per NRIC) | The name to appear on the payment voucher. Enter the name only, not an NRIC number. |
| Bank A/c/PayNow | The payment details requested by the finance IC. |
| Purchase date | A calendar date in `YYYY-MM-DD`, for example `2026-10-01`. |
| Item description | What was purchased. The event title is added to the voucher description automatically. |
| Amount | A positive amount such as `12.50`. Use at most two decimal places, with no currency symbol or thousands separator. |
| Congregation | Choose an option if the question is shown. Otherwise Youth is assigned automatically. |
| Receipt | One image or PDF, within the form's configured limits. |

Use the same account and exactly the same name/payment details for further claims in the same week. Different accounts are treated as different claimants, even if their names match. Agree the event's currency with finance; the program does not convert currencies.

A form confirmation means the response was received. Finance must check that processing reaches `DONE`. Do not resubmit an expense just because processing is delayed: another response can receive another receipt number.

## Find claims and receipts

Open `registerUrl` and select the **Claims** tab. It shows the receipt number/reference, submission time, week, claimant, description, congregation, amount, status, receipt link, weekly workbook link, and last error.

| Status | Meaning | Finance action |
| --- | --- | --- |
| `PENDING` | A receipt number has been reserved; processing has not completed. | Check the relevant Apps Script execution and retry after resolving any interruption. |
| `ERROR` | Processing stopped after reservation. Some files or workbook changes may already exist. | Read **Last error**, resolve its cause, then retry the original response. |
| `DONE` | Receipt filing and weekly voucher rendering completed. | Review the claim and prepare the PDF when needed. This is not an approval or payment status. |

The form's raw response tab is separate from **Claims**. Invalid input can fail before a Claims row is created, so check the raw response and Apps Script **Executions** when a submission is missing from Claims.

Receipt numbering is shared across everyone in one event. It does not restart per person or week. For example, one person's voucher can contain receipts 1 and 3 while another person's contains receipt 2. `CAMP26-000001` is the cross-event reference for receipt 1 in CAMP26.

### How weeks work

Weeks use the **submission timestamp**, Monday–Sunday in **Asia/Singapore**, rather than the purchase date. A response submitted on 12 November 2026 belongs to the week starting `2026-11-09`, even if its purchase date is in October.

The same person/week reuses one workbook. A new submission week creates another workbook in the same claimant folder. The voucher Date currently displays the week-start date; confirm the final production date policy with finance before official use.

Do not edit/delete Claims rows, the State JSON column, People/Weeks tabs, or saved internal Script Properties. They hold the receipt sequence and recovery state. Edits to the generated voucher worksheet can be replaced by the next processed claim. Unrelated worksheets can be retained, but generated helper tabs are reserved for the program.

## Create the weekly PDFs

1. Check the current week's Claims rows and resolve incomplete processing.
2. In Apps Script, select **exportWeeklyClaimVouchers** and click **Run**.
3. Read each person's result and the final summary in the execution log.
4. Open the PDFs from their links or claimant folders, check every page, and print the accepted copies.

The function exports the **current Singapore submission week** for every person with claims in that week. Each PDF is saved in that person's folder. A person with no claims this week receives no new PDF; the program does not substitute their latest older week. If nobody has current-week claims, it creates no PDFs.

The summary contains `week`, `peopleWithClaims`, `exported`, `skipped`, `failed`, and `results`. Each successful result contains the PDF/workbook links, claim count, and total in cents. For example, `1975` cents is an amount of `19.75`.

If one person's export fails, the program reports that person as `ERROR` and continues with the others. A person with incomplete claims is blocked from PDF export so an expense is not silently omitted. Resolve their processing errors before running export again. Missing or inconsistent workbook metadata requires maintainer review.

Each run saves a separate PDF snapshot; earlier PDFs are not overwritten. The filename identifies the event, week, workbook revision, and a unique suffix. New claims arriving after that person's PDF was generated require another export. People first submitting after the batch started are included on the next run.

The previous **exportLatestClaimVoucher** function is an alias for the same batch export. It no longer selects only the latest claimant.

Before printing, check claimant/payment details, receipt numbers, descriptions, congregation, amount and total, all claim rows, page breaks, and signature areas. Export requests A4 portrait with fit-to-width. PDF creation does not approve or pay the claim. There is no automatic weekly export schedule or past-week selector in this version.

## Retry incomplete submissions

After fixing a temporary service or access problem, select **retryPendingClaimSubmissions** and Run.

- Each run attempts up to ten responses that are not marked `DONE`.
- Further runs continue after the last attempted response and wrap around, so repeatedly invalid early responses do not block later ones.
- A recorded claim keeps its reserved receipt number and stored receipt file ID.
- Completed responses are skipped. Retrying a recorded response is different from submitting another response for the same expense.

Read the returned results and check Claims afterward. A retry cannot repair invalid answers or decide which of two conflicting payment details is correct. Refer these cases to the maintainer/finance IC; the current version has no general correction or voiding interface. Do not delete rows to release receipt numbers or change the internal JSON by hand.

## Update an existing installation

1. Obtain the new bundle and retain a copy of the previous version for reference.
2. In the **same Apps Script project**, replace the whole `Code.gs` contents. Avoid duplicate program files.
3. Use the matching `appsscript.json` if the update includes a changed manifest. The congregation switch, weekly batch export, and event-folder update do not add permissions beyond the current supplied manifest.
4. Keep existing Script Properties and event resources. Do not replace the register with a new blank one.
5. Run **setupClaimPipeline** if applying folder or congregation settings. The active form stays open and existing resources are reused.
6. Use **showClaimPipelineStatus** to check links/settings. Confirm there is still one submission trigger, then submit a synthetic test receipt and review its result.

For a new event, use a new project rather than changing this installation's event code/title. Updates pushed to GitHub do not automatically replace code already pasted into Google.

Changing the operating finance IC is a separate handover task. Sharing a folder does not transfer the trigger creator's identity. See the [developer guide](DeveloperGuide.md#ownership-and-access) before relying on another account to operate an existing event.

## Troubleshooting

| Symptom or message | What to do |
| --- | --- |
| The form is closed or setup reports `ADD_RECEIPT_UPLOAD_THEN_ACTIVATE`. | Add/check the one required upload question, then run `activateClaimPipeline`. |
| `Add exactly one required File upload question...` | Ensure the form has exactly one File upload question. Manually check Required, maximum one file, and Image/PDF settings. |
| The form opens Google sign-in. | Use the intended Google account and check responder access. Upload responses require Google sign-in. |
| `The form currently has no response destination.` during an older setup run | Replace the whole script with the corrected current bundle and rerun setup in the same project. Keep its resources and settings. |
| `Drive.Files.create is not a function` in an old bundle | Install the current script; keep Drive API v2 if that is the installed version. The importer supports v2 and v3. |
| A submission is received but no Claims row appears. | Check raw form responses and Apps Script Executions. Invalid date/amount, missing email, or file-count problems can fail before reservation. |
| An event folder cannot be accessed or cannot accept children. | Check the folder link/ID and the operating account's permission to add files/folders, then rerun setup. Do not create a replacement installation. |
| Name/payment details conflict within a week. | Ask finance to review the intended details. Retrying alone does not resolve the conflict. |
| Duplicate trigger or changed response-destination warning | Have the maintainer review the installed trigger and form/register link; do not repeatedly create new resources. |
| PDF summary contains failed exports. | Read each person's error. Fix incomplete processing and retry; ask the maintainer to inspect missing/stale metadata. Other successful PDFs may already exist. |
| Execution stops before the batch summary. | Check individual execution-log results and existing PDF files. Google service/runtime limits can interrupt a large batch; rerunning creates additional snapshots. |
| Header, claim text, total, or signature area is clipped in the PDF. | Retain the PDF for diagnosis and ask the maintainer to review the template/text. Do not edit the original master to bypass validation. |

Use fictional data when reporting a problem. Do not paste passwords, authorisation tokens, or real payment details into public issues or repository files.

## Function reference

Choose a function in the Apps Script editor and click **Run**, except for the automatic handler below.

| Function | Purpose |
| --- | --- |
| `setupClaimPipeline` | Create/resume an event installation; apply parent-folder and congregation settings to an existing installation. |
| `activateClaimPipeline` | Check the form, apply the congregation setting, install/reuse its trigger, and open it. |
| `showClaimPipelineStatus` | Reprint setup links and applied congregation/location settings. |
| `retryPendingClaimSubmissions` | Attempt the next batch of up to ten incomplete responses. |
| `exportWeeklyClaimVouchers` | Export PDFs for all people with current-week claims. |
| `exportLatestClaimVoucher` | Compatibility alias for the same weekly batch export. |
| `onClaimFormSubmit` | Automatic form-submit handler; do not run manually. |

`runVoucherPrototype` is a separate synthetic renderer test for maintainers. It does not process live form responses. Functions ending in `_` are internal helpers.

## Current limits

This version handles one event per project and one image/PDF receipt per response. It has no approval/payment execution, paid/closed-week status, OCR, receipt-content duplicate detection, automatic exports, general correction interface, or guided Setup Workbook. Exports select the current week only.

The user has reported successful short/long voucher exports and basic multi-person submissions, folders, and numbering. The newer folder relocation and weekly batch PDF features have local tests and still need native validation. Independent installation under a second finance IC account, access boundaries, live interruption recovery, and simultaneous submissions remain acceptance checks. See [live validation](live-validation.md) and the [manual test checklist](DeveloperGuide.md#appendix-manual-testing).
