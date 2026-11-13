# Guided setup workbook

This preview moves event setup and routine finance actions into a Google Sheets menu. Each event uses its own copy of a **blank workbook with its own bound Apps Script project**. Finance ICs using a prepared template do not paste code, set Script Properties, or use the Apps Script function selector.

Google authorisation and the receipt-upload question still require the operating finance IC's participation. This interface does not resolve the existing production Date/correction decisions or the long-description issue; use fictional claims during preview validation.

## Finance IC: start an event

1. Obtain the blank setup-workbook template from the maintainer and make your own copy in Google Drive. Use desktop Google Sheets. Do not copy an event workbook containing finance results to distribute as a template.
2. Open your copy. Choose **KY Claims → Start / open setup**. Complete Google's authorisation review under the account that will operate the event. If the menu is missing, reload the spreadsheet after the bound script has been installed.
3. In **KY Setup**, fill the blue cells: event code, event title, optional event-folder link, and whether to ask for congregation. Event code/title are fixed once preparation starts. An unchecked congregation box uses Youth automatically.
4. Choose **KY Claims → 1. Prepare event / apply settings**. The Stage, Next step, and event links appear below your settings. If interrupted, fix the displayed cause and run Prepare again in the same copy; retain existing resources and settings.
5. Open **Form editor**. Add exactly one **File upload** question named **Receipt**: Required, maximum one file, Image/PDF, suitable size limit. In Responses settings, select **Verified** email collection, allow repeat responses, and check responder access. Tick both manual-check boxes in KY Setup only after checking these settings. The program detects an upload question but cannot verify all these editor settings.
6. Choose **KY Claims → 2. Activate form**. Stage should become **Accepting submissions**. If you edited event settings after Prepare, apply them with Prepare before activating.
7. Open **Claimant form**, submit a fictional receipt, then use **Refresh status** and the **Claims register** to check processing reaches DONE. The form's confirmation alone is not proof of processing.

Only the claimant form link is intended for claimants. The setup workbook, form editor, register, folders, and results are finance resources. A selected parent folder can confer access through its sharing settings; use the intended finance access.

## Routine actions

| Menu action | Result |
| --- | --- |
| Start / open setup | Initialise a new copy or reopen the existing setup without overwriting its settings. |
| Prepare event / apply settings | Create/resume event resources and apply folder/congregation settings. |
| Activate form | Check the two manual acknowledgements, install/reuse the submission trigger, and open the form. |
| Refresh status | Refresh links and counts of completed/incomplete processed Claims records. Invalid responses can fail before a Claims row exists; check raw responses if a submission is missing. |
| Retry incomplete submissions | Attempt the next existing retry batch. KY Results shows outcomes; no pending responses is reported explicitly. Invalid answers or conflicting payment details still need review. |
| Export current-week PDFs | Run the existing weekly batch. KY Results shows each person's status, PDF/workbook links, claim count, total, and errors. Inspect every PDF before printing. |

KY Results shows the latest retry/export action only. PDF snapshots themselves remain in the claimant folders. Weeks still use submission time, Monday–Sunday in Singapore. The detailed claim rules and limits in the [User Guide](UserGuide.md) are unchanged.

## Copies and existing installations

A copied controller must be initialised with **Start / open setup** before its other actions work. The workbook/script binding prevents the copy from operating the original event through the guided actions. Where copied project properties contain an original installation's IDs, initialisation clears only this copy's recognised installation properties and displayed results; it does not delete or alter the original event's resources. Same-project or inconsistent bindings stop for review instead of resetting event state. Unknown project properties and unrelated worksheets are preserved.

These are accidental-reuse guards, not access controls against an editor who changes the source or internal state. Restrict editor access appropriately. Trigger ownership and an independent installation under a different finance IC still require their own native acceptance tests.

The existing standalone installation remains supported. It cannot become spreadsheet-bound simply by moving its project file. Do not copy its internal configuration into a new controller: migration/handover of an existing event is separate work. Use a separate synthetic event for this preview.

## Maintainer: prepare the blank template once

1. Build the installer bundle from this repository:

   ```sh
   npm run check
   npm test
   npm run bundle -- --installer
   ```

   The default output is ignored `local/setup-workbook/`. It contains Code.gs, appsscript.json, and this guide as START-HERE.md. The installer flag chooses the guide/default directory; all bundles contain the same runtime modules.

2. Create a blank Google spreadsheet, choose **Extensions → Apps Script**, and install the complete Code.gs and matching manifest in that bound project. The supplied manifest includes Advanced Drive v2 and the existing service scopes. No web-app deployment is needed.
3. Reload the spreadsheet. Choose **KY Claims → Start / open setup** to create its interface. Leave event code/title blank and do not prepare a real event in the distribution template.
4. Make a test copy and initialise that copy. Validate its menu, authorisation, independent resource IDs, actual browser submissions, retry and PDF actions. Keep the distribution template blank.
5. Share the blank template only with the intended audience after its access and distribution are approved. A private template's `/copy` link does not itself grant someone access. Provide its verified copy link to finance ICs; do not require them to author source code.

The bound script is copied with its container according to [Google's bound-script guide](https://developers.google.com/apps-script/guides/bound). Menus use a simple [onOpen trigger](https://developers.google.com/apps-script/guides/triggers), which only creates menu items; resource creation waits for an authorised menu action. Installable submission triggers run under their creator, as described in [Google's trigger guide](https://developers.google.com/apps-script/guides/triggers/installable).

## Implementation and validation

`src/SetupWorkbook.gs` supplies the menu, owned worksheet layout, copy-binding guard, settings adapter, status, and results. Pipeline setup/activation retain public locked entry points and expose internal functions for the installer to call while already holding the same lock. A script-binding guard in configuration reads rejects inherited IDs from another guided project, including direct calls to legacy pipeline entry points. No new scopes or scheduled triggers are added.

Local tests exercise invalid/immutable settings, copy isolation and resets, reserved-sheet preservation, interrupted preparation, activation acknowledgements, result links/escaping, counts and empty retry scans. These substitutes do not establish native copy behaviour, authorisation, or second-account operation. Record observed native results separately in [live validation](live-validation.md).

On 13 November 2026, a private blank template was copied through Google Sheets and its copy passed preparation, guarded activation, an actual browser claim, status refresh, an empty retry scan, and a one-claim/12.50 PDF export through the menu. No source code was pasted into the copy, and the blank template retained empty event settings and links. This was one operating account; independent second-IC installation and copies of already-configured controllers remain separate acceptance cases. See the [native evidence and build attribution](live-validation.md#guided-workbook-native-run--13-november-2026).
