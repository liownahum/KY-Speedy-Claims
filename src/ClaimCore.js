var ClaimCore = (function () {
  'use strict';
  function text(value, label, limit) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' is required.');
    value = value.trim();
    if (limit && value.length > limit) throw new Error(label + ' is too long.');
    return value;
  }
  function isoDate(value) {
    value = text(value, 'Date');
    var parsed = new Date(value + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new Error('Use a valid date in YYYY-MM-DD format.');
    }
    return value;
  }
  function money(value) {
    value = text(String(value), 'Amount');
    if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('Amount must be positive with at most two decimal places.');
    var parts = value.split('.');
    var cents = Number(parts[0]) * 100 + Number(((parts[1] || '') + '00').slice(0, 2));
    if (!Number.isSafeInteger(cents) || cents < 1 || cents > 1000000000000) throw new Error('Amount is outside the supported range.');
    return cents;
  }
  function monday(date) {
    var parsed = new Date(isoDate(date) + 'T00:00:00Z');
    parsed.setUTCDate(parsed.getUTCDate() - (parsed.getUTCDay() + 6) % 7);
    return parsed.toISOString().slice(0, 10);
  }
  function normalize(input, config) {
    if (!input || !config) throw new Error('Submission and event configuration are required.');
    var email = text(input.email, 'Collected email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid collected email is required.');
    var submitted = new Date(input.submittedAt);
    if (!Number.isFinite(submitted.getTime())) throw new Error('Submission timestamp is invalid.');
    var congregation = text(input.congregation, 'Congregation', 100);
    if (config.congregations.indexOf(congregation) === -1) throw new Error('Unsupported congregation.');
    if (!Array.isArray(input.fileIds) || input.fileIds.length !== 1 || typeof input.fileIds[0] !== 'string' || !/^[\w-]+$/.test(input.fileIds[0])) {
      throw new Error('Upload exactly one receipt image or PDF for each submission.');
    }
    return {
      id: text(input.id, 'Response ID'), personKey: email,
      submittedAt: submitted.toISOString(), week: monday(input.localSubmittedDate),
      payload: {
        email: email, fullName: text(input.fullName, 'Full name', 200),
        paymentDetails: text(input.paymentDetails, 'Payment details', 200),
        purchaseDate: isoDate(input.purchaseDate), description: text(input.description, 'Description', 1000),
        congregation: congregation, amountCents: money(input.amount), receiptFileId: input.fileIds[0]
      }
    };
  }
  function nextReceipt(records) {
    var ids = new Set();
    var numbers = new Set();
    var highest = 0;
    records.forEach(function (record) {
      if (!record.id || ids.has(record.id) || !Number.isSafeInteger(record.receiptNumber) || record.receiptNumber < 1 || numbers.has(record.receiptNumber)) {
        throw new Error('Claim register contains duplicate or invalid identities/numbers.');
      }
      ids.add(record.id); numbers.add(record.receiptNumber);
      highest = Math.max(highest, record.receiptNumber);
    });
    if (!Number.isSafeInteger(highest + 1)) throw new Error('Receipt sequence is exhausted.');
    return highest + 1;
  }
  function weekKey(record) { return record.personKey + '|' + record.week; }
  function weeklyPayload(records, current, config) {
    var matching = records.filter(function (record) {
      return record.personKey === current.personKey && record.week === current.week && record.receiptsReady;
    }).sort(function (a, b) { return a.receiptNumber - b.receiptNumber; });
    if (!matching.length) throw new Error('No receipt-ready claims for this week.');
    var first = matching[0].payload;
    matching.forEach(function (record) {
      if (record.payload.fullName !== first.fullName || record.payload.paymentDetails !== first.paymentDetails) {
        throw new Error('Name/payment details conflict within this week; finance review is required.');
      }
    });
    return {
      fullName: first.fullName, paymentDetails: first.paymentDetails,
      voucherDate: current.week, // Explicit test convention; production date policy remains open.
      eventTitle: config.eventTitle,
      claims: matching.map(function (record) {
        return { receiptNumber: record.receiptNumber, description: record.payload.description, congregation: record.payload.congregation, amountCents: record.payload.amountCents };
      })
    };
  }
  function receiptFilename(number, originalName, mimeType) {
    if (!/^image\//.test(mimeType) && mimeType !== 'application/pdf') throw new Error('Receipt must be an image or PDF.');
    var extension = String(originalName).match(/\.([a-zA-Z0-9]{1,8})$/);
    var fallback = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/webp': 'webp' };
    return String(number) + '.' + (extension ? extension[1].toLowerCase() : fallback[mimeType] || 'img');
  }
  return { normalize: normalize, money: money, monday: monday, nextReceipt: nextReceipt, weekKey: weekKey, weeklyPayload: weeklyPayload, receiptFilename: receiptFilename };
}());
if (typeof module !== 'undefined') module.exports = ClaimCore;
