'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../src/VoucherCore.js');
const { fixture, spreadsheetService } = require('./helpers/sheets-fake.js');

function runtime(overrides = {}) {
  const context = vm.createContext({ VoucherCore: core, SpreadsheetApp: spreadsheetService(), ...overrides });
  vm.runInContext(fs.readFileSync('src/Voucher.gs', 'utf8'), context);
  return { context, renderer: context.VoucherRenderer };
}

for (const count of [1, 2, 7, 8, 30, 31, 75]) {
  test(`renders ${count} claims with preserved helpers and relocated totals/signatures`, () => {
    const { workbook, sheet, options } = fixture();
    const payload = core.sample(count);
    const output = runtime().renderer.render(workbook, payload, 'original-master');
    assert.equal(output.claimCount, count);
    assert.equal(output.needsPrintReview, true);
    assert.equal(sheet.getRange(`G${11 + count}`).getValue(), 'Total:');
    assert.equal(sheet.getRange(`B${13 + count}`).getValue(), 'Prepared by  :');
    assert.equal(sheet.getRange(`B${15 + count}`).getValue(), 'Verified by  :');
    assert.equal(sheet.getRange(`F${13 + count}`).getValue(), 'Payment approved by  :');
    assert.equal(sheet.getRange(`H${11 + count}`).getFormula(), core.plan(payload).totalFormula);
    assert.equal(Math.round(sheet.getRange(`H${11 + count}`).getValue() * 100), core.plan(payload).totalCents);
    assert.equal(sheet.getRange('B11').getValue(), 1);
    assert.equal(sheet.getRange(`B${10 + count}`).getValue(), 1 + 3 * (count - 1));
    assert.equal(sheet.getRange(`C${10 + count}`).getValue(), `Sample Event - Test item ${count}`);
    assert.equal(sheet.getRange('G8').getValue(), 'SAMPLE ONLY - NOT PAYABLE');
    assert.equal(sheet.getRange(`D${13 + count}`).getValue(), '');
    assert.equal(sheet.getRange(`G${13 + count}`).getValue(), '');
    const config = workbook.getSheetByName('_KY_Voucher_Config');
    assert.deepEqual(config.getRange('A1:A7').getValues().map(row => row[0]), options);
    assert.equal(config.hidden, true);
    assert.equal(sheet.validations[0].rows, count);
    assert.equal(sheet.validations[0].rule.range.sheet, config);
    assert.equal(sheet.validations[0].rule.allowInvalid, false);
    const binding = workbook.mutations.findIndex(operation => operation[0] === 'validation' && operation[1] === sheet.name);
    const claimWrite = workbook.mutations.findIndex(operation => operation[0] === 'write' && operation[1] === sheet.name && operation[2] === 11);
    assert.ok(binding < claimWrite, 'Dropdown must reference the preserved list before claims are written');
    assert.equal(sheet.getRange(`G${10 + count}`).getDataValidation().range.sheet, config);
    assert.equal(sheet.frozenRows, 0);
    const expectedOperation = count < 30 ? ['deleteRows', 11 + count, 30 - count] : count > 30 ? ['insertRows', 41, count - 30] : null;
    const resizing = workbook.mutations.filter(operation => /Rows$/.test(operation[0]));
    assert.deepEqual(resizing, expectedOperation ? [expectedOperation] : []);
  });
}

test('fixture reproduces the stale-dropdown rejection after original helper rows are deleted', () => {
  const { sheet } = fixture();
  sheet.deleteRows(12, 29);
  assert.throws(() => sheet.getRange('G11').setValue('Youth'), /Data validation rejected/);
});

test('restored congregation dropdown rejects unknown values after rendering', () => {
  const { workbook, sheet } = fixture();
  runtime().renderer.render(workbook, core.sample(1), 'original-master');
  assert.throws(() => sheet.getRange('G11').setValue('Unknown'), /Data validation rejected/);
  sheet.getRange('G11').setValue('English');
  assert.equal(sheet.getRange('G11').getValue(), 'English');
});

test('imported 24-point voucher titles receive enough row height without changing their text', () => {
  const { workbook, sheet } = fixture();
  const title = sheet.getRange('B4').getValue();
  const church = sheet.getRange('B2').getValue();
  const needed = 8 + Math.ceil(24 * 4 / 3 * 1.4);
  assert.ok(sheet.getRowHeight(4) < needed, 'Fixture must reproduce the undersized imported title row');
  runtime().renderer.render(workbook, core.sample(1), 'original-master');
  assert.ok(sheet.getRowHeight(4) >= needed);
  assert.ok(sheet.getRowHeight(2) + sheet.getRowHeight(3) >= needed);
  assert.equal(sheet.getRange('B4').getValue(), title);
  assert.equal(sheet.getRange('B2').getValue(), church);
});

test('existing taller title rows are not shrunk', () => {
  const { workbook, sheet } = fixture();
  sheet.setRowHeight(2, 100);
  sheet.setRowHeight(4, 100);
  runtime().renderer.render(workbook, core.sample(31), 'original-master');
  assert.equal(sheet.getRowHeight(2), 100);
  assert.equal(sheet.getRowHeight(4), 100);
});

