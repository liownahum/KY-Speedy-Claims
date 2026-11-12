# Official payment voucher template

Inspected on 12 November 2026 from the [user-supplied Drive file](https://docs.google.com/spreadsheets/d/1bV03-iPhOFeUaSI3ep75NaaCaXNzfeFH/edit). This is `YC Payment Voucher Template.xlsx`, an Excel workbook displayed in Google's Office editing mode, rather than a native Google Sheets master.

Finance requires a printed payment voucher. The application will retain the editable weekly document and export a PDF when the IC prepares a submission. Group means Congregation, as explicitly confirmed by the user.

The original was read and downloaded for inspection only. It was not edited, converted, moved, or added to the repository. These findings are a snapshot, not proof that future source versions have the same layout.

## Workbook inventory

| Worksheet | Visibility in inspected source | Intended use |
| --- | --- | --- |
| Payment Voucher (Half) | Visible | 7 claim rows |
| Payment Voucher (full) | Visible | 30 claim rows |
| Claim Voucher (full) | Hidden | Other form; exclude from payment voucher output |
| Claim Voucher (half) | Hidden | Other form; exclude from payment voucher output |
| Petty Cash Voucher (half) | Hidden | Other form; exclude from payment voucher output |

The PDF export must identify the selected payment-voucher tab explicitly; exporting the whole workbook is unsuitable.

## Field mapping

Addresses below refer to the supplied source version. Check the labels, sheet names, and totals formula before writing to a converted or copied version. Refuse a mismatched template rather than guess.

| Meaning | Half-page worksheet | Full-page worksheet |
| --- | --- | --- |
| Date input | H5 | H6 |
| Pay to / full name | C7, with underline extending through E7 | C8, with underline extending through E8 |
| Bank A/c/PayNow input | G7, with underline extending through H7 | G8, with underline extending through H8 |
| Column headings | B9, C9, G9, H9 | B10, C10, G10, H10 |
| Receipt numbers | B10:B16 | B11:B40 |
| Description start cells | C10:C16, visually spanning C:F | C11:C40, visually spanning C:F |
| Congregation | G10:G16 | G11:G40 |
| Amount | H10:H16 | H11:H40 |
| Total formula | H17 | H41 |
| Prepared by input area | D19:E19 | D43:E43 |
| Payment approved by area | G19:H19 | G43:H43 |
| Verified by input area | D21:E21 | D45:E45 |
| Proposed PDF range | B1:H21 | B2:H45 |

The header labels must remain exactly as supplied, including `R No.`, `Congregation`, and `Bank A/c/PayNow:`. The full name instruction requests the name as per NRIC; it does not call for collecting an NRIC number.

Description regions and header input spans are not merged in the exported workbook. Text placement must be visually tested when adjacent cells are populated. Do not assume wrapping a single C-column cell will use the width through F, or merge cells silently as a layout workaround.

## Formulas and congregation validation

The half-page total is `IF(SUM(H10:H16)>0,SUM(H10:H16),"")`. The full-page total is `IF(SUM(H11:H40)>0,SUM(H11:H40),"")`. Preserve the existing formulas and check both numeric total and printed amount after filling.

The full-page Congregation list is sourced from X10:X16: Cantonese, Children, English, General, Mandarin, Woodlands, Youth. These are inspected source values, not a decision that every event must offer every option.

The half-page validation references X10:X17, but those cells were empty in the downloaded source. Its dropdown cannot be assumed equivalent to the full-page version. Verify the intended list before enabling that layout. Do not repair the official master during setup.

Column X is a helper area, not part of the printable payment voucher.

## Print-export evidence

Two read-only exports were inspected:

| Export | Result |
| --- | --- |
| Generic workbook PDF export | 3 pages, 612 x 792 points (Letter); includes both visible vouchers and splits the full voucher from its total/signature area. |
| Explicit full-voucher sheet/range with A4 and fit-to-page | 1 page, approximately 595 x 842 points (A4); title, 30-row table, total, and signature areas intact in visual review. |

The source's Google print preview for the full tab also showed A4, portrait, fit-to-page and one page. This differs from generic export defaults, so production must set export parameters explicitly.

The tested public-source export used sheet gid `314912145`, range `B2:H45`, portrait A4, fit-to-page (`scale=4`), no gridlines, sheet names, or added print titles. Its range coordinates were `r1=1&c1=1&r2=45&c2=8` (zero-based start and exclusive end). The half tab's source gid is `621633474`. A copied or converted workbook may have different gids; resolve them from the actual worksheet rather than hardcode these source IDs in production.

These are observed export results, not a guarantee of filled-document fidelity. The test was a blank original. Do not represent it as a completed claim or production-ready export.

## Proposed output behaviour

1. Keep the editable document for the claimant and week.
2. Let the IC prepare a submission and explicitly export its voucher PDF.
3. Use a deterministic, human-readable file name based on event, claimant, week, and revision. Choose the naming rule before implementation.
4. Record the PDF file ID, source revision, export time, covered receipt references, and total in the register.
5. Preserve earlier submitted PDFs; make corrections a new traceable revision.
6. Leave approval and verification signatures to the proper signatories. Printed signature lines must remain visible.

Full-page is proposed for the first filled prototype. Production sizing, overflow, voucher-date meaning, and correction/closure rules are still open. If capacity is exceeded, require the agreed continuation/split policy; do not insert rows, truncate claims, or silently shrink the standard form.

## Remaining prototype checks

- Create a disposable working copy and validate any conversion to native Google Sheets against this original.
- Fill a synthetic name, clearly fictional payment placeholder, date, Congregation, and two receipt rows. Confirm total and one-page PDF visually.
- Test long descriptions and names, decimal amounts, final available row, and capacity overflow.
- Verify the half-page layout independently if it is selected for production.
- Test installation and uploads using a second IC account.

Google's [PDF generation example](https://developers.google.com/apps-script/samples/automations/generate-pdfs) documents template population and sheet/range export. It is a reference for the eventual implementation; its email-sending behaviour is not required here.
