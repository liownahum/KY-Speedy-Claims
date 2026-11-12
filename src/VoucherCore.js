/* Shared by the Apps Script V8 runtime and the dependency-free Node tests. */
var VoucherCore = (function () {
  'use strict';

  function requiredText(value, label) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(label + ' is required.');
    }
    return value.trim();
  }

  // User-provided text must remain literal when sent to a spreadsheet.
  function literal(value) {
    return /^[=+@'\-]/.test(value) ? "'" + value : value;
  }

  function dateSerial(isoDate) {
    if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      throw new Error('Voucher date must be YYYY-MM-DD.');
    }
    var date = new Date(isoDate + 'T00:00:00.000Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== isoDate) {
      throw new Error('Voucher date is not a valid calendar date.');
    }
    return (date.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
  }

  function plan(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('Voucher data is required.');
    var fullName = requiredText(payload.fullName, 'Full name');
    var paymentDetails = requiredText(payload.paymentDetails, 'Payment details');
    var voucherDate = dateSerial(payload.voucherDate);
    var eventTitle = requiredText(payload.eventTitle, 'Event title');
    if (!Array.isArray(payload.claims) || payload.claims.length === 0) {
      throw new Error('A voucher needs at least one claim.');
    }
    var seen = new Set();
    var totalCents = 0;
    var descriptions = [];
    var congregations = [];
    var rows = Array.from(payload.claims, function (claim, index) {
      if (!claim || !Number.isSafeInteger(claim.receiptNumber) || claim.receiptNumber < 1) {
        throw new Error('Claim ' + (index + 1) + ' needs a positive integer receipt number.');
      }
      if (seen.has(claim.receiptNumber)) throw new Error('Duplicate receipt number in voucher.');
      seen.add(claim.receiptNumber);
      if (!Number.isSafeInteger(claim.amountCents) || claim.amountCents < 1) {
        throw new Error('Claim ' + (index + 1) + ' needs a positive integer amount in cents.');
      }
      totalCents += claim.amountCents;
      // Leave headroom for conversion to spreadsheet decimal amounts.
      if (!Number.isSafeInteger(totalCents) || totalCents > 1000000000000) {
        throw new Error('Voucher total exceeds the supported monetary precision.');
      }
      var description = eventTitle + ' - ' + requiredText(claim.description, 'Item description');
      var congregation = requiredText(claim.congregation, 'Congregation');
      descriptions.push(description);
      congregations.push(congregation);
      return [claim.receiptNumber, literal(description), '', '', '', literal(congregation), claim.amountCents / 100];
    });
    var count = rows.length;
    var lastClaimRow = 10 + count;
    return {
      fullName: fullName,
      paymentDetails: paymentDetails,
      dateSerial: voucherDate,
      rows: rows,
      descriptions: descriptions,
      congregations: congregations,
      claimCount: count,
      totalCents: totalCents,
      firstClaimRow: 11,
      lastClaimRow: lastClaimRow,
      totalRow: lastClaimRow + 1,
      signatureRow: lastClaimRow + 3,
      lastPrintRow: lastClaimRow + 5,
      totalFormula: '=IF(SUM(H11:H' + lastClaimRow + ')>0,SUM(H11:H' + lastClaimRow + '),"")'
    };
  }

  function sample(claimCount) {
    if (!Number.isInteger(claimCount) || claimCount < 1 || claimCount > 200) {
      throw new Error('Choose 1 to 200 claims for this synthetic prototype run.');
    }
    return {
      fullName: 'SAMPLE - DO NOT SUBMIT',
      paymentDetails: 'SAMPLE ONLY - NOT PAYABLE',
      voucherDate: '2026-11-12',
      eventTitle: 'Sample Event',
      claims: Array.from({ length: claimCount }, function (_, index) {
        return {
          receiptNumber: 1 + 3 * index,
          description: 'Test item ' + (index + 1),
          congregation: 'Youth',
          amountCents: 1250 + index
        };
      })
    };
  }

  // Conservative row sizing for wrapped content; Google print layout still needs review.
  function textHeight(text, widthPx, fontSize, minimumPx) {
    var columns = Math.max(1, Math.floor((widthPx - 12) / (fontSize * 4 / 3)));
    var lines = text.split(/\r?\n/).reduce(function (sum, line) {
      return sum + Math.max(1, Math.ceil(Array.from(line).length / columns));
    }, 0);
    var height = Math.max(minimumPx, 8 + lines * Math.ceil(fontSize * 4 / 3 * 1.4));
    if (height > 400) {
      throw new Error('Text needs an oversized row; review the description or name before exporting.');
    }
    return height;
  }

  function pdfQuery(sheetId, lastPrintRow) {
    if (!Number.isSafeInteger(sheetId) || sheetId < 0 || !Number.isSafeInteger(lastPrintRow) || lastPrintRow < 16) {
      throw new Error('Invalid voucher print bounds.');
    }
    var settings = {
      format: 'pdf', gid: sheetId, size: 'A4', portrait: true,
      scale: 2, // Fit width; do not force an arbitrarily long voucher onto one page.
      sheetnames: false, printtitle: false, gridlines: false, fzr: true,
      pagenum: 'UNDEFINED', attachment: true,
      top_margin: 0.25, bottom_margin: 0.25, left_margin: 0.25, right_margin: 0.25,
      r1: 1, c1: 1, r2: lastPrintRow, c2: 8
    };
    return Object.keys(settings).map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(settings[key]);
    }).join('&');
  }

  return { plan: plan, sample: sample, literal: literal, textHeight: textHeight, pdfQuery: pdfQuery };
}());

if (typeof module !== 'undefined') module.exports = VoucherCore;
