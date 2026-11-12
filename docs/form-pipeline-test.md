# Google Form pipeline: manual live test

For the complete setup and operating instructions, use the [User Guide](UserGuide.md). This page is the focused pipeline test checklist; the [Developer Guide](DeveloperGuide.md) explains the implementation and wider acceptance cases.

The user has reported successful multi-person submissions, folder handling, and receipt numbering after the earlier short/long voucher exports. The current-week batch PDF export below is a new change awaiting native validation. Upload ownership/access, recovery, concurrency, and independent installation still need their own evidence. Use fictional names/payment details and sample receipts. The guided Setup Workbook installer is a later milestone.

## 1. Update the Apps Script project

Use the account that will own this test event. You can reuse the voucher prototype project if it has not already been configured for another event, or create a separate standalone project at [Google Apps Script](https://script.google.com/).

1. Replace the whole contents of `Code.gs` with the new pipeline bundle's `Code.gs`. Avoid keeping duplicate copies of the same functions in other script files.
2. In Project Settings, enable **Show appsscript.json manifest file in editor**. Replace that file with the supplied `appsscript.json` too. Save both files.
3. The bundle uses the Advanced Drive service **v2**, which worked in the voucher test. It now also requests Forms and trigger-management permissions. Authorise the updated project when prompted.
4. Optional: before the first setup, set Script Properties `PIPELINE_EVENT_CODE` and `PIPELINE_EVENT_TITLE`. Defaults are `TEST` and `KY Claims Test`. Use a distinct code for each event whose accounts will be combined. A project supports one event; do not change these values after setup.
5. Optional: set Script Property `PIPELINE_ASK_CONGREGATION` to `true` to ask claimants for their congregation. Leave it unset, or set it to `false`, to omit that question and automatically use **Youth** in the register and payment voucher.
6. Optional: set Script Property `PIPELINE_PARENT_FOLDER_ID` to the existing event folder's ID or its full `https://drive.google.com/drive/folders/...` link. Setup creates the claims folder inside it, alongside your planning documents. Leave it unset for the original My Drive location on a new installation.

The original template ID is built in. If necessary, set `PIPELINE_TEMPLATE_ID` to an accessible pristine native Sheets or XLSX copy of the same official template. The source master is copied, never filled directly.

## 2. Create the event resources

Select **setupClaimPipeline** and click Run. The execution log returns:

- `formEditUrl`: edit the new form.
- `formSubmitUrl`: use this link to submit claims later.
- `registerUrl`: check processing and errors here.
- `folderUrl`: the test event's Drive folder.
- `parentFolderUrl`: the selected event folder containing the claims folder, or null for the default location.

Setup creates a pristine template copy, a Claims Register, and a form with five required claim questions plus email collection. Enabling `PIPELINE_ASK_CONGREGATION` adds a sixth required question, the Congregation dropdown. It links the form's raw response tab to the register. Setup saves resource IDs as it progresses; running it again normally reuses them. It keeps an unfinished form closed to submissions.

### Choosing the event folder

In **Project Settings → Script Properties**, set `PIPELINE_PARENT_FOLDER_ID` to your existing event folder's ID or full folder link, then run **setupClaimPipeline**. The finance IC needs permission to create files and folders there. Setup checks the destination before creating or moving resources; an invalid or inaccessible location does not fall back to My Drive.

The selected folder remains your event's planning folder. A dedicated claims folder is created inside it, containing the register, form, template copy, and claimant folders. Weekly workbooks and exported PDFs stay in the corresponding claimant folders. Other planning documents are left in place.

For an existing installation, rerunning setup moves the same claims folder and all its contents under the selected event folder. Existing file IDs, links, receipt numbers, form responses, and processing state are retained. The active form stays open and keeps its upload question and trigger. If a move fails, fix access and rerun setup; do not delete the old folder or its saved IDs. Removing the property afterward leaves the existing claims folder where it is; it does not move it back to My Drive. To relocate it again, set another event folder and rerun setup.

Use a normal Google Drive folder, which may be shared with the finance IC. Workspace **Shared Drives** are rejected because [Google Forms does not support file-upload questions in forms stored there](https://support.google.com/docs/answer/7322334?hl=en). The existing Advanced Drive service and Drive permission are used; this update does not add manifest scopes. Choose a destination with the intended finance access: files and folders can [inherit access from their parent folder](https://support.google.com/drive/answer/7166529?co=GENIE.Platform%3DDesktop&hl=en), including access to claim and payment details.

### Changing the congregation setting

In Apps Script **Project Settings → Script Properties**, use:

| Property | Value | Result after rerunning setup |
| --- | --- | --- |
| `PIPELINE_ASK_CONGREGATION` | `true` | Create or reuse one required Congregation dropdown, with the official template's options. |
| `PIPELINE_ASK_CONGREGATION` | `false`, blank, `null`, or property deleted | Remove the Congregation question and use Youth automatically. |

Only `true` enables the question; letter case and surrounding spaces are ignored. After changing the property, run **setupClaimPipeline** again in the same project. This also works for an **ACTIVE** installation: the form remains open, its upload question and trigger stay in place, and its existing resources are reused. Running **activateClaimPipeline** also applies the setting. **showClaimPipelineStatus** reports the applied `askCongregation` and `defaultCongregation` values.

Review or process outstanding submissions before switching modes: unreserved responses are interpreted using the applied form settings. Claims already saved keep their recorded congregation and receipt number, including when retried. Disabling the question requires Youth to be an allowed congregation in the voucher template; otherwise setup stops before removing it. The Congregation column remains on the official payment voucher in both modes.

## 3. Add the receipt-upload question

Open `formEditUrl` in the Google Forms editor:

1. Add exactly one **File upload** question named **Receipt**. Accept Google's upload prompt.
2. Set **Required**, maximum **1 file**, and allow **Image** and **PDF** files. Choose a suitable size limit, such as 10 MB.
3. Check that email collection is enabled; choose **Verified** collection where available so identity comes from the signed-in account. Keep **Limit to 1 response** off: each receipt needs a separate submission.
4. Check responder access allows your test account(s). Account or organisation restrictions may affect external claimants and uploads.

Google's Apps Script Forms service cannot create the file-upload question. Activation detects its presence, while you must check its Required/type/count settings in the editor. See [Google's upload automation example](https://developers.google.com/apps-script/samples/automations/upload-files).

## 4. Activate and submit through the actual form

Run **activateClaimPipeline**. This publishes/opens the form and installs one form-submit trigger under your account. Repeating activation reuses that trigger.

Open `formSubmitUrl` in a browser and submit a sample receipt:

| Field | Test value |
| --- | --- |
| Full name | SAMPLE - DO NOT SUBMIT |
| Bank A/c/PayNow | SAMPLE ONLY - NOT PAYABLE |
| Purchase date | 2026-10-01, or another valid YYYY-MM-DD date |
| Item description | Test item 1 |
| Amount | 12.50 |
| Congregation | Youth automatically; choose a dropdown option only when `PIPELINE_ASK_CONGREGATION` is enabled. |
| Receipt | One sample image or PDF |

Do not run `onClaimFormSubmit` from the script editor. It needs the real submission event. Script/API-created FormResponses do not prove that the installed trigger runs; see [Google's trigger restrictions](https://developers.google.com/apps-script/guides/triggers/installable#restrictions).

Wait for the submission execution to finish, then open the register's **Claims** tab. A successful first claim has status **DONE**, receipt number **1**, reference **TEST-000001** (or your event code), and links to the receipt and weekly workbook. Form confirmation means the form received the response; it does not establish successful processing.

## 5. Check the results

| Test | Expected result |
| --- | --- |
| First receipt | One person folder named for the claimant, a Receipts subfolder, one weekly workbook, correct header, one input row, total 12.50. Receipt renamed `1.jpg`, `1.png`, `1.pdf`, etc. |
| Submit a second receipt using the same account, identical full name/payment details, amount 7.25 | Receipt number 2; same folder and same workbook URL; exactly two input rows; total 19.75. |
| Use an older purchase date | Grouping still uses the current **submission** week. Purchase date is retained in stored claim data. |
| Submit through a second account | Receipt number 3 across the event; a separate person folder/week workbook. Use a different sample name so the folders are easy to distinguish. |
| Run retryPendingClaimSubmissions after successful processing | Completed responses skipped; no extra numbers, receipt copies, or claim rows. |
| Run setupClaimPipeline and activateClaimPipeline again | Existing resources and the single trigger reused; active form remains open. |
| Set PIPELINE_PARENT_FOLDER_ID and rerun setupClaimPipeline | Claims folder appears inside the selected event folder; its existing contents and links remain usable. Rerunning setup again creates no replacement folder. |
| Run exportWeeklyClaimVouchers | Saves one PDF for each person with claims in the current submission week, in that person's folder. Logs each result and a summary. Inspect every PDF before printing. |
| Person has claims only in another week | No PDF created for that person; other weeks' files are untouched. |

For a submission on 12 November 2026, the week start is **2026-11-09**. Weeks run Monday–Sunday in **Asia/Singapore**. For this test only, the voucher Date is the week-start date; the finance department's final date policy remains undecided. Two claims from different submission weeks create separate weekly workbooks; crossing that boundary is covered locally but still needs native evidence.

The weekly workbook ID stays the same. Processing renders a fresh voucher tab from the pristine template, verifies it, saves its identity, then removes the prior generated tab. Manually added non-reserved tabs are retained, but edits to the generated Voucher tab are replaced by the next claim. If another tab already uses the name Voucher, the generated tab uses an available name such as Voucher (2). PDFs are generated on demand; each export gets a new revision filename.

### Export all current-week claimants

Replace `Code.gs` with the latest bundle, then select **exportWeeklyClaimVouchers** and Run. This code update does not require a new manifest or rerunning setup. The week is fixed when the run starts, using Monday–Sunday in Asia/Singapore. The batch selects every person with saved claims in that week, then exports each person's weekly voucher into their own existing folder. No PDF, folder, or weekly workbook is created for a person with no claims that week. An event with no current-week claims returns zero exports.

Each person's result includes `EXPORTED` or `ERROR`, their identity, and either the PDF/workbook links and totals or the reason for failure. The final summary includes `week`, `peopleWithClaims`, `exported`, `skipped`, `failed`, and `results`. One failure does not stop the remaining people. Incomplete claims block that person's PDF so it cannot silently omit an expense; resolve those claims and retry processing before exporting again. Missing or inconsistent weekly metadata requires review.

Submissions can continue between people in the batch. People first submitting after the batch starts, or new claims arriving after their PDF was generated, are included by running the export again. Each run retains a separate PDF snapshot with week, workbook revision, and a unique suffix; previous PDFs are not overwritten. The old **exportLatestClaimVoucher** function remains available as an alias, but now performs this same batch export instead of selecting only the latest submission. Export remains a manual action; no schedule is installed.

## If a submission fails

- An earlier setup bundle stopped with **The form currently has no response destination.** while reading a new form's destination. Replace `Code.gs` with the corrected bundle and rerun **setupClaimPipeline** in the same project. It reuses saved resources and links the register; keep Script Properties and existing resources intact. This fix does not change the manifest.
- Check the **Claims** status and **Last error**, plus Apps Script **Executions**. The raw **Form Responses** tab is separate from processed Claims.
- Run **retryPendingClaimSubmissions** after fixing a service/access problem. It retries up to ten non-completed responses per run, retaining reserved receipt numbers and stored file IDs. Each run continues after the last attempted response and wraps around, so repeatedly invalid early submissions do not block later claims. Failed attempts advance this saved position too; completed claims are skipped. If the last attempted response has been deleted, retries resume from the first pending response.
- Invalid date/amount, missing email, or an incorrect file count can fail before a Claims row is reserved. The raw response remains in Forms; retry output shows the error. Use a new valid submission for this test. There is no general correction interface yet.
- Conflicting full name/payment details for the same person/week are flagged for review. Previous details are not silently overwritten. Retrying alone cannot resolve that conflict.
- Do not delete or edit Claims rows, State JSON, People, Weeks, generated helper tabs, or saved Script Properties. They hold the receipt sequence and recovery state. Hiding State JSON is for readability, not an access control.
- **showClaimPipelineStatus** prints the setup links again.

This is a test installation. Approval, paid/closed states, corrections, scheduled recovery, and selecting a past week for export are not implemented. Rare failures between Google resource creation and saving its ID can leave an unused file/folder requiring review; the services do not provide one transaction across Forms, Drive, and Sheets. Keep event resources restricted to the finance IC during testing.

Record the observed receipt numbers, workbook reuse, totals, upload owner/location, retry result, and PDF appearance. The independent second-finance-IC installation and simultaneous-submission cases remain additional live tests.

## Building this bundle from the repository

Use Node.js 20 or later:

```sh
npm run check
npm test
npm run bundle -- /absolute/path/to/form-test --pipeline
```

This produces `Code.gs`, `appsscript.json`, and this guide as `START-HERE.md`. Updating GitHub does not update the code already pasted into your Apps Script project.
