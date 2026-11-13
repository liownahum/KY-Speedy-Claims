/** One test event per Apps Script project. All responses remain in Forms as well. */
var CLAIM_RETRY_CURSOR_ = 'KY_CLAIM_RETRY_CURSOR';

function claimLock_(callback) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return callback(); } finally { lock.releaseLock(); }
}
function claimConfig_(required) {
  var properties = PropertiesService.getScriptProperties();
  var raw = properties.getProperty('KY_CLAIM_PIPELINE');
  var boundScript = properties.getProperty('KY_SETUP_SCRIPT_ID');
  if (boundScript && boundScript !== ScriptApp.getScriptId()) {
    throw new Error('This is a copied setup workbook. Choose KY Claims > Start / open setup before using this copy.');
  }
  if (!raw && required) throw new Error('Run setupClaimPipeline first.');
  var config = raw ? JSON.parse(raw) : null;
  if (config && config.installationScriptId && config.installationScriptId !== ScriptApp.getScriptId()) {
    throw new Error('This event belongs to another script project. Initialise a new event in your copied setup workbook.');
  }
  return config;
}
function saveClaimConfig_(config) {
  PropertiesService.getScriptProperties().setProperty('KY_CLAIM_PIPELINE', JSON.stringify(config));
}
function claimParentFolderId_(value) {
  value = String(value || '').trim();
  if (!value) return null;
  if (/^[\w-]+$/.test(value)) return value;
  var match = value.match(/^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]+)\/?(?:\?[^#]*)?(?:#.*)?$/);
  if (!match) throw new Error('PIPELINE_PARENT_FOLDER_ID must be a Drive folder ID or a https://drive.google.com/drive/folders/... link.');
  return match[1];
}
function claimDestinationFolder_(id) {
  if (typeof Drive === 'undefined' || !Drive.Files || typeof Drive.Files.get !== 'function') {
    throw new Error('Enable the Advanced Drive service before choosing an event folder.');
  }
  var metadata = Drive.Files.get(id, {
    fields: 'id,mimeType,driveId,capabilities(canAddChildren)', supportsAllDrives: true
  });
  if (metadata.mimeType !== 'application/vnd.google-apps.folder') throw new Error('Choose an event folder, not a file or shortcut.');
  if (metadata.driveId) throw new Error('Choose a normal Drive folder; receipt-upload forms cannot be stored in a Workspace Shared Drive.');
  if (!metadata.capabilities || metadata.capabilities.canAddChildren !== true) {
    throw new Error('You need permission to add files and folders to the selected event folder.');
  }
  var folder = DriveApp.getFolderById(id);
  if (folder.isTrashed()) throw new Error('The selected event folder is in the trash.');
  return folder;
}
function claimRootFolder_(config) {
  var raw = PropertiesService.getScriptProperties().getProperty('PIPELINE_PARENT_FOLDER_ID');
  var parentId = claimParentFolderId_(raw);
  // Resolve and validate a chosen destination before creating or moving anything.
  var parent = parentId ? claimDestinationFolder_(parentId) : null;
  if (!config.rootFolderId) {
    var name = 'KY Claims Test - ' + config.eventCode + ' - ' + config.eventId.slice(0, 8);
    var created = parent ? parent.createFolder(name) : DriveApp.createFolder(name);
    config.rootFolderId = created.getId();
    config.parentFolderId = parent ? parent.getId() : null;
    saveClaimConfig_(config);
    return created;
  }
  var folder = DriveApp.getFolderById(config.rootFolderId);
  if (parent) {
    if (parent.getId() === folder.getId()) throw new Error('Choose the event folder outside the existing claims folder.');
    var parents = folder.getParents();
    var alreadyPlaced = false;
    while (parents.hasNext()) {
      if (parents.next().getId() === parent.getId()) alreadyPlaced = true;
    }
    if (!alreadyPlaced) folder.moveTo(parent);
    // Save only after a successful move; a retry can detect a lost acknowledgement.
    if (config.parentFolderId !== parent.getId()) {
      config.parentFolderId = parent.getId();
      saveClaimConfig_(config);
    }
  }
  return folder;
}
function claimConfigureCongregation_(form, config) {
  var value = PropertiesService.getScriptProperties().getProperty('PIPELINE_ASK_CONGREGATION');
  var enabled = String(value || '').trim().toLowerCase() === 'true';
  if (!enabled && config.congregations.indexOf('Youth') === -1) {
    throw new Error('The voucher template must allow Youth before disabling the Congregation question.');
  }
  var id = config.questions.congregation;
  var item = id ? form.getItemById(id) : null;
  var matching = form.getItems().filter(function (candidate) { return candidate.getTitle() === 'Congregation'; });
  if (matching.length > 1 || (item && matching.length && matching[0].getId() !== item.getId())) {
    throw new Error('Duplicate form questions need review: Congregation');
  }
  item = item || matching[0];
  if (enabled) {
    if (!item) item = form.addListItem().setTitle('Congregation');
    if (item.getType().toString() !== 'LIST') throw new Error('Unexpected question type: Congregation');
    form.getItemById(item.getId()).asListItem().setChoiceValues(config.congregations).setRequired(true);
    config.questions.congregation = item.getId();
  } else {
    if (item) form.deleteItem(item);
    delete config.questions.congregation;
  }
  saveClaimConfig_(config);
}
function claimStatus_(config) {
  var form = FormApp.openById(config.formId);
  var status = {
    stage: config.active ? 'ACTIVE' : 'ADD_RECEIPT_UPLOAD_THEN_ACTIVATE',
    eventCode: config.eventCode,
    askCongregation: Boolean(config.questions.congregation),
    defaultCongregation: config.questions.congregation ? null : 'Youth',
    formEditUrl: form.getEditUrl(), formSubmitUrl: form.getPublishedUrl(),
    registerUrl: 'https://docs.google.com/spreadsheets/d/' + config.registerId + '/edit',
    folderUrl: 'https://drive.google.com/drive/folders/' + config.rootFolderId,
    parentFolderUrl: config.parentFolderId ? 'https://drive.google.com/drive/folders/' + config.parentFolderId : null,
    weekRule: 'Submission week, Monday-Sunday, Asia/Singapore'
  };
  console.log(JSON.stringify(status));
  return status;
}
function setupClaimPipeline() {
  return claimLock_(setupClaimPipeline_);
}
/** Internal entry point for the guided installer, which already holds the lock. */
function setupClaimPipeline_() {
    var properties = PropertiesService.getScriptProperties();
    var code = (properties.getProperty('PIPELINE_EVENT_CODE') || 'TEST').trim().toUpperCase();
    var title = (properties.getProperty('PIPELINE_EVENT_TITLE') || 'KY Claims Test').trim();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code) || !title || title.length > 150) throw new Error('Use an event code with letters/numbers/hyphens and a short event title.');
    var config = claimConfig_(false);
    if (config && (config.eventCode !== code || config.eventTitle !== title)) throw new Error('This project already has another event configuration. Use a separate project for another event.');
    if (!config) {
      config = { version: 1, eventId: Utilities.getUuid(), eventCode: code, eventTitle: title, timezone: 'Asia/Singapore', questions: {}, active: false };
      saveClaimConfig_(config);
    }
    var folder = claimRootFolder_(config);
    if (config.active) {
      claimConfigureCongregation_(FormApp.openById(config.formId), config);
      return claimStatus_(config);
    }
    if (!config.nativeTemplateId) {
      var sourceId = properties.getProperty('PIPELINE_TEMPLATE_ID') || properties.getProperty('PROTOTYPE_TEMPLATE_ID') || '1bV03-iPhOFeUaSI3ep75NaaCaXNzfeFH';
      var source = DriveApp.getFileById(sourceId);
      var nativeType = 'application/vnd.google-apps.spreadsheet';
      if (source.getMimeType() === nativeType) config.nativeTemplateId = source.makeCopy('Pristine voucher template - ' + code, folder).getId();
      else if (source.getMimeType() === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        config.nativeTemplateId = prototypeXlsxImporter_()('Pristine voucher template - ' + code, folder.getId(), source.getBlob()).id;
      } else throw new Error('Use a native Sheets or XLSX template.');
      if (!config.nativeTemplateId || config.nativeTemplateId === sourceId) throw new Error('A separate pristine template could not be created.');
      saveClaimConfig_(config);
    }
    config.congregations = VoucherRenderer.templateOptions(SpreadsheetApp.openById(config.nativeTemplateId));
    saveClaimConfig_(config);
    if (!config.registerId) {
      var register = SpreadsheetApp.create('Claims Register - ' + code);
      register.getSheets()[0].setName('Claims');
      config.registerId = register.getId(); saveClaimConfig_(config);
    }
    DriveApp.getFileById(config.registerId).moveTo(folder);
    claimStore_(SpreadsheetApp.openById(config.registerId));
    if (!config.formId) {
      config.formId = FormApp.create('TEST Claims - ' + title).getId(); saveClaimConfig_(config);
    }
    var form = FormApp.openById(config.formId);
    DriveApp.getFileById(config.formId).moveTo(folder);
    form.setDescription('TEST PIPELINE: use fictional payment details and sample receipts. One submission per receipt. The collected email identifies the claimant.');
    form.setCollectEmail(true).setAllowResponseEdits(false).setLimitOneResponsePerUser(false).setPublishingSummary(false);
    form.setConfirmationMessage('Submission received. Finance should check its processing status in the Claims register.');
    if (form.supportsAdvancedResponderPermissions()) form.setPublished(false);
    else form.setAcceptingResponses(false);
    var fields = [
      ['fullName', 'Full name (as per NRIC)'], ['paymentDetails', 'Bank A/c/PayNow'],
      ['purchaseDate', 'Purchase date (YYYY-MM-DD)'], ['description', 'Item description'],
      ['amount', 'Amount (up to 2 decimal places)']
    ];
    fields.forEach(function (field) {
      var item = config.questions[field[0]] ? form.getItemById(config.questions[field[0]]) : null;
      if (!item) {
        var existing = form.getItems().filter(function (candidate) { return candidate.getTitle() === field[1]; });
        if (existing.length > 1) throw new Error('Duplicate form questions need review: ' + field[1]);
        item = existing[0] || form.addTextItem().setTitle(field[1]);
      }
      item = form.getItemById(item.getId());
      if (item.getType().toString() !== 'TEXT') throw new Error('Unexpected question type: ' + field[1]);
      item.asTextItem().setRequired(true);
      config.questions[field[0]] = item.getId(); saveClaimConfig_(config);
    });
    claimConfigureCongregation_(form, config);
    form.getItemById(config.questions.purchaseDate).asTextItem().setHelpText('Use YYYY-MM-DD, for example 2026-11-12. Purchase date is stored separately; grouping uses submission week.');
    form.getItemById(config.questions.amount).asTextItem().setHelpText('A positive amount such as 12.50. Use one event currency; no currency conversion.');
    var destinationId = null;
    try { destinationId = form.getDestinationId(); }
    catch (error) {
      // A newly created form throws here rather than returning an empty ID.
      // Only this known absence is safe to handle as an unlinked form.
      if (!/^(?:Exception: )?The form currently has no response destination\.?$/.test(String(error.message || error).trim())) throw error;
    }
    if (destinationId && destinationId !== config.registerId) throw new Error('Form response destination was changed; review before continuing.');
    if (!destinationId) form.setDestination(FormApp.DestinationType.SPREADSHEET, config.registerId);
    return claimStatus_(config);
}
function activateClaimPipeline() {
  return claimLock_(activateClaimPipeline_);
}
/** Internal entry point; caller must hold claimLock_. */
function activateClaimPipeline_() {
    var config = claimConfig_(true);
    var form = FormApp.openById(config.formId);
    var uploads = form.getItems().filter(function (item) { return item.getType().toString() === 'FILE_UPLOAD'; });
    if (uploads.length !== 1) throw new Error('Add exactly one required File upload question in the form editor: Receipt; allow one image or PDF, then rerun activation.');
    config.uploadQuestionId = uploads[0].getId();
    claimConfigureCongregation_(form, config);
    Object.keys(config.questions).forEach(function (key) {
      if (!form.getItemById(config.questions[key])) throw new Error('A required form question was deleted; restore it before activation.');
    });
    var triggers = ScriptApp.getProjectTriggers().filter(function (trigger) { return trigger.getHandlerFunction() === 'onClaimFormSubmit'; });
    if (triggers.some(function (trigger) { return trigger.getTriggerSourceId() !== config.formId; }) || triggers.length > 1) {
      throw new Error('Existing claim triggers need review; use one event and one submission trigger per project.');
    }
    if (!triggers.length) ScriptApp.newTrigger('onClaimFormSubmit').forForm(form).onFormSubmit().create();
    if (form.supportsAdvancedResponderPermissions()) form.setPublished(true);
    form.setAcceptingResponses(true);
    config.active = true; saveClaimConfig_(config);
    return claimStatus_(config);
}
function claimInput_(response, config) {
  var answers = {};
  response.getItemResponses().forEach(function (item) { answers[item.getItem().getId()] = item.getResponse(); });
  var timestamp = response.getTimestamp();
  return {
    id: response.getId(), email: response.getRespondentEmail(), submittedAt: timestamp.toISOString(),
    localSubmittedDate: Utilities.formatDate(timestamp, config.timezone, 'yyyy-MM-dd'),
    fullName: answers[config.questions.fullName], paymentDetails: answers[config.questions.paymentDetails],
    purchaseDate: answers[config.questions.purchaseDate], description: answers[config.questions.description],
    congregation: config.questions.congregation ? answers[config.questions.congregation] : 'Youth',
    amount: answers[config.questions.amount], fileIds: answers[config.uploadQuestionId]
  };
}
function processClaimResponse_(response, config) {
  var store = claimStore_(SpreadsheetApp.openById(config.registerId));
  return ClaimProcessor.process(claimInput_(response, config), config, store, claimFilePorts_(config, store));
}
function onClaimFormSubmit(event) {
  if (!event || !event.response || !event.source) throw new Error('Submit the actual form in a browser; do not run onClaimFormSubmit manually.');
  return claimLock_(function () {
    var config = claimConfig_(true);
    if (!config.active || event.source.getId() !== config.formId) throw new Error('Submission is not from the active configured form.');
    return processClaimResponse_(event.response, config);
  });
}
function retryPendingClaimSubmissions() {
  var config = claimConfig_(true);
  if (!config.active) throw new Error('Activate the pipeline first.');
  var records = claimStore_(SpreadsheetApp.openById(config.registerId)).records();
  var done = new Set(records.filter(function (record) {
    return record.status === 'DONE';
  }).map(function (record) { return record.id; }));
  var responses = FormApp.openById(config.formId).getResponses();
  var cursor = PropertiesService.getScriptProperties().getProperty(CLAIM_RETRY_CURSOR_);
  var pending = claimPendingRetries_(responses, done, cursor);
  var results = pending.map(claimRetryResponse_);
  console.log(JSON.stringify(results));
  return results;
}

