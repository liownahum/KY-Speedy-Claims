/** One test event per Apps Script project. All responses remain in Forms as well. */
function claimLock_(callback) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return callback(); } finally { lock.releaseLock(); }
}
function claimConfig_(required) {
  var raw = PropertiesService.getScriptProperties().getProperty('KY_CLAIM_PIPELINE');
  if (!raw && required) throw new Error('Run setupClaimPipeline first.');
  return raw ? JSON.parse(raw) : null;
}
function saveClaimConfig_(config) {
  PropertiesService.getScriptProperties().setProperty('KY_CLAIM_PIPELINE', JSON.stringify(config));
}
function claimStatus_(config) {
  var form = FormApp.openById(config.formId);
  var status = {
    stage: config.active ? 'ACTIVE' : 'ADD_RECEIPT_UPLOAD_THEN_ACTIVATE',
    eventCode: config.eventCode,
    formEditUrl: form.getEditUrl(), formSubmitUrl: form.getPublishedUrl(),
    registerUrl: 'https://docs.google.com/spreadsheets/d/' + config.registerId + '/edit',
    folderUrl: 'https://drive.google.com/drive/folders/' + config.rootFolderId,
    weekRule: 'Submission week, Monday-Sunday, Asia/Singapore'
  };
  console.log(JSON.stringify(status));
  return status;
}
function setupClaimPipeline() {
  return claimLock_(function () {
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
    if (config.active) return claimStatus_(config);
    if (!config.rootFolderId) {
      config.rootFolderId = DriveApp.createFolder('KY Claims Test - ' + code + ' - ' + config.eventId.slice(0, 8)).getId();
      saveClaimConfig_(config);
    }
    var folder = DriveApp.getFolderById(config.rootFolderId);
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
      ['fullName', 'Full name (as per NRIC)', 'TEXT'], ['paymentDetails', 'Bank A/c/PayNow', 'TEXT'],
      ['purchaseDate', 'Purchase date (YYYY-MM-DD)', 'TEXT'], ['description', 'Item description', 'TEXT'],
      ['amount', 'Amount (up to 2 decimal places)', 'TEXT'], ['congregation', 'Congregation', 'LIST']
    ];
    fields.forEach(function (field) {
      var item = config.questions[field[0]] ? form.getItemById(config.questions[field[0]]) : null;
      if (!item) {
        var existing = form.getItems().filter(function (candidate) { return candidate.getTitle() === field[1]; });
        if (existing.length > 1) throw new Error('Duplicate form questions need review: ' + field[1]);
        item = existing[0] || (field[2] === 'LIST' ? form.addListItem() : form.addTextItem()).setTitle(field[1]);
      }
      item = form.getItemById(item.getId());
      if (item.getType().toString() !== field[2]) throw new Error('Unexpected question type: ' + field[1]);
      if (field[2] === 'LIST') item.asListItem().setChoiceValues(config.congregations).setRequired(true);
      else item.asTextItem().setRequired(true);
      config.questions[field[0]] = item.getId(); saveClaimConfig_(config);
    });
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
  });
}
function activateClaimPipeline() {
  return claimLock_(function () {
    var config = claimConfig_(true);
    var form = FormApp.openById(config.formId);
    var uploads = form.getItems().filter(function (item) { return item.getType().toString() === 'FILE_UPLOAD'; });
    if (uploads.length !== 1) throw new Error('Add exactly one required File upload question in the form editor: Receipt; allow one image or PDF, then rerun activation.');
    config.uploadQuestionId = uploads[0].getId();
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
  });
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
    congregation: answers[config.questions.congregation], amount: answers[config.questions.amount], fileIds: answers[config.uploadQuestionId]
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
  var done = new Set(records.filter(function (record) { return record.status === 'DONE'; }).map(function (record) { return record.id; }));
  var pending = FormApp.openById(config.formId).getResponses().filter(function (response) { return !done.has(response.getId()); }).slice(0, 10);
  var results = pending.map(function (response) {
    try { return claimLock_(function () { return { id: response.getId(), status: processClaimResponse_(response, claimConfig_(true)).status }; }); }
    catch (error) { return { id: response.getId(), status: 'ERROR', error: String(error.message || error) }; }
  });
  console.log(JSON.stringify(results));
  return results;
}
function showClaimPipelineStatus() { return claimStatus_(claimConfig_(true)); }
function exportLatestClaimVoucher() {
  return claimLock_(function () {
    var config = claimConfig_(true);
    var store = claimStore_(SpreadsheetApp.openById(config.registerId));
    var record = store.records().filter(function (item) { return item.status === 'DONE'; }).sort(function (a, b) { return b.receiptNumber - a.receiptNumber; })[0];
    if (!record) throw new Error('There are no completed claims to export.');
    var week = store.getMeta('Weeks', ClaimCore.weekKey(record));
    var person = store.getMeta('People', record.personKey);
    if (!week || !week.rendered || !person) throw new Error('Weekly voucher metadata is incomplete.');
    var book = SpreadsheetApp.openById(week.fileId);
    var filename = 'Voucher - ' + config.eventCode + ' - ' + record.week + ' - r' + week.revision + ' - ' + Utilities.getUuid().slice(0, 8) + '.pdf';
    var pdf = VoucherRenderer.exportPdf(book, week.rendered, DriveApp.getFolderById(person.folderId), filename);
    var output = { pdfUrl: pdf.getUrl(), workbookUrl: book.getUrl(), claimCount: week.rendered.claimCount, totalCents: week.rendered.totalCents, needsPrintReview: true };
    console.log(JSON.stringify(output)); return output;
  });
}
