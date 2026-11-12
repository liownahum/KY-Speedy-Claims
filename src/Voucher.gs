/** Render only a fresh disposable copy of the inspected full payment voucher. */
var VoucherRenderer = (function () {
  'use strict';
  var SHEET_NAME = 'Payment Voucher (full)';
  var CONFIG_NAME = '_KY_Voucher_Config';

  function clean(value) { return String(value).replace(/\s+/g, ' ').trim(); }

  function validateTemplate(sheet) {
    if (!sheet) throw new Error('Full payment voucher worksheet is missing.');
    var anchors = {
      B4: 'PAYMENT VOUCHER', G6: 'Date :', B8: 'Pay to :', F8: 'Bank A/c/PayNow:',
      B10: 'R No.', C10: 'Description', G10: 'Congregation', H10: 'Amount',
      G41: 'Total:', B43: 'Prepared by :', F43: 'Payment approved by :', B45: 'Verified by :'
    };
    Object.keys(anchors).forEach(function (address) {
      if (clean(sheet.getRange(address).getDisplayValue()) !== anchors[address]) {
        throw new Error('Template does not match the inspected layout at ' + address + '.');
      }
    });
    var formula = sheet.getRange('H41').getFormula().replace(/\s/g, '').toUpperCase();
    if (formula !== '=IF(SUM(H11:H40)>0,SUM(H11:H40),"")') {
      throw new Error('Template total formula does not match the inspected original.');
    }
    ['B11:H40', 'H6', 'C8:E8', 'G8:H8', 'D43:E43', 'G43:H43', 'D45:E45'].forEach(function (address) {
      var range = sheet.getRange(address);
      var occupied = range.getValues().some(function (row) {
        return row.some(function (value) { return clean(value) !== ''; });
      });
      var formulas = range.getFormulas().some(function (row) {
        return row.some(function (value) { return Boolean(value); });
      });
      if (occupied || formulas || range.getMergedRanges().length) {
        throw new Error('Expected a blank, unmerged template input area at ' + address + '.');
      }
    });
    var options = sheet.getRange('X10:X16').getValues().map(function (row) { return clean(row[0]); });
    if (options.some(function (value) { return !value; }) || new Set(options).size !== options.length) {
      throw new Error('Template congregation list is missing or ambiguous.');
    }
    return options;
  }

  function width(sheet, start, end) {
    var sum = 0;
    for (var column = start; column <= end; column++) sum += sheet.getColumnWidth(column);
    return sum;
  }

  function titleHeight(sheet, address) {
    return 8 + Math.ceil(sheet.getRange(address).getFontSize() * 4 / 3 * 1.4);
  }

  function render(spreadsheet, payload, sourceFileId, destination) {
    destination = destination || {};
    var sheetName = destination.sheetName || SHEET_NAME;
    var configName = destination.configName || CONFIG_NAME;
    var plan = VoucherCore.plan(payload);
    if (!sourceFileId || spreadsheet.getId() === sourceFileId) {
      throw new Error('Render into a disposable copy, never the source template.');
    }
    var sheet = spreadsheet.getSheetByName(sheetName);
    var options = validateTemplate(sheet);
    plan.congregations.forEach(function (value) {
      if (options.indexOf(value) === -1) throw new Error('A claim has an unsupported congregation.');
    });
    if (spreadsheet.getSheetByName(configName)) {
      throw new Error('Prototype configuration already exists; use a fresh template copy.');
    }
    var baseHeight = sheet.getRowHeight(12);
    var fontSize = sheet.getRange('C12').getFontSize();
    var descriptionWidth = width(sheet, 3, 6);
    var rowHeights = plan.descriptions.map(function (text) {
      return VoucherCore.textHeight(text, descriptionWidth, fontSize, baseHeight);
    });
    var headerHeight = Math.max(
      VoucherCore.textHeight(plan.fullName, width(sheet, 3, 5), sheet.getRange('C8').getFontSize(), sheet.getRowHeight(8)),
      VoucherCore.textHeight(plan.paymentDetails, width(sheet, 7, 8), sheet.getRange('G8').getFontSize(), sheet.getRowHeight(8))
    );

    // Save helper values and a clean row style before whole-row deletion can move them.
    var helper = spreadsheet.insertSheet(configName);
    var list = helper.getRange(1, 1, options.length, 1);
    list.setValues(options.map(function (value) { return [VoucherCore.literal(value)]; }));
    var rowStyle = helper.getRange('C10:I10');
    sheet.getRange('B12:H12').copyTo(rowStyle, { formatOnly: true });
    rowStyle.clearDataValidations();
    helper.hideSheet();

    // Old dropdowns reference X10:X16 on rows that may be deleted below.
    sheet.getRange('B11:H40').clearDataValidations();
    if (plan.claimCount < 30) sheet.deleteRows(11 + plan.claimCount, 30 - plan.claimCount);
    if (plan.claimCount > 30) sheet.insertRowsBefore(41, plan.claimCount - 30);
    rowStyle.copyFormatToRange(sheet, 2, 8, 11, plan.lastClaimRow);
    var claimRange = sheet.getRange(11, 2, plan.claimCount, 7);
    claimRange.clearDataValidations();
    var rule = SpreadsheetApp.newDataValidation().requireValueInRange(list, true).setAllowInvalid(false).build();
    sheet.getRange(11, 7, plan.claimCount, 1).setDataValidation(rule);
    SpreadsheetApp.flush();
    claimRange.setValues(plan.rows);

    // C:F is already one visible Description column. Merge within that span only
    // in this working copy so long text can wrap without altering the visible columns.
    sheet.getRange(11, 3, plan.claimCount, 4).mergeAcross().setWrap(true);
    sheet.getRange('C8:E8').merge().setWrap(true);
    sheet.getRange('C8').setValue(VoucherCore.literal(plan.fullName));
    sheet.getRange('G8:H8').merge().setWrap(true);
    sheet.getRange('G8').setValue(VoucherCore.literal(plan.paymentDetails));
    sheet.setRowHeight(8, headerHeight);
    rowHeights.forEach(function (height, index) { sheet.setRowHeight(11 + index, height); });
    sheet.getRange('H6').setValue(plan.dateSerial).setNumberFormat('dd mmm yyyy');
    sheet.getRange(11, 8, plan.claimCount, 1).setNumberFormat('0.00');
    sheet.getRange(plan.totalRow, 8).setFormula(plan.totalFormula).setNumberFormat('0.00');
    // Imported merged titles can have explicit row heights smaller than their font.
    sheet.setRowHeight(2, Math.max(sheet.getRowHeight(2), titleHeight(sheet, 'B2') - sheet.getRowHeight(3)));
    sheet.setRowHeight(4, Math.max(sheet.getRowHeight(4), titleHeight(sheet, 'B4')));
    // Repeating the full frozen header with a bounded print range duplicated it
    // in the user's one-claim PDF. Keep the prototype header in the content only.
    sheet.setFrozenRows(0);
    SpreadsheetApp.flush();
    var actualTotal = sheet.getRange(plan.totalRow, 8).getValue();
    if (typeof actualTotal !== 'number' || Math.round(actualTotal * 100) !== plan.totalCents) {
      throw new Error('Calculated voucher total does not match the claims; review the retained copy.');
    }
    return {
      spreadsheetId: spreadsheet.getId(), sheetId: sheet.getSheetId(),
      helperSheetId: helper.getSheetId(),
      claimCount: plan.claimCount, totalCents: plan.totalCents,
      lastPrintRow: plan.lastPrintRow, needsPrintReview: true
    };
  }

  function exportPdf(spreadsheet, rendered, folder, filename) {
    if (rendered.spreadsheetId !== spreadsheet.getId()) throw new Error('PDF bounds belong to a different workbook.');
    var query = VoucherCore.pdfQuery(rendered.sheetId, rendered.lastPrintRow);
    SpreadsheetApp.flush();
    Utilities.sleep(500);
    var response = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + spreadsheet.getId() + '/export?' + query, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
    });
    var blob = response.getBlob();
    if (response.getResponseCode() !== 200 || !/^application\/pdf\b/i.test(blob.getContentType())) {
      throw new Error('PDF export failed (HTTP ' + response.getResponseCode() + '); no PDF was saved.');
    }
    var bytes = blob.getBytes();
    if (bytes.length < 5 || String.fromCharCode.apply(null, bytes.slice(0, 5)) !== '%PDF-') {
      throw new Error('Export response is not a PDF; no PDF was saved.');
    }
    return folder.createFile(blob.setName(filename));
  }

  return {
    render: render, exportPdf: exportPdf,
    templateOptions: function (spreadsheet) { return validateTemplate(spreadsheet.getSheetByName(SHEET_NAME)); }
  };
}());
