# Live voucher validation

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

## Remaining work

This confirmation does not validate the complete claims workflow. Still outstanding:

- Google Form creation/copying, receipt-upload ownership/routing, and a real submission trigger.
- Event-wide receipt number allocation and retry-safe processing.
- Creating/reusing claimant folders and weekly vouchers across multiple submissions.
- Concurrent submissions, corrections, and recovery after interrupted live processing.
- Installation under a second finance IC's independent Google account.
- Any specific production continuation-heading requirements, long-name/description cases, and a fully documented native run matrix.

Each future PDF still requires its own print review; `needsPrintReview: true` remains intentional. The larger setup/account milestone remains open until the second-account and form-upload checks are completed.
