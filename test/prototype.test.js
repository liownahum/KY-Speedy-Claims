'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../src/VoucherCore.js');

function environment({ native = false, count = null, unsupported = false, sameId = false, openError = false, renderError = false, exportError = false } = {}) {
  const calls = [];
  const logs = [];
  const properties = { PROTOTYPE_CLAIM_COUNT: count };
  const folder = { getId: () => 'sample-folder', getUrl: () => 'folder-url' };
  const workbook = { getUrl: () => 'copy-url' };
  const source = {
    getMimeType: () => unsupported ? 'application/pdf' : native ? 'application/vnd.google-apps.spreadsheet' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    getBlob: () => 'xlsx-blob',
    makeCopy(name, destination) { calls.push(['makeCopy', name, destination]); return { getId: () => sameId ? '1bV03-iPhOFeUaSI3ep75NaaCaXNzfeFH' : 'copy-id' }; }
  };
  const context = vm.createContext({
    VoucherCore: core,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties[key] === undefined ? null : properties[key] }) },
    Utilities: { formatDate: () => 'test-date', getUuid: () => 'test-uuid' },
    DriveApp: {
      getFileById(id) { calls.push(['readSource', id]); return source; },
      createFolder(name) { calls.push(['createFolder', name]); return folder; },
      getFolderById: () => folder
    },
    Drive: { Files: { create(metadata, blob, options) {
      calls.push(['convert', metadata, blob, options]);
      return { id: 'converted-copy-id' };
    } } },
    SpreadsheetApp: { openById(id) { calls.push(['open', id]); if (openError) throw new Error('open failed'); return workbook; } },
    VoucherRenderer: {
      render(target, payload, sourceId) {
        calls.push(['render', target, payload, sourceId]);
        if (renderError) throw new Error('render failed');
        return { claimCount: payload.claims.length, totalCents: core.plan(payload).totalCents };
      },
      exportPdf(target, rendered, destination, filename) {
        calls.push(['export', target, rendered, destination, filename]);
        if (exportError) throw new Error('export failed');
        return { getUrl: () => 'pdf-url' };
      }
    },
    console: { log: value => logs.push(value) }
  });
  vm.runInContext(fs.readFileSync('src/Prototype.gs', 'utf8'), context);
  return { run: () => context.runVoucherPrototype(), calls, logs, properties, folder };
}

test('XLSX source is imported as a new native workbook, with its original blob unchanged', () => {
  const app = environment({ count: '31' });
  const result = app.run();
  const conversion = app.calls.find(call => call[0] === 'convert');
  assert.equal(conversion[1].mimeType, 'application/vnd.google-apps.spreadsheet');
  assert.equal(conversion[1].parents[0], 'sample-folder');
  assert.equal(conversion[2], 'xlsx-blob');
  assert.equal(app.calls.find(call => call[0] === 'open')[1], 'converted-copy-id');
  assert.equal(app.calls.find(call => call[0] === 'render')[3], '1bV03-iPhOFeUaSI3ep75NaaCaXNzfeFH');
  assert.equal(result.claimCount, 31);
  assert.equal(result.needsPrintReview, true);
  assert.equal(result.pdfUrl, 'pdf-url');
});

test('native source uses makeCopy and never the original workbook for rendering', () => {
  const app = environment({ native: true });
  const result = app.run();
  assert.equal(result.claimCount, 1);
  assert.equal(app.calls.filter(call => call[0] === 'makeCopy').length, 1);
  assert.equal(app.calls.filter(call => call[0] === 'convert').length, 0);
  assert.equal(app.calls.find(call => call[0] === 'open')[1], 'copy-id');
});

test('invalid test sizes do not create folders or copies', () => {
  for (const count of ['0', '-1', '1.5', '201', 'not-a-number', '']) {
    const app = environment({ count });
    assert.throws(app.run);
    assert.equal(app.calls.length, 0);
  }
});

test('unsupported source format is rejected before creating output resources', () => {
  const app = environment({ unsupported: true });
  assert.throws(app.run, /Google Sheets or XLSX/);
  assert.deepEqual(app.calls.map(call => call[0]), ['readSource']);
});

test('copy identity guard rejects accidentally returning the original file ID', () => {
  const app = environment({ native: true, sameId: true });
  assert.throws(app.run, /separate working copy/);
  assert.equal(app.calls.some(call => call[0] === 'open'), false);
  assert.equal(app.calls.some(call => call[0] === 'render'), false);
});

test('open, render, or export failure retains the separate copy for diagnosis', () => {
  for (const setting of [{ openError: true }, { renderError: true }, { exportError: true }]) {
    const app = environment(setting);
    assert.throws(app.run, /failed/);
    assert.equal(app.logs.some(line => line.includes('retained for review: https://docs.google.com/spreadsheets/d/converted-copy-id/edit')), true);
    if (setting.renderError) assert.equal(app.calls.some(call => call[0] === 'export'), false);
  }
});

test('an explicit output folder is reused and no automatic cleanup deletes files', () => {
  const app = environment();
  app.properties.PROTOTYPE_OUTPUT_FOLDER_ID = 'chosen-folder';
  app.run();
  assert.equal(app.calls.some(call => call[0] === 'createFolder'), false);
  assert.equal(app.calls.find(call => call[0] === 'export')[3], app.folder);
});
