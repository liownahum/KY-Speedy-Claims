'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function environment() {
  const properties = new Map(); const calls = []; const items = []; const triggers = [];
  let next = 1; let destination = null;
  function newItem(type) {
    const item = { id: next++, title: '', type, required: false,
      getId() { return this.id; }, getType() { return { toString: () => type }; },
      setTitle(title) { this.title = title; return this; }, setRequired(value) { this.required = value; return this; },
      setChoiceValues(values) { this.choices = values; return this; }, setHelpText(text) { this.help = text; return this; }
    };
    items.push(item); return item;
  }
  function generic(item) {
    if (!item) return null;
    return { getId: () => item.id, getTitle: () => item.title, getType: () => item.getType(), asTextItem: () => item, asListItem: () => item };
  }
  const form = {
    getId: () => 'form-id', getEditUrl: () => 'edit-url', getPublishedUrl: () => 'submit-url',
    addTextItem: () => newItem('TEXT'), addListItem: () => newItem('LIST'),
    getItems: () => items.map(generic), getItemById: id => generic(items.find(item => item.id === id)),
    deleteItem(item) {
      const index = items.findIndex(candidate => candidate.id === item.getId());
      if (index < 0) throw new Error('Item does not exist');
      calls.push(['deleteItem', item.getId()]);
      items.splice(index, 1);
    },
    getDestinationId() {
      if (!destination) throw new Error('The form currently has no response destination.');
      return destination;
    },
    setDestination(type, id) { calls.push(['destination', type, id]); destination = id; return this; },
    supportsAdvancedResponderPermissions: () => true,
    setPublished(value) { this.published = value; return this; },
    setAcceptingResponses(value) { this.accepting = value; return this; },
    responses: [], getResponses() { return this.responses; }
  };
  for (const method of ['setDescription', 'setCollectEmail', 'setAllowResponseEdits', 'setLimitOneResponsePerUser', 'setPublishingSummary', 'setConfirmationMessage']) {
    form[method] = function (...values) { calls.push([method, ...values]); return this; };
  }
  const folder = { getId: () => 'root-id' };
  const register = { getId: () => 'register-id', getSheets: () => [{ setName() {} }] };
  const store = { records: () => [] };
  const context = vm.createContext({
    ClaimCore: require('../src/ClaimCore.js'),
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key) ?? null, setProperty(key, value) { calls.push(['property', key, value]); properties.set(key, value); } }) },
    LockService: { getScriptLock: () => ({ waitLock() { calls.push(['lock']); }, releaseLock() { calls.push(['unlock']); } }) },
    Utilities: { getUuid: () => 'unique-id', formatDate: () => '2026-11-12' },
    DriveApp: {
      createFolder() { calls.push(['folder']); return folder; }, getFolderById: () => folder,
      getFileById: () => ({ getMimeType: () => 'application/vnd.google-apps.spreadsheet', makeCopy() { calls.push(['template']); return { getId: () => 'template-id' }; }, moveTo() { return this; } })
    },
    SpreadsheetApp: { create() { calls.push(['register']); return register; }, openById: () => register },
    VoucherRenderer: { templateOptions: () => ['Youth', 'English'] },
    FormApp: { create() { calls.push(['form']); return form; }, openById: () => form, DestinationType: { SPREADSHEET: 'SPREADSHEET' } },
    ScriptApp: { getProjectTriggers: () => triggers, newTrigger(handler) {
      return { forForm(value) { this.source = value; return this; }, onFormSubmit() { return this; }, create() { triggers.push({ getHandlerFunction: () => handler, getTriggerSourceId: () => 'form-id' }); return this; } };
    } },
    claimStore_: () => store, console: { log() {} }
  });
  vm.runInContext(fs.readFileSync('src/ClaimPipeline.gs', 'utf8'), context);
  return { context, properties, calls, form, items, triggers, store, addUpload: () => newItem('FILE_UPLOAD') };
}

function submission(config, id, overrides = {}) {
  const values = {
    fullName: 'SAMPLE - DO NOT SUBMIT', paymentDetails: 'SAMPLE ONLY',
    purchaseDate: '2026-10-01', description: 'Printing', amount: '12.50',
    congregation: 'English', ...overrides
  };
  const entries = Object.entries(config.questions).map(([key, questionId]) => ({
    getItem: () => ({ getId: () => questionId }), getResponse: () => values[key]
  }));
  entries.push({ getItem: () => ({ getId: () => config.uploadQuestionId }), getResponse: () => ['file-' + id] });
  return {
    getId: () => id, getRespondentEmail: () => 'sample@example.com',
    getTimestamp: () => new Date('2026-11-12T04:00:00Z'), getItemResponses: () => entries
  };
}

