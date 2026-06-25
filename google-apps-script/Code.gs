/**
 * Blood Donation App — Email Backend
 * Deploy as a Web App (Execute as: Me, Who has access: Anyone).
 *
 * Admin sheet: run setupDonorSheet() once from the editor to create the
 * Google Sheet, or let the first booking create it automatically.
 */

var CLINIC_NAME = 'LASUTH Blood Donor Clinic';
var CLINIC_REPLY_TO = ''; // optional: clinic inbox for donor replies
var CLINIC_NOTIFY_EMAIL = 'ademolaayoola89@gmail.com'; // admin receives copy of donor confirmation
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
    // Support an "auto" booking mode that chooses the next available
    // date/time slot when `data.auto === true`.
    if (data && data.auto) {
      validateAutoPayload_(data);
      var booking = autoBook_(data);
      // booking contains date, dateLabel, time, hospital
      // merge booking details into data
      Object.keys(booking).forEach(function(k){ data[k] = booking[k]; });
      sendDonorConfirmation_(data);
      notifyClinic_(data);
      logBookingToSheet_(data);
      return jsonResponse_({ status: 'success', booking: booking });
    }

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
  var email = buildDonorConfirmationEmail_(data);

  GmailApp.sendEmail(data.email, email.subject, email.plainBody, {
    htmlBody: email.htmlBody,
    name: CLINIC_NAME,
    replyTo: CLINIC_REPLY_TO || undefined,
    bcc: "ademolaayoola89@gmail.com"
  });
}

function notifyClinic_(data) {
  var clinicEmail = getClinicNotifyEmail_();
  if (!clinicEmail) return;

  var email = buildDonorConfirmationEmail_(data);
  var sheetUrl = getDonorSheetUrl_();
  var adminBanner = buildAdminBanner_(data, sheetUrl);

  var subject = '[Admin copy] Donor confirmation — ' + data.name + ' (' + data.dateLabel + ')';
  var htmlBody = adminBanner + email.htmlBody;
  var plainBody = [
    'ADMIN COPY — same confirmation sent to donor: ' + data.email,
    '',
    'Donor phone: ' + (data.phone || '—'),
    'Donor age: ' + (data.age || '—'),
    'Donor gender: ' + (data.gender || '—'),
    'Notes: ' + (data.notes || '—'),
    sheetUrl ? 'View all bookings: ' + sheetUrl : '',
    '',
    '--- Donor confirmation below ---',
    '',
    email.plainBody
  ].filter(Boolean).join('\n');

  GmailApp.sendEmail(clinicEmail, subject, plainBody, {
    htmlBody: htmlBody,
    name: CLINIC_NAME
  });
}

function getClinicNotifyEmail_() {
  if (CLINIC_NOTIFY_EMAIL && isValidEmail_(CLINIC_NOTIFY_EMAIL)) {
    return String(CLINIC_NOTIFY_EMAIL).trim();
  }

  var activeEmail = Session.getActiveUser().getEmail();
  return activeEmail || '';
}

function buildAdminBanner_(data, sheetUrl) {
  return [
    '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto 16px;color:#1A1414;">',
    '  <div style="background:#FFF3F3;border:1px solid #F3C8C8;border-radius:12px;padding:16px 18px;">',
    '    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8B0000;font-weight:700;">Admin notification</p>',
    '    <p style="margin:0 0 10px;font-size:14px;line-height:1.5;">The confirmation below was also sent to <strong>' + escapeHtml_(data.email) + '</strong>.</p>',
    '    <p style="margin:0;font-size:13px;color:#5a2424;line-height:1.6;">',
    '      <strong>Phone:</strong> ' + escapeHtml_(data.phone || '—') + '<br>',
    '      <strong>Age:</strong> ' + escapeHtml_(String(data.age || '—')) + '<br>',
    '      <strong>Gender:</strong> ' + escapeHtml_(data.gender || '—') + '<br>',
    '      <strong>Notes:</strong> ' + escapeHtml_(data.notes || '—'),
    '    </p>',
    sheetUrl ? '    <p style="margin:12px 0 0;font-size:13px;"><a href="' + escapeHtml_(sheetUrl) + '" style="color:#C8102E;font-weight:600;">Open donor follow-up sheet</a></p>' : '',
    '  </div>',
    '</div>'
  ].join('\n');
}

function buildDonorConfirmationEmail_(data) {
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
    '- Rest well.',
    '- Avoid alcohol for 24 hours before your appointment.'
  ].filter(Boolean).join('\n');

  return {
    subject: subject,
    plainBody: plainBody,
    htmlBody: htmlBody
  };
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

/**
 * Validate payload for auto booking (minimal fields required).
 */
function validateAutoPayload_(data){
  var required = ['name', 'email'];
  for (var i = 0; i < required.length; i++){
    var key = required[i];
    if (!data[key] || String(data[key]).trim() === ''){
      throw new Error('Missing required field for auto booking: ' + key);
    }
  }

  if (!isValidEmail_(data.email)) throw new Error('Invalid email address.');
}

/**
 * Auto-book: find the next available slot within the next 30 days.
 * Returns an object {date: 'YYYY-MM-DD', dateLabel: 'Mon, 1 Jan 2026', time: '8am', hospital: '...'}
 */
function autoBook_(data){
  var MAX_PER_SLOT = 4; // maximum bookings allowed per time slot
  var today = new Date();

  // iterate days from tomorrow to +30
  for (var dayOffset = 1; dayOffset <= 30; dayOffset++){
    var d = new Date(today);
    d.setDate(today.getDate() + dayOffset);
    var isoDate = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var dateLabel = formatDateLabel_(isoDate);

    for (var h = 8; h <= 15; h++){
      var timeLabel = formatHourLabel_(h);
      var sheet = getDonorSheet_();
      var taken = countBookingsForSlot_(sheet, dateLabel, timeLabel);
      if (taken < MAX_PER_SLOT){
        return {
          date: isoDate,
          dateLabel: dateLabel,
          time: timeLabel,
          hospital: 'Lagos State University Teaching Hospital, Ikeja'
        };
      }
    }
  }

  throw new Error('No available slots in the next 30 days. Please try again later.');
}

function formatHourLabel_(h){
  if (h === 12) return '12pm';
  if (h > 12) return (h-12) + 'pm';
  return h + 'am';
}

function formatDateLabel_(isoDate){
  // isoDate is YYYY-MM-DD
  var parts = isoDate.split('-');
  var d = new Date(parts[0], Number(parts[1]) - 1, parts[2]);
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

/**
 * Count bookings on the sheet matching dateLabel and timeLabel.
 */
function countBookingsForSlot_(sheet, dateLabel, timeLabel){
  try{
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return 0; // only headers present

    // Donation Date at column 7, Time at column 8 (1-based)
    var dataRange = sheet.getRange(2, 7, lastRow - 1, 2).getValues();
    var count = 0;
    for (var i = 0; i < dataRange.length; i++){
      var rowDate = String(dataRange[i][0] || '').trim();
      var rowTime = String(dataRange[i][1] || '').trim();
      if (rowDate === dateLabel && rowTime === timeLabel) count++;
    }
    return count;
  } catch (err){
    return 0;
  }
}