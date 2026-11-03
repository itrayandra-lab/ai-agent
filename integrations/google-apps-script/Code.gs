/**
 * Ray Agent Office → Google Workspace bridge (free Google Apps Script).
 *
 * Setup:
 * 1. Create a standalone Apps Script project and paste this file.
 * 2. Run setRayAgentSecret('a-long-random-secret') once from the editor.
 * 3. Deploy → New deployment → Web app → Execute as Me → access for the
 *    account/audience appropriate to your Workspace.
 * 4. Put the /exec URL and the same secret in Ray Office Settings.
 */
function setRayAgentSecret(secret) {
  if (!secret || String(secret).length < 16) throw new Error('Use a secret of at least 16 characters.');
  PropertiesService.getScriptProperties().setProperty('RAY_AGENT_SECRET', String(secret));
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var expected = PropertiesService.getScriptProperties().getProperty('RAY_AGENT_SECRET');
    if (!expected || body.secret !== expected) return json_({ ok: false, error: 'Unauthorized' });
    var p = body.payload || {};
    if (body.action === 'status') return json_({ ok: true, receipt: { service: 'Google Apps Script', account: Session.getEffectiveUser().getEmail(), verifiedAt: new Date().toISOString() } });
    if (body.action === 'sheets.append') return appendSheet_(p);
    if (body.action === 'drive.create') return createDriveFile_(p);
    if (body.action === 'calendar.create') return createCalendarEvent_(p);
    return json_({ ok: false, error: 'Unsupported action: ' + body.action });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function appendSheet_(p) {
  var ss = p.spreadsheet_id ? SpreadsheetApp.openById(p.spreadsheet_id) : SpreadsheetApp.create(p.spreadsheet_name || 'Ray Agent Export');
  var sheet = ss.getSheetByName(p.sheet_name || 'Data') || ss.insertSheet(p.sheet_name || 'Data');
  var rows = Array.isArray(p.rows) ? p.rows : [];
  if (!rows.length) throw new Error('rows cannot be empty');
  if (sheet.getLastRow() === 0 && Array.isArray(p.headers) && p.headers.length) sheet.appendRow(p.headers);
  var width = Math.max.apply(null, rows.map(function (r) { return Array.isArray(r) ? r.length : 0; }));
  if (!width) throw new Error('rows must contain arrays');
  var normalized = rows.map(function (r) { r = Array.isArray(r) ? r.slice(0, width) : []; while (r.length < width) r.push(''); return r; });
  var start = sheet.getLastRow() + 1;
  sheet.getRange(start, 1, normalized.length, width).setValues(normalized);
  return json_({ ok: true, receipt: { spreadsheetId: ss.getId(), sheetName: sheet.getName(), range: sheet.getName() + '!A' + start + ':' + sheet.getRange(start + normalized.length - 1, width).getA1Notation(), rowCount: normalized.length, url: ss.getUrl() } });
}

function createDriveFile_(p) {
  if (!p.name) throw new Error('name is required');
  var mime = p.mime_type || 'text/plain';
  var file;
  if (mime === 'application/vnd.google-apps.document') {
    var doc = DocumentApp.create(p.name); doc.getBody().setText(String(p.content || '')); doc.saveAndClose(); file = DriveApp.getFileById(doc.getId());
  } else file = DriveApp.createFile(p.name, String(p.content || ''), mime);
  if (p.folder_id) file.moveTo(DriveApp.getFolderById(p.folder_id));
  return json_({ ok: true, receipt: { fileId: file.getId(), name: file.getName(), mimeType: file.getMimeType(), url: file.getUrl() } });
}

function createCalendarEvent_(p) {
  if (!p.title || !p.start || !p.end) throw new Error('title, start, and end are required');
  var cal = p.calendar_id ? CalendarApp.getCalendarById(p.calendar_id) : CalendarApp.getDefaultCalendar();
  if (!cal) throw new Error('calendar not found');
  var opts = { description: String(p.description || '') };
  if (Array.isArray(p.guests) && p.guests.length) opts.guests = p.guests.join(',');
  var event = cal.createEvent(p.title, new Date(p.start), new Date(p.end), opts);
  return json_({ ok: true, receipt: { eventId: event.getId(), title: event.getTitle(), start: event.getStartTime().toISOString(), end: event.getEndTime().toISOString(), calendarId: cal.getId() } });
}
