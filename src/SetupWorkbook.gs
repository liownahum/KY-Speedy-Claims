/** Bound-spreadsheet interface. Each copied workbook must own a separate script project. */
var KY_SETUP_VERSION_ = '0.2.0-preview.2';
var KY_SETUP_SHEET_ = 'KY Setup';
var KY_RESULTS_SHEET_ = 'KY Results';
var KY_CATEGORIES_SHEET_ = 'KY Categories';
var KY_SETUP_MARKER_ = 'KY_SETUP_V1';
var KY_SETUP_OWNED_PROPERTIES_ = [
  'KY_SETUP_SCRIPT_ID', 'KY_CLAIM_PIPELINE', 'KY_CLAIM_RETRY_CURSOR',
  'PIPELINE_EVENT_CODE', 'PIPELINE_EVENT_TITLE', 'PIPELINE_PARENT_FOLDER_ID',
  'PIPELINE_ASK_CONGREGATION', 'PIPELINE_TEMPLATE_ID', 'PIPELINE_CATEGORIES'
];

// Simple trigger: create the menu only; never create resources or request access here.
function onOpen() {
  SpreadsheetApp.getUi().createMenu('KY Claims')
    .addItem('Start / open setup', 'initializeClaimSetupWorkbook')
    .addSeparator()
    .addItem('1. Prepare event / apply settings', 'prepareClaimEvent')
    .addItem('2. Activate form', 'activateClaimEvent')
    .addItem('Refresh status', 'refreshClaimSetup')
    .addSeparator()
    .addItem('Retry incomplete submissions', 'retryClaimEvent')
    .addItem('Export current-week PDFs', 'exportClaimEvent')
    .addToUi();
}