test('refuses the original file before modifying it', () => {
  const { workbook } = fixture();
  assert.throws(() => runtime().renderer.render(workbook, core.sample(1), workbook.getId()), /source template/);
  assert.deepEqual(workbook.mutations, []);
});

test('refuses a filled, mismatched, signed, or unsupported template without modifying it', () => {
  const mutations = [
    ({ sheet }) => sheet.getRange('C11').setValue('Existing claim'),
    ({ sheet }) => sheet.getRange('C10').setValue('Wrong heading'),
    ({ sheet }) => sheet.getRange('H41').setFormula('=SUM(H11:H39)'),
    ({ sheet }) => sheet.getRange('X16').setValue(''),
    ({ sheet }) => sheet.getRange('D43').setValue('Someone already signed'),
    ({ sheet }) => sheet.getRange('C11:F11').merge()
  ];
  for (const mutate of mutations) {
    const model = fixture();
    mutate(model);
    model.workbook.mutations = [];
    assert.throws(() => runtime().renderer.render(model.workbook, core.sample(1), 'original-master'));
    assert.deepEqual(model.workbook.mutations, []);
  }
});

test('rejects invalid congregation and oversized text before changing the workbook', () => {
  for (const change of [data => { data.claims[0].congregation = 'Unknown'; }, data => { data.claims[0].description = 'x'.repeat(10000); }]) {
    const { workbook } = fixture();
    const payload = core.sample(1);
    change(payload);
    assert.throws(() => runtime().renderer.render(workbook, payload, 'original-master'));
    assert.deepEqual(workbook.mutations, []);
  }
});

test('formula-looking user inputs remain literal in the rendered copy', () => {
  const { workbook, sheet } = fixture();
  const payload = core.sample(1);
  payload.fullName = '=1+1';
  payload.paymentDetails = '+1+1';
  payload.eventTitle = '=1+1';
  runtime().renderer.render(workbook, payload, 'original-master');
  assert.equal(sheet.getRange('C8').getValue(), '=1+1');
  assert.equal(sheet.getRange('C8').getFormula(), '');
  assert.equal(sheet.getRange('G8').getValue(), '+1+1');
  assert.equal(sheet.getRange('C11').getValue(), '=1+1 - Test item 1');
  assert.equal(sheet.getRange('C11').getFormula(), '');
});

test('a recalculation failure stops the workflow before it can export', () => {
  const { workbook } = fixture();
  workbook.corruptCalculation = true;
  assert.throws(() => runtime().renderer.render(workbook, core.sample(1), 'original-master'), /total does not match/);
});

function pdfEnvironment(code = 200, type = 'application/pdf', prefix = '%PDF-1.7') {
  const calls = [];
  const blob = { getContentType: () => type, getBytes: () => Array.from(Buffer.from(prefix)), setName(name) { this.name = name; return this; } };
  const env = {
    Utilities: { sleep() {} },
    ScriptApp: { getOAuthToken: () => 'synthetic-test-token' },
    UrlFetchApp: { fetch(url, options) { calls.push({ url, options }); return { getBlob: () => blob, getResponseCode: () => code }; } }
  };
  const folder = { saved: [], createFile(value) { this.saved.push(value); return value; } };
  return { calls, folder, env };
}

test('PDF export uses the actual copy ID and final print bounds, with the token only in the header', () => {
  const { workbook } = fixture();
  const { calls, folder, env } = pdfEnvironment();
  const { renderer } = runtime(env);
  const result = renderer.render(workbook, core.sample(31), 'original-master');
  renderer.exportPdf(workbook, result, folder, 'synthetic.pdf');
  assert.equal(folder.saved.length, 1);
  assert.equal(folder.saved[0].name, 'synthetic.pdf');
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/spreadsheets/d/disposable-copy/export');
  assert.equal(url.searchParams.get('r2'), '46');
  assert.equal(url.searchParams.get('scale'), '2');
  assert.equal(url.searchParams.get('fzr'), 'false');
  assert.equal(url.href.includes('synthetic-test-token'), false);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer synthetic-test-token');
});

test('failed or non-PDF exports are never saved as vouchers', () => {
  for (const [code, type, prefix] of [[403, 'text/html', '<html>'], [200, 'text/html', '<html>'], [200, 'application/pdf', 'wrong']]) {
    const { workbook } = fixture();
    const { folder, env } = pdfEnvironment(code, type, prefix);
    const { renderer } = runtime(env);
    const result = renderer.render(workbook, core.sample(1), 'original-master');
    assert.throws(() => renderer.exportPdf(workbook, result, folder, 'synthetic.pdf'), /no PDF was saved/);
    assert.equal(folder.saved.length, 0);
  }
});

test('PDF export refuses print metadata for a different workbook', () => {
  const { workbook } = fixture();
  const { calls, folder, env } = pdfEnvironment();
  assert.throws(() => runtime(env).renderer.exportPdf(workbook, { spreadsheetId: 'different' }, folder, 'x.pdf'), /different workbook/);
  assert.equal(calls.length, 0);
});
