/**
 * Blood Donation App — Email Backend
 * Deploy as a Web App (Execute as: Me, Who has access: Anyone).
 *
 * Admin sheet: run setupDonorSheet() once from the editor to create the
 * Google Sheet, or let the first booking create it automatically.
 */

var CLINIC_NAME = 'LASUTH Blood Donor Clinic';
var CLINIC_REPLY_TO = ''; // optional: clinic inbox for donor replies
var DONOR_SHEET_NAME = 'Blood Donation Bookings';
var DONOR_SHEET_TAB = 'Donors';
var SHEET_ID_KEY = 'DONOR_SHEET_ID';

var DONOR_SHEET_HEADERS = [
  'Booked At',
  'Name',
  'Age',
  'Gender',
  'Phone',
  'Email',
  'Donation Date',
  'Time',
  'Hospital',
  'Previous Donor',
  'Notes',
  'Follow-up Status',
  'Admin Notes'
];

function doPost(e) {
  return handleRequest_(e);
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      service: 'Blood Donation Email API',
      message: 'POST booking JSON to this URL to send confirmation emails.'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleRequest_(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Missing request body.');
    }

    var data = JSON.parse(e.postData.contents);
    validatePayload_(data);
    sendDonorConfirmation_(data);
    notifyClinic_(data);
    logBookingToSheet_(data);

    return jsonResponse_({ status: 'success' });
  } catch (err) {
    return jsonResponse_({
      status: 'error',
      message: err && err.message ? err.message : 'Unable to send email.'
    });
  }
}

function validatePayload_(data) {
  var required = ['name', 'email', 'dateLabel', 'time', 'hospital'];
  for (var i = 0; i < required.length; i++) {
    var key = required[i];
    if (!data[key] || String(data[key]).trim() === '') {
      throw new Error('Missing required field: ' + key);
    }
  }

  if (!isValidEmail_(data.email)) {
    throw new Error('Invalid email address.');
  }
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function sendDonorConfirmation_(data) {
  var firstName = String(data.name).trim().split(/\s+/)[0] || 'there';
  var subject = 'Your blood donation booking is confirmed — ' + data.dateLabel;

  var htmlBody = [
    '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1A1414;">',
    '  <div style="background:linear-gradient(180deg,#C8102E,#8B0000);color:#fff;padding:28px 24px;border-radius:16px 16px 0 0;">',
    '    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">Blood Donation App</p>',
    '    <h1 style="margin:0;font-size:24px;line-height:1.2;">Thank you, ' + escapeHtml_(firstName) + '.</h1>',
    '    <p style="margin:12px 0 0;opacity:0.92;line-height:1.5;">Your donation slot is confirmed. We look forward to seeing you.</p>',
    '  </div>',
    '  <div style="background:#fff;border:1px solid #F0DADA;border-top:none;padding:24px;border-radius:0 0 16px 16px;">',
    '    <h2 style="margin:0 0 14px;font-size:16px;color:#8B0000;">Booking summary</h2>',
    summaryRow_('Date', data.dateLabel),
    summaryRow_('Time', data.time),
    summaryRow_('Location', data.hospital),
    summaryRow_('Clinic', 'Blood Donor Clinic — Main Building'),
    data.previous ? summaryRow_('Previous donor', data.previous) : '',
  '    <div style="margin-top:20px;padding:16px;background:#FFF3F3;border:1px solid #F3C8C8;border-radius:12px;">',
    '      <p style="margin:0 0 10px;font-weight:700;color:#8B0000;">Before you come</p>',
    '      <ul style="margin:0;padding-left:18px;color:#5a2424;line-height:1.7;font-size:14px;">',
    '        <li>Eat a proper meal within 3 hours before donating.</li>',
    '        <li>Drink plenty of water the night before and on the morning of your visit.</li>',
    '        <li>Sleep well — aim for at least 6 hours.</li>',
    '        <li>Bring a valid ID and wear sleeves that roll up easily.</li>',
    '        <li>Avoid alcohol for 24 hours before your appointment.</li>',
    '      </ul>',
    '    </div>',
    '    <p style="margin:20px 0 0;font-size:13px;color:#8C6F6F;line-height:1.6;">',
    '      If you need to reschedule, reply to this email or contact the clinic directly.',
    '    </p>',
    '  </div>',
    '</div>'
  ].join('\n');

  var plainBody = [
    'Thank you, ' + firstName + '.',
    '',
    'Your blood donation booking is confirmed.',
    '',
    'Date: ' + data.dateLabel,
    'Time: ' + data.time,
    'Location: ' + data.hospital,
    'Clinic: Blood Donor Clinic — Main Building',
    data.previous ? 'Previous donor: ' + data.previous : '',
    '',
    'Before you come:',
    '- Eat a proper meal within 3 hours before donating.',
    '- Drink plenty of water.',
    '- Sleep well and bring a valid ID.',
    '- Avoid alcohol for 24 hours before your appointment.'
  ].filter(Boolean).join('\n');

  GmailApp.sendEmail(data.email, subject, plainBody, {
    htmlBody: htmlBody,
    name: CLINIC_NAME,
    replyTo: CLINIC_REPLY_TO || undefined
  });
}

function notifyClinic_(data) {
  var clinicEmail = Session.getActiveUser().getEmail();
  if (!clinicEmail) return;

  var sheetUrl = getDonorSheetUrl_();
  var subject = 'New donation booking — ' + data.name + ' (' + data.dateLabel + ')';
  var body = [
    'A new blood donation booking was submitted.',
    '',
    'Name: ' + data.name,
    'Age: ' + (data.age || '—'),
    'Gender: ' + (data.gender || '—'),
    'Phone: ' + (data.phone || '—'),
    'Email: ' + data.email,
    'Date: ' + data.dateLabel,
    'Time: ' + data.time,
    'Hospital: ' + data.hospital,
    'Previous donor: ' + (data.previous || '—'),
    'Notes: ' + (data.notes || '—'),
    '',
    sheetUrl ? 'View all bookings: ' + sheetUrl : 'Admin sheet: run setupDonorSheet() in Apps Script to create the donor log.'
  ].join('\n');

  GmailApp.sendEmail(clinicEmail, subject, body, {
    name: 'Blood Donation App'
  });
}

/**
 * Run once from the Apps Script editor to create the admin Google Sheet.
 * Check View → Logs for the sheet URL after running.
 */
function setupDonorSheet() {
  var sheet = createDonorSheet_();
  var url = sheet.getParent().getUrl();
  Logger.log('Donor sheet ready: ' + url);
  return url;
}

function logBookingToSheet_(data) {
  var sheet = getDonorSheet_();
  sheet.appendRow([
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
    data.name || '',
    data.age || '',
    data.gender || '',
    data.phone || '',
    data.email || '',
    data.dateLabel || '',
    data.time || '',
    data.hospital || '',
    data.previous || '',
    data.notes || '',
    'Pending',
    ''
  ]);
}

function getDonorSheet_() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty(SHEET_ID_KEY);

  if (sheetId) {
    try {
      var existing = SpreadsheetApp.openById(sheetId).getSheetByName(DONOR_SHEET_TAB);
      if (existing) return existing;
    } catch (err) {
      // Sheet was deleted — create a new one below.
    }
  }

  return createDonorSheet_();
}

