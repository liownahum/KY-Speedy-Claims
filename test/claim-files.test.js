'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const voucher = require('../src/VoucherCore.js');
const claims = require('../src/ClaimCore.js');
const { fixture, spreadsheetService } = require('./helpers/sheets-fake.js');
const clone = value => JSON.parse(JSON.stringify(value));

function environment() {
  let sheetSequence = 100;
  let token = 0;
  const source = fixture().sheet;
  const folders = new Map();
  const files = new Map();
  const books = new Map();
  const metadata = new Map();
  const env = { failDelete: false, failCommit: false, failRender: false };
  function folder(id, name) {
    const value = { id, name, description: '', children: [], getId: () => id,
      getDescription() { return this.description; }, setDescription(text) { this.description = text; return this; },
      getFoldersByName(text) { const found = this.children.filter(item => item.name === text); return { hasNext: () => found.length > 0, next: () => found.shift() }; },
      createFolder(text) { const child = folder('folder-' + folders.size, text); this.children.push(child); return child; }
    };
    folders.set(id, value); return value;
  }
  folder('root', 'Root');
  function enhance(book) {
    const insert = book.insertSheet.bind(book);
    function decorate(sheet) {
      const id = sheetSequence++;
      sheet.getSheetId = () => id;
      sheet.getName = () => sheet.name;
      sheet.setName = name => {
        if (book.sheets.has(name) && book.sheets.get(name) !== sheet) throw new Error('Duplicate sheet name');
        book.sheets.delete(sheet.name); sheet.name = name; book.sheets.set(name, sheet); return sheet;
      };
      return sheet;
    }
    book.sheets.forEach(decorate);
    book.insertSheet = name => decorate(insert(name));
    book.getSheets = () => [...book.sheets.values()];
    book.deleteSheet = sheet => {
      if (env.failDelete) { env.failDelete = false; throw new Error('Delete failed'); }
      if (!sheet.hidden && book.getSheets().filter(item => !item.hidden).length <= 1) throw new Error('Cannot delete the last visible worksheet');
      book.sheets.delete(sheet.name);
    };
    book.setActiveSheet = sheet => { book.active = sheet; };
    return book;
  }
  source.copyTo = book => {
    const copied = book.insertSheet('Copy of Payment Voucher');
    copied.cells = new Map([...source.cells].map(([key, value]) => [key, clone(value)]));
    copied.fontSizes = new Map(source.fontSizes);
    copied.rowHeights = new Map(source.rowHeights);
    copied.validationRules = new Map(source.validationRules);
    return copied;
  };
  const store = {
    getMeta: (name, key) => metadata.has(name + key) ? clone(metadata.get(name + key)) : null,
    saveMeta(name, key, value) {
      if (env.failCommit && name === 'Weeks' && value.rendered && !metadata.get(name + key)?.rendered) {
        env.failCommit = false; throw new Error('Commit failed');
      }
      metadata.set(name + key, clone(value));
    }
  };
  const service = {
    ...spreadsheetService(),
    create() {
      const book = enhance(fixture().workbook);
      book.getSheets()[0].cells.clear();
      book.getSheets()[0].validationRules.clear();
      book.getSheets()[0].setName('Sheet1');
      book.id = 'weekly-' + books.size;
      books.set(book.id, book);
      files.set(book.id, { moveTo(destination) { this.folder = destination.getId(); return this; } });
      return book;
    },
    openById(id) { return id === 'template' ? { getSheetByName: () => source } : books.get(id); }
  };
  const context = vm.createContext({
    VoucherCore: voucher, ClaimCore: claims, SpreadsheetApp: service,
    DriveApp: { getFolderById: id => folders.get(id), getFileById: id => files.get(id) },
    Utilities: { getUuid: () => 'token' + ++token }
  });
  vm.runInContext(fs.readFileSync('src/Voucher.gs', 'utf8'), context);
  const render = context.VoucherRenderer.render;
  context.VoucherRenderer.render = (...args) => { if (env.failRender) { env.failRender = false; throw new Error('Render failed'); } return render(...args); };
  vm.runInContext(fs.readFileSync('src/ClaimFiles.gs', 'utf8'), context);
  const config = { eventId: 'event', rootFolderId: 'root', nativeTemplateId: 'template' };
  Object.assign(env, { ports: context.claimFilePorts_(config, store), store, books, files, folders });
  env.record = { id: 'r1', personKey: 'a@example.com', week: '2026-11-09', receiptNumber: 1,
    payload: { fullName: 'SAMPLE', paymentDetails: 'SAMPLE ONLY', receiptFileId: 'receipt-file' } };
  env.payload = count => { const data = voucher.sample(count); data.fullName = 'SAMPLE'; data.paymentDetails = 'SAMPLE ONLY'; return data; };
  return env;
}

