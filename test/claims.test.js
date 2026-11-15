'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/ClaimCore.js');
const processor = require('../src/ClaimProcessor.js');
const config = { eventCode: 'TEST', eventTitle: 'Test Event', congregations: ['Youth', 'English'] };
const clone = value => JSON.parse(JSON.stringify(value));
function input(id = 'response-1', email = 'a@example.com', date = '2026-11-12') {
  return {
    id, email, submittedAt: date + 'T04:00:00Z', localSubmittedDate: date,
    fullName: 'Sample Claimant', paymentDetails: 'SAMPLE ONLY', purchaseDate: '2026-10-01',
    description: 'Printing', congregation: 'Youth', amount: '12.50', fileIds: ['file-' + id]
  };
}
function environment() {
  const records = new Map();
  const people = new Map();
  const weeks = new Map();
  const files = new Map();
  const rendered = new Map();
  const calls = [];
  const store = { records: () => clone([...records.values()]), saveRecord: record => records.set(record.id, clone(record)) };
  const env = { store, records, people, weeks, files, rendered, calls, failure: null };
  function maybeFail(stage) {
    if (env.failure === stage) { env.failure = null; throw new Error('Simulated ' + stage + ' failure'); }
  }
  const ports = {
    ensurePerson(record) {
      calls.push('person');
      if (!people.has(record.personKey)) people.set(record.personKey, { folderId: 'person-' + people.size });
      return people.get(record.personKey);
    },
    ensureWeek(record) {
      calls.push('week');
      const key = core.weekKey(record);
      if (!weeks.has(key)) weeks.set(key, { fileId: 'week-' + weeks.size, fullName: record.payload.fullName, paymentDetails: record.payload.paymentDetails });
      const week = weeks.get(key);
      if (week.fullName !== record.payload.fullName || week.paymentDetails !== record.payload.paymentDetails) throw new Error('Personal details conflict');
      return week;
    },
    fileReceipt(record, person) {
      calls.push('receipt');
      files.set(record.payload.receiptFileId, { folderId: person.folderId, name: record.receiptNumber + '.png' });
      maybeFail('receipt');
      return 'https://example.com/' + record.payload.receiptFileId;
    },
    renderWeek(week, payload) {
      calls.push('render');
      rendered.set(week.fileId, clone(payload));
      maybeFail('render');
    },
    rebuildCancelledWeek(record, payload) {
      const week = weeks.get(core.weekKey(record));
      if (week) this.renderWeek(week, payload);
    }
  };
  env.process = data => processor.process(data, config, store, ports);
  env.cancel = (id, reason = 'Incorrect amount', actor = 'admin@example.com') => processor.cancel(id, reason, actor, config, store, ports);
  env.repair = id => processor.repairCancellation(store.records().find(item => item.id === id), config, store, ports);
  return env;
}

test('groups by the Singapore submission date, not the purchase date', () => {
  const data = input();
  assert.equal(core.normalize(data, config).week, '2026-11-09');
  data.submittedAt = '2026-11-15T16:30:00Z';
  data.localSubmittedDate = '2026-11-16';
  assert.equal(core.normalize(data, config).week, '2026-11-16');
  assert.equal(core.monday('2027-01-01'), '2026-12-28');
});

test('money is parsed into exact integer cents and invalid money is rejected', () => {
  assert.equal(core.money('0.01'), 1);
  assert.equal(core.money('12.5'), 1250);
  assert.equal(core.money('0012.50'), 1250);
  for (const invalid of ['0', '-1', '1,000', '1e2', '1.001', 'NaN', '', '100000000000.00']) assert.throws(() => core.money(invalid));
});

test('normalizes claimant identity without dropping email aliases', () => {
  const data = input(); data.email = ' A+Test@Example.COM ';
  assert.equal(core.normalize(data, config).personKey, 'a+test@example.com');
});

test('first submission is reserved, filed, rendered, and marked complete', () => {
  const env = environment();
  const result = env.process(input());
  assert.equal(result.status, 'DONE');
  assert.equal(result.receiptNumber, 1);
  assert.equal(result.reference, 'TEST-000001');
  assert.equal(env.people.size, 1); assert.equal(env.weeks.size, 1);
  assert.equal(env.files.get('file-response-1').name, '1.png');
  assert.equal(env.rendered.get('week-0').claims.length, 1);
});

test('same person/week reuses the workbook and includes both claims exactly once', () => {
  const env = environment();
  const first = env.process(input());
  const next = input('response-2'); next.amount = '7.25';
  const second = env.process(next);
  assert.equal(first.weeklyFileId, second.weeklyFileId);
  assert.equal(env.people.size, 1); assert.equal(env.weeks.size, 1);
  assert.deepEqual(env.rendered.get('week-0').claims.map(claim => claim.receiptNumber), [1, 2]);
  assert.equal(env.rendered.get('week-0').claims.reduce((sum, claim) => sum + claim.amountCents, 0), 1975);
});