function connectProcessor(env) {
  const records = new Map();
  const clone = value => JSON.parse(JSON.stringify(value));
  env.store.records = () => clone([...records.values()]);
  env.store.saveRecord = record => records.set(record.id, clone(record));
  env.context.ClaimProcessor = require('../src/ClaimProcessor.js');
  let rendered;
  env.context.claimFilePorts_ = () => ({
    ensurePerson: () => ({ folderId: 'person-folder' }),
    ensureWeek: () => ({ fileId: 'weekly-file' }),
    fileReceipt: record => 'receipt-url-' + record.id,
    renderWeek(week, payload) { rendered = clone(payload); }
  });
  return { records, rendered: () => rendered };
}

test('setup creates one scaffold and reuses saved resources/questions on rerun', () => {
  const env = environment();
  const first = env.context.setupClaimPipeline();
  assert.equal(first.stage, 'ADD_RECEIPT_UPLOAD_THEN_ACTIVATE');
  assert.equal(env.items.length, 5);
  assert.equal(env.form.getDestinationId(), 'register-id');
  assert.equal(env.calls.filter(call => call[0] === 'destination').length, 1);
  assert.equal(env.form.published, false);
  env.context.setupClaimPipeline();
  for (const effect of ['folder', 'template', 'register', 'form']) assert.equal(env.calls.filter(call => call[0] === effect).length, 1);
  assert.equal(env.items.length, 5);
  const cfg = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
  assert.equal(cfg.timezone, 'Asia/Singapore');
  assert.equal(cfg.questions.congregation, undefined);
  assert.equal(first.askCongregation, false);
  assert.equal(first.defaultCongregation, 'Youth');
  assert.equal(env.calls.some(call => call[0] === 'setAllowResponseEdits' && call[1] === false), true);
  assert.equal(env.calls.some(call => call[0] === 'setLimitOneResponsePerUser' && call[1] === false), true);
});

test('setup places the claims folder and finance assets inside the selected event location', () => {
  const env = environment();
  const root = { getId: () => 'root-id' };
  const parent = {
    getId: () => 'event-folder', isTrashed: () => false,
    createFolder(name) { env.calls.push(['folder', 'event-folder', name]); return root; }
  };
  env.context.Drive = { Files: { get: () => ({
    mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: true }
  }) } };
  env.context.DriveApp.getFolderById = id => id === 'event-folder' ? parent : root;
  const files = env.context.DriveApp.getFileById;
  const placements = [];
  env.context.DriveApp.getFileById = id => {
    const file = files(id);
    const copy = file.makeCopy;
    file.makeCopy = (name, folder) => { placements.push(['template', folder.getId()]); return copy(name, folder); };
    file.moveTo = folder => { placements.push([id, folder.getId()]); return file; };
    return file;
  };
  env.properties.set('PIPELINE_PARENT_FOLDER_ID', 'https://drive.google.com/drive/folders/event-folder?usp=sharing');
  const status = env.context.setupClaimPipeline();
  assert.equal(status.parentFolderUrl, 'https://drive.google.com/drive/folders/event-folder');
  assert.deepEqual(placements, [['template', 'root-id'], ['register-id', 'root-id'], ['form-id', 'root-id']]);
  assert.equal(env.calls.filter(call => call[0] === 'folder')[0][1], 'event-folder');
});

