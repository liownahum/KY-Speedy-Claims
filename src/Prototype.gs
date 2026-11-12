/** Manual developer prototype. No form trigger, email, approval, or payment action. */
function runVoucherPrototype() {
  var settings = PropertiesService.getScriptProperties();
  var rawCount = settings.getProperty('PROTOTYPE_CLAIM_COUNT');
  var count = rawCount === null ? 1 : Number(rawCount);
  var payload = VoucherCore.sample(count);
  VoucherCore.plan(payload); // Validate before creating any Drive resources.
  var sourceId = settings.getProperty('PROTOTYPE_TEMPLATE_ID') || '1bV03-iPhOFeUaSI3ep75NaaCaXNzfeFH';
  var source = DriveApp.getFileById(sourceId);
  var sourceType = source.getMimeType();
  var nativeType = 'application/vnd.google-apps.spreadsheet';
  var excelType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (sourceType !== nativeType && sourceType !== excelType) throw new Error('Use a Google Sheets or XLSX template.');
  var stamp = Utilities.formatDate(new Date(), 'UTC', 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0, 8);
  var name = 'SAMPLE ONLY - ' + count + ' claims - ' + stamp;
  var outputFolderId = settings.getProperty('PROTOTYPE_OUTPUT_FOLDER_ID');
  var folder = outputFolderId ? DriveApp.getFolderById(outputFolderId) : DriveApp.createFolder('KY Claims Prototype - ' + stamp);
  var workId;
  if (sourceType === nativeType) {
    workId = source.makeCopy(name, folder).getId();
  } else {
    workId = Drive.Files.create({ name: name, mimeType: nativeType, parents: [folder.getId()] }, source.getBlob(), { fields: 'id' }).id;
  }
  if (!workId || workId === sourceId) throw new Error('A separate working copy could not be created.');
  try {
    var spreadsheet = SpreadsheetApp.openById(workId);
    var rendered = VoucherRenderer.render(spreadsheet, payload, sourceId);
    var pdf = VoucherRenderer.exportPdf(spreadsheet, rendered, folder, name + '.pdf');
    var result = {
      workbookUrl: spreadsheet.getUrl(), pdfUrl: pdf.getUrl(), folderUrl: folder.getUrl(),
      claimCount: rendered.claimCount, totalCents: rendered.totalCents, needsPrintReview: true
    };
    console.log(JSON.stringify(result));
    return result;
  } catch (error) {
    console.log('Incomplete prototype copy retained for review: https://docs.google.com/spreadsheets/d/' + workId + '/edit');
    throw error;
  }
}