test('receipt sequence is shared across claimants, while their weekly files are separate', () => {
  const env = environment();
  env.process(input('r1')); env.process(input('r2', 'b@example.com')); env.process(input('r3'));
  assert.equal(env.people.size, 2); assert.equal(env.weeks.size, 2);
  assert.deepEqual(env.rendered.get('week-0').claims.map(claim => claim.receiptNumber), [1, 3]);
  assert.deepEqual(env.rendered.get('week-1').claims.map(claim => claim.receiptNumber), [2]);
});

test('new submission week creates a new workbook for the same person', () => {
  const env = environment();
  env.process(input('r1')); env.process(input('r2', 'a@example.com', '2026-11-16'));
  assert.equal(env.people.size, 1); assert.equal(env.weeks.size, 2);
  assert.equal(env.rendered.get('week-0').claims.length, 1);
  assert.equal(env.rendered.get('week-1').voucherDate, '2026-11-16');
});

test('replaying a completed response produces no new effects or receipt number', () => {
  const env = environment(); env.process(input());
  const before = env.calls.length;
  assert.equal(env.process(input()).receiptNumber, 1);
  assert.equal(env.calls.length, before); assert.equal(env.records.size, 1);
});

for (const stage of ['receipt', 'render']) {
  test(`retry after ${stage} failure keeps the reserved number and one canonical claim`, () => {
    const env = environment(); env.failure = stage;
    assert.throws(() => env.process(input()), /Simulated/);
    assert.equal(env.records.get('response-1').status, 'ERROR');
    assert.equal(env.records.get('response-1').receiptNumber, 1);
    assert.equal(env.process(input()).status, 'DONE');
    assert.equal(env.records.size, 1); assert.equal(env.files.size, 1);
    assert.equal(env.rendered.get('week-0').claims.length, 1);
  });
}

test('a later claim can rebuild the week after an earlier rendering failure', () => {
  const env = environment(); env.failure = 'render';
  assert.throws(() => env.process(input('r1')));
  env.process(input('r2'));
  assert.deepEqual(env.rendered.get('week-0').claims.map(claim => claim.receiptNumber), [1, 2]);
  env.process(input('r1'));
  assert.equal(env.rendered.get('week-0').claims.length, 2);
});

test('retrying a saved claim keeps its original congregation after form settings change', () => {
  const env = environment();
  const original = input('r1'); original.congregation = 'English';
  env.failure = 'render';
  assert.throws(() => env.process(original), /Simulated/);
  assert.equal(env.records.get('r1').payload.congregation, 'English');

  const current = input('r1'); current.congregation = 'Youth';
  assert.equal(env.process(current).status, 'DONE');
  assert.equal(env.records.get('r1').payload.congregation, 'English');
  assert.equal(env.rendered.get('week-0').claims[0].congregation, 'English');
  assert.equal(env.records.get('r1').receiptNumber, 1);
});

test('an uncertain reservation write is recovered using the saved response ID', () => {
  const env = environment(); const save = env.store.saveRecord;
  let first = true;
  env.store.saveRecord = record => { save(record); if (first) { first = false; throw new Error('Write acknowledgement lost'); } };
  assert.throws(() => env.process(input()), /acknowledgement/);
  assert.equal(env.calls.length, 0);
  assert.equal(env.process(input()).receiptNumber, 1);
  assert.equal(env.records.size, 1);
});

test('a completion-write failure can be retried without duplicating the voucher claim', () => {
  const env = environment(); const save = env.store.saveRecord; let fail = true;
  env.store.saveRecord = record => {
    save(record);
    if (record.status === 'DONE' && fail) { fail = false; throw new Error('Completion write failed'); }
  };
  assert.throws(() => env.process(input()), /Completion/);
  assert.equal(env.process(input()).status, 'DONE');
  assert.equal(env.rendered.get('week-0').claims.length, 1);
});

test('invalid input fails before reserving a number or changing Drive resources', () => {
  for (const mutate of [data => { data.email = 'bad'; }, data => { data.amount = '0'; }, data => { data.fileIds = []; }, data => { data.fileIds.push('second'); }, data => { data.purchaseDate = '2026-02-30'; }, data => { data.congregation = 'Unknown'; }]) {
    const env = environment(); const data = input(); mutate(data);
    assert.throws(() => env.process(data));
    assert.equal(env.records.size, 0); assert.equal(env.calls.length, 0);
  }
});

test('a receipt file already assigned to another response cannot be reassigned', () => {
  const env = environment(); env.process(input());
  const data = input('second'); data.fileIds = ['file-response-1'];
  assert.throws(() => env.process(data), /already linked/);
  assert.equal(env.records.size, 1);
});

