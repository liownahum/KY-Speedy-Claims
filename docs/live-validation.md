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

The user then observed that PDF export generated only the latest claimant's PDF and clarified that it must cover all people with claims in the current week. At the time of that report, the batch-export change had local tests only. The single-account native run below subsequently exercised its one-claimant path; multi-person batch coverage remains outstanding. The earlier user report does not establish simultaneous submissions, upload ownership/access boundaries, retries after interrupted processing, or an independent second-IC installation.

## Browser-assisted native integration run — 13 November 2026

The user explicitly authorised browser-assisted testing, personally signed in and completed Google's permission review, and later chose to finish with that account only. The assistant operated the actual Apps Script, Forms, Drive, Sheets, and PDF-preview interfaces in a newly created, separate test event. All names, payment details, descriptions, and receipt images were fictional. This is directly observed native evidence, rather than a local service substitute or a script-created FormResponse.

- Source commit: `8e8eade98a374ba6d2d853e21121ffe57c43c541`.
- Installed bundle fingerprint: `071a8392e8420370ddc53a303f2dbbb8e4e008f59c282f02e7fe7220a18d070a`.
- The installed `Code.gs` was copied back through the editor and matched the supplied 52,500-character bundle exactly after newline normalisation. The installed manifest matched the supplied manifest as parsed JSON, including Advanced Drive v2 and the Singapore timezone.
- The upload question was added through the editor: Required, one file, Image/PDF, 10 MB. Email collection was explicitly changed from Responder input to Verified; repeated responses remained enabled.
- Private screenshots, copied synthetic register/voucher ranges, and before/after recovery evidence were retained outside the repository. Account identifiers and private resource links are intentionally omitted here.

| Case | Observed result | Scope |
| --- | --- | --- |
| Fresh setup and activation | Setup completed, linked the response destination, and activation reported ACTIVE. | Separate standalone project; no missing-destination exception. |
| Two actual browser submissions | Amounts 12.50 and 7.25 reached DONE with receipt numbers 1 and 2. | Same verified account and identical fictional name/payment details. |
| Weekly workbook reuse | Both Claims rows linked to the same workbook; it contained exactly two claim rows and total 19.75. | One person in one submission week. |
| Purchase date versus submission week | October purchase dates submitted on 13 November routed to week starting 2026-11-09. | Does not test crossing Monday midnight. |
| Receipt routing | Drive showed 1.png and 2.png in the saved claimant Receipts folder. | Same-account access; cross-account ownership/access was not established. |
| Completed retry scan | Retry returned an empty result; the two completed records remained unchanged. | No pending work at that point. |
| Repeated setup/activation | Setup retained the same resource links and ACTIVE state; the trigger page showed exactly one onClaimFormSubmit trigger after reactivation. | Trigger visibility under the operating account. |
| Existing-root relocation | Applying a normal Drive parent-folder link moved the same claims root into that folder; saved resource links were retained and a later browser submission was processed. | Own-account folder; initial creation under a parent and shared-folder permissions remain separate cases. |
| Controlled render failure | Temporarily renaming only the installation's disposable template worksheet caused receipt 3, amount 0.25, to record ERROR with the expected missing-template message after filing its receipt. | The official master was not edited. This is not a timeout or uncertain-write test. |
| Incomplete-week export safeguard | While claim 3 was incomplete, export reported zero PDFs and one failed claimant rather than omitting the claim. | One claimant; isolation of another claimant's successful export was not tested. |
| Recovery after restoration | Restoring the worksheet name and retrying the original response reached DONE with the same receipt number 3, receipt-file link, and weekly workbook link. The workbook had exactly three claim rows and total 20.00; Drive showed one numbered receipt file for each of 1, 2, and 3. | Tests recovery from this specific post-filing render failure. The template copy was restored and saved. |
| PDF export and retained revisions | Revision 2 exported two claims/19.75; revision 3 exported three claims/20.00. Both files remained in the claimant folder. Each preview showed one page with the expected claims, total, headers, and signature areas. | Single-claimant batch path; visual browser preview, not a physical print or measured paper-size check. |

