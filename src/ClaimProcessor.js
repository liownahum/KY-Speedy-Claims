/** Called under one installation-wide lock by the Google adapter. */
var ClaimProcessor = (function () {
  'use strict';
  function process(input, config, store, ports) {
    var records = store.records();
    var record = records.find(function (item) { return item.id === input.id; });
    if (record && record.status === 'DONE') return record;
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
  return { process: process };
}());
if (typeof module !== 'undefined') {
  var ClaimCore = require('./ClaimCore.js');
  module.exports = ClaimProcessor;
}
