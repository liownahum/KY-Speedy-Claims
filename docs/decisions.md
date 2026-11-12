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

## Proposed choices awaiting confirmation or prototype evidence

| ID | Topic | Proposed default | What must be resolved |
| --- | --- | --- | --- |
| P01 | Claim week | Monday-Sunday, Asia/Singapore; week based on submission timestamp | Confirm boundaries, cutoff, and late-claim treatment. |
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
| P15 | PDF pagination | A4 portrait, fit to width at readable size, with multiple pages as needed | Test page breaks, repeated table headings, and keeping totals/signatures together. The single-page blank-template test is not a requirement to compress every voucher onto one page. |

## Immediate inputs needed

1. Which base layout to use in production and how to handle long descriptions.
2. Any specific finance requirements for page breaks and repeated headings on longer printed vouchers.
3. What date belongs in the voucher's Date field.

The source template, printed/PDF output requirement, and dynamic input-row rule have been received. There is no outstanding question about what happens at the original template's last input row: add another input row. See [voucher template findings](voucher-template.md) for verified details and limitations.

Resolve remaining operational questions before implementing the affected behaviour. Work on documentation and account/template feasibility can proceed in parallel with these decisions.
