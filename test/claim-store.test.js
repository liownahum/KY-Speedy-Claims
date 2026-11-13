'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ClaimCore = require('../src/ClaimCore.js');
const VoucherCore = require('../src/VoucherCore.js');

function fixture() {
  const tabs = new Map();
  let flushes = 0;
  function tab(name) {
    const data = [];
    const sheet = {
      data, frozen: 0, hidden: [],
      getLastRow: () => data.length,
      setFrozenRows: count => { sheet.frozen = count; },
      hideColumns: col => sheet.hidden.push(col),
      appendRow: values => sheet.getRange(data.length + 1, 1, 1, values.length).setValues([values]),
      getRange(row, col, height, width) {
        return {
          setNumberFormat() {},
          getValues: () => Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => data[row - 1 + r]?.[col - 1 + c] ?? '')),
          setValues(values) {
            values.forEach((cells, r) => {
              data[row - 1 + r] ||= [];
              cells.forEach((value, c) => {
                // Sheets treats an initial apostrophe as a literal-text prefix.
                data[row - 1 + r][col - 1 + c] = typeof value === 'string' && value.startsWith("'") ? value.slice(1) : value;
              });
            });
          }
        };
      }
    };
    tabs.set(name, sheet); return sheet;
  }
  tab('Claims'); // Like SpreadsheetApp.create followed by initial tab rename.
  const spreadsheet = { getSheetByName: name => tabs.get(name), insertSheet: tab };
  const context = vm.createContext({ ClaimCore, VoucherCore, SpreadsheetApp: { flush: () => { flushes++; } } });
  vm.runInContext(fs.readFileSync('src/ClaimStore.gs', 'utf8'), context);
  return { tabs, spreadsheet, open: () => context.claimStore_(spreadsheet), flushes: () => flushes };
}
function record() {
  return {
    id: 'response1', receiptNumber: 1, reference: 'TEST-000001', submittedAt: '2026-11-12T04:00:00Z', week: '2026-11-09',
    personKey: 'a@example.com', status: 'PENDING', receiptsReady: false,
    payload: { email: 'a@example.com', fullName: '=SAMPLE', paymentDetails: 'SAMPLE ONLY', description: '+Printing', congregation: 'Youth', amountCents: 1250, receiptFileId: 'file1' }
  };
}

test('register initializes blank Claims and metadata tabs and reopens without losing rows', () => {
  const env = fixture(); const store = env.open();
  assert.equal(env.tabs.get('Claims').frozen, 1);
  assert.deepEqual(env.tabs.get('Claims').hidden, [15]);
  store.saveRecord(record());
  assert.equal(env.open().records()[0].id, 'response1');
  assert.equal(env.tabs.size, 3);
});

test('register upserts a reserved response, preserves exact cents and literal text', () => {
  const env = fixture(); const store = env.open(); const data = record();
  store.saveRecord(data); data.status = 'DONE'; data.weeklyFileId = 'weekly1'; store.saveRecord(data);
  assert.equal(env.tabs.get('Claims').data.length, 2);
  assert.equal(env.tabs.get('Claims').data[1][9], 12.5);
  assert.equal(env.tabs.get('Claims').data[1][6], '=SAMPLE');
  assert.equal(store.records()[0].payload.description, '+Printing');
  assert.equal(store.records()[0].status, 'DONE');
  assert.equal(env.flushes(), 2);
});

test('metadata updates reuse their key and duplicates are rejected', () => {
  const env = fixture(); const store = env.open();
  assert.equal(store.getMeta('Weeks', 'a|week'), null);
  store.saveMeta('Weeks', 'a|week', { revision: 1 });
  store.saveMeta('Weeks', 'a|week', { revision: 2 });
  assert.equal(store.getMeta('Weeks', 'a|week').revision, 2);
  env.tabs.get('Weeks').data.push(['a|week', '{}']);
  assert.throws(() => store.getMeta('Weeks', 'a|week'), /Duplicate/);
});

test('changed headers and damaged claim state stop processing', () => {
  const env = fixture(); const store = env.open(); store.saveRecord(record());
  const row = env.tabs.get('Claims').data[1];
  row[1] = 2;
  assert.throws(() => store.records(), /identity columns/);
  row[1] = 1; row[14] = 'not JSON';
  assert.throws(() => store.records(), /Unreadable/);
  env.tabs.get('Claims').data[0][0] = 'Changed';
  assert.throws(() => env.open(), /headers changed/);
});

test('duplicate saved receipt numbers are detected before another is allocated', () => {
  const env = fixture(); const store = env.open(); const data = record();
  store.saveRecord(data); data.id = 'response2'; store.saveRecord(data);
  assert.throws(() => store.records(), /duplicate or invalid/);
});

test('new category columns preserve the existing register layout and saved category snapshot', () => {
  const env = fixture(); const store = env.open(); const data = record();
  Object.assign(data.payload, { category: '=Games', categoryPrefix: 'G', receiptType: 'Hardcopy' });
  store.saveRecord(data);
  const rows = env.tabs.get('Claims').data;
  assert.equal(rows[0][14], 'State JSON');
  assert.deepEqual(rows[0].slice(15), ['Expense category', 'Category letter', 'Receipt type']);
  assert.deepEqual(rows[1].slice(15), ['=Games', 'G', 'Hardcopy']);
  assert.equal(env.open().records()[0].payload.category, '=Games');
});

test('legacy register headers are extended without rewriting old claim rows and foreign columns stop migration', () => {
  const env = fixture(); const store = env.open(); store.saveRecord(record());
  const data = env.tabs.get('Claims').data;
  data[0].length = 15; data[1].length = 15;
  const oldRow = JSON.stringify(data[1]);
  env.open();
  assert.equal(JSON.stringify(data[1]), oldRow); assert.equal(data[0].length, 18);
  assert.equal(env.open().records()[0].payload.category, undefined);
  data[0][15] = 'Finance notes';
  assert.throws(() => env.open(), /occupied or changed/);
  assert.equal(data[0][15], 'Finance notes'); assert.equal(JSON.stringify(data[1]), oldRow);
});

test('legacy register upgrade preserves data under unlabelled extra columns', () => {
  const env = fixture(); const store = env.open(); store.saveRecord(record());
  const data = env.tabs.get('Claims').data;
  data[0].length = 15; data[1][15] = 'Keep this finance note';
  assert.throws(() => env.open(), /unlabelled data/);
  assert.equal(data[1][15], 'Keep this finance note'); assert.equal(data[0].length, 15);
});