test('active setup relocates the claims folder without recreating assets or resetting claims', () => {
  const env = environment();
  env.context.setupClaimPipeline(); const upload = env.addUpload(); env.context.activateClaimPipeline();
  const before = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
  const saved = [{ id: 'response-existing', receiptNumber: 7, status: 'DONE' }];
  env.store.records = () => saved;
  let location = null;
  let moves = 0;
  const parent = { getId: () => 'event-folder', isTrashed: () => false };
  const root = {
    getId: () => before.rootFolderId,
    getParents() {
      const parents = location ? [location] : [];
      return { hasNext: () => parents.length > 0, next: () => parents.shift() };
    },
    moveTo(folder) { location = folder; moves++; return this; }
  };
  env.context.Drive = { Files: { get: () => ({
    mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: true }
  }) } };
  env.context.DriveApp.getFolderById = id => id === 'event-folder' ? parent : root;
  env.properties.set('PIPELINE_PARENT_FOLDER_ID', 'event-folder');

  assert.equal(env.context.setupClaimPipeline().stage, 'ACTIVE');
  env.context.setupClaimPipeline();
  assert.equal(location, parent);
  assert.equal(moves, 1);
  const after = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
  assert.deepEqual(after, { ...before, parentFolderId: 'event-folder' });
  assert.deepEqual(env.store.records(), saved);
  assert.ok(env.items.includes(upload));
  assert.equal(env.triggers.length, 1);
  assert.equal(env.form.published, true);
  assert.equal(env.form.accepting, true);
  for (const effect of ['folder', 'template', 'register', 'form']) {
    assert.equal(env.calls.filter(call => call[0] === effect).length, 1);
  }
});

test('true enables one required Congregation dropdown using the template options', () => {
  const env = environment();
  env.properties.set('PIPELINE_ASK_CONGREGATION', 'true');
  const status = env.context.setupClaimPipeline();
  const config = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
  const question = env.items.find(item => item.id === config.questions.congregation);
  assert.equal(status.askCongregation, true);
  assert.equal(status.defaultCongregation, null);
  assert.equal(env.items.length, 6);
  assert.equal(question.type, 'LIST');
  assert.equal(question.required, true);
  assert.deepEqual(question.choices, ['Youth', 'English']);
  env.context.setupClaimPipeline();
  assert.equal(env.items.filter(item => item.title === 'Congregation').length, 1);
  assert.equal(JSON.parse(env.properties.get('KY_CLAIM_PIPELINE')).questions.congregation, question.id);
});

test('missing, false, null, and empty properties remove the question and default to Youth', () => {
  for (const value of [null, 'false', 'null', '', 'FALSE']) {
    const env = environment();
    env.properties.set('PIPELINE_ASK_CONGREGATION', 'true');
    env.context.setupClaimPipeline();
    if (value === null) env.properties.delete('PIPELINE_ASK_CONGREGATION');
    else env.properties.set('PIPELINE_ASK_CONGREGATION', value);

    const status = env.context.setupClaimPipeline();
    assert.equal(status.askCongregation, false);
    assert.equal(status.defaultCongregation, 'Youth');
    assert.equal(env.items.filter(item => item.title === 'Congregation').length, 0);
    const config = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
    assert.equal(config.questions.congregation, undefined);
    env.context.setupClaimPipeline();
    assert.equal(env.items.length, 5);
  }
});

test('active forms can switch both ways without closing or replacing their resources', () => {
  const env = environment();
  env.properties.set('PIPELINE_ASK_CONGREGATION', 'true');
  env.context.setupClaimPipeline();
  const upload = env.addUpload();
  env.context.activateClaimPipeline();
  const before = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
  env.properties.delete('PIPELINE_ASK_CONGREGATION');

  assert.equal(env.context.setupClaimPipeline().askCongregation, false);
  assert.equal(env.form.published, true);
  assert.equal(env.form.accepting, true);
  env.properties.set('PIPELINE_ASK_CONGREGATION', ' TRUE ');
  assert.equal(env.context.setupClaimPipeline().askCongregation, true);
  const after = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
  for (const key of ['formId', 'registerId', 'rootFolderId', 'nativeTemplateId', 'uploadQuestionId']) {
    assert.equal(after[key], before[key]);
  }
  assert.notEqual(after.questions.congregation, before.questions.congregation);
  assert.equal(env.items.filter(item => item.title === 'Congregation').length, 1);
  assert.ok(env.items.includes(upload));
  assert.equal(env.triggers.length, 1);
  for (const effect of ['folder', 'template', 'register', 'form']) {
    assert.equal(env.calls.filter(call => call[0] === effect).length, 1);
  }
});

test('activation also applies the congregation setting to an existing form', () => {
  const env = environment();
  env.context.setupClaimPipeline(); env.addUpload();
  env.properties.set('PIPELINE_ASK_CONGREGATION', 'true');
  assert.equal(env.context.activateClaimPipeline().askCongregation, true);
  env.properties.set('PIPELINE_ASK_CONGREGATION', 'false');
  assert.equal(env.context.activateClaimPipeline().askCongregation, false);
  assert.equal(env.triggers.length, 1);
});

