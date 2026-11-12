# Manual live test

## Updating an existing test project

Replace the entire Code.gs contents with the newly bundled Code.gs. Do not add it alongside the old script, since the bundle already combines all three source files. Save and rerun runVoucherPrototype. Keep your existing script properties.

Both Drive API v2 and v3 are supported. If the Services dropdown only offers v2, keep v2 and identifier Drive. There is no need to find v3 or create a new project. The updated code selects v3 create when available, or v2 insert with explicit conversion when that is the installed version. It selects the method before uploading and does not retry a failed upload through the other API.

## First run in a new project

1. Sign in to the Google account intended to own the test. Open [Google Apps Script](https://script.google.com/) and create a new project named KY Speedy Claims - Prototype.
2. Replace all text in the default Code.gs with the complete bundled Code.gs. Do not also add the repository's three source files separately.
3. Open Project Settings, enable Show appsscript.json manifest file in editor, then open appsscript.json in the editor and replace it with the bundled manifest. Save. This manifest uses Drive API v2; an existing v3 configuration also works.
4. Confirm Drive API appears under Services with identifier Drive. If needed, add Drive API v2. This is the Drive API service, not Drive Activity API. If you use a standard Google Cloud project, also enable Drive API in that project's Cloud console.
5. Select runVoucherPrototype, click Run, and complete Google's authorisation flow after reviewing the requested Drive, Sheets, and PDF-export access. No deployment is required.
6. Open the workbook and PDF links in the Execution log. The default sample has one claim, receipt number 1, and total 12.50. Expect one input row, followed by the total and blank signature areas. The name/payment fields say SAMPLE. This is not a submission voucher.

## Larger runs

In Project Settings > Script properties, set PROTOTYPE_CLAIM_COUNT to the desired size, save, and run the function again. Each run creates a new sample.

| Claim count | Expected total | Purpose |
| --- | --- | --- |
| 1 | 12.50 | Remove surplus rows |
| 31 | 392.15 | Insert a row beyond the original 30 |
| 75 | 965.25 | Inspect multi-page printing |

Receipt numbers intentionally have gaps and must not be renumbered. Review all PDF pages for readability, missing/repeated claims, and awkward breaks around the total/signature area. The exporter requests A4 portrait and fit-to-width, not forced single-page output.

## Report results

Send the exact execution error if a run fails. For a successful run, share the PDF (upload it or provide an accessible link), confirm the Congregation dropdown works, and confirm the original template is unchanged. Do not include passwords or authorisation tokens.

`TypeError: Drive.Files.create is not a function` in the old bundle means it called the v3 method against a service without that method. Replace Code.gs with the updated bundle; keep v2 if that is available in your project. An absent/incompatible service now produces a clear setup message before creating an output folder.

The default source is the supplied XLSX template. Each run creates uniquely named sample resources in a new folder unless PROTOTYPE_OUTPUT_FOLDER_ID names an existing destination. Incomplete copies are retained for diagnosis. This is a developer-run prototype, not the final finance IC setup experience. Full scope and remaining checks are in [the prototype guide](https://github.com/liownahum/KY-Speedy-Claims/blob/main/docs/prototype.md).

Only each finance IC needs a script installation. Claimants will use the eventual Google Form; they do not need script copies. The planned Setup Workbook will copy its script with it, after which the IC authorises their copy and installs its own trigger. Merging repository changes does not update a script already pasted into Google.
