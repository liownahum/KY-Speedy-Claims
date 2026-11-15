/** Called under one installation-wide lock by the Google adapter. */
var ClaimProcessor = (function () {
  'use strict';
  function process(input, config, store, ports) {
    var records = store.records();
    var record = records.find(function (item) { return item.id === input.id; });
    if (record && (record.status === 'DONE' || record.status === 'CANCELLED')) return record;
    if (!record) {
      var normalized = ClaimCore.normalize(input, config);
      if (records.some(function (item) { return item.payload.receiptFileId === normalized.payload.receiptFileId; })) {
        throw new Error('This uploaded receipt file is already linked to a different submission.');
      }
      record = Object.assign(normalized, {
        receiptNumber: ClaimCore.nextReceipt(records), status: 'PENDING', receiptsReady: false, error: ''
      });
      record.reference = config.eventCode + '-' + String(record.receiptNumber).padStart(6, '0');
      store.saveRecord(record); // Persist number and response ID before any Drive side effects.
    }
    try {
      var person = ports.ensurePerson(record);
      var week = ports.ensureWeek(record, person);
      record.weeklyFileId = week.fileId;
      store.saveRecord(record);
      record.receiptUrl = ports.fileReceipt(record, person);
      record.receiptsReady = true;
      store.saveRecord(record);
      var payload = ClaimCore.weeklyPayload(store.records(), record, config);
      ports.renderWeek(week, payload);
      record.status = 'DONE'; record.error = '';
      store.saveRecord(record);
      return record;
    } catch (error) {
      record.status = 'ERROR'; record.error = String(error.message || error).slice(0, 1000);
      store.saveRecord(record);
      throw error;
    }
  }
  function cancel(id, reason, actor, config, store, ports) {
    var record = store.records().find(function (item) { return item.id === id; });
    if (!record) throw new Error('Claim not found in this event.');
    if (record.status !== 'CANCELLED') {
      if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) {
        throw new Error('Enter a cancellation reason of 1 to 500 characters.');
      }
      record.status = 'CANCELLED';
      record.cancellation = { reason: reason.trim(), at: new Date().toISOString(), by: actor || '', pending: true };
      record.error = '';
      // Publish the exclusion before touching the voucher. A failure must never restore the claim.
      store.saveRecord(record);
    }
    return repairCancellation(record, config, store, ports);
  }
  function repairCancellation(record, config, store, ports) {
    if (record.status !== 'CANCELLED' || !record.cancellation) throw new Error('Cancellation audit record is missing.');
    if (!record.cancellation.pending) return record;
    try {
      ports.rebuildCancelledWeek(record, ClaimCore.weeklyPayload(store.records(), record, config));
      record.cancellation.pending = false;
      record.error = '';
      store.saveRecord(record);
      return record;
    } catch (error) {
      record.cancellation.pending = true;
      record.error = 'Claim cancelled; voucher update pending. Retry incomplete submissions. ' + String(error.message || error).slice(0, 800);
      store.saveRecord(record);
      throw new Error(record.error);
    }
  }
  return { process: process, cancel: cancel, repairCancellation: repairCancellation };
}());
if (typeof module !== 'undefined') {
  var ClaimCore = require('./ClaimCore.js');
  module.exports = ClaimProcessor;
}