test('interrupted congregation deletion is recoverable on the next setup run', () => {
  const env = environment();
  env.properties.set('PIPELINE_ASK_CONGREGATION', 'true');
  env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  env.properties.set('PIPELINE_ASK_CONGREGATION', 'false');
  const remove = env.form.deleteItem;
  let fail = true;
  env.form.deleteItem = item => {
    remove(item);
    if (fail) { fail = false; throw new Error('Delete acknowledgement lost'); }
  };
  assert.throws(() => env.context.setupClaimPipeline(), /acknowledgement lost/);
  assert.equal(env.context.setupClaimPipeline().askCongregation, false);
  assert.equal(env.items.filter(item => item.title === 'Congregation').length, 0);
  assert.equal(env.form.published, true);
});

test('Youth must be valid in the voucher template before removing an active question', () => {
  const env = environment();
  env.context.VoucherRenderer.templateOptions = () => ['English'];
  env.properties.set('PIPELINE_ASK_CONGREGATION', 'true');
  env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  env.properties.set('PIPELINE_ASK_CONGREGATION', 'false');
  assert.throws(() => env.context.setupClaimPipeline(), /template must allow Youth/);
  assert.equal(env.items.filter(item => item.title === 'Congregation').length, 1);
  assert.equal(env.form.published, true);
});

test('ambiguous Congregation questions stop changes for review', () => {
  const env = environment();
  env.properties.set('PIPELINE_ASK_CONGREGATION', 'true');
  env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  env.form.addListItem().setTitle('Congregation');
  env.properties.set('PIPELINE_ASK_CONGREGATION', 'false');
  assert.throws(() => env.context.setupClaimPipeline(), /Duplicate form questions/);
  assert.equal(env.items.filter(item => item.title === 'Congregation').length, 2);
});

test('an interrupted question creation reuses the existing dropdown on rerun', () => {
  const env = environment();
  env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  const existing = env.form.addListItem().setTitle('Congregation');
  env.properties.set('PIPELINE_ASK_CONGREGATION', 'true');
  env.context.setupClaimPipeline();
  assert.equal(JSON.parse(env.properties.get('KY_CLAIM_PIPELINE')).questions.congregation, existing.id);
  assert.equal(env.items.filter(item => item.title === 'Congregation').length, 1);
});

test('setup resumes an interrupted destination link without creating another form or register', () => {
  const env = environment(); const set = env.form.setDestination; let fail = true;
  env.form.setDestination = function (type, id) {
    set.call(this, type, id);
    if (fail) { fail = false; throw new Error('Link acknowledgement lost'); }
    return this;
  };
  assert.throws(() => env.context.setupClaimPipeline(), /acknowledgement lost/);
  env.context.setupClaimPipeline();
  for (const effect of ['folder', 'template', 'register', 'form', 'destination']) assert.equal(env.calls.filter(call => call[0] === effect).length, 1);
  assert.equal(env.form.getDestinationId(), 'register-id');
});

test('setup preserves a different existing destination and stops for review', () => {
  const env = environment();
  env.form.setDestination('SPREADSHEET', 'another-register');
  assert.throws(() => env.context.setupClaimPipeline(), /destination was changed/);
  assert.equal(env.form.getDestinationId(), 'another-register');
  assert.equal(env.calls.filter(call => call[0] === 'destination').length, 1);
});

test('setup does not treat unrelated destination access failures as an unlinked form', () => {
  const env = environment();
  env.form.getDestinationId = () => { throw new Error('Permission denied'); };
  assert.throws(() => env.context.setupClaimPipeline(), /Permission denied/);
  assert.equal(env.calls.filter(call => call[0] === 'destination').length, 0);
});

test('activation requires exactly one manually added file-upload question', () => {
  const env = environment(); env.context.setupClaimPipeline();
  assert.throws(() => env.context.activateClaimPipeline(), /exactly one required File upload/);
  assert.equal(env.triggers.length, 0);
  env.addUpload(); env.addUpload();
  assert.throws(() => env.context.activateClaimPipeline(), /exactly one required File upload/);
  assert.equal(env.triggers.length, 0);
});

