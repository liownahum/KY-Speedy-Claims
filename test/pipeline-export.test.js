'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ClaimCore = require('../src/ClaimCore.js');
const VoucherCore = require('../src/VoucherCore.js');
const clone = value => JSON.parse(JSON.stringify(value));

function record(number, personKey, week = '2026-11-09', overrides = {}) {
  return {
    id: 'response-' + number, receiptNumber: number, personKey, week,
    status: 'DONE', receiptsReady: true, weeklyFileId: personKey + '|' + week,
    payload: {
      fullName: 'SAMPLE ' + personKey, paymentDetails: 'SAMPLE ONLY',
      email: personKey, purchaseDate: '2026-10-01', description: 'Test item ' + number,
      congregation: 'Youth', amountCents: 1250, receiptFileId: 'receipt-' + number
    },
    ...overrides
  };
}

function environment(initial, instant = '2026-11-12T04:00:00Z') {
  const config = { eventCode: 'TEST', eventTitle: 'Test Event', registerId: 'register', timezone: 'Asia/Singapore' };
  const records = clone(initial);
  const people = new Map();
  const weeks = new Map();
  const books = new Map();
  const exports = [];
  const calls = [];
  const logs = [];
  const failures = new Set();
  let locked = false;
  let sequence = 0;
  for (const entry of records) {
    people.set(entry.personKey, { folderId: 'folder-' + entry.personKey });
    const key = ClaimCore.weekKey(entry);
    if (weeks.has(key)) continue;
    const payload = ClaimCore.weeklyPayload(records, entry, config);
    const plan = VoucherCore.plan(payload);
    const rendered = {
      spreadsheetId: key, sheetId: 1, helperSheetId: 2,
      claimCount: plan.claimCount, totalCents: plan.totalCents, lastPrintRow: plan.lastPrintRow
    };
    weeks.set(key, { fileId: key, revision: 1, rendered, fingerprint: JSON.stringify(payload) });
    books.set(key, { getId: () => key, getUrl: () => 'https://example.com/books/' + key });
  }
  const store = {
    records() { assert.equal(locked, true); return clone(records); },
    getMeta(name, key) { return clone((name === 'People' ? people : weeks).get(key) ?? null); }
  };
  const context = vm.createContext({
    ClaimCore,
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [instant])); }
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => key === 'KY_CLAIM_PIPELINE' ? JSON.stringify(config) : null }) },
    LockService: { getScriptLock: () => ({
      waitLock() { assert.equal(locked, false); locked = true; calls.push('lock'); },
      releaseLock() { assert.equal(locked, true); locked = false; calls.push('unlock'); }
    }) },
    Utilities: {
      formatDate(date, timezone, format) {
        assert.equal(timezone, 'Asia/Singapore');
        assert.equal(format, 'yyyy-MM-dd');
        return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
      },
      getUuid: () => String(++sequence).padStart(8, '0') + '-test'
    },
    SpreadsheetApp: { openById(id) {
      assert.equal(locked, true);
      calls.push('book:' + id);
      return id === 'register' ? { getId: () => id } : books.get(id);
    } },
    DriveApp: { getFolderById(id) { calls.push('folder:' + id); return { getId: () => id }; } },
    VoucherRenderer: { exportPdf(book, rendered, folder, filename) {
      assert.equal(locked, true);
      assert.equal(rendered.spreadsheetId, book.getId());
      if (failures.has(book.getId())) throw new Error('Simulated PDF export failure');
      const item = { bookId: book.getId(), rendered: clone(rendered), folderId: folder.getId(), filename };
      exports.push(item);
      return { getUrl: () => 'https://example.com/pdf/' + filename };
    } },
    claimStore_: () => store,
    console: { log: message => logs.push(JSON.parse(message)) }
  });
  vm.runInContext(fs.readFileSync('src/ClaimPipeline.gs', 'utf8'), context);
  return { context, records, people, weeks, exports, failures, calls, logs, store };
}

test('exports every current-week claimant once into their own folder, including all their claims', () => {
  const env = environment([
    record(1, 'a@example.com'), record(2, 'b@example.com'), record(3, 'a@example.com'),
    record(4, 'prior@example.com', '2026-11-02'), record(5, 'future@example.com', '2026-11-16')
  ]);
  const result = env.context.exportWeeklyClaimVouchers();
  assert.equal(result.week, '2026-11-09');
  assert.equal(result.peopleWithClaims, 2);
  assert.equal(result.exported, 2);
  assert.equal(result.failed, 0);
  assert.equal(env.exports.length, 2);
  assert.deepEqual(env.exports.map(item => item.folderId), ['folder-a@example.com', 'folder-b@example.com']);
  assert.deepEqual(env.exports.map(item => item.rendered.claimCount), [2, 1]);
  assert.deepEqual(env.exports.map(item => item.rendered.totalCents), [2500, 1250]);
  assert.ok(env.exports.every(item => item.filename.includes('2026-11-09 - r1')));
  assert.equal(result.results[0].status, 'EXPORTED');
  assert.equal(result.results[0].needsPrintReview, true);
  assert.deepEqual(env.logs.at(-1), clone(result));
  assert.equal(env.calls.filter(call => call === 'lock').length, 3);
  assert.equal(env.calls.filter(call => call === 'unlock').length, 3);
});

