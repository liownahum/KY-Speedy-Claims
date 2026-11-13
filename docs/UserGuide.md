# KY Speedy Claims User Guide

KY Speedy Claims helps the person in charge of an event's finances collect expense claims. Claimants fill in a Google Form and upload a receipt. The system files the receipt and adds the expense to that person's weekly payment voucher.

**Finance ICs use a setup spreadsheet. Claimants only need the form link.** You do not need to write code to use a prepared setup spreadsheet.

This version is a preview. Start with made-up details and sample receipts. A copied setup spreadsheet has been tested using one Google account; setup by a second finance IC using a different account still needs testing.

## Find what you need

| I want to… | Go to |
| --- | --- |
| Start an event as the finance IC | [Set up an event](#set-up-an-event) |
| Claim an expense | [Submit an expense](#submit-an-expense) |
| Check whether a claim was processed | [Check claims and find receipts](#check-claims-and-find-receipts) |
| Prepare vouchers for printing | [Create the weekly PDFs](#create-the-weekly-pdfs) |
| Deal with an incomplete claim | [Retry incomplete submissions](#retry-incomplete-submissions) |
| Fix a problem | [Troubleshooting](#troubleshooting) |

## Before you start

If you are the finance IC, have these ready:

- The Google account you will use to manage the event. Keep using that account for setup and finance tasks.
- The **blank KY Speedy Claims setup template**, supplied by the person who maintains the system. This guide calls that person your **technical helper**.
- A short event code, such as **CAMP26**, and an event name, such as **Youth Camp 2026**. Use a different code for each event.
- Optionally, a Google Drive folder where you want to keep the event's claims. You must be able to add files and folders there.
- A sample receipt and made-up name and payment details for testing.

Use Google Sheets on a computer for setup. Make a separate copy of the blank template for each event.

Claims contain personal and payment information. Keep the setup spreadsheet, register and claims folders accessible only to the intended finance team. If you choose an existing shared folder, people who can open that folder may also be able to open the claims inside it. A normal Drive folder can be used; a Google Workspace **Shared Drive** cannot be used in this version.

## Set up an event

### 1. Make your own copy

1. Open the blank setup template supplied by your technical helper.
2. In Google Sheets, choose **File → Make a copy**.
3. Give the copy a clear name, such as **Claims — Youth Camp 2026**.
4. Open your copy and choose **KY Claims → Start / open setup** from the menu at the top.
5. Complete Google's permission review using the event's Google account. If you are unsure about the project or requested access, check with your technical helper before continuing.

The system needs permission to create the event's form, organise receipts, update spreadsheets and create PDFs. If Google asks you to run the menu action again after granting permission, choose **Start / open setup** again.

You should now see a tab named **KY Setup** at the bottom. If the **KY Claims** menu is missing, reload the spreadsheet. If it is still missing, ask your technical helper to check that you have the prepared template.

### 2. Fill in the blue cells

In **KY Setup**, enter:

| Setting | What to do | Example |
| --- | --- | --- |
| Event code | Enter a short code with no spaces. Use letters, numbers, hyphens or underscores; start with a letter or number. | CAMP26 |
| Event title | Enter the event's name. This is added to descriptions on the voucher. | Youth Camp 2026 |
| Event folder link (optional) | Open the event's folder in Drive, copy its address from your browser, and paste it here. Leave this blank to create the claims folder in My Drive. | Your event planning folder's link |
| Ask for congregation? | Tick to let claimants choose their congregation. Leave unticked to use **Youth** for every claim. | Unticked for a Youth-only event |

Check the event code and title carefully. **They cannot be changed after you prepare the event.** For another event, make another copy of the blank template.

### 3. Prepare the event

Choose **KY Claims → 1. Prepare event / apply settings**.

Wait for the action to finish. In KY Setup, look below your settings for **Stage**, **Next step / last error**, and **EVENT LINKS**. The system creates the form, claims register and claims folder for you.

If a problem appears, keep using this same copy. Follow the message or ask your technical helper, then run Prepare again. Do not delete the files or make a replacement event to get around an error.

### 4. Check the form

Open the **Form editor** link under EVENT LINKS. Two checks need your attention before the form can accept claims.

First, add one receipt question in Google Forms:

| Setting | Choose |
| --- | --- |
| Question title | **Receipt** |
| Question type | **File upload** |
| Required | **On** |
| Maximum number of files | **1** |
| Allowed file types | **Image** and **PDF** |
| Maximum file size | A suitable limit, such as **10 MB** |

There must be exactly one file-upload question. Google requires this question to be added in the form editor.

Next, open the form's **Settings → Responses**:

- Set **Collect email addresses** to **Verified**. This identifies the claimant by their signed-in Google account.
- Leave **Limit to 1 response** switched **off**, so a person can submit more than one receipt.
- Check that the people you expect to claim can open and submit the form. Organisation restrictions may prevent people outside your organisation from responding.

Return to KY Setup. Tick **I checked the receipt question** and **I checked responder settings** only after you have checked both. These boxes record your checks; the system cannot check every Google Forms setting for you.

### 5. Activate the form

Choose **KY Claims → 2. Activate form**.

The Stage should change to **Accepting submissions**. If it does not, read **Next step / last error**.

### 6. Try two sample receipts

Before inviting claimants, test the **Claimant form** link under EVENT LINKS. Use made-up details and sample receipt files.

1. Submit a sample expense for **12.50**.
2. Submit another for **7.25**, using the same Google account and exactly the same name and payment details.
3. Back in your setup spreadsheet, choose **KY Claims → Refresh status**.
4. Open **Claims register**, then its **Claims** tab. Both entries should show **DONE**.
5. Open the weekly spreadsheet linked from either entry. It should contain two claim rows with a total of **19.75**.
6. Try [creating the weekly PDFs](#create-the-weekly-pdfs) and check the result.

In a brand-new event, these should be receipts **1** and **2**. If you already submitted a test, the next numbers will be used. Do not delete records to restart numbering. Keep preview testing in a separate event from real claims.

### 7. Give claimants the correct link

The **Claimant form** link is the link people use to submit expenses. The **Form editor** link is for finance to change form settings.

Share the claimant link only after activation and a successful sample submission. Before collecting real claims, ask your finance lead and technical helper to confirm that this preview meets the event's needs. The remaining limits are listed [below](#current-limits).

## Submit an expense

This section is for anyone claiming an expense.

1. Open the event's claim form link from your finance IC.
2. Sign in to the Google account you will use for this event's claims.
3. Fill in the details below, attach one receipt, and submit.
4. For another receipt, submit the form again.

| Form field | What to enter |
| --- | --- |
| Full name (as per NRIC) | Your name as it should appear on the voucher. **Do not enter your NRIC number.** |
| Bank A/c/PayNow | The payment details requested by your finance IC. |
| Purchase date (YYYY-MM-DD) | The date on the receipt. For example, 4 October 2026 is **2026-10-04**. |
| Item description | A short, clear description, such as **Stationery for camp games**. The event name is added automatically. |
| Amount (up to 2 decimal places) | A positive amount such as **12.50**. Do not add a currency symbol or commas. |
| Congregation | Choose your congregation if the question appears. If it does not appear, **Youth** is used automatically. |
| Receipt | One image or PDF within the size limit shown on the form. |

The form also collects your signed-in email address. Use the **same Google account and exactly the same name and payment details** for claims in the same week. Different accounts are treated as different people, even if the names match. Check the event's currency with finance; the system does not convert currencies.

The confirmation page means your response was received. It does **not** mean the claim has been checked, approved or paid. If you made a mistake or are unsure whether it was processed, contact your finance IC. **Do not submit the same expense again just because processing seems slow.**

## Check claims and find receipts

This section and the remaining sections are for the finance IC.

Open your setup spreadsheet and choose **KY Claims → Refresh status**. KY Setup shows the number of completed and incomplete claims. For individual details, open **Claims register → Claims**.

| Status in Claims | What it means | What to do |
| --- | --- | --- |
| **DONE** | The receipt has been filed and the weekly voucher updated. | Check the details. DONE does not mean approved or paid. |
| **PENDING** | Processing has started but has not finished. | Check again after processing finishes. If it stays pending, ask your technical helper before retrying. |
| **ERROR** | Processing stopped because something needs attention. | Read **Last error**. Fix the cause or ask your technical helper, then [retry](#retry-incomplete-submissions). |

Use each claim's receipt link to open the filed receipt, or its weekly spreadsheet link to open that person's voucher. You can also open **Claims folder** from KY Setup and find the person's folder. It contains their **Receipts** folder, weekly spreadsheets and exported PDFs.

If a response is missing from Claims, it may have been received but rejected before a claim record was created. Check the form's **Responses** tab and ask your technical helper to investigate. The counts in KY Setup cannot show responses that have no claim record yet.

### Receipt numbers

Receipt numbers run across **everyone in the event**. They do not restart for each person or week. For example, one person's voucher may contain receipts 1 and 3, while another person's contains receipt 2. The filed receipt is named with its number, such as **1.png** or **2.pdf**.

An event reference such as **CAMP26-000001** means receipt 1 for event CAMP26.

### How weeks work

A week runs from **Monday to Sunday, using Singapore time**. The week is based on **when the form was submitted**, rather than when the item was purchased.

For example, a claim submitted on 12 November 2026 belongs to the week starting **9 November 2026**, even if the purchase was in October. Each person has one voucher spreadsheet per submission week. More claims in that week update the same spreadsheet.

The voucher's Date currently shows the Monday of that week. Finance still needs to confirm the date to use for official submissions.

### Keep the records intact

Use the generated vouchers for review. Edits you make directly to a voucher can be replaced when the next claim arrives. Do not delete or change claim records, numbered receipts, hidden information or system-created tabs to fix an error. Ask your technical helper about corrections.

## Create the weekly PDFs

A PDF is the printable copy of a voucher. Create PDFs when you are ready to prepare the week's finance submission.

1. Open **Claims register → Claims** and check the current week's entries. Resolve incomplete claims before printing.
2. In your setup spreadsheet, choose **KY Claims → Export current-week PDFs**.
3. Open the **KY Results** tab. Check the exported, failed and skipped counts, then each person's result.
4. Open each **PDF** link. Check the claimant and payment details, receipt numbers, descriptions, congregation, amounts and total. Check every page, including the signature areas.
5. Print the checked PDFs for the finance submission.

The action creates a PDF for **each person with claims in the current Singapore week**, and saves it in that person's folder. People with no claims that week receive no new PDF. You cannot choose an earlier week from this menu yet.

If someone's claims are incomplete, their PDF is blocked so an expense is not left out. Other people's exports can still succeed. Read that person's error, resolve it and run the action again. If you are unsure how to fix it, ask your technical helper.

Each export saves a **new PDF file**. Earlier PDFs remain in the folder. If more claims arrive after you export, export again and check that you are printing the updated file. KY Results shows only the most recent retry or export action; the saved PDF files remain available in the claimant folders.

Creating or printing a PDF does not approve the claim or make a payment. Exports happen only when you choose this menu action; there is no automatic weekly export.

## Retry incomplete submissions

Use retry after the cause of a processing problem has been fixed. It asks the system to continue working on the original response.

1. Read **Last error** in the Claims register. Fix the cause or ask your technical helper for help.
2. Choose **KY Claims → Retry incomplete submissions**.
3. Read the results in **KY Results**.
4. Choose **Refresh status**, then check the affected Claims rows again. A successful claim should show **DONE**.

One run attempts up to ten incomplete responses. If more remain, run it again. Completed responses are skipped, and an existing claim keeps its assigned receipt number.

Retrying will not correct a wrong amount or settle conflicting name/payment details. Ask finance and your technical helper to review those cases. Do not delete a claim or submit a replacement unless they have told you how to handle it.

## Change event settings

### Choose the event folder

In KY Setup, paste the new normal Drive folder's link into **Event folder link (optional)**, then choose **KY Claims → 1. Prepare event / apply settings**.

For an existing event, this moves the same claims folder and its contents. Existing links and receipt numbers stay the same. Check **Claims folder** and **Parent event folder** afterward. Clearing the field later leaves the claims folder where it is; it does not move it back to My Drive.

Choose a folder with the intended finance access. Do not choose the claims folder itself or a folder inside it. If the move fails, check the link and your access, then try Prepare again in the same setup spreadsheet.

### Choose whether to ask for congregation

Before changing this setting, review any unprocessed responses with your technical helper. In KY Setup, change **Ask for congregation?**, then choose **KY Claims → 1. Prepare event / apply settings**.

Ticked means claimants must choose their congregation. Unticked means new claims use **Youth**. Already-recorded claims keep their recorded congregation. The Congregation column stays on the voucher in both cases.

### Start another event or change the finance IC

For another event, copy the **blank template**. Do not copy a spreadsheet containing another event's claims to give to the next finance IC.

If someone else will take over an existing event, arrange the handover with your technical helper. Sharing the spreadsheet or folder alone does not transfer the automatic claim processing to their account.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| No **KY Claims** menu | Open the prepared setup spreadsheet on a computer and reload it. If the menu is still missing, contact your technical helper. |
| A copied spreadsheet asks you to start setup | Choose **KY Claims → Start / open setup** in your copy. For a new event, use the blank template. |
| Google asks you to sign in | Use the event's operating account for finance tasks, or your claimant account when submitting a receipt. |
| The form is closed | Check that the receipt question and responder settings are correct, tick both checks in KY Setup, then choose **2. Activate form**. |
| Activation asks you to check the receipt or responder settings | Complete [step 4](#4-check-the-form), then tick the two checkboxes in KY Setup. |
| Activation says settings changed | Choose **1. Prepare event / apply settings**, then try **2. Activate form** again. Event code/title cannot change after preparation. |
| Someone cannot open the claim form | Check that they are using the right link and account. Review responder access in the form editor; ask your technical helper if organisation restrictions apply. |
| A claimant has a confirmation but no Claims entry | Check the form's Responses tab. Ask your technical helper to investigate; do not ask the claimant to submit the same expense again yet. |
| A claim says name or payment details conflict | Compare this week's entries with the claimant. Ask finance and your technical helper how to correct it; retry alone will not fix it. |
| The event folder cannot be opened or used | Check the folder link and whether the operating Google account can add files there. Keep using the same setup spreadsheet. |
| A PDF export failed or stopped partway | Check KY Results and the claimant folders for PDFs already created. Ask your technical helper if the cause is unclear. Another run creates new files. |
| A PDF has missing or cut-off text, a wrong total or a damaged layout | Do not print it for submission. Keep the PDF and ask your technical helper to investigate. |
| An error keeps coming back | Give your technical helper the action you chose, the error text and the approximate time. Avoid sharing real payment details or receipts in public messages. |

## Updates and older installations

Your technical helper should install software updates. Existing event copies do not update themselves when the blank template or repository changes. Keep using the same event files and records during an update.

If your existing event is operated from a code editor and has no KY Claims spreadsheet menu, ask your technical helper to use the [standalone setup and test guide](form-pipeline-test.md). Moving that event into the new setup spreadsheet needs a separate review; copying its settings into a new spreadsheet is not an upgrade.

## Current limits

This preview supports one event per setup spreadsheet and one receipt file per form response. It prepares vouchers but does not approve claims, track payments, make payments or convert currencies. There is no general screen for correcting or cancelling claims, and the PDF menu covers the current week only.

Very long item descriptions can stop voucher processing and affect later claims for that person in the same week. Keep descriptions brief and contact your technical helper if this occurs; repeatedly retrying does not fix the text.

The copied-workbook workflow has passed testing with one operating Google account. Independent setup by another finance IC, multi-person PDF batches, access across accounts and simultaneous submissions still need further checks. See the [validation record](live-validation.md) for the exact evidence. Agree the remaining date, correction and printing requirements with finance before official use.