function claimSetupBook_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('Open the setup workbook in Google Sheets and use its KY Claims menu.');
  return book;
}
function claimSetupSheet_(book) {
  var sheet = book.getSheetByName(KY_SETUP_SHEET_);
  if (!sheet || sheet.getRange('E1').getValue() !== KY_SETUP_MARKER_) {
    throw new Error('Choose KY Claims > Start / open setup first.');
  }
  if (sheet.getRange('E2').getValue() !== book.getId() || sheet.getRange('E3').getValue() !== ScriptApp.getScriptId()) {
    throw new Error('This workbook is a copy. Choose KY Claims > Start / open setup to initialise its own event.');
  }
  if (sheet.getRange('E4').getValue() !== 'READY') throw new Error('Setup layout is incomplete. Choose Start / open setup again.');
  var owner = PropertiesService.getScriptProperties().getProperty('KY_SETUP_SCRIPT_ID');
  if (owner !== ScriptApp.getScriptId()) throw new Error('Setup binding is incomplete. Choose Start / open setup again.');
  return sheet;
}
function claimSetupText_(sheet, address, value) {
  sheet.getRange(address).setValue(typeof value === 'string' ? VoucherCore.literal(value) : value);
}
function claimSetupResultsSheet_(book) {
  var sheet = book.getSheetByName(KY_RESULTS_SHEET_);
  if (sheet && sheet.getRange('J1').getValue() !== KY_SETUP_MARKER_) {
    throw new Error('A different worksheet already uses the name KY Results. Rename that worksheet before continuing.');
  }
  if (!sheet) sheet = book.insertSheet(KY_RESULTS_SHEET_);
  sheet.getRange('J1').setValue(KY_SETUP_MARKER_);
  sheet.hideColumns(10);
  return sheet;
}
function claimSetupCategoriesSheet_(book, reset) {
  var sheet = book.getSheetByName(KY_CATEGORIES_SHEET_);
  if (sheet && sheet.getRange('J1').getValue() !== KY_SETUP_MARKER_) {
    throw new Error('A different worksheet already uses the name KY Categories. Rename that worksheet before continuing.');
  }
  var create = !sheet;
  if (!sheet) sheet = book.insertSheet(KY_CATEGORIES_SHEET_);
  if (create || reset || sheet.getRange('J2').getValue() !== 'READY') {
    sheet.getRange('J1:J2').setValues([[KY_SETUP_MARKER_], ['BUILDING']]);
    sheet.getRange(1, 1, sheet.getMaxRows(), 2).clearContent();
    sheet.getRange('A1:B5').setValues([
      ['EVENT EXPENSE CATEGORIES', 'Fill the blue cells from row 6.'],
      ['Your event, your list', 'Examples: Games / G; Hospitality / H. Enter your own list below.'],
      ['One category per row', 'Use a different letter A–Z for each category. Leave blank only for events without categories.'],
      ['Apply the list', 'Choose KY Claims > 1. Prepare event / apply settings. Active forms allow additions only.'],
      ['Category name', 'Letter']
    ]).setWrap(true).setFontFamily('Arial').setVerticalAlignment('top');
    sheet.getRange('A1:B1').setBackground('#17365d').setFontColor('#ffffff').setFontWeight('bold');
    sheet.getRange('A5:B5').setFontWeight('bold');
    sheet.getRange('A6:B31').setBackground('#e8f0fe').setNumberFormat('@');
    sheet.setColumnWidth(1, 300).setColumnWidth(2, 520).setRowHeights(1, 4, 56);
    sheet.setFrozenRows(5);
    sheet.hideColumns(10);
    sheet.getRange('J2').setValue('READY');
  }
  return sheet;
}
function claimSetupCategories_(book) {
  var sheet = book.getSheetByName(KY_CATEGORIES_SHEET_);
  if (!sheet || sheet.getRange('J1').getValue() !== KY_SETUP_MARKER_) {
    throw new Error('Choose Start / open setup to create the KY Categories tab.');
  }
  if (sheet.getRange('J2').getValue() !== 'READY') throw new Error('The category table is incomplete. Choose Start / open setup again.');
  var count = Math.max(sheet.getLastRow() - 5, 0);
  var values = count ? sheet.getRange(6, 1, count, 2).getValues() : [];
  return ClaimCore.categories(values.filter(function (row) {
    return row.some(function (value) { return String(value).trim() !== ''; });
  }).map(function (row) { return { name: row[0], prefix: row[1] }; }));
}
function claimSetupLayout_(book, sheet) {
  sheet.getRange('E1:E4').setValues([[KY_SETUP_MARKER_], [book.getId()], [ScriptApp.getScriptId()], ['BUILDING']]);
  sheet.getRange('A1:C32').clearContent().setFontFamily('Arial').setFontSize(11).setVerticalAlignment('top').setWrap(true);
  var rows = [
    ['KY SPEEDY CLAIMS', 'Guided setup preview', 'Use fictional claims while the production decisions remain open.'],
    ['YOUR EVENT', '', 'Use your own copy of the blank setup workbook for each event.'],
    ['How to start', 'Fill the blue cells below', 'Then choose KY Claims > 1. Prepare event / apply settings.'],
    ['Setting', 'Your value', 'Guidance'],
    ['Event code', '', 'Required. Example: CAMP26. Unique when combining event accounts; fixed after preparation.'],
    ['Event title', '', 'Required. Appears in voucher descriptions; fixed after preparation.'],
    ['Event folder link (optional)', '', 'A normal Drive folder for finance resources. Blank creates the claims folder in My Drive. Shared Drives are unsupported.'],
    ['Ask for congregation?', false, 'Checked: ask claimants. Unchecked: use Youth automatically.'],
    ['NEXT: CHECK THE FORM', '', 'Open the form editor link after preparing the event.'],
    ['Manual checks', 'Tick only after checking', 'Google requires the receipt-upload question to be added in the form editor.'],
    ['I checked the receipt question', false, 'Exactly one File upload question: Receipt; Required; 1 file; Image and PDF; suitable size limit.'],
    ['I checked responder settings', false, 'Collect Verified email; allow repeated responses; check who can respond. Activation relies on these manual checks.'],
    ['Then activate', 'KY Claims > 2. Activate form', 'Submit a fictional receipt through the claimant link and check DONE in the register.'],
    ['EVENT STATUS', '', 'Use Refresh status to update the processed-claim counts.'],
    ['Stage', 'Not prepared', ''],
    ['Next step / last error', 'Fill event settings, then prepare the event.', ''],
    ['EVENT LINKS', '', 'Only give the claimant form link to claimants.'],
    ['Form editor', '', 'Finance: add/check the receipt-upload question and verified email collection.'],
    ['Claimant form', '', 'Share after activation and a successful fictional test submission.'],
    ['Claims register', '', 'Finance: review processed claims and errors; raw responses are separate.'],
    ['Claims folder', '', 'Finance resources, person folders, receipts, weekly vouchers and PDF snapshots.'],
    ['Parent event folder', '', 'The applied parent location, if selected.'],
    ['PROCESSED CLAIMS', '', 'Invalid responses can fail before reservation. Check raw form responses if a claim is missing.'],
    ['Completed claims', 0, 'DONE means processed, not approved or paid.'],
    ['Incomplete claims', 0, 'Resolve the recorded cause, then choose Retry incomplete submissions.'],
    ['Last refreshed', '', ''],
    ['Software', KY_SETUP_VERSION_, 'Preview; separate events and native account/access checks still apply.'],
    ['DAILY ACTIONS', '', 'Use the KY Claims menu; results and PDF links appear in KY Results.'],
    ['After a PDF export', 'Review every page before printing', 'Exports use the current Singapore submission week and retain separate snapshots.'],
    ['Keep settings/state intact', '', 'Do not delete internal project properties or register metadata.'],
    ['For another event', 'Copy the blank template', 'Start / open setup initialises the copy separately. Do not distribute an event workbook containing finance results.'],
    ['Handover', 'Ask the maintainer', 'Sharing this workbook does not transfer its submission trigger to another finance IC.']
  ];
  sheet.getRange(1, 1, rows.length, 3).setValues(rows);
  sheet.getRange('B5:B7').setNumberFormat('@').setBackground('#e8f0fe');
  ['B8', 'B11:B12'].forEach(function (range) { sheet.getRange(range).insertCheckboxes().setBackground('#e8f0fe'); });
  sheet.setColumnWidth(1, 245).setColumnWidth(2, 360).setColumnWidth(3, 520);
  sheet.setFrozenRows(4);
  [1, 2, 9, 14, 17, 23, 28].forEach(function (row) {
    sheet.getRange(row, 1, 1, 3).setBackground('#17365d').setFontColor('#ffffff').setFontWeight('bold');
  });
  sheet.getRange('A1:C1').setFontSize(18);
  sheet.setRowHeight(1, 40);
  sheet.setRowHeights(2, 31, 48);
  sheet.hideColumns(4, 2);
  sheet.getRange('E4').setValue('READY');
}

