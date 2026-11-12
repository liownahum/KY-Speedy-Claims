# Implementation iterations

Source code, tests, documentation, build scripts, and the Apps Script manifest (`src/appsscript.json`) are versioned together. Generated bundles can be rebuilt from a checkout; updating the repository does not update a Google Apps Script project automatically.

| Commit | Iteration | Validation |
| --- | --- | --- |
| f059c70 | Voucher PDF fixes after Drive v2/v3 and Congregation validation fixes | User confirmed one-line and long native voucher exports. See [live validation](live-validation.md) for build attribution and evidence. |
| 8f2ea35 | Record the accepted voucher samples and remaining scope | Documentation only; no additional native test implied. |
| e3554fe | First Google Form submission pipeline, setup, register, receipt routing, weekly rebuild, retry, and PDF helper | 86 individual local checks. First native setup stopped when reading an absent response destination. |
| 0329e37 | Handle the new form's missing response destination before linking its register | 89 individual local checks plus passing GitHub checks. Corrected native setup rerun and browser-submitted claims remain pending. |

The corrected pipeline bundle at 0329e37 has source fingerprint prefix `a54df2ed92a3`. The preceding bundle at e3554fe has prefix `33037b30cdf8` and contains the setup bug. The fingerprint covers the combined script and manifest; the generated Code.gs header contains its full value.

## Reproducing an iteration

Check out the desired commit in a separate checkout if retaining a newer working copy, then run:

```sh
npm run check
npm test
npm run bundle -- /absolute/output/folder --pipeline
```

For the original voucher-only guide, omit `--pipeline`. The bundle contains Code.gs, appsscript.json, and START-HERE.md. The manifest defaults to Advanced Drive v2 and includes Forms and trigger-management permissions in pipeline iterations. Keep the script and manifest from the same source revision when installing.

Follow the [form pipeline test guide](form-pipeline-test.md) for the next native test. Real event Script Properties, claims, uploads, payment details, and credentials belong in the finance IC's restricted Google workspace; they are not repository configuration. The local agent handoff is intentionally ignored by Git.