test('does nothing for people whose only claims are outside the current week', () => {
  const env = environment([record(1, 'prior@example.com', '2026-11-02')]);
  const result = env.context.exportWeeklyClaimVouchers();
  assert.equal(result.peopleWithClaims, 0);
  assert.equal(result.exported, 0);
  assert.equal(result.failed, 0);
  assert.equal(result.results.length, 0);
  assert.equal(env.exports.length, 0);
  assert.equal(env.calls.filter(call => call.startsWith('folder:')).length, 0);
  assert.deepEqual(env.calls.filter(call => call.startsWith('book:')), ['book:register']);
});

test('an empty event produces an empty summary and no PDF', () => {
  const env = environment([]);
  const result = env.context.exportWeeklyClaimVouchers();
  assert.equal(result.exported, 0);
  assert.equal(result.peopleWithClaims, 0);
  assert.equal(env.exports.length, 0);
});

test('week selection changes at Monday midnight in Singapore, regardless of the UTC date', () => {
  const data = [record(1, 'old@example.com'), record(2, 'new@example.com', '2026-11-16')];
  const sunday = environment(data, '2026-11-15T15:59:59Z');
  assert.equal(sunday.context.exportWeeklyClaimVouchers().week, '2026-11-09');
  assert.equal(sunday.exports[0].folderId, 'folder-old@example.com');
  const monday = environment(data, '2026-11-15T16:00:00Z');
  assert.equal(monday.context.exportWeeklyClaimVouchers().week, '2026-11-16');
  assert.equal(monday.exports[0].folderId, 'folder-new@example.com');
});

test('one person export failure is reported while the remaining people are still exported', () => {
  const env = environment([record(1, 'a@example.com'), record(2, 'b@example.com'), record(3, 'c@example.com')]);
  env.failures.add('b@example.com|2026-11-09');
  const result = env.context.exportWeeklyClaimVouchers();
  assert.equal(result.exported, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.results[1].status, 'ERROR');
  assert.match(result.results[1].error, /Simulated PDF export failure/);
  assert.deepEqual(env.exports.map(item => item.folderId), ['folder-a@example.com', 'folder-c@example.com']);
});

test('an incomplete claim prevents a partial PDF for that person without blocking others', () => {
  const env = environment([record(1, 'a@example.com'), record(2, 'a@example.com'), record(3, 'b@example.com')]);
  env.records[1].status = 'ERROR';
  const result = env.context.exportWeeklyClaimVouchers();
  assert.equal(result.exported, 1);
  assert.equal(result.failed, 1);
  assert.match(result.results[0].error, /incomplete claims/);
  assert.equal(env.exports[0].folderId, 'folder-b@example.com');
});

test('a person with only an incomplete current-week claim is reported without a PDF', () => {
  const env = environment([record(1, 'a@example.com'), record(2, 'b@example.com')]);
  env.records[0].status = 'ERROR';
  env.records[0].receiptsReady = false;
  env.weeks.delete('a@example.com|2026-11-09');
  const result = env.context.exportWeeklyClaimVouchers();
  assert.equal(result.peopleWithClaims, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.exported, 1);
  assert.match(result.results[0].error, /incomplete claims/);
  assert.equal(env.exports[0].folderId, 'folder-b@example.com');
});

test('incomplete claims from another week do not block this week export', () => {
  const env = environment([record(1, 'a@example.com', '2026-11-02'), record(2, 'a@example.com')]);
  env.records[0].status = 'ERROR';
  env.records[0].receiptsReady = false;
  const result = env.context.exportWeeklyClaimVouchers();
  assert.equal(result.exported, 1);
  assert.equal(result.failed, 0);
  assert.equal(env.exports[0].rendered.claimCount, 1);
});

test('missing or stale weekly metadata is reported before exporting a misleading PDF', () => {
  for (const mutate of [
    env => env.people.delete('a@example.com'),
    env => env.weeks.delete('a@example.com|2026-11-09'),
    env => { env.weeks.get('a@example.com|2026-11-09').rendered = null; },
    env => { env.weeks.get('a@example.com|2026-11-09').fingerprint = 'outdated'; }
  ]) {
    const env = environment([record(1, 'a@example.com'), record(2, 'b@example.com')]);
    mutate(env);
    const result = env.context.exportWeeklyClaimVouchers();
    assert.equal(result.failed, 1);
    assert.equal(result.exported, 1);
    assert.equal(env.exports[0].folderId, 'folder-b@example.com');
  }
});

test('rerunning exports retains separate revision PDFs and leaves claim records unchanged', () => {
  const env = environment([record(1, 'a@example.com'), record(2, 'b@example.com')]);
  const before = clone(env.records);
  env.context.exportWeeklyClaimVouchers();
  env.context.exportWeeklyClaimVouchers();
  assert.equal(env.exports.length, 4);
  assert.equal(new Set(env.exports.map(item => item.filename)).size, 4);
  assert.deepEqual(env.records, before);
});

test('the previous export entry point now exports all people for this week too', () => {
  const env = environment([record(1, 'a@example.com'), record(2, 'b@example.com')]);
  const result = env.context.exportLatestClaimVoucher();
  assert.equal(env.exports.length, 2);
  assert.equal(result.exported, 2);
});
