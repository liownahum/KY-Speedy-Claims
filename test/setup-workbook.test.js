'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const VoucherCore = require('../src/VoucherCore.js');
const { fixture } = require('./helpers/sheets-fake.js');

function environment() {
  const book = fixture().workbook;
  book.sheets.clear(); book.id = 'book-A';
  const properties = new Map(); const effects = []; const menus = [];
  const env = { scriptId: 'script-A', locked: false, failPrepare: false, records: [] };
  const insert = book.insertSheet.bind(book);
  book.insertSheet = name => {
    const sheet = insert(name); sheet.maxRows = 1000;
    const range = sheet.getRange.bind(sheet);
    sheet.getRange = (...args) => {
      const result = range(...args);
      for (const method of ['setFontFamily', 'setFontSize', 'setVerticalAlignment', 'setWrap', 'setNumberFormat', 'setBackground', 'setFontColor', 'setFontWeight']) result[method] = () => result;
      result.clearContent = () => {
        for (let r=0;r<result.rows;r++) for (let c=0;c<result.cols;c++) sheet.cells.delete(`${result.row+r},${result.col+c}`);
        return result;
      };
      result.insertCheckboxes = () => {
        result.setValues(Array.from({length:result.rows},()=>Array(result.cols).fill(false)));
        return result;
      };
      return result;
    };
    for (const method of ['setColumnWidth', 'setColumnWidths', 'setRowHeights', 'setFrozenRows', 'hideColumns']) sheet[method] = () => sheet;
    const setRowHeight = sheet.setRowHeight.bind(sheet);
    sheet.setRowHeight = (row, height) => { setRowHeight(row, height); return sheet; };
    sheet.getLastRow = () => Math.max(0, ...[...sheet.cells.keys()].map(key => Number(key.split(',')[0])));
    sheet.getMaxRows = () => sheet.maxRows;
    sheet.insertRowsAfter = (start, count) => { sheet.maxRows += count; return sheet; };
    return sheet;
  };
  book.setActiveSheet = sheet => { book.active = sheet; return sheet; };
  book.toast = (message, title) => effects.push(['toast', title, message]);
  const menu = { addItem(label, handler) { menus.push([label,handler]); return this; }, addSeparator() {return this;}, addToUi() {return this;} };
  const context = vm.createContext({
    VoucherCore, console:{log(){},error(){}},
    SpreadsheetApp: { getActiveSpreadsheet: () => book, getUi: () => ({createMenu: () => menu}), openById: () => ({}) },
    PropertiesService: {getScriptProperties: () => ({
      getProperty: key => properties.get(key) ?? null,
      setProperty(key,value) {properties.set(key,value); return this;},
      deleteProperty(key) {properties.delete(key); return this;}
    })},
    ScriptApp: {getScriptId: () => env.scriptId},
    LockService: {getScriptLock: () => ({
      waitLock() { assert.equal(env.locked,false,'lock must not be re-entered'); env.locked=true; },
      releaseLock() {env.locked=false;}
    })},
    FormApp: {openById: () => ({getEditUrl: () => 'https://docs.google.com/forms/d/form/edit',getPublishedUrl: () => 'https://docs.google.com/forms/d/form/viewform'})},
    Utilities: {formatDate: () => '2026-11-13 12:00:00'},
    claimStore_: () => ({records: () => env.records})
  });
  vm.runInContext(fs.readFileSync('src/ClaimPipeline.gs','utf8'),context);
  vm.runInContext(fs.readFileSync('src/SetupWorkbook.gs','utf8'),context);
  context.setupClaimPipeline_ = () => {
    assert.equal(env.locked,true); effects.push(['prepare']);
    const existing = context.claimConfig_(false);
    const config = existing || {eventCode:properties.get('PIPELINE_EVENT_CODE'),eventTitle:properties.get('PIPELINE_EVENT_TITLE'),questions:{},active:false};
    config.formId='form';config.registerId='register';config.rootFolderId='folder';
    context.saveClaimConfig_(config);
    if(env.failPrepare) throw new Error('Temporary destination failure');
    return context.claimStatus_(config);
  };
  context.activateClaimPipeline_ = () => {
    assert.equal(env.locked,true);effects.push(['activate']);
    const config=context.claimConfig_(true);config.active=true;context.saveClaimConfig_(config);
    return context.claimStatus_(config);
  };
  context.retryPendingClaimSubmissions = () => {effects.push(['retry']);return env.retryResults || [];};
  context.exportWeeklyClaimVouchers = () => {effects.push(['export']);return env.exportSummary || {week:'2026-11-09',exported:0,failed:0,skipped:0,results:[]};};
  env.init=()=>context.initializeClaimSetupWorkbook();
  env.sheet=()=>book.getSheetByName('KY Setup');
  env.settings=(code='CAMP26',title='Sample Camp')=>{
    env.sheet().getRange('B5:B8').setValues([[code],[title],[''],[false]]);
  };
  return Object.assign(env,{book,properties,effects,menus,context});
}