test('activation publishes the form and installs only one trigger even when repeated', () => {
  const env = environment(); env.context.setupClaimPipeline(); const upload = env.addUpload();
  assert.equal(env.context.activateClaimPipeline().stage, 'ACTIVE');
  env.context.activateClaimPipeline();
  assert.equal(env.triggers.length, 1);
  assert.equal(env.form.published, true); assert.equal(env.form.accepting, true);
  assert.equal(JSON.parse(env.properties.get('KY_CLAIM_PIPELINE')).uploadQuestionId, upload.id);
  env.context.setupClaimPipeline();
  assert.equal(env.form.published, true, 'Rerunning setup must not close an active form');
});

test('activation refuses conflicting pre-existing triggers', () => {
  const env = environment(); env.context.setupClaimPipeline(); env.addUpload();
  env.triggers.push({ getHandlerFunction: () => 'onClaimFormSubmit', getTriggerSourceId: () => 'other-form' });
  assert.throws(() => env.context.activateClaimPipeline(), /triggers need review/);
  assert.equal(env.triggers.length, 1);
});

test('event reconfiguration is rejected without creating another set of resources', () => {
  const env = environment(); env.context.setupClaimPipeline();
  env.properties.set('PIPELINE_EVENT_CODE', 'DIFFERENT');
  assert.throws(() => env.context.setupClaimPipeline(), /another event/);
  assert.equal(env.calls.filter(call => call[0] === 'folder').length, 1);
  assert.equal(env.calls.filter(call => call[0] === 'lock').length, env.calls.filter(call => call[0] === 'unlock').length);
});

test('trigger handler requires a real response from the configured active form', () => {
  const env = environment(); env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  assert.throws(() => env.context.onClaimFormSubmit(), /actual form in a browser/);
  let processed = 0;
  env.context.processClaimResponse_ = () => { processed++; return { status: 'DONE' }; };
  assert.throws(() => env.context.onClaimFormSubmit({ source: { getId: () => 'other' }, response: {} }), /not from/);
  assert.equal(processed, 0);
  assert.equal(env.context.onClaimFormSubmit({ source: env.form, response: {} }).status, 'DONE');
  assert.equal(processed, 1);
});

test('response extraction uses item IDs, collected email, and submission timestamp', () => {
  const env = environment(); env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  const cfg = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
  const entries = Object.entries(cfg.questions).map(([key, id]) => ({ getItem: () => ({ getId: () => id }), getResponse: () => key + '-value' }));
  entries.push({ getItem: () => ({ getId: () => cfg.uploadQuestionId }), getResponse: () => ['receipt-file-id'] });
  const parsed = env.context.claimInput_({ getId: () => 'response-id', getRespondentEmail: () => 'a@example.com', getTimestamp: () => new Date('2026-11-12T04:00:00Z'), getItemResponses: () => entries }, cfg);
  assert.equal(parsed.fullName, 'fullName-value');
  assert.equal(parsed.email, 'a@example.com');
  assert.equal(parsed.localSubmittedDate, '2026-11-12');
  assert.equal(parsed.fileIds[0], 'receipt-file-id');
  assert.equal(parsed.congregation, 'Youth');
});

for (const enabled of [false, true]) {
  test(`two submitted claims reach the weekly expense payload with congregation question ${enabled ? 'enabled' : 'disabled'}`, () => {
    const env = environment();
    if (enabled) env.properties.set('PIPELINE_ASK_CONGREGATION', 'true');
    env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
    const config = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
    const pipeline = connectProcessor(env);

    for (const [id, amount] of [['r1', '12.50'], ['r2', '7.25']]) {
      const result = env.context.onClaimFormSubmit({ source: env.form, response: submission(config, id, { amount }) });
      assert.equal(result.status, 'DONE');
    }
    const records = [...pipeline.records.values()];
    assert.deepEqual(records.map(record => record.receiptNumber), [1, 2]);
    assert.ok(records.every(record => record.payload.congregation === (enabled ? 'English' : 'Youth')));
    const payload = pipeline.rendered();
    assert.equal(payload.claims.length, 2);
    assert.equal(payload.claims.reduce((sum, claim) => sum + claim.amountCents, 0), 1975);
    assert.ok(payload.claims.every(claim => claim.congregation === (enabled ? 'English' : 'Youth')));
  });
}