function initializeClaimSetupWorkbook() {
  return claimSetupAction_('Open setup', function (book) {
    return claimLock_(function () {
      var properties = PropertiesService.getScriptProperties();
      var scriptId = ScriptApp.getScriptId();
      var sheet = book.getSheetByName(KY_SETUP_SHEET_);
      var raw = properties.getProperty('KY_CLAIM_PIPELINE');
      var config = raw ? JSON.parse(raw) : null;
      var existingResults = book.getSheetByName(KY_RESULTS_SHEET_);
      if (existingResults && existingResults.getRange('J1').getValue() !== KY_SETUP_MARKER_) {
        throw new Error('A different worksheet already uses the name KY Results. Rename that worksheet before continuing.');
      }
      var existingCategories = book.getSheetByName(KY_CATEGORIES_SHEET_);
      if (existingCategories && existingCategories.getRange('J1').getValue() !== KY_SETUP_MARKER_) {
        throw new Error('A different worksheet already uses the name KY Categories. Rename that worksheet before continuing.');
      }
      var fresh = !sheet || sheet.getLastRow() === 0;
      if (sheet && !fresh && sheet.getRange('E1').getValue() !== KY_SETUP_MARKER_) {
        throw new Error('A different worksheet already uses the name KY Setup. Rename that worksheet before continuing.');
      }
      var copied = !fresh && sheet.getRange('E2').getValue() !== book.getId();
      var incomplete = !fresh && sheet.getRange('E4').getValue() !== 'READY';
      if (copied) {
        var originalScript = sheet.getRange('E3').getValue();
        if (!originalScript || originalScript === scriptId ||
            properties.getProperty('KY_SETUP_SCRIPT_ID') === scriptId ||
            (config && (config.installationScriptId === scriptId ||
              (config.installationScriptId !== originalScript && properties.getProperty('KY_SETUP_SCRIPT_ID') !== originalScript)))) {
          throw new Error('This project already owns an event or has an inconsistent binding. No event state was reset; ask the maintainer to review it.');
        }
        // Only the copied project's properties are cleared. Never delete or alter source resources.
        KY_SETUP_OWNED_PROPERTIES_.forEach(function (key) { properties.deleteProperty(key); });
        fresh = true;
      } else if (fresh && raw) {
        throw new Error('This project already contains an event. Ask the maintainer to migrate it; no state was reset.');
      } else if (!fresh && sheet.getRange('E3').getValue() !== scriptId) {
        throw new Error('The setup workbook and script project do not match. No state was reset.');
      }
      if (incomplete && !copied) {
        if (raw) throw new Error('An event exists with an incomplete setup layout. Ask the maintainer to review it; no state was reset.');
        fresh = true;
      }
      // Validate reserved names before changing settings or the copied project.
      var results = claimSetupResultsSheet_(book);
      if (!sheet) sheet = book.insertSheet(KY_SETUP_SHEET_);
      if (fresh) {
        claimSetupLayout_(book, sheet);
        results.getRange(1, 1, results.getMaxRows(), 8).clearContent();
      }
      claimSetupCategoriesSheet_(book, fresh);
      claimSetupText_(sheet, 'B3', 'Fill the blue cells and the KY Categories tab');
      claimSetupText_(sheet, 'C3', 'Enter this event\'s category names and letters, then choose KY Claims > 1. Prepare event / apply settings.');
      claimSetupText_(sheet, 'B27', KY_SETUP_VERSION_);
      sheet.getRange('C1').setFontSize(11);
      sheet.setRowHeight(1, 48);
      properties.setProperty('KY_SETUP_SCRIPT_ID', scriptId);
      book.setActiveSheet(sheet);
      return { message: fresh ? 'Fill your event settings, then choose Prepare event.' : 'Setup opened. Existing settings and resources retained.' };
    });
  }, true);
}