test('opening adds menu actions without creating resources or configuration',()=>{
  const env=environment();env.context.onOpen();
  assert.deepEqual(env.menus.map(item=>item[1]),['initializeClaimSetupWorkbook','prepareClaimEvent','activateClaimEvent','refreshClaimSetup','retryClaimEvent','exportClaimEvent']);
  assert.equal(env.properties.size,0);assert.equal(env.book.sheets.size,0);assert.equal(env.effects.length,0);
});
test('initialisation is repeatable and retains edited settings and unrelated tabs',()=>{
  const env=environment();env.book.insertSheet('Finance notes').getRange('A1').setValue('Keep');
  env.init();env.settings();env.init();
  assert.equal(env.sheet().getRange('B5').getValue(),'CAMP26');assert.equal(env.book.sheets.size,3);
  assert.equal(env.book.getSheetByName('Finance notes').getRange('A1').getValue(),'Keep');
});
test('invalid settings do not create resources or write pipeline properties',()=>{
  for(const [code,title] of [['','Camp'],['bad code','Camp'],['CAMP26','']]){
    const env=environment();env.init();env.settings(code,title);
    assert.equal(env.context.prepareClaimEvent().status,'ERROR');
    assert.equal(env.properties.has('PIPELINE_EVENT_CODE'),false);assert.equal(env.effects.some(call=>call[0]==='prepare'),false);
  }
});
test('preparation applies normalised settings and binds the event to its script',()=>{
  const env=environment();env.init();env.settings(' camp26 ',' Sample Camp ');
  env.sheet().getRange('B7').setValue('https://drive.google.com/drive/folders/event-folder?usp=sharing');
  env.context.prepareClaimEvent();
  assert.equal(env.properties.get('PIPELINE_EVENT_CODE'),'CAMP26');assert.equal(env.properties.get('PIPELINE_PARENT_FOLDER_ID'),'event-folder');
  const config=env.context.claimConfig_(true);assert.equal(config.installationScriptId,'script-A');assert.equal(config.setupWorkbookPrepared,true);
  assert.equal(env.sheet().getRange('B15').getValue(),'Form checks needed');assert.equal(env.locked,false);
});
test('a prepared event cannot be changed into another event through the workbook',()=>{
  const env=environment();env.init();env.settings();env.context.prepareClaimEvent();
  env.settings('OTHER','Other');assert.equal(env.context.prepareClaimEvent().status,'ERROR');
  assert.equal(env.properties.get('PIPELINE_EVENT_CODE'),'CAMP26');
  assert.equal(env.effects.filter(call=>call[0]==='prepare').length,1);
});
test('activation requires both manual checks and applied settings',()=>{
  const env=environment();env.init();env.settings();env.context.prepareClaimEvent();
  assert.equal(env.context.activateClaimEvent().status,'ERROR');
  env.sheet().getRange('B11:B12').setValues([[true],[true]]);
  env.sheet().getRange('B8').setValue(true);assert.equal(env.context.activateClaimEvent().status,'ERROR');
  assert.equal(env.effects.some(call=>call[0]==='activate'),false);
  env.context.prepareClaimEvent();env.context.activateClaimEvent();
  assert.equal(env.context.claimConfig_(true).active,true);assert.equal(env.sheet().getRange('B15').getValue(),'Accepting submissions');
});
test('an interrupted preparation cannot be activated until preparation finishes',()=>{
  const env=environment();env.init();env.settings();env.failPrepare=true;
  assert.equal(env.context.prepareClaimEvent().status,'ERROR');
  env.sheet().getRange('B11:B12').setValues([[true],[true]]);
  assert.match(env.context.activateClaimEvent().error,/Preparation is incomplete/);
  env.context.refreshClaimSetup();assert.match(env.sheet().getRange('B15').getValue(),/incomplete/);
  env.failPrepare=false;env.context.prepareClaimEvent();env.context.activateClaimEvent();assert.equal(env.context.claimConfig_(true).active,true);
});
test('copied workbooks cannot prepare, retry, export or use inherited core configuration before initialisation',()=>{
  const env=environment();env.init();env.settings();env.context.prepareClaimEvent();
  env.book.id='book-B';env.scriptId='script-B';
  for(const action of ['prepareClaimEvent','retryClaimEvent','exportClaimEvent']) assert.equal(env.context[action]().status,'ERROR');
  assert.throws(()=>env.context.claimConfig_(false),/copied setup workbook/);
  assert.equal(env.effects.filter(call=>['prepare','retry','export'].includes(call[0])).length,1);
});
test('initialising a true copy drops inherited IDs/settings/results without deleting resources or unknown properties',()=>{
  const env=environment();env.init();env.settings();env.context.prepareClaimEvent();
  const original=env.properties.get('KY_CLAIM_PIPELINE');
  env.book.getSheetByName('KY Results').getRange('A6').setValue('Old claimant result');
  env.properties.set('PERSONAL_SETTING','keep');env.book.id='book-B';env.scriptId='script-B';env.init();
  assert.equal(env.properties.has('KY_CLAIM_PIPELINE'),false);assert.equal(env.properties.get('PERSONAL_SETTING'),'keep');
  assert.equal(env.sheet().getRange('B5').getValue(),'');assert.equal(env.sheet().getRange('B18').getValue(),'');
  assert.equal(env.book.getSheetByName('KY Results').getRange('A6').getValue(),'');
  assert.equal(JSON.parse(original).installationScriptId,'script-A');
  env.settings('SECOND','Second Event');env.context.prepareClaimEvent();assert.equal(env.context.claimConfig_(true).installationScriptId,'script-B');
});
test('the same script cannot reset an event just because worksheet metadata was moved',()=>{
  const env=environment();env.init();env.settings();env.context.prepareClaimEvent();const original=env.properties.get('KY_CLAIM_PIPELINE');
  env.book.id='other-book';assert.equal(env.init().status,'ERROR');assert.equal(env.properties.get('KY_CLAIM_PIPELINE'),original);
});
test('copies without any transferred Script Properties initialise independently',()=>{
  const env=environment();env.init();env.settings();env.context.prepareClaimEvent();
  env.book.id='book-B';env.scriptId='script-B';env.properties.clear();env.init();
  assert.equal(env.sheet().getRange('B5').getValue(),'');assert.equal(env.properties.get('KY_SETUP_SCRIPT_ID'),'script-B');
});
test('an interrupted initial layout can be rebuilt before any event exists',()=>{
  const env=environment();env.init();env.properties.clear();
  env.sheet().getRange('E4').setValue('BUILDING');env.sheet().getRange('A1').setValue('Partial layout');
  env.init();assert.equal(env.sheet().getRange('A1').getValue(),'KY SPEEDY CLAIMS');assert.equal(env.sheet().getRange('E4').getValue(),'READY');
});
test('unknown event state in a copied workbook is not silently discarded',()=>{
  const env=environment();env.init();env.book.id='book-B';env.scriptId='script-B';env.properties.clear();
  env.properties.set('KY_CLAIM_PIPELINE','{"eventCode":"LOCAL"}');
  assert.equal(env.init().status,'ERROR');assert.equal(env.properties.get('KY_CLAIM_PIPELINE'),' {"eventCode":"LOCAL"}'.trim());
});
test('unowned reserved worksheets and unbound legacy event state are preserved',()=>{
  for(const name of ['KY Setup','KY Results']){
    const env=environment();env.book.insertSheet(name).getRange('A1').setValue('User content');
    assert.equal(env.init().status,'ERROR');assert.equal(env.book.getSheetByName(name).getRange('A1').getValue(),'User content');assert.equal(env.properties.size,0);
  }
  const env=environment();env.properties.set('KY_CLAIM_PIPELINE','{"eventCode":"OLD"}');assert.equal(env.init().status,'ERROR');assert.equal(env.properties.get('KY_CLAIM_PIPELINE'),' {"eventCode":"OLD"}'.trim());
});
test('foreign results collisions block a copied reset before inherited properties are cleared',()=>{
  const env=environment();env.init();env.settings();env.context.prepareClaimEvent();const original=env.properties.get('KY_CLAIM_PIPELINE');
  env.book.getSheetByName('KY Results').getRange('J1').setValue('Other data');env.book.id='book-B';env.scriptId='script-B';
  assert.equal(env.init().status,'ERROR');assert.equal(env.properties.get('KY_CLAIM_PIPELINE'),original);
});
test('PDF results expose links and partial failures with literal text and exact displayed totals',()=>{
  const env=environment();env.init();env.settings();env.context.prepareClaimEvent();
  env.exportSummary={week:'2026-11-09',exported:1,failed:1,skipped:0,results:[
    {fullName:'=1+1',week:'2026-11-09',status:'EXPORTED',pdfUrl:'https://drive.google.com/file/d/pdf/view',workbookUrl:'https://docs.google.com/spreadsheets/d/week/edit',claimCount:2,totalCents:1975},
    {personKey:'b@example.com',week:'2026-11-09',status:'ERROR',error:'Needs review'}
  ]};
  env.context.exportClaimEvent();const sheet=env.book.getSheetByName('KY Results');
  assert.equal(sheet.cells.get('6,1').value,"'=1+1");assert.equal(sheet.getRange('G6').getValue(),19.75);
  assert.equal(sheet.getRange('D6').getValue(),'https://drive.google.com/file/d/pdf/view');assert.equal(sheet.getRange('H7').getValue(),'Needs review');
  assert.equal(env.book.active,sheet);
});
test('refresh counts canonical processed records and retry reports an empty scan clearly',()=>{
  const env=environment();env.init();env.settings();env.context.prepareClaimEvent();
  env.records=[{status:'DONE'},{status:'ERROR'},{status:'PENDING'}];env.context.refreshClaimSetup();
  assert.equal(env.sheet().getRange('B24').getValue(),1);assert.equal(env.sheet().getRange('B25').getValue(),2);
  env.context.retryClaimEvent();assert.equal(env.book.getSheetByName('KY Results').getRange('A2').getValue(),'No pending responses found.');
});