No production code changes were needed for these scenarios. The long-description failure found in the preceding local review remains unresolved and was not exercised in this native run. These passes do not establish multi-person batch export, simultaneous submissions, every failure boundary, or production readiness.

## Guided workbook native run — 13 November 2026

After the user requested simpler deployment, a separate private blank spreadsheet was prepared with the new bound installer. The user completed Google's permission review. A test copy was then created using Google Sheets **Make a copy**, under the same operating account. No code or manifest was pasted into the copy. All claim/payment/receipt content was fictional.

- Source: local guided-installer changes based on commit `8e8eade98a374ba6d2d853e21121ffe57c43c541`.
- Installed bundle fingerprint: `4f1b9fc50b37eaab8f400dffa7e44708f2925b77a45f2dd0018b796df62378da`.
- The template's installed Code.gs was copied back through the editor and matched the 71,663-character supplied bundle after newline normalisation. The supplied manifest retained the existing scopes, Advanced Drive v2, and Singapore timezone.
- The source blank template and test copy remain private. Screenshots and copied ranges are retained outside the repository; account identifiers and resource links are omitted here.

| Case | Observed result | Scope |
| --- | --- | --- |
| Bound menu and initialisation | All six KY Claims actions appeared; Start / open setup created/reopened the interface. | Native Google Sheets; authorisation still requires the operator. |
| Blank-template copy | The copied workbook retained the bound menu and created its own form, register and root folder. | One account copying a blank controller; not a second IC or a configured-controller copy. |
| Guided preparation | Event code/title, an own-account normal parent-folder link, and congregation disabled were supplied in the sheet. Prepare populated event links and form-check instructions. | Initial preparation with a parent selected; no shared-folder/access-boundary test. |
| Activation guard | Before the two checkboxes were ticked, Activate displayed the receipt/responder-check message and did not activate. | Manual acknowledgements are required, but do not automatically verify every Form setting. |
| Form configuration and activation | Receipt upload was added manually: Required, one Image/PDF, 10 MB. Verified email was selected, repeat responses remained allowed, both checks were ticked, and Activate changed Stage to Accepting submissions. | Native form editor and workbook menu. |
| Actual browser submission | A 12.50 claim with an October purchase date reached DONE, number 1, event reference GSET261113-000001, week starting 2026-11-09, and Youth. | One claimant and one submission, delivered by the installed trigger. |
| Status and retry menus | Refresh showed one completed and zero incomplete records. Retry displayed No pending responses found in KY Results. | Empty retry scan; recovery evidence belongs to the earlier standalone run above. |
| PDF menu and preview | KY Results reported Exported 1, Failed 0, Skipped 0, with PDF/workbook links and total 12.50. Drive preview showed one page, one receipt row, total 12.50, headers and signature areas intact. | Single-claimant path and browser visual review; no physical print or multi-person batch test. |
| Source remained blank | After the copy processed its claim, the template still had blank event code/title/folder input, unchecked options/checks, no event links, and zero completed/incomplete counts. | Observed isolation for this blank-template copy. Local tests cover additional inherited-property and binding cases. |

All 150 individual local tests across ten files passed with this source, including 17 installer tests. The preview needs independent second-IC acceptance before the guided-setup milestone is closed. It does not fix the known long-description failure or settle production correction/date policies.

## Remaining work

These confirmations do not validate the complete claims workflow. Still outstanding:

- Multi-person batch PDF export, skipping people with no current-week claims, and per-person failure isolation.
- Receipt-upload ownership and permissions across accounts, plus independent installations under another account and copies of already-configured controllers.
- Recovery at additional failure boundaries, including timeouts and uncertain acknowledgements; the missing-template case above is narrower evidence.
- Native week-boundary evidence, including Monday midnight in Singapore and reuse across different weeks.
- Concurrent submissions, corrections, and the unresolved long-description failure.
- Congregation-mode changes and shared-folder access/relocation.
- Installation under a second finance IC's independent Google account.
- Any specific production continuation-heading requirements, long-name/description cases, and a fully documented native run matrix.

Each future PDF still requires its own print review; `needsPrintReview: true` remains intentional. The larger setup/account milestone remains open until the second-account and form-upload checks are completed.