function claimPendingRetries_(responses, done, cursor) {
  // Rotate before filtering: a completed response can still be the cursor.
  // A missing or deleted cursor restarts safely from the first response.
  var start = responses.findIndex(function (response) { return response.getId() === cursor; }) + 1;
  var ordered = responses.slice(start).concat(responses.slice(0, start));
  return ordered.filter(function (response) { return !done.has(response.getId()); }).slice(0, 10);
}

function claimRetryResponse_(response) {
  var id = response.getId();
  try {
    return claimLock_(function () {
      try {
        var config = claimConfig_(true);
        if (!config.active) throw new Error('Activate the pipeline first.');
        return { id: id, status: processClaimResponse_(response, config).status };
      } finally {
        // Advance even when validation fails before a Claims row is reserved.
        PropertiesService.getScriptProperties().setProperty(CLAIM_RETRY_CURSOR_, id);
      }
    });
  } catch (error) {
    return { id: id, status: 'ERROR', error: String(error.message || error) };
  }
}

function showClaimPipelineStatus() { return claimStatus_(claimConfig_(true)); }
function exportWeeklyClaimVouchers() {
  var config = claimConfig_(true);
  var today = Utilities.formatDate(new Date(), config.timezone, 'yyyy-MM-dd');
  var weekStart = ClaimCore.monday(today);
  var people = claimLock_(function () {
    var records = claimStore_(SpreadsheetApp.openById(config.registerId)).records();
    return Array.from(new Set(records.filter(function (record) {
      return record.week === weekStart;
    }).map(function (record) { return record.personKey; })));
  });
  var results = people.map(function (personKey) {
    var result;
    try {
      // Release the lock between people so submissions can continue during a batch.
      result = claimLock_(function () {
        var store = claimStore_(SpreadsheetApp.openById(config.registerId));
        return claimExportPersonWeek_(config, store, personKey, weekStart);
      });
    } catch (error) {
      result = { personKey: personKey, week: weekStart, status: 'ERROR', error: String(error.message || error) };
    }
    console.log(JSON.stringify(result));
    return result;
  });
  var summary = {
    week: weekStart, peopleWithClaims: people.length,
    exported: results.filter(function (result) { return result.status === 'EXPORTED'; }).length,
    skipped: results.filter(function (result) { return result.status === 'SKIPPED'; }).length,
    failed: results.filter(function (result) { return result.status === 'ERROR'; }).length,
    results: results
  };
  console.log(JSON.stringify(summary));
  return summary;
}

