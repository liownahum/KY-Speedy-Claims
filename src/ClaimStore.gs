/** Private finance register. State JSON is authoritative; raw Form responses are separate. */
function claimStore_(spreadsheet) {
  var headers = ['Response ID', 'Receipt no.', 'Reference', 'Submitted at', 'Week start', 'Claimant email', 'Full name', 'Description', 'Congregation', 'Amount', 'Status', 'Receipt', 'Weekly voucher', 'Last error', 'State JSON'];
  function sheet(name, expected) {
    var tab = spreadsheet.getSheetByName(name);
    if (!tab) {
      tab = spreadsheet.insertSheet(name);
    }
    if (tab.getLastRow() === 0) {
      tab.getRange(1, 1, 1, expected.length).setValues([expected]);
      tab.setFrozenRows(1);
    }
    var actual = tab.getRange(1, 1, 1, expected.length).getValues()[0];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Register headers changed in ' + name + '.');
    return tab;
  }
  var claims = sheet('Claims', headers);
  claims.getRange('J:J').setNumberFormat('0.00');
  claims.hideColumns(15);
  sheet('People', ['Key', 'State JSON']);
  sheet('Weeks', ['Key', 'State JSON']);
  function rows(tab, columns) {
    return tab.getLastRow() < 2 ? [] : tab.getRange(2, 1, tab.getLastRow() - 1, columns).getValues();
  }
  function records() {
    var result = rows(claims, headers.length).map(function (row) {
      var record;
      try { record = JSON.parse(row[14]); } catch (_) { throw new Error('Unreadable claim state; do not delete or edit register rows.'); }
      if (record.id !== row[0] || record.receiptNumber !== row[1]) throw new Error('Register identity columns do not match stored claim state.');
      return record;
    });
    ClaimCore.nextReceipt(result); // Verify ledger identities even when replaying a completed claim.
    return result;
  }
  function put(tab, key, values) {
    var existing = rows(tab, 1).findIndex(function (row) { return row[0] === key; });
    if (existing < 0) tab.appendRow(values);
    else tab.getRange(existing + 2, 1, 1, values.length).setValues([values]);
    SpreadsheetApp.flush();
  }
  return {
    records: records,
    saveRecord: function (record) {
      var p = record.payload;
      var values = [record.id, record.receiptNumber, record.reference, new Date(record.submittedAt), record.week, p.email, p.fullName, p.description, p.congregation, p.amountCents / 100, record.status, record.receiptUrl || '', record.weeklyFileId ? 'https://docs.google.com/spreadsheets/d/' + record.weeklyFileId + '/edit' : '', record.error || '', JSON.stringify(record)];
      put(claims, record.id, values.map(function (value) { return typeof value === 'string' ? VoucherCore.literal(value) : value; }));
    },
    getMeta: function (name, key) {
      var matching = rows(sheet(name, ['Key', 'State JSON']), 2).filter(function (row) { return row[0] === key; });
      if (matching.length > 1) throw new Error('Duplicate metadata key in ' + name + '.');
      return matching.length ? JSON.parse(matching[0][1]) : null;
    },
    saveMeta: function (name, key, value) {
      put(sheet(name, ['Key', 'State JSON']), key, [VoucherCore.literal(key), JSON.stringify(value)]);
    }
  };
}