function claimSetupSettings_(sheet, book) {
  var values = sheet.getRange('B5:B8').getValues().map(function (row) { return row[0]; });
  var code = String(values[0] || '').trim().toUpperCase();
  var title = String(values[1] || '').trim();
  if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code)) throw new Error('Enter an event code: up to 40 letters, digits, underscores or hyphens; start with a letter or digit.');
  if (!title || title.length > 150) throw new Error('Enter an event title of 1 to 150 characters.');
  if (values[3] !== true && values[3] !== false) throw new Error('Use the Ask for congregation checkbox.');
  return { code: code, title: title, parent: claimParentFolderId_(values[2]), ask: values[3], categories: claimSetupCategories_(book) };
}
function claimSetupApply_(sheet, book) {
  var settings = claimSetupSettings_(sheet, book);
  var config = claimConfig_(false);
  if (config && (config.eventCode !== settings.code || config.eventTitle !== settings.title)) {
    throw new Error('Event code and title are fixed after preparation. Use another copy of the blank setup workbook for another event.');
  }
  ClaimCore.categoryChanges(config && config.categories, settings.categories, config && config.active);
  var properties = PropertiesService.getScriptProperties();
  properties.setProperty('PIPELINE_EVENT_CODE', settings.code);
  properties.setProperty('PIPELINE_EVENT_TITLE', settings.title);
  properties.setProperty('PIPELINE_ASK_CONGREGATION', String(settings.ask));
  properties.setProperty('PIPELINE_CATEGORIES', JSON.stringify(settings.categories));
  if (settings.parent) properties.setProperty('PIPELINE_PARENT_FOLDER_ID', settings.parent);
  else properties.deleteProperty('PIPELINE_PARENT_FOLDER_ID');
  return settings;
}
function claimSetupStatus_(book, sheet) {
  var config = claimConfig_(false);
  var status = config && config.formId && config.setupWorkbookPrepared ? claimStatus_(config) : null;
  var active = Boolean(config && config.active);
  claimSetupText_(sheet, 'B15', active ? 'Accepting submissions' : status ? 'Form checks needed' : 'Not prepared / preparation incomplete');
  claimSetupText_(sheet, 'B16', active ? 'Submit a fictional test claim and check DONE in the register. Review claims before exporting PDFs.' : status ? 'Open the form editor, complete both checks above, then choose Activate form.' : 'Fill event settings, then choose Prepare event. Rerun after resolving an interruption.');
  ['formEditUrl', 'formSubmitUrl', 'registerUrl', 'folderUrl', 'parentFolderUrl'].forEach(function (key, index) {
    claimSetupText_(sheet, 'B' + (18 + index), status && status[key] || '');
  });
  if (config && config.registerId) {
    var records = claimStore_(SpreadsheetApp.openById(config.registerId)).records();
    claimSetupText_(sheet, 'B24', records.filter(function (record) { return record.status === 'DONE'; }).length);
    claimSetupText_(sheet, 'B25', records.filter(function (record) { return record.status !== 'DONE'; }).length);
  }
  claimSetupText_(sheet, 'B26', Utilities.formatDate(new Date(), 'Asia/Singapore', 'yyyy-MM-dd HH:mm:ss') + ' Singapore');
  return status;
}
function prepareClaimEvent() {
  return claimSetupAction_('Prepare event', function (book, sheet) {
    return claimLock_(function () {
      claimSetupApply_(sheet, book);
      var status = setupClaimPipeline_();
      var config = claimConfig_(true);
      config.installationScriptId = ScriptApp.getScriptId();
      config.setupWorkbookPrepared = true;
      saveClaimConfig_(config);
      claimSetupStatus_(book, sheet);
      return status;
    });
  });
}
function activateClaimEvent() {
  return claimSetupAction_('Activate form', function (book, sheet) {
    return claimLock_(function () {
      var settings = claimSetupSettings_(sheet, book);
      var config = claimConfig_(true);
      if (!config.setupWorkbookPrepared) throw new Error('Preparation is incomplete. Choose Prepare event again before activation.');
      var properties = PropertiesService.getScriptProperties();
      if (config.eventCode !== settings.code || config.eventTitle !== settings.title ||
          properties.getProperty('PIPELINE_ASK_CONGREGATION') !== String(settings.ask) ||
          JSON.stringify(config.categories || []) !== JSON.stringify(settings.categories) ||
          claimParentFolderId_(properties.getProperty('PIPELINE_PARENT_FOLDER_ID')) !== settings.parent) {
        throw new Error('Settings changed. Choose Prepare event / apply settings before activation.');
      }
      if (sheet.getRange('B11').getValue() !== true || sheet.getRange('B12').getValue() !== true) {
        throw new Error('Check the receipt question and responder settings in the form editor, then tick both manual checks.');
      }
      var status = activateClaimPipeline_();
      claimSetupStatus_(book, sheet);
      return status;
    });
  });
}
function refreshClaimSetup() {
  return claimSetupAction_('Refresh status', function (book, sheet) {
    return claimLock_(function () { return claimSetupStatus_(book, sheet); });
  });
}
function retryClaimEvent() {
  return claimSetupAction_('Retry submissions', function (book, sheet) {
    var results = retryPendingClaimSubmissions();
    claimSetupWriteResults_(book, 'Retry submissions', results.map(function (result, index) {
      return ['Submission ' + (index + 1), '', result.status, '', '', '', '', result.error || ''];
    }), results.length ? 'Attempts: ' + results.length : 'No pending responses found.');
    claimLock_(function () { claimSetupStatus_(book, sheet); });
    return results;
  });
}
function exportClaimEvent() {
  return claimSetupAction_('Export PDFs', function (book, sheet) {
    var summary = exportWeeklyClaimVouchers();
    claimSetupWriteResults_(book, 'PDF export: week of ' + summary.week, summary.results.map(function (result) {
      return [result.fullName || result.personKey, result.week, result.status, result.pdfUrl || '', result.workbookUrl || '',
        result.claimCount || '', typeof result.totalCents === 'number' ? result.totalCents / 100 : '', result.error || ''];
    }), 'Exported: ' + summary.exported + ' | Failed: ' + summary.failed + ' | Skipped: ' + summary.skipped);
    claimLock_(function () { claimSetupStatus_(book, sheet); });
    book.setActiveSheet(book.getSheetByName(KY_RESULTS_SHEET_));
    return summary;
  });
}
function claimSetupWriteResults_(book, title, rows, summary) {
  var sheet = claimSetupResultsSheet_(book);
  var count = Math.max(sheet.getLastRow(), rows.length + 5, 7);
  if (sheet.getMaxRows() < count) sheet.insertRowsAfter(sheet.getMaxRows(), count - sheet.getMaxRows());
  sheet.getRange(1, 1, count, 8).clearContent();
  sheet.getRange('A1:H2').setBackground('#17365d').setFontColor('#ffffff').setFontWeight('bold');
  claimSetupText_(sheet, 'A1', title);
  claimSetupText_(sheet, 'A2', summary);
  claimSetupText_(sheet, 'A3', 'Latest action only. PDF files remain in each claimant folder; inspect every page before printing.');
  sheet.getRange('A5:H5').setValues([['Claimant / submission', 'Week', 'Result', 'PDF', 'Workbook', 'Claims', 'Total', 'Details']]).setFontWeight('bold');
  if (rows.length) sheet.getRange(6, 1, rows.length, 8).setValues(rows.map(function (row) {
    return row.map(function (value) { return typeof value === 'string' ? VoucherCore.literal(value) : value; });
  }));
  sheet.getRange(1, 1, count, 8).setWrap(true).setVerticalAlignment('top').setFontFamily('Arial');
  sheet.setRowHeights(1, 2, 56).setRowHeight(3, 48).setRowHeight(5, 38);
  sheet.setRowHeights(6, count - 5, 72);
  sheet.getRange('G6:G' + count).setNumberFormat('0.00');
  sheet.setColumnWidths(1, 5, 210).setColumnWidths(6, 2, 90).setColumnWidth(8, 380).setFrozenRows(5);
}
function claimSetupAction_(title, callback, initializing) {
  var book = claimSetupBook_();
  var sheet;
  try {
    if (!initializing) sheet = claimSetupSheet_(book);
    var result = callback(book, sheet);
    book.toast(title + ' complete. See KY Setup / KY Results.', 'KY Claims', 6);
    return result;
  } catch (error) {
    var message = String(error.message || error).slice(0, 1500);
    // Do not write into copied/foreign sheets until their binding has been verified.
    if (sheet) claimSetupText_(sheet, 'B16', title + ': ' + message);
    book.toast(message, 'KY Claims — action needs attention', 10);
    console.error(title + ': ' + message);
    return { status: 'ERROR', error: message };
  }
}