test('disabled mode ignores a stale congregation answer rather than accepting an override', () => {
  const env = environment();
  env.properties.set('PIPELINE_ASK_CONGREGATION', 'true');
  env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  const previous = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
  env.properties.set('PIPELINE_ASK_CONGREGATION', 'false');
  env.context.setupClaimPipeline();
  const current = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
  assert.equal(env.context.claimInput_(submission(previous, 'stale', { congregation: 'English' }), current).congregation, 'Youth');
});

test('property edits take effect only after the form setting is applied', () => {
  const env = environment();
  env.properties.set('PIPELINE_ASK_CONGREGATION', 'true');
  env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  env.properties.set('PIPELINE_ASK_CONGREGATION', 'false');
  const config = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
  assert.equal(env.context.claimInput_(submission(config, 'unchanged'), config).congregation, 'English');
  assert.equal(env.context.showClaimPipelineStatus().askCongregation, true);
  assert.equal(env.context.setupClaimPipeline().askCongregation, false);
});

test('enabled mode requires a congregation answer before reserving a claim', () => {
  const env = environment();
  env.properties.set('PIPELINE_ASK_CONGREGATION', 'true');
  env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  const config = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
  const pipeline = connectProcessor(env);
  assert.throws(() => env.context.onClaimFormSubmit({
    source: env.form, response: submission(config, 'missing', { congregation: undefined })
  }), /Congregation is required/);
  assert.equal(pipeline.records.size, 0);
});

test('replay skips completed responses and continues after an individual failure', () => {
  const env = environment(); env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  env.store.records = () => [{ id: 'done', status: 'DONE' }];
  env.form.responses = ['done', 'failed', 'new'].map(id => ({ getId: () => id }));
  env.context.processClaimResponse_ = response => { if (response.getId() === 'failed') throw new Error('One failure'); return { status: 'DONE' }; };
  const results = env.context.retryPendingClaimSubmissions();
  assert.equal(results.length, 2); assert.equal(results[0].status, 'ERROR'); assert.equal(results[1].status, 'DONE');
});

test('replay is bounded to ten pending submissions per manual run', () => {
  const env = environment(); env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  env.form.responses = Array.from({ length: 12 }, (_, index) => ({ getId: () => 'r' + index }));
  env.context.processClaimResponse_ = () => ({ status: 'DONE' });
  assert.equal(env.context.retryPendingClaimSubmissions().length, 10);
});

test('repeated validation failures do not starve later pending submissions', () => {
  const env = environment();
  env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  env.form.responses = Array.from({ length: 12 }, (_, index) => ({ getId: () => 'r' + index }));
  const completed = new Set();
  env.store.records = () => [...completed].map(id => ({ id, status: 'DONE' }));
  env.context.processClaimResponse_ = response => {
    const id = response.getId();
    if (Number(id.slice(1)) < 10) throw new Error('Invalid input requires review');
    completed.add(id);
    return { status: 'DONE' };
  };

  const first = env.context.retryPendingClaimSubmissions();
  assert.equal(first.length, 10);
  assert.ok(first.every(result => result.status === 'ERROR'));
  const second = env.context.retryPendingClaimSubmissions();
  assert.equal(second.length, 10);
  assert.equal(second[0].id, 'r10');
  assert.equal(second[1].id, 'r11');
  assert.deepEqual([...completed], ['r10', 'r11']);

  // Cursor writes, including failed attempts, share the processing lock.
  let locked = false;
  let cursorWrites = 0;
  for (const call of env.calls) {
    if (call[0] === 'lock') locked = true;
    if (call[0] === 'unlock') locked = false;
    if (call[0] === 'property' && call[1] === 'KY_CLAIM_RETRY_CURSOR') {
      assert.equal(locked, true);
      cursorWrites++;
    }
  }
  assert.equal(cursorWrites, 20);
});

test('retry rotation wraps around without attempting the same response twice in a batch', () => {
  const env = environment();
  env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  env.form.responses = Array.from({ length: 12 }, (_, index) => ({ getId: () => 'r' + index }));
  env.properties.set('KY_CLAIM_RETRY_CURSOR', 'r9');
  env.context.processClaimResponse_ = () => { throw new Error('Still needs review'); };

  const results = env.context.retryPendingClaimSubmissions();
  assert.deepEqual(Array.from(results, result => result.id), ['r10', 'r11', 'r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7']);
  assert.equal(env.properties.get('KY_CLAIM_RETRY_CURSOR'), 'r7');
});