test('first render keeps a visible sheet until its verified replacement is committed', () => {
  const env = environment();
  const person = env.ports.ensurePerson(env.record);
  const week = env.ports.ensureWeek(env.record, person);
  env.ports.renderWeek(week, env.payload(1));
  const book = env.books.get(week.fileId);
  assert.deepEqual(book.getSheets().filter(sheet => !sheet.hidden).map(sheet => sheet.name), ['Voucher']);
  assert.equal(book.getSheetByName('Voucher').getRange('H12').getValue(), 12.5);
  assert.equal(env.files.get(week.fileId).folder, person.folderId);
});

test('second render preserves the weekly workbook ID and replaces only owned previous sheets', () => {
  const env = environment(); const person = env.ports.ensurePerson(env.record);
  let week = env.ports.ensureWeek(env.record, person);
  env.ports.renderWeek(week, env.payload(1));
  const book = env.books.get(week.fileId);
  const priorSheet = book.getSheetByName('Voucher').getSheetId();
  book.insertSheet('Finance notes');
  week = env.ports.ensureWeek(env.record, person);
  env.ports.renderWeek(week, env.payload(2));
  assert.equal(env.books.size, 1);
  assert.notEqual(book.getSheetByName('Voucher').getSheetId(), priorSheet);
  assert.equal(book.getSheetByName('Voucher').getRange('B12').getValue(), 4);
  assert.ok(book.getSheetByName('Finance notes'));
  assert.equal(book.getSheets().filter(sheet => /^__KY_HELPER_/.test(sheet.name)).length, 1);
});

test('rendering failure retains the last usable voucher and a later retry succeeds', () => {
  const env = environment(); const person = env.ports.ensurePerson(env.record);
  let week = env.ports.ensureWeek(env.record, person);
  env.ports.renderWeek(week, env.payload(1));
  const book = env.books.get(week.fileId); const oldId = book.getSheetByName('Voucher').getSheetId();
  week = env.ports.ensureWeek(env.record, person); env.failRender = true;
  assert.throws(() => env.ports.renderWeek(week, env.payload(2)), /Render failed/);
  assert.equal(book.getSheetByName('Voucher').getSheetId(), oldId);
  week = env.ports.ensureWeek(env.record, person);
  env.ports.renderWeek(week, env.payload(2));
  assert.notEqual(book.getSheetByName('Voucher').getSheetId(), oldId);
});

test('failed pointer publication preserves the default sheet and is recoverable', () => {
  const env = environment(); const person = env.ports.ensurePerson(env.record);
  let week = env.ports.ensureWeek(env.record, person); env.failCommit = true;
  assert.throws(() => env.ports.renderWeek(week, env.payload(1)), /Commit failed/);
  assert.ok(env.books.get(week.fileId).getSheetByName('Sheet1'));
  week = env.ports.ensureWeek(env.record, person);
  env.ports.renderWeek(week, env.payload(1));
  assert.ok(env.books.get(week.fileId).getSheetByName('Voucher'));
});

