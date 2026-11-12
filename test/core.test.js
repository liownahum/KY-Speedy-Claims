'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/VoucherCore.js');

for (const count of [1, 2, 7, 8, 30, 31, 75]) {
  test(`plans ${count} claims without treating the starting row count as a limit`, () => {
    const payload = core.sample(count);
    const plan = core.plan(payload);
    assert.equal(plan.rows.length, count);
    assert.equal(plan.totalRow, count + 11);
    assert.equal(plan.lastPrintRow, count + 15);
    assert.equal(plan.totalCents, payload.claims.reduce((sum, claim) => sum + claim.amountCents, 0));
    assert.deepEqual(plan.rows.map(row => row[0]), payload.claims.map(claim => claim.receiptNumber));
    assert.equal(plan.totalFormula, `=IF(SUM(H11:H${count + 10})>0,SUM(H11:H${count + 10}),"")`);
  });
}

test('preserves receipt identities and input data rather than renumbering or mutating them', () => {
  const payload = core.sample(2);
  payload.claims[0].receiptNumber = 100;
  payload.claims[1].receiptNumber = 3;
  const before = JSON.stringify(payload);
  assert.deepEqual(core.plan(payload).rows.map(row => row[0]), [100, 3]);
  assert.equal(JSON.stringify(payload), before);
});

test('sums cents exactly for small decimal amounts', () => {
  const payload = core.sample(3);
  payload.claims.forEach((claim, i) => { claim.amountCents = [10, 20, 1][i]; });
  assert.equal(core.plan(payload).totalCents, 31);
});

test('escapes formula-like text without changing ordinary text', () => {
  for (const value of ['=HYPERLINK("example")', '+SUM(1,2)', '-1+1', '@SUM(A1)', "'leading quote"]) {
    assert.equal(core.literal(value), "'" + value);
  }
  assert.equal(core.literal('Ordinary text'), 'Ordinary text');
  const payload = core.sample(1);
  payload.fullName = '=1+1';
  payload.eventTitle = '=1+1';
  assert.equal(core.plan(payload).rows[0][1], "'=1+1 - Test item 1");
});

test('requires explicit valid dates, including leap-year boundaries', () => {
  const payload = core.sample(1);
  payload.voucherDate = '2024-02-29';
  assert.equal(core.plan(payload).dateSerial, 45351);
  for (const invalid of ['2025-02-29', '2026-02-30', '2026-13-01', '12/11/2026', '']) {
    payload.voucherDate = invalid;
    assert.throws(() => core.plan(payload), /date/i);
  }
});

test('rejects missing identity, empty claims, duplicate receipts, and invalid money', () => {
  const mutations = [
    data => { data.fullName = ' '; },
    data => { data.paymentDetails = ''; },
    data => { data.eventTitle = ''; },
    data => { data.claims = []; },
    data => { data.claims = Array(1); },
    data => { data.claims = [null]; },
    data => { data.claims[1].receiptNumber = data.claims[0].receiptNumber; },
    data => { data.claims[0].receiptNumber = 0; },
    data => { data.claims[0].amountCents = 1.2; },
    data => { data.claims[0].amountCents = -1; },
    data => { data.claims[0].amountCents = Number.NaN; },
    data => { data.claims[0].amountCents = Number.MAX_SAFE_INTEGER; },
    data => { data.claims[0].description = ' '; }
  ];
  for (const mutate of mutations) {
    const payload = core.sample(2);
    mutate(payload);
    assert.throws(() => core.plan(payload));
  }
});

test('print settings address only the resized voucher and fit width, not total page height', () => {
  const query = new URLSearchParams(core.pdfQuery(123, core.plan(core.sample(75)).lastPrintRow));
  assert.equal(query.get('gid'), '123');
  assert.equal(query.get('r1'), '1');
  assert.equal(query.get('r2'), '90');
  assert.equal(query.get('c1'), '1');
  assert.equal(query.get('c2'), '8');
  assert.equal(query.get('size'), 'A4');
  assert.equal(query.get('scale'), '2');
  assert.equal(query.get('fzr'), 'true');
  assert.throws(() => core.pdfQuery(1, 0));
});

test('text sizing handles newlines and long content without silently truncating it', () => {
  assert.ok(core.textHeight('first\nsecond', 400, 12, 20) > core.textHeight('first', 400, 12, 20));
  assert.throws(() => core.textHeight('x'.repeat(10000), 100, 12, 20), /oversized/);
});

test('synthetic runner has an explicit test-only size guard', () => {
  for (const count of [0, -1, 201, 1.5, NaN]) assert.throws(() => core.sample(count));
  assert.equal(core.plan(core.sample(200)).claimCount, 200);
});
