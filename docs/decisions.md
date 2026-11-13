# Decision log

Use this log to preserve both the current choices and the questions that still need answers. A recommendation in a conversation is not automatically an approved requirement.

## Confirmed choices

| ID | Decision | Reason / evidence |
| --- | --- | --- |
| D01 | Each event is an independent installation managed by its finance IC. | User requirement: different ICs manage different events independently. |
| D02 | Preserve the official claim template's labels, column layout, styling, totals, and signature sections; allow the input-row resizing in D10. | User supplied the YC Payment Voucher Template.xlsx Drive link and clarified row resizing on 12 November 2026. |
| D03 | Maintain a separate weekly claim spreadsheet for each claimant. | User's specified folder and weekly-document workflow. |
| D04 | Store receipt images under the claimant's receipts subfolder. | User requirement. |
| D05 | Receipt numbering is shared across all people within one event, starting at 1. | User explicitly selected separate sequences per event on 12 November 2026. |
| D06 | Identify receipts across events by event code + receipt number. | Selected with D05. Event codes must be distinct wherever records are combined. |
| D07 | Use KY-Speedy-Claims as the project repository. | User supplied this repository to begin the project. |
| D08 | Export payment vouchers as PDF for printing and physical submission. | User confirmed the finance department requires printed vouchers on 12 November 2026. PDF export is needed when preparing a submission. |
| D09 | The previously described Group field means the template's Congregation field. | User explicitly selected this mapping on 12 November 2026. Preserve the official Congregation label. |
| D10 | The weekly voucher has exactly one input row per included claim: delete unused input rows and add rows when needed. Move totals/signatures accordingly and update formula/print ranges. | User explicitly clarified that one claim needs one input row and more claims require added rows on 12 November 2026. Original row counts are not limits. |
| D11 | Accept the supplied voucher prototype's one-line and long PDF export cases as manually validated in Google Apps Script. | User confirmed both work on 12 November 2026 and supplied the test folder. See the live validation record for build attribution and scope. |
| D12 | Group claims by submission week, Monday–Sunday in Asia/Singapore, rather than purchase date. | User selected submission week for the pipeline test on 12 November 2026. Purchase date is stored separately. |
| D13 | Control the Congregation question with `PIPELINE_ASK_CONGREGATION`: true shows the question; missing/null/false removes it and assigns Youth automatically. Keep the official voucher's Congregation column. | User requested this Script Property switch on 12 November 2026. |
| D14 | A weekly PDF export covers every person with claims in the current submission week, saving each person's PDF in their own folder. People without claims that week receive no output. | User clarified batch PDF completion on 12 November 2026 after the previous helper exported only the latest claimant. |
| D15 | Allow a normal Drive folder, including a shared folder, as the event's parent location through `PIPELINE_PARENT_FOLDER_ID`. Keep claims in a dedicated subfolder alongside the event's planning documents. | User requested a configurable event location and confirmed a normal Drive folder, possibly shared, on 12 November 2026. |
| D16 | Proceed with simpler deployment through a guided, copyable Setup Workbook, keeping Google authorisation and the manual receipt-upload step visible. | User accepted this next implementation step on 13 November 2026 after the single-account integration tests. Native copy and independent-account acceptance remain separate evidence. |
| D17 | Expense categories belong to one event and are entered by finance during event setup. Claimants select the category and Hardcopy/E-receipt on the form. | User clarified Games/Decor/etc. are categories within one event, chose claimant selection, and requested an event-specific list at startup on 13 November 2026. The existing tracker's columns were supplied; its sheet and complete category-letter mapping have not yet been supplied. |

## Proposed choices awaiting confirmation or prototype evidence

| ID | Topic | Proposed default | What must be resolved |
| --- | --- | --- | --- |
| P01 | Week closure | Submission-week grouping is confirmed in D12 | Decide any additional operational cutoff, closed-week handling, and exceptions. |
| P02 | Submission unit | One receipt per submission and one claim row | Confirm whether split allocations or several separate receipts are required. |
| P03 | Identity | Verified email, or a stable member ID | Confirm available accounts and whether anyone submits on another person's behalf. |
| P04 | Payment information | Collect full name and Bank A/c/PayNow details; snapshot them into each weekly document | Decide how repeated/conflicting details and updates are reviewed. Collect the name as stated on the template, not an NRIC number. |
| P05 | Uploads | Required images; optional PDF / multiple pages if needed | Confirm allowed formats, file limits, and page naming. |
| P06 | Setup packaging | Copyable Setup Workbook with attached Apps Script and a guided setup action | Prototype copy behaviour and authorisation under a second account. |
| P07 | Number display | Six-digit display such as 000001 | Confirm what the official document permits. Do not force a prefix into a numeric-only field. |
| P08 | Closure/corrections | Closed weekly documents require a recorded correction path | Agree approval/payment states and who may reopen a week. |
| P09 | Currency | One configured currency per event | Confirm whether foreign-currency receipts or conversion records are required. |
| P10 | Documentation website | GitHub Pages handbook using repository documentation | Decide publication timing and content visibility; no site is published yet. |
| P11 | Template distribution | Preserve supplied XLSX master in Drive and pin its version | Validate conversion of a working copy to native Sheets. Confirm redistribution before adding the template file itself to the public repository. |
| P12 | Base layout | Use the full-page voucher as the initial layout for the prototype, resized per D10 | Choose the production base layout; its original 30 rows do not impose a limit or require switching to a separate voucher. |
| P13 | Voucher date | Explicit date at PDF preparation | Confirm whether finance expects preparation date, submission date, or week-ending date. |
| P14 | PDF snapshots | Generate on demand and retain each submitted revision | Define re-export naming and how later corrections are linked to earlier submissions. |
| P15 | Production PDF pagination | Prototype uses A4 portrait, fit to width, and no frozen-row repetition; user accepted the supplied short/long samples | Any additional continuation-heading requirements and full native boundary/text cases remain separate from acceptance of those samples. |

## Immediate inputs needed

1. Which base layout to use in production and how to handle long descriptions.
2. Any specific finance requirements for page breaks and repeated headings on longer printed vouchers.
3. What date belongs in the voucher's Date field.

The source template, printed/PDF output requirement, and dynamic input-row rule have been received. There is no outstanding question about what happens at the original template's last input row: add another input row. See [voucher template findings](voucher-template.md) for verified details and limitations.

Resolve remaining operational questions before implementing the affected behaviour. Work on documentation and account/template feasibility can proceed in parallel with these decisions.