test('failure after publishing the pointer reuses the committed render and finishes cleanup', () => {
  const env = environment(); const person = env.ports.ensurePerson(env.record);
  let week = env.ports.ensureWeek(env.record, person); env.failDelete = true;
  assert.throws(() => env.ports.renderWeek(week, env.payload(1)), /Delete failed/);
  week = env.ports.ensureWeek(env.record, person);
  const published = week.rendered.sheetId;
  env.ports.renderWeek(week, env.payload(1));
  assert.equal(env.books.get(week.fileId).getSheetByName('Voucher').getSheetId(), published);
});

test('same-name claimants are separated by identity markers and reused by stored IDs', () => {
  const env = environment();
  const a = env.ports.ensurePerson(env.record);
  const b = env.ports.ensurePerson({ ...env.record, personKey: 'b@example.com' });
  assert.notEqual(a.folderId, b.folderId);
  assert.equal(env.ports.ensurePerson(env.record).folderId, a.folderId);
});

test('receipt rename/move is repeatable and preserves its Drive ID', () => {
  const env = environment(); const person = env.ports.ensurePerson(env.record);
  const receipt = { name: 'Photo.PNG', getName() { return this.name; }, getMimeType: () => 'image/png', setName(name) { this.name = name; return this; }, moveTo(folder) { this.folder = folder.getId(); return this; }, getUrl: () => 'receipt-url' };
  env.files.set('receipt-file', receipt);
  assert.equal(env.ports.fileReceipt(env.record, person), 'receipt-url');
  assert.equal(env.ports.fileReceipt(env.record, person), 'receipt-url');
  assert.equal(receipt.name, '1.png'); assert.equal(receipt.folder, person.receiptFolderId);
  assert.equal(env.files.get('receipt-file'), receipt);
});

test('an unrelated Voucher tab is preserved without blocking later claims or retries', () => {
  const env = environment();
  const person = env.ports.ensurePerson(env.record);
  let week = env.ports.ensureWeek(env.record, person);
  env.ports.renderWeek(week, env.payload(1));
  const book = env.books.get(week.fileId);
  book.getSheetByName('Voucher').setName('Previous generated voucher');
  const notes = book.insertSheet('Voucher');
  notes.getRange('A1').setValue('Finance notes');

  week = env.ports.ensureWeek(env.record, person);
  env.ports.renderWeek(week, env.payload(2));
  assert.equal(book.getSheetByName('Voucher'), notes);
  assert.equal(notes.getRange('A1').getValue(), 'Finance notes');
  const generated = book.getSheetByName('Voucher (2)');
  assert.equal(book.active, generated);
  assert.equal(generated.getRange('B12').getValue(), 4);

  week = env.ports.ensureWeek(env.record, person);
  const revision = week.revision;
  env.ports.renderWeek(week, env.payload(2));
  assert.equal(book.active, generated);
  assert.equal(week.revision, revision);
  assert.equal(notes.getRange('A1').getValue(), 'Finance notes');

  week = env.ports.ensureWeek(env.record, person);
  env.ports.renderWeek(week, env.payload(3));
  assert.equal(book.getSheetByName('Voucher'), notes);
  assert.notEqual(book.active, generated);
  assert.equal(book.active.getName(), 'Voucher (2)');
});

test('generated voucher names skip occupied suffixes and case variants', () => {
  const env = environment();
  const person = env.ports.ensurePerson(env.record);
  const week = env.ports.ensureWeek(env.record, person);
  const book = env.books.get(week.fileId);
  const notes = ['voucher', 'Voucher (2)', 'VOUCHER (3)'].map(name => book.insertSheet(name));

  env.ports.renderWeek(week, env.payload(1));
  assert.equal(book.active.getName(), 'Voucher (4)');
  for (const sheet of notes) assert.equal(book.getSheetByName(sheet.getName()), sheet);
});