function claimExportPersonWeek_(config, store, personKey, weekStart) {
  var records = store.records().filter(function (record) {
    return record.personKey === personKey && record.week === weekStart;
  });
  if (!records.length) return { personKey: personKey, week: weekStart, status: 'SKIPPED' };
  if (records.some(function (record) { return record.status !== 'DONE' || !record.receiptsReady; })) {
    throw new Error('This person has incomplete claims for the week; resolve them and retry before exporting.');
  }
  var record = records[0];
  var week = store.getMeta('Weeks', ClaimCore.weekKey(record));
  var person = store.getMeta('People', personKey);
  if (!week || !week.rendered || !person) throw new Error('Weekly voucher metadata is incomplete.');
  var payload = ClaimCore.weeklyPayload(records, record, config);
  if (week.fingerprint !== JSON.stringify(payload)) {
    throw new Error('Weekly voucher does not match the saved claims; review before exporting.');
  }
  var book = SpreadsheetApp.openById(week.fileId);
  var filename = 'Voucher - ' + config.eventCode + ' - ' + weekStart + ' - r' + week.revision + ' - ' + Utilities.getUuid().slice(0, 8) + '.pdf';
  var pdf = VoucherRenderer.exportPdf(book, week.rendered, DriveApp.getFolderById(person.folderId), filename);
  return {
    personKey: personKey, fullName: record.payload.fullName, week: weekStart, status: 'EXPORTED',
    pdfUrl: pdf.getUrl(), workbookUrl: book.getUrl(), revision: week.revision,
    claimCount: week.rendered.claimCount, totalCents: week.rendered.totalCents, needsPrintReview: true
  };
}

// Keep the previously documented entry point usable with the corrected batch behaviour.
function exportLatestClaimVoucher() {
  return exportWeeklyClaimVouchers();
}