function createDonorSheet_() {
  var ss = SpreadsheetApp.create(DONOR_SHEET_NAME);
  var sheet = ss.getActiveSheet();
  sheet.setName(DONOR_SHEET_TAB);

  sheet.getRange(1, 1, 1, DONOR_SHEET_HEADERS.length)
    .setValues([DONOR_SHEET_HEADERS])
    .setFontWeight('bold')
    .setBackground('#C8102E')
    .setFontColor('#FFFFFF');

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, DONOR_SHEET_HEADERS.length);

  var statusCol = DONOR_SHEET_HEADERS.indexOf('Follow-up Status') + 1;
  sheet.getRange(2, statusCol, 500, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Pending', 'Contacted', 'Confirmed', 'Completed', 'No-show', 'Cancelled'], true)
      .setAllowInvalid(false)
      .build()
  );

  PropertiesService.getScriptProperties().setProperty(SHEET_ID_KEY, ss.getId());
  return sheet;
}

function getDonorSheetUrl_() {
  var sheetId = PropertiesService.getScriptProperties().getProperty(SHEET_ID_KEY);
  if (!sheetId) return '';
  return 'https://docs.google.com/spreadsheets/d/' + sheetId + '/edit';
}

function summaryRow_(label, value) {
  return [
    '<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px dashed #F0DADA;font-size:14px;">',
    '  <span style="color:#8C6F6F;">' + escapeHtml_(label) + '</span>',
    '  <strong style="text-align:right;">' + escapeHtml_(String(value)) + '</strong>',
    '</div>'
  ].join('');
}

function escapeHtml_(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
