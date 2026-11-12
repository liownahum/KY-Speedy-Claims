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
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key) ?? null, setProperty(key, value) { properties.set(key, value); } }) },
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

test('setup creates one scaffold and reuses saved resources/questions on rerun', () => {
  const env = environment();
  const first = env.context.setupClaimPipeline();
  assert.equal(first.stage, 'ADD_RECEIPT_UPLOAD_THEN_ACTIVATE');
  assert.equal(env.items.length, 6);
  assert.equal(env.form.getDestinationId(), 'register-id');
  assert.equal(env.calls.filter(call => call[0] === 'destination').length, 1);
  assert.equal(env.form.published, false);
  env.context.setupClaimPipeline();
  for (const effect of ['folder', 'template', 'register', 'form']) assert.equal(env.calls.filter(call => call[0] === effect).length, 1);
  assert.equal(env.items.length, 6);
  const cfg = JSON.parse(env.properties.get('KY_CLAIM_PIPELINE'));
  assert.equal(cfg.timezone, 'Asia/Singapore');
  assert.equal(cfg.questions.congregation > 0, true);
  assert.equal(env.calls.some(call => call[0] === 'setAllowResponseEdits' && call[1] === false), true);
  assert.equal(env.calls.some(call => call[0] === 'setLimitOneResponsePerUser' && call[1] === false), true);
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