test('a completed cursor response keeps its position while completed claims are skipped', () => {
  const env = environment();
  env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  env.form.responses = ['r0', 'r1', 'r2', 'r3', 'r4'].map(id => ({ getId: () => id }));
  env.properties.set('KY_CLAIM_RETRY_CURSOR', 'r2');
  env.store.records = () => [{ id: 'r2', status: 'DONE' }, { id: 'r3', status: 'DONE' }];
  env.context.processClaimResponse_ = () => ({ status: 'DONE' });

  const results = env.context.retryPendingClaimSubmissions();
  assert.deepEqual(Array.from(results, result => result.id), ['r4', 'r0', 'r1']);
  assert.equal(env.properties.get('KY_CLAIM_RETRY_CURSOR'), 'r1');
});

test('missing or deleted retry cursors safely restart at the first pending response', () => {
  for (const cursor of [null, 'deleted-response']) {
    const env = environment();
    env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
    env.form.responses = ['r0', 'r1'].map(id => ({ getId: () => id }));
    if (cursor) env.properties.set('KY_CLAIM_RETRY_CURSOR', cursor);
    env.context.processClaimResponse_ = () => ({ status: 'DONE' });

    const results = env.context.retryPendingClaimSubmissions();
    assert.deepEqual(Array.from(results, result => result.id), ['r0', 'r1']);
  }
});

test('empty retry batches leave the saved cursor unchanged', () => {
  const env = environment();
  env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  env.properties.set('KY_CLAIM_RETRY_CURSOR', 'r0');
  assert.equal(env.context.retryPendingClaimSubmissions().length, 0);
  env.form.responses = [{ getId: () => 'r0' }];
  env.store.records = () => [{ id: 'r0', status: 'DONE' }];
  env.context.processClaimResponse_ = () => assert.fail('Completed responses must be skipped');
  assert.equal(env.context.retryPendingClaimSubmissions().length, 0);
  assert.equal(env.properties.get('KY_CLAIM_RETRY_CURSOR'), 'r0');
});

test('event-specific category and receipt-type dropdowns are required, reused and read by item ID', () => {
  const env = environment();
  env.properties.set('PIPELINE_CATEGORIES', JSON.stringify([{ name: 'Games', prefix: 'G' }, { name: 'Hospitality', prefix: 'H' }]));
  env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  const before = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
  const categoryItem = env.items.find(item => item.id === before.questions.category);
  assert.deepEqual(Array.from(categoryItem.choices), ['Games', 'Hospitality']);
  assert.equal(categoryItem.required, true);
  const receiptItem = env.items.find(item => item.id === before.questions.receiptType);
  assert.deepEqual(Array.from(receiptItem.choices), ['Hardcopy', 'E-receipt']); assert.equal(receiptItem.required, true);
  const pipeline = connectProcessor(env);
  const claim = env.context.onClaimFormSubmit({ source: env.form, response: submission(before, 'cat1', { category: 'Games', receiptType: 'Hardcopy' }) });
  assert.equal(claim.status, 'DONE'); assert.equal(claim.receiptNumber, 1);
  assert.equal(claim.payload.categoryPrefix, 'G'); assert.equal(claim.payload.receiptType, 'Hardcopy');
  env.context.setupClaimPipeline();
  const after = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
  assert.equal(after.questions.category, before.questions.category); assert.equal(after.questions.receiptType, before.questions.receiptType);
  assert.equal(env.items.filter(item => item.title === 'Expense category').length, 1);
  assert.equal(pipeline.records.size, 1);
});

test('invalid categories stop before resources and invalid answers stop before reserving a receipt', () => {
  const env = environment();
  env.properties.set('PIPELINE_CATEGORIES', '[{"name":"Games","prefix":"G"},{"name":"Decor","prefix":"G"}]');
  assert.throws(() => env.context.setupClaimPipeline(), /different letter/);
  assert.equal(env.calls.some(call => ['folder', 'template', 'form', 'register'].includes(call[0])), false);
  env.properties.set('PIPELINE_CATEGORIES', '[{"name":"Games","prefix":"G"}]');
  env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  const config = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE')); const pipeline = connectProcessor(env);
  for (const values of [{ category: 'Unknown', receiptType: 'E-receipt' }, { category: 'Games', receiptType: 'Other' }]) {
    assert.throws(() => env.context.onClaimFormSubmit({ source: env.form, response: submission(config, 'invalid', values) }));
  }
  assert.equal(pipeline.records.size, 0);
});