test('conflicting payment details preserve the prior voucher and flag the new claim', () => {
  const env = environment(); env.process(input());
  const data = input('second'); data.paymentDetails = 'DIFFERENT';
  assert.throws(() => env.process(data), /conflict/);
  assert.equal(env.records.get('second').status, 'ERROR');
  assert.equal(env.files.has('file-second'), false);
  assert.equal(env.rendered.get('week-0').claims.length, 1);
});

test('the original 30-row layout is not a limit on collected claims', () => {
  const env = environment();
  for (let i = 1; i <= 31; i++) env.process(input('r' + i));
  assert.equal(env.weeks.size, 1); assert.equal(env.rendered.get('week-0').claims.length, 31);
});

test('receipt naming retains extensions and rejects unsupported file types', () => {
  assert.equal(core.receiptFilename(3, 'Photo.JPG', 'image/jpeg'), '3.jpg');
  assert.equal(core.receiptFilename(4, 'Scan', 'application/pdf'), '4.pdf');
  assert.throws(() => core.receiptFilename(5, 'sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
});

test('corrupt or duplicate register identities prevent number allocation', () => {
  const item = { id: 'r1', receiptNumber: 1 };
  assert.equal(core.nextReceipt([]), 1);
  assert.equal(core.nextReceipt([item, { id: 'r2', receiptNumber: 4 }]), 5);
  assert.throws(() => core.nextReceipt([item, item]));
  assert.throws(() => core.nextReceipt([item, { id: 'r2', receiptNumber: 1 }]));
});

test('each event normalises its own distinct category names and letters', () => {
  assert.deepEqual(core.categories([{ name: ' Games ', prefix: ' g ' }, { name: 'Hospitality', prefix: 'h' }]), [
    { name: 'Games', prefix: 'G' }, { name: 'Hospitality', prefix: 'H' }
  ]);
  assert.deepEqual(core.categories([{ name: 'Transport', prefix: 'G' }]), [{ name: 'Transport', prefix: 'G' }]);
  for (const values of [null, [{ name: '', prefix: 'G' }], [{ name: 'Games', prefix: '' }],
    [{ name: 'Games', prefix: 'G1' }], [{ name: 'Games', prefix: 'AB' }],
    [{ name: 'Games', prefix: 'G' }, { name: 'games', prefix: 'H' }],
    [{ name: 'Games', prefix: 'G' }, { name: 'Decor', prefix: 'g' }]]) {
    assert.throws(() => core.categories(values));
  }
  assert.throws(() => core.categories(Array.from({ length: 26 }, (_, index) => ({ name: String.fromCharCode(65 + index) + '界'.repeat(79), prefix: String.fromCharCode(65 + index) }))), /too long/);
});

test('active category mappings permit additions but prohibit removal, renaming and reused letters', () => {
  const initial = core.categories([{ name: 'Games', prefix: 'G' }]);
  assert.doesNotThrow(() => core.categoryChanges(initial, [...initial, { name: 'Decor', prefix: 'D' }], true));
  for (const next of [[], [{ name: 'Games', prefix: 'D' }], [{ name: 'Gaming', prefix: 'G' }]]) {
    assert.throws(() => core.categoryChanges(initial, next, true), /Keep existing/);
    assert.doesNotThrow(() => core.categoryChanges(initial, next, false));
  }
});

test('category and receipt type are validated and snapshotted without changing legacy input', () => {
  const settings = { ...config, categories: core.categories([{ name: 'Games', prefix: 'G' }]) };
  const data = { ...input(), category: 'Games', receiptType: 'Hardcopy' };
  const claim = core.normalize(data, settings);
  assert.equal(claim.payload.category, 'Games');
  assert.equal(claim.payload.categoryPrefix, 'G');
  assert.equal(claim.payload.receiptType, 'Hardcopy');
  assert.equal(core.normalize({ ...data, receiptType: 'E-receipt' }, settings).payload.receiptType, 'E-receipt');
  for (const override of [{ category: undefined }, { category: 'Other' }, { receiptType: undefined }, { receiptType: 'Photo' }]) {
    assert.throws(() => core.normalize({ ...data, ...override }, settings));
  }
  assert.equal(core.normalize(data, config).payload.category, undefined);
});

test('cancellation keeps the original claim and receipt while rebuilding only active totals', () => {
  const env = environment();
  const original = env.process(input('r1'));
  env.process({ ...input('r2'), amount: '7.25' });
  env.process(input('other', 'b@example.com'));
  const files = clone([...env.files]);
  const cancelled = env.cancel('r1', '  Incorrect amount  ');
  assert.equal(cancelled.status, 'CANCELLED');
  assert.deepEqual(cancelled.payload, original.payload);
  assert.equal(cancelled.receiptNumber, 1);
  assert.equal(cancelled.receiptUrl, original.receiptUrl);
  assert.equal(cancelled.weeklyFileId, original.weeklyFileId);
  assert.equal(cancelled.cancellation.reason, 'Incorrect amount');
  assert.equal(cancelled.cancellation.by, 'admin@example.com');
  assert.ok(Number.isFinite(Date.parse(cancelled.cancellation.at)));
  assert.equal(cancelled.cancellation.pending, false);
  assert.deepEqual([...env.files], files);
  assert.deepEqual(env.rendered.get('week-0').claims.map(item => item.receiptNumber), [2]);
  assert.equal(env.rendered.get('week-0').claims[0].amountCents, 725);
  assert.equal(env.rendered.get('week-1').claims.length, 1);
  assert.equal(env.process(input('replacement')).receiptNumber, 4);
});

test('cancellation is permanent and repeated requests preserve the original audit and number', () => {
  const env = environment(); env.process(input('r1')); env.cancel('r1');
  const saved = clone(env.records.get('r1'));
  const calls = env.calls.length;
  assert.deepEqual(env.process(input('r1')), saved);
  assert.deepEqual(env.cancel('r1', 'Different reason', 'other@example.com'), saved);
  assert.equal(env.calls.length, calls);
  assert.throws(() => env.process({ ...input('r2'), fileIds: ['file-r1'] }), /already linked/);
});

test('cancelling the last claim produces an empty active week and replacement starts at a new number', () => {
  const env = environment(); env.process(input('r1')); env.cancel('r1');
  assert.deepEqual(env.rendered.get('week-0').claims, []);
  env.process(input('r2'));
  assert.deepEqual(env.rendered.get('week-0').claims.map(item => item.receiptNumber), [2]);
});

test('invalid reasons and unknown claim IDs have no cancellation effects', () => {
  const env = environment(); env.process(input('r1'));
  const original = clone(env.records.get('r1')); const calls = env.calls.length;
  for (const reason of ['', '  ', 'a'.repeat(501), null]) assert.throws(() => env.cancel('r1', reason), /reason/);
  assert.throws(() => env.cancel('unknown'), /not found/);
  assert.deepEqual(env.records.get('r1'), original);
  assert.equal(env.calls.length, calls);
});

test('failed cancellation rendering remains CANCELLED and canonical retry repairs it without changing the audit', () => {
  const env = environment(); env.process(input('r1')); env.process(input('r2'));
  env.failure = 'render';
  assert.throws(() => env.cancel('r1'), /cancelled; voucher update pending/);
  const saved = clone(env.records.get('r1'));
  assert.equal(saved.status, 'CANCELLED'); assert.equal(saved.cancellation.pending, true);
  assert.equal(env.process(input('r1')).status, 'CANCELLED');
  const repaired = env.repair('r1');
  assert.deepEqual(repaired.cancellation, { ...saved.cancellation, pending: false });
  assert.equal(repaired.error, '');
  assert.deepEqual(env.rendered.get('week-0').claims.map(item => item.receiptNumber), [2]);
});

test('lost cancellation reservation acknowledgement leaves a recoverable exclusion before voucher effects', () => {
  const env = environment(); env.process(input('r1'));
  const save = env.store.saveRecord; let fail = true;
  env.store.saveRecord = record => { save(record); if (fail) { fail = false; throw new Error('Acknowledgement lost'); } };
  assert.throws(() => env.cancel('r1'), /Acknowledgement/);
  assert.equal(env.records.get('r1').status, 'CANCELLED');
  assert.equal(env.records.get('r1').cancellation.pending, true);
  assert.equal(env.rendered.get('week-0').claims.length, 1);
  env.repair('r1'); assert.equal(env.rendered.get('week-0').claims.length, 0);
});

test('cancellation completion write failure can be repaired without reviving the claim', () => {
  const env = environment(); env.process(input('r1'));
  const save = env.store.saveRecord; let fail = true;
  env.store.saveRecord = record => {
    save(record);
    if (record.cancellation && !record.cancellation.pending && fail) { fail = false; throw new Error('Completion failed'); }
  };
  assert.throws(() => env.cancel('r1'), /Completion failed/);
  assert.equal(env.records.get('r1').status, 'CANCELLED');
  env.repair('r1'); assert.equal(env.records.get('r1').cancellation.pending, false);
  assert.equal(env.rendered.get('week-0').claims.length, 0);
});

test('a failed claim can be cancelled before any receipt or workbook exists', () => {
  const env = environment(); env.process(input('r1'));
  const bad = { ...input('r2'), paymentDetails: 'WRONG DETAILS' };
  assert.throws(() => env.process(bad), /conflict/);
  env.cancel('r2');
  assert.equal(env.files.has('file-r2'), false);
  assert.deepEqual(env.rendered.get('week-0').claims.map(item => item.receiptNumber), [1]);
  assert.equal(env.records.get('r2').status, 'CANCELLED');
});
