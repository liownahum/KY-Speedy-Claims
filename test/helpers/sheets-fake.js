'use strict';

function columnNumber(letters) {
  return Array.from(letters).reduce((number, letter) => number * 26 + letter.charCodeAt(0) - 64, 0);
}

class Range {
  constructor(sheet, row, col, rows = 1, cols = 1) {
    Object.assign(this, { sheet, row, col, rows, cols });
  }
  values(getter) {
    return Array.from({ length: this.rows }, (_, r) => Array.from({ length: this.cols }, (_, c) => getter(this.row + r, this.col + c)));
  }
  getValues() { return this.values((r, c) => this.sheet.value(r, c)); }
  getFormulas() { return this.values((r, c) => (this.sheet.cells.get(`${r},${c}`) || {}).formula || ''); }
  getValue() { return this.getValues()[0][0]; }
  getDisplayValue() { return String(this.getValue()); }
  getFormula() { return this.getFormulas()[0][0]; }
  getFontSize() { return 12; }
  getMergedRanges() {
    return this.sheet.merges.filter(other => this.row <= other.row + other.rows - 1 && other.row <= this.row + this.rows - 1 && this.col <= other.col + other.cols - 1 && other.col <= this.col + this.cols - 1);
  }
  setValues(values) {
    if (values.length !== this.rows || values.some(row => row.length !== this.cols)) throw new Error('Matrix shape mismatch');
    this.sheet.workbook.mutations.push(['write', this.sheet.name, this.row, this.col, this.rows, this.cols]);
    values.forEach((row, r) => row.forEach((value, c) => this.sheet.cells.set(`${this.row + r},${this.col + c}`, { value })));
    return this;
  }
  setValue(value) { return this.setValues([[value]]); }
  setFormula(formula) {
    this.sheet.workbook.mutations.push(['formula', this.row, this.col]);
    this.sheet.cells.set(`${this.row},${this.col}`, { formula });
    return this;
  }
  copyTo(target, options) { target.savedStyle = { sourceRow: this.row, formatOnly: options.formatOnly }; return this; }
  copyFormatToRange(sheet, col, lastCol, row, lastRow) {
    sheet.workbook.mutations.push(['format', col, lastCol, row, lastRow]);
    return this;
  }
  mergeAcross() { for (let r = 0; r < this.rows; r++) this.sheet.merges.push(new Range(this.sheet, this.row + r, this.col, 1, this.cols)); return this; }
  merge() { this.sheet.merges.push(this); return this; }
  setWrap() { return this; }
  setNumberFormat() { return this; }
  setDataValidation(rule) { this.sheet.validations.push({ row: this.row, rows: this.rows, rule }); return this; }
}

class Sheet {
  constructor(workbook, name) {
    Object.assign(this, { workbook, name, cells: new Map(), merges: [], validations: [], rowHeights: new Map(), hidden: false, frozenRows: 0 });
  }
  getRange(row, col, rows, cols) {
    if (typeof row === 'string') {
      const match = row.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
      if (!match) throw new Error('Unsupported range: ' + row);
      const startRow = Number(match[2]);
      const startCol = columnNumber(match[1]);
      return new Range(this, startRow, startCol, match[4] ? Number(match[4]) - startRow + 1 : 1, match[3] ? columnNumber(match[3]) - startCol + 1 : 1);
    }
    return new Range(this, row, col, rows, cols);
  }
  value(row, col) {
    const cell = this.cells.get(`${row},${col}`) || {};
    if (cell.formula) {
      if (this.workbook.corruptCalculation) return '#REF!';
      const match = cell.formula.match(/SUM\(H(\d+):H(\d+)\)/);
      if (!match) throw new Error('Unsupported fake calculation: ' + cell.formula);
      let sum = 0;
      for (let r = Number(match[1]); r <= Number(match[2]); r++) {
        const amount = this.value(r, 8);
        if (typeof amount === 'number') sum += amount;
      }
      return sum > 0 ? sum : '';
    }
    const value = cell.value === undefined ? '' : cell.value;
    return typeof value === 'string' && value.startsWith("'") ? value.slice(1) : value;
  }
  shift(start, count, removing) {
    const shifted = new Map();
    for (const [key, cell] of this.cells) {
      const [row, col] = key.split(',').map(Number);
      if (removing && row >= start && row < start + count) continue;
      const next = row >= start ? row + (removing ? -count : count) : row;
      shifted.set(`${next},${col}`, cell);
    }
    this.cells = shifted;
  }
  deleteRows(start, count) { this.workbook.mutations.push(['deleteRows', start, count]); this.shift(start, count, true); }
  insertRowsBefore(start, count) { this.workbook.mutations.push(['insertRows', start, count]); this.shift(start, count, false); }
  getColumnWidth(col) { return col === 6 ? 200 : 80; }
  getRowHeight(row) { return this.rowHeights.get(row) || 24; }
  setRowHeight(row, height) { this.rowHeights.set(row, height); }
  setFrozenRows(count) { this.frozenRows = count; }
  getSheetId() { return 123; }
  hideSheet() { this.hidden = true; }
}

class Workbook {
  constructor() { this.sheets = new Map(); this.mutations = []; this.id = 'disposable-copy'; }
  getId() { return this.id; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) {
    this.mutations.push(['insertSheet', name]);
    if (this.sheets.has(name)) throw new Error('Duplicate sheet name');
    const sheet = new Sheet(this, name);
    this.sheets.set(name, sheet);
    return sheet;
  }
}

function fixture() {
  const workbook = new Workbook();
  const sheet = workbook.insertSheet('Payment Voucher (full)');
  const labels = {
    B4: 'PAYMENT VOUCHER', G6: 'Date : ', B8: 'Pay to  :', F8: 'Bank A/c/PayNow:',
    B10: 'R No.', C10: 'Description', G10: 'Congregation', H10: 'Amount',
    G41: 'Total:', B43: 'Prepared by  :', F43: 'Payment approved by  :', B45: 'Verified by  :'
  };
  for (const [address, label] of Object.entries(labels)) sheet.getRange(address).setValue(label);
  sheet.getRange('H41').setFormula('=IF(SUM(H11:H40)>0,SUM(H11:H40),"")');
  const options = ['Cantonese', 'Children', 'English', 'General', 'Mandarin', 'Woodlands', 'Youth'];
  sheet.getRange('X10:X16').setValues(options.map(option => [option]));
  sheet.getRange('B12').setValue(' ');
  workbook.mutations = [];
  return { workbook, sheet, options };
}

function spreadsheetService() {
  return {
    flush() {},
    newDataValidation() {
      return {
        requireValueInRange(range) { this.range = range; return this; },
        setAllowInvalid(value) { this.allowInvalid = value; return this; },
        build() { return { range: this.range, allowInvalid: this.allowInvalid }; }
      };
    }
  };
}

module.exports = { fixture, spreadsheetService };
