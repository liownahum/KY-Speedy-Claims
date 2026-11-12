/** Google Drive/Sheets effects for one event. Call only while holding claimLock_. */
function claimFilePorts_(config, store) {
  var root = DriveApp.getFolderById(config.rootFolderId);
  function markedFolder(parent, name, marker) {
    var folders = parent.getFoldersByName(name);
    var found = [];
    while (folders.hasNext()) {
      var folder = folders.next();
      if (folder.getDescription() === marker) found.push(folder);
    }
    if (found.length > 1) throw new Error('Duplicate marked folders need finance review.');
    if (found.length) return found[0];
    return parent.createFolder(name).setDescription(marker);
  }
  function ensurePerson(record) {
    var person = store.getMeta('People', record.personKey);
    if (person) return person;
    var marker = 'KYCLAIMS:' + config.eventId + ':' + record.personKey;
    var folder = markedFolder(root, record.payload.fullName, marker);
    var receipts = markedFolder(folder, 'Receipts', marker + ':receipts');
    person = { key: record.personKey, fullName: record.payload.fullName, folderId: folder.getId(), receiptFolderId: receipts.getId() };
    store.saveMeta('People', person.key, person);
    return person;
  }
  function ensureWeek(record, person) {
    var key = ClaimCore.weekKey(record);
    var week = store.getMeta('Weeks', key);
    if (week) {
      if (week.fullName !== record.payload.fullName || week.paymentDetails !== record.payload.paymentDetails) {
        throw new Error('Name/payment details changed within this week; finance review is required.');
      }
      DriveApp.getFileById(week.fileId).moveTo(DriveApp.getFolderById(person.folderId));
      return week;
    }
    var book = SpreadsheetApp.create('Claims - ' + record.payload.fullName + ' - week of ' + record.week);
    week = {
      key: key, fileId: book.getId(), week: record.week,
      fullName: record.payload.fullName, paymentDetails: record.payload.paymentDetails,
      revision: 0, rendered: null, fingerprint: '',
      garbage: book.getSheets().map(function (sheet) { return sheet.getSheetId(); })
    };
    store.saveMeta('Weeks', key, week);
    DriveApp.getFileById(book.getId()).moveTo(DriveApp.getFolderById(person.folderId));
    return week;
  }
  function fileReceipt(record, person) {
    var file = DriveApp.getFileById(record.payload.receiptFileId);
    var name = ClaimCore.receiptFilename(record.receiptNumber, file.getName(), file.getMimeType());
    file.setName(name);
    file.moveTo(DriveApp.getFolderById(person.receiptFolderId));
    return file.getUrl();
  }
  function removeOwnedSheets(book, week) {
    var active = week.rendered ? [week.rendered.sheetId, week.rendered.helperSheetId] : [];
    var garbage = new Set(week.garbage || []);
    book.getSheets().forEach(function (sheet) {
      var id = sheet.getSheetId();
      var staleStage = /^__KY_(STAGE|HELPER)_/.test(sheet.getName());
      if (active.indexOf(id) === -1 && (garbage.has(id) || staleStage)) book.deleteSheet(sheet);
    });
    week.garbage = [];
    store.saveMeta('Weeks', week.key, week);
  }
  function renderWeek(week, payload) {
    var book = SpreadsheetApp.openById(week.fileId);
    var fingerprint = JSON.stringify(payload);
    if (week.fingerprint === fingerprint && week.rendered) {
      removeOwnedSheets(book, week);
      activateRendered(book, week.rendered);
      return week.rendered;
    }
    if (week.rendered) removeOwnedSheets(book, week);
    else {
      // Keep the new workbook's default sheet until a rendered replacement exists.
      book.getSheets().forEach(function (sheet) {
        if (/^__KY_(STAGE|HELPER)_/.test(sheet.getName())) book.deleteSheet(sheet);
      });
    }
    var token = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
    var name = '__KY_STAGE_' + token;
    var helperName = '__KY_HELPER_' + token;
    var original = SpreadsheetApp.openById(config.nativeTemplateId).getSheetByName('Payment Voucher (full)');
    if (!original) throw new Error('Pristine full voucher template is missing.');
    var stage = original.copyTo(book).setName(name);
    var rendered = VoucherRenderer.render(book, payload, config.nativeTemplateId, { sheetName: name, configName: helperName });
    var previous = week.rendered;
    week.garbage = previous ? [previous.sheetId, previous.helperSheetId] : week.garbage;
    week.rendered = rendered;
    week.fingerprint = fingerprint;
    week.revision += 1;
    // Commit the verified sheet pointer before deleting the previous sheet.
    store.saveMeta('Weeks', week.key, week);
    removeOwnedSheets(book, week);
    activateRendered(book, rendered);
    return rendered;
  }
  function activateRendered(book, rendered) {
    var active = book.getSheets().find(function (sheet) { return sheet.getSheetId() === rendered.sheetId; });
    if (!active) throw new Error('Committed voucher worksheet is missing; finance review is required.');
    // Finance may already use the usual label for an unrelated worksheet.
    // Keep that sheet intact and choose an available display name for ours.
    var occupiedNames = book.getSheets().filter(function (sheet) {
      return sheet.getSheetId() !== rendered.sheetId;
    }).map(function (sheet) { return sheet.getName().toLowerCase(); });
    var name = 'Voucher';
    var suffix = 2;
    while (occupiedNames.indexOf(name.toLowerCase()) !== -1) {
      name = 'Voucher (' + suffix + ')';
      suffix += 1;
    }
    if (active.getName() !== name) active.setName(name);
    book.setActiveSheet(active);
  }
  return { ensurePerson: ensurePerson, ensureWeek: ensureWeek, fileReceipt: fileReceipt, renderWeek: renderWeek };
}