test('active events retain old mappings and saved claim details while accepting a new category', () => {
  const env = environment();
  const first = [{ name: 'Games', prefix: 'G' }];
  env.properties.set('PIPELINE_CATEGORIES', JSON.stringify(first));
  env.context.setupClaimPipeline(); env.addUpload(); env.context.activateClaimPipeline();
  const config = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE')); const pipeline = connectProcessor(env);
  let fail = true;
  const ports = env.context.claimFilePorts_;
  env.context.claimFilePorts_ = () => ({ ...ports(), renderWeek() { if (fail) { fail = false; throw new Error('Render failed'); } } });
  assert.throws(() => env.context.onClaimFormSubmit({ source: env.form, response: submission(config, 'saved', { category: 'Games', receiptType: 'Hardcopy' }) }), /Render failed/);
  for (const values of [[], [{ name: 'Games', prefix: 'D' }]]) {
    env.properties.set('PIPELINE_CATEGORIES', JSON.stringify(values));
    assert.throws(() => env.context.setupClaimPipeline(), /Keep existing/);
    assert.deepEqual(Array.from(env.items.find(item => item.id === config.questions.category).choices), ['Games']);
  }
  env.properties.set('PIPELINE_CATEGORIES', JSON.stringify([...first, { name: 'Decor', prefix: 'D' }]));
  env.context.setupClaimPipeline();
  const current = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
  const result = env.context.onClaimFormSubmit({ source: env.form, response: submission(current, 'saved', { category: 'Decor', receiptType: 'E-receipt' }) });
  assert.equal(result.payload.category, 'Games'); assert.equal(result.payload.receiptType, 'Hardcopy');
  assert.equal(result.receiptNumber, 1); assert.equal(pipeline.records.size, 1);
  assert.equal(env.context.onClaimFormSubmit({ source: env.form, response: submission(current, 'next', { category: 'Decor', receiptType: 'E-receipt' }) }).payload.categoryPrefix, 'D');
});

test('category setup does not reinterpret an already-used legacy form', () => {
  for (const active of [false, true]) {
    const env = environment(); env.context.setupClaimPipeline(); env.addUpload();
    if (active) env.context.activateClaimPipeline();
    else env.form.responses = [{ getId: () => 'old-response' }];
    env.properties.set('PIPELINE_CATEGORIES', '[{"name":"Games","prefix":"G"}]');
    assert.throws(() => env.context.setupClaimPipeline(), /before activating|already has responses/);
    assert.equal(env.items.some(item => item.title === 'Expense category'), false);
  }
});

test('category question creation resumes after a lost configuration write without duplicates', () => {
  const env = environment();
  env.properties.set('PIPELINE_CATEGORIES', '[{"name":"Games","prefix":"G"}]');
  const save = env.context.saveClaimConfig_; let fail = true;
  env.context.saveClaimConfig_ = config => {
    if (config.categories?.length && fail) { fail = false; throw new Error('Save failed'); }
    save(config);
  };
  assert.throws(() => env.context.setupClaimPipeline(), /Save failed/);
  env.context.setupClaimPipeline();
  assert.equal(env.items.filter(item => item.title === 'Expense category').length, 1);
  assert.equal(env.items.filter(item => item.title === 'Receipt type').length, 1);
});

test('duplicate or incorrectly typed category questions stop before changing dropdown choices', () => {
  for (const kind of ['duplicate', 'wrong-type']) {
    const env = environment(); env.context.setupClaimPipeline();
    env.properties.set('PIPELINE_CATEGORIES', '[{"name":"Games","prefix":"G"}]');
    if (kind === 'duplicate') {
      env.form.addListItem().setTitle('Expense category'); env.form.addListItem().setTitle('Expense category');
    } else env.form.addTextItem().setTitle('Receipt type');
    assert.throws(() => env.context.setupClaimPipeline(), /Duplicate|Unexpected question type/);
    assert.equal(env.items.filter(item => item.title === 'Expense category' && item.choices).length, 0);
  }
});
