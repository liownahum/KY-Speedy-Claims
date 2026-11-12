# Live validation

## Confirmed result

On 12 November 2026, the user confirmed that both the one-line export and a long export work in a live Google Apps Script run after the PDF-header fixes. This accepts the current voucher prototype's rendering/export path for those manually tested cases.

- Corresponding latest delivered source: `f059c70fdaf2b776ce86abb32d1c819152426981`.
- Delivered script/manifest bundle fingerprint: `b591b9bb8f8ee25f229cb29fee42091b5e4e0104faa11c6c93764a2ac0be7046`.
- User-supplied [live-test evidence folder](https://drive.google.com/drive/folders/1-d7m0tfXrUrtL9QTDAZ9Ssc4dbYwk7Wl).
- Evidence attribution: user-run manual validation. The folder required Google sign-in from the assistant's browser, so its files were not independently inspected or copied into this repository.

| Case | Result | Scope |
| --- | --- | --- |
| One-line voucher | User confirmed working | Short export after removing unused input rows and correcting header layout |
| Long voucher | User confirmed working | Expanded voucher export; exact claim count not specified |

The build reference identifies the latest supplied code at the time of confirmation. It is not a claim that the user independently checked a source hash. No assumption is made that the long run contained exactly 31, 75, or 200 claims.

## Issues covered by this iteration

The live-test sequence exposed and corrected Drive v2/v3 import compatibility, the stale Congregation validation rule during row deletion/writes, and duplicated/clipped PDF headings. The final confirmation followed the replacement script that disables frozen-row repetition and sizes title rows appropriately.

The same source has 46 passing local tests covering row-count boundaries, cent totals, receipt identities, strict dropdowns, original-template protection, import branches, and PDF request/error handling. Local service-model tests remain separate from native visual evidence.

## Multi-person pipeline report

On 12 November 2026, the user reported testing multiple people and said folder handling/numbering and receipt numbering appeared to work. The latest delivered code at that point was the optional-congregation bundle with source fingerprint prefix `10e408dbd6e1`, based on `aad77d7` plus local congregation-switch changes. The exact installed fingerprint, claimant count, and receipt counts were not independently confirmed. This is user-run manual evidence, not an assistant inspection of the protected Google resources.

The user then observed that PDF export generated only the latest claimant's PDF and clarified that it must cover all people with claims in the current week. That batch-export change is now implemented locally but has not yet been validated in Google. This report does not establish simultaneous submissions, upload ownership/access boundaries, retries after interrupted processing, or an independent second-IC installation.

## Remaining work

These confirmations do not validate the complete claims workflow. Still outstanding:

- Batch PDF export for every current-week claimant, including skipping people with no current-week claims.
- Receipt-upload ownership and permissions, plus form copying for independent installations.
- Retry-safe number allocation and recovery without duplicate rows/files after failures.
- A detailed native run record for weekly workbook reuse and week boundaries.
- Concurrent submissions, corrections, and recovery after interrupted live processing.
- Installation under a second finance IC's independent Google account.
- Any specific production continuation-heading requirements, long-name/description cases, and a fully documented native run matrix.

Each future PDF still requires its own print review; `needsPrintReview: true` remains intentional. The larger setup/account milestone remains open until the second-account and form-upload checks are completed.
