/**
 * SPA SAM — Syafiq Aura Massage
 * Booking backend (Google Apps Script)
 *
 * What it does
 *  - Receives bookings from the website and saves them to the "Tempahan" sheet
 *  - Creates a Google Calendar event for each booking (colour = status)
 *  - Emails NOTIFY_EMAIL for: new booking, receipt uploaded, date changed
 *  - Saves deposit receipts to a Google Drive folder
 *  - Keeps Sheet <-> Calendar <-> website dates in sync:
 *      * customer changes date on the website  -> Sheet + Calendar move
 *      * Sam edits Tarikh / Masa / Status in the Sheet -> Calendar moves / recolours
 *      * Sam drags the event in Google Calendar -> Sheet updates (every 10 min)
 *  - Tells the website which slots are already taken
 *
 * Setup: see SETUP.md. Run setup() once, then Deploy > New deployment > Web app.
 */

// ===================== SETTINGS =====================
var CONFIG = {
  NOTIFY_EMAIL: 'syafiqaurawellness@gmail.com',
  BUSINESS: 'Spa SAM — Syafiq Aura Massage',
  SAM_WHATSAPP: '601169796259',
  TZ: 'Asia/Kuala_Lumpur',
  SHEET_NAME: 'Tempahan',
  DRIVE_FOLDER: 'SAM - Resit Deposit',
  CALENDAR_ID: '',            // '' = the account's main calendar
  SLOTS: ['10:00', '12:00', '14:30', '17:00', '20:00'],
  MAX_PER_DAY: 5,
  DAYS_AHEAD: 30,             // how far ahead customers can book
  MIN_LEAD_MINUTES: 60,       // no booking a slot starting within 60 min
  HOLD_HOURS: 0,              // >0 = auto-cancel unpaid bookings after N hours (0 = off)
  MAX_RECEIPT_MB: 8
};

// Services must match the website (id, name, minutes, price, deposit)
var SERVICES = {
  full:    { name: 'Urutan Badan Penuh',        min: 60,  rm: 120, dep: 10 },
  manhood: { name: 'Urutan Lelaki (Manhood)',   min: 30,  rm: 65,  dep: 10 },
  scrub:   { name: 'Lulur Badan Penuh',         min: 45,  rm: 85,  dep: 10 },
  bekam:   { name: 'Bekam (14 Cawan)',          min: 60,  rm: 65,  dep: 10 },
  first:   { name: 'Pakej Pertama Kali',        min: 75,  rm: 100, dep: 20 },
  combo3:  { name: 'Pakej Istimewa 3-dalam-1',  min: 120, rm: 165, dep: 20 }
};

var STATUS = {
  PENDING: 'Menunggu deposit',
  RECEIPT: 'Resit diterima',
  CONFIRMED: 'Disahkan',
  DONE: 'Selesai',
  CANCELLED: 'Batal'
};

var COLS = ['ID', 'Dibuat', 'Status', 'Servis', 'Minit', 'Harga (RM)', 'Deposit (RM)', 'Tarikh', 'Masa',
  'Jenis', 'Kawasan / alamat', 'Nama', 'Telefon', 'Pertama kali', 'Nota', 'Resit', 'Resit diterima',
  'Event ID', 'Dikemaskini', 'Sumber'];
var C = {}; COLS.forEach(function (n, i) { C[n] = i + 1; });

// ===================== ONE-TIME SETUP =====================
function setup() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold')
    .setBackground('#2A1D14').setFontColor('#F5EBDD');
  sh.setFrozenRows(1);
  sh.getRange('H:I').setNumberFormat('@'); // Tarikh & Masa as plain text (yyyy-mm-dd, HH:mm)
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList([STATUS.PENDING, STATUS.RECEIPT, STATUS.CONFIRMED, STATUS.DONE, STATUS.CANCELLED], true)
    .build();
  sh.getRange(2, C['Status'], 1000, 1).setDataValidation(rule);
  sh.setColumnWidths(1, COLS.length, 130);
  sh.setColumnWidth(C['Nota'], 220);

  ss.setSpreadsheetTimeZone(CONFIG.TZ);
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  getFolder_();

  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('syncFromCalendar').timeBased().everyMinutes(10).create();

  Logger.log('Setup complete. Sheet: ' + ss.getUrl());
}

// ===================== WEB ENDPOINTS =====================
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'slots') return json_(getSlots_(p.date, Number(p.min) || 60, p.exclude || ''));
    if (p.action === 'lookup') return json_(lookup_(p.id, p.phone));
    return json_({ ok: true, service: CONFIG.BUSINESS });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return json_({ ok: false, error: 'bad_json' }); }
  try {
    if (body.website) return json_({ ok: false, error: 'spam' }); // honeypot field
    if (body.action === 'book') return json_(book_(body));
    if (body.action === 'receipt') return json_(receipt_(body));
    if (body.action === 'reschedule') return json_(reschedule_(body));
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

// ===================== ACTIONS =====================
function getSlots_(date, min, excludeId) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('bad_date');
  var taken = takenSlots_(date, min, excludeId);
  return { ok: true, date: date, taken: taken.taken, full: taken.full };
}

function book_(b) {
  var svc = SERVICES[b.service];
  if (!svc) throw new Error('bad_service');
  var name = clean_(b.name, 60), phone = normPhone_(b.phone);
  if (name.length < 2) throw new Error('bad_name');
  if (!phone) throw new Error('bad_phone');
  checkSlot_(b.date, b.time);
  if (b.mode !== 'in' && b.mode !== 'out') throw new Error('bad_mode');
  var area = b.mode === 'out' ? clean_(b.area, 200) : '';
  if (b.mode === 'out' && area.length < 3) throw new Error('bad_area');
  rateLimit_(phone);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var t = takenSlots_(b.date, svc.min, '');
    if (t.full || t.taken.indexOf(b.time) >= 0) return { ok: false, error: 'slot_taken' };

    var sh = sheet_(), id = newId_(sh), now = new Date();
    var row = {
      'ID': id, 'Dibuat': now, 'Status': STATUS.PENDING, 'Servis': svc.name, 'Minit': svc.min,
      'Harga (RM)': svc.rm, 'Deposit (RM)': svc.dep, 'Tarikh': b.date, 'Masa': b.time,
      'Jenis': b.mode === 'in' ? 'In-Call' : 'Out-Call', 'Kawasan / alamat': area, 'Nama': name,
      'Telefon': phone, 'Pertama kali': b.first === true ? 'Ya' : (b.first === false ? 'Tidak' : ''),
      'Nota': clean_(b.note, 500), 'Resit': '', 'Resit diterima': '', 'Event ID': '',
      'Dikemaskini': now, 'Sumber': 'Web app (' + (b.lang === 'en' ? 'EN' : 'BM') + ')'
    };
    sh.appendRow(COLS.map(function (k) { return row[k]; }));
    var r = sh.getLastRow();
    var ev = upsertEvent_(rowObj_(sh, r));
    sh.getRange(r, C['Event ID']).setValue(ev.getId());

    notify_('Tempahan baharu', rowObj_(sh, r), 'Tempahan baharu diterima dari web app. Pelanggan diminta bayar deposit dan muat naik resit.');
    return { ok: true, id: id, deposit: svc.dep, status: STATUS.PENDING };
  } finally {
    lock.releaseLock();
  }
}

function receipt_(b) {
  var found = findBooking_(b.id, b.phone);
  if (!found) return { ok: false, error: 'not_found' };
  var mime = String(b.mime || '');
  if (!/^image\/(jpeg|png|webp|heic|heif)$|^application\/pdf$/.test(mime)) throw new Error('bad_file');
  var bytes = Utilities.base64Decode(String(b.data || ''));
  if (bytes.length > CONFIG.MAX_RECEIPT_MB * 1024 * 1024) throw new Error('file_too_big');
  var ext = mime === 'application/pdf' ? 'pdf' : (mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1]);
  var o = found.obj;
  var blob = Utilities.newBlob(bytes, mime, o['ID'] + ' - ' + o['Nama'] + ' - resit.' + ext);
  var file = getFolder_().createFile(blob);

  var sh = found.sheet, r = found.row, now = new Date();
  sh.getRange(r, C['Resit']).setValue(file.getUrl());
  sh.getRange(r, C['Resit diterima']).setValue(now);
  if (o['Status'] === STATUS.PENDING) sh.getRange(r, C['Status']).setValue(STATUS.RECEIPT);
  sh.getRange(r, C['Dikemaskini']).setValue(now);
  var obj = rowObj_(sh, r);
  upsertEvent_(obj);
  notify_('Resit deposit diterima', obj, 'Pelanggan telah memuat naik resit deposit. Sila semak dan tukar Status kepada "Disahkan" dalam Sheet.', [blob]);
  return { ok: true, status: obj['Status'] };
}

function reschedule_(b) {
  var found = findBooking_(b.id, b.phone);
  if (!found) return { ok: false, error: 'not_found' };
  var o = found.obj;
  if (o['Status'] === STATUS.CANCELLED || o['Status'] === STATUS.DONE) return { ok: false, error: 'closed' };
  checkSlot_(b.date, b.time);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var t = takenSlots_(b.date, Number(o['Minit']) || 60, o['ID']);
    if (t.full || t.taken.indexOf(b.time) >= 0) return { ok: false, error: 'slot_taken' };
    var oldWhen = fmtWhen_(o['Tarikh'], o['Masa']);
    var sh = found.sheet, r = found.row;
    sh.getRange(r, C['Tarikh']).setValue(b.date);
    sh.getRange(r, C['Masa']).setValue(b.time);
    sh.getRange(r, C['Dikemaskini']).setValue(new Date());
    var obj = rowObj_(sh, r);
    upsertEvent_(obj);
    notify_('Tarikh tempahan ditukar', obj, 'Pelanggan menukar tarikh/masa melalui web app. Asal: ' + oldWhen + '.');
    return { ok: true, date: b.date, time: b.time, status: obj['Status'] };
  } finally {
    lock.releaseLock();
  }
}

function lookup_(id, phone) {
  var f = findBooking_(id, phone);
  if (!f) return { ok: false, error: 'not_found' };
  var o = f.obj;
  var svcId = Object.keys(SERVICES).filter(function (k) { return SERVICES[k].name === o['Servis']; })[0] || '';
  return {
    ok: true, id: o['ID'], status: o['Status'], service: svcId, serviceName: o['Servis'], min: Number(o['Minit']),
    price: Number(o['Harga (RM)']), deposit: Number(o['Deposit (RM)']), date: toDateStr_(o['Tarikh']),
    time: toTimeStr_(o['Masa']), mode: o['Jenis'] === 'Out-Call' ? 'out' : 'in', name: o['Nama'],
    receipt: !!o['Resit']
  };
}

// ===================== TRIGGERS (sync) =====================
// Installable onEdit: Sam edits the Sheet -> Calendar follows
function onSheetEdit(e) {
  try {
    var sh = e.range.getSheet();
    if (sh.getName() !== CONFIG.SHEET_NAME || e.range.getRow() < 2) return;
    var c1 = e.range.getColumn(), c2 = c1 + e.range.getNumColumns() - 1;
    var watched = [C['Status'], C['Tarikh'], C['Masa'], C['Servis'], C['Minit'], C['Nama'], C['Nota'], C['Jenis'], C['Kawasan / alamat']];
    if (!watched.some(function (c) { return c >= c1 && c <= c2; })) return;
    for (var r = e.range.getRow(); r < e.range.getRow() + e.range.getNumRows(); r++) {
      var o = rowObj_(sh, r);
      if (!o['ID']) continue;
      var ev = upsertEvent_(o);
      if (ev && ev.getId() !== o['Event ID']) sh.getRange(r, C['Event ID']).setValue(ev.getId());
      sh.getRange(r, C['Dikemaskini']).setValue(new Date());
    }
  } catch (err) {
    Logger.log('onSheetEdit: ' + err);
  }
}

// Every 10 min: event moved in Google Calendar -> Sheet follows; optional unpaid auto-cancel
function syncFromCalendar() {
  var sh = sheet_(), last = sh.getLastRow();
  if (last < 2) return;
  var data = sh.getRange(2, 1, last - 1, COLS.length).getValues();
  var cal = calendar_(), now = new Date();
  data.forEach(function (v, i) {
    var r = i + 2, status = v[C['Status'] - 1], evId = v[C['Event ID'] - 1];
    if (!evId || status === STATUS.CANCELLED || status === STATUS.DONE) return;

    if (CONFIG.HOLD_HOURS > 0 && status === STATUS.PENDING) {
      var created = v[C['Dibuat'] - 1];
      if (created instanceof Date && now - created > CONFIG.HOLD_HOURS * 3600000) {
        sh.getRange(r, C['Status']).setValue(STATUS.CANCELLED);
        var o0 = rowObj_(sh, r); upsertEvent_(o0);
        notify_('Tempahan dibatalkan (tiada deposit)', o0, 'Dibatalkan automatik selepas ' + CONFIG.HOLD_HOURS + ' jam tanpa resit deposit.');
        return;
      }
    }

    var ev = null;
    try { ev = cal.getEventById(evId); } catch (x) { ev = null; }
    if (!ev) return;
    var start = ev.getStartTime();
    var d = Utilities.formatDate(start, CONFIG.TZ, 'yyyy-MM-dd');
    var t = Utilities.formatDate(start, CONFIG.TZ, 'HH:mm');
    if (d !== toDateStr_(v[C['Tarikh'] - 1]) || t !== toTimeStr_(v[C['Masa'] - 1])) {
      sh.getRange(r, C['Tarikh']).setValue(d);
      sh.getRange(r, C['Masa']).setValue(t);
      sh.getRange(r, C['Dikemaskini']).setValue(now);
    }
  });
}

// ===================== CALENDAR =====================
function upsertEvent_(o) {
  var cal = calendar_();
  var ev = null;
  if (o['Event ID']) { try { ev = cal.getEventById(o['Event ID']); } catch (x) { ev = null; } }

  if (o['Status'] === STATUS.CANCELLED) {
    if (ev) ev.deleteEvent();
    return null;
  }
  var start = toDate_(o['Tarikh'], o['Masa']);
  if (!start) return ev;
  var end = new Date(start.getTime() + (Number(o['Minit']) || 60) * 60000);
  var title = statusTag_(o['Status']) + ' · ' + o['Servis'] + ' · ' + o['Nama'];
  var desc = eventDesc_(o);
  var loc = o['Jenis'] === 'Out-Call' ? ('Out-Call: ' + o['Kawasan / alamat']) : 'In-Call · Chendering, Kuala Terengganu';

  if (!ev) {
    ev = cal.createEvent(title, start, end, { description: desc, location: loc });
    ev.addPopupReminder(60);
  } else {
    ev.setTitle(title);
    ev.setTime(start, end);
    ev.setDescription(desc);
    ev.setLocation(loc);
  }
  var color = { 'Menunggu deposit': CalendarApp.EventColor.YELLOW, 'Resit diterima': CalendarApp.EventColor.ORANGE,
    'Disahkan': CalendarApp.EventColor.GREEN, 'Selesai': CalendarApp.EventColor.GRAY }[o['Status']];
  if (color) ev.setColor(color);
  return ev;
}

function statusTag_(s) {
  return ({ 'Menunggu deposit': 'MENUNGGU DEPOSIT', 'Resit diterima': 'SEMAK RESIT', 'Disahkan': 'DISAHKAN', 'Selesai': 'SELESAI' })[s] || String(s || '').toUpperCase();
}

function eventDesc_(o) {
  return [
    'ID: ' + o['ID'],
    'Status: ' + o['Status'],
    'Servis: ' + o['Servis'] + ' (' + o['Minit'] + ' min)',
    'Harga: RM' + o['Harga (RM)'] + ' · Deposit: RM' + o['Deposit (RM)'],
    'Pelanggan: ' + o['Nama'],
    'Telefon: +' + o['Telefon'],
    'WhatsApp: https://wa.me/' + o['Telefon'],
    'Jenis: ' + o['Jenis'] + (o['Kawasan / alamat'] ? ' · ' + o['Kawasan / alamat'] : ''),
    'Pertama kali: ' + (o['Pertama kali'] || '-'),
    'Nota: ' + (o['Nota'] || '-'),
    'Resit: ' + (o['Resit'] || 'belum'),
    '',
    'Tukar Tarikh/Masa/Status dalam Google Sheet "Tempahan", atau seret acara ini — kedua-duanya akan diselaraskan.'
  ].join('\n');
}

// Which slots are taken on a date, for a service lasting `min` minutes
function takenSlots_(date, min, excludeId) {
  var cal = calendar_();
  var dayStart = toDate_(date, '00:00'), dayEnd = new Date(dayStart.getTime() + 86400000);
  var excludeEv = '';
  var sh = sheet_(), last = sh.getLastRow(), count = 0;
  if (last >= 2) {
    sh.getRange(2, 1, last - 1, COLS.length).getValues().forEach(function (v) {
      if (excludeId && v[0] === excludeId) { excludeEv = v[C['Event ID'] - 1]; return; }
      if (toDateStr_(v[C['Tarikh'] - 1]) === date && v[C['Status'] - 1] !== STATUS.CANCELLED) count++;
    });
  }
  var events = cal.getEvents(dayStart, dayEnd).filter(function (ev) {
    return !ev.isAllDayEvent() && ev.getId() !== excludeEv;
  });
  var now = new Date();
  var taken = CONFIG.SLOTS.filter(function (s) {
    var a = toDate_(date, s), b = new Date(a.getTime() + min * 60000);
    if (a.getTime() < now.getTime() + CONFIG.MIN_LEAD_MINUTES * 60000) return true;
    return events.some(function (ev) { return ev.getStartTime() < b && ev.getEndTime() > a; });
  });
  return { taken: taken, full: count >= CONFIG.MAX_PER_DAY };
}

// ===================== EMAIL =====================
function notify_(subject, o, intro, attachments) {
  var waText = 'Assalamualaikum ' + o['Nama'] + ', ini Sam dari Spa SAM. Tempahan anda ' + o['ID'] + ' (' + o['Servis'] +
    ', ' + fmtWhen_(o['Tarikh'], o['Masa']) + ') telah DISAHKAN. Jumpa nanti!';
  var rows = [
    ['ID', o['ID']], ['Status', o['Status']], ['Servis', o['Servis'] + ' (' + o['Minit'] + ' min)'],
    ['Tarikh & masa', fmtWhen_(o['Tarikh'], o['Masa'])], ['Jenis', o['Jenis'] + (o['Kawasan / alamat'] ? ' — ' + o['Kawasan / alamat'] : '')],
    ['Nama', o['Nama']], ['Telefon', '+' + o['Telefon']], ['Pertama kali', o['Pertama kali'] || '-'],
    ['Harga / deposit', 'RM' + o['Harga (RM)'] + ' / RM' + o['Deposit (RM)']], ['Nota', o['Nota'] || '-'],
    ['Resit', o['Resit'] ? '<a href="' + o['Resit'] + '">Buka resit</a>' : 'Belum']
  ];
  var html = '<div style="font-family:Arial,sans-serif;max-width:560px;color:#241A14">' +
    '<h2 style="font-family:Georgia,serif;font-weight:normal;margin:0 0 6px">' + esc_(subject) + '</h2>' +
    '<p style="color:#5E5046;margin:0 0 16px">' + esc_(intro) + '</p>' +
    '<table style="border-collapse:collapse;width:100%;font-size:14px">' +
    rows.map(function (r) {
      return '<tr><td style="padding:7px 10px;border-bottom:1px solid #E9DCCB;color:#5E5046;width:38%">' + r[0] +
        '</td><td style="padding:7px 10px;border-bottom:1px solid #E9DCCB">' + (r[0] === 'Resit' ? r[1] : esc_(String(r[1]))) + '</td></tr>';
    }).join('') + '</table>' +
    '<p style="margin:20px 0 8px"><a href="https://wa.me/' + o['Telefon'] + '?text=' + encodeURIComponent(waText) +
    '" style="background:#1E7E45;color:#fff;padding:11px 18px;border-radius:999px;text-decoration:none;display:inline-block">WhatsApp pelanggan (sahkan)</a> ' +
    '<a href="' + getSpreadsheet_().getUrl() + '" style="background:#86663F;color:#fff;padding:11px 18px;border-radius:999px;text-decoration:none;display:inline-block">Buka Google Sheet</a></p>' +
    '<p style="font-size:12px;color:#8a7a6b">Tukar Status kepada "Disahkan" dalam Sheet selepas semak resit. Kalendar akan dikemas kini secara automatik.</p></div>';
  var opts = { htmlBody: html, name: 'Spa SAM Booking' };
  if (attachments && attachments.length) opts.attachments = attachments;
  MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, '[SAM] ' + subject + ' — ' + o['ID'] + ' · ' + o['Nama'] + ' · ' + fmtWhen_(o['Tarikh'], o['Masa']),
    subject + '\n\n' + intro + '\n\n' + rows.map(function (r) { return r[0] + ': ' + String(r[1]).replace(/<[^>]+>/g, ''); }).join('\n'), opts);
}

// ===================== HELPERS =====================
function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var active = SpreadsheetApp.getActiveSpreadsheet(); // script created from the Sheet (Extensions > Apps Script)
  if (active) return active;
  var ss = SpreadsheetApp.create('SAM Tempahan');
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  return ss;
}
function sheet_() { return getSpreadsheet_().getSheetByName(CONFIG.SHEET_NAME); }
function calendar_() { return CONFIG.CALENDAR_ID ? CalendarApp.getCalendarById(CONFIG.CALENDAR_ID) : CalendarApp.getDefaultCalendar(); }
function getFolder_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (x) {} }
  var it = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER);
  var f = it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.DRIVE_FOLDER);
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}
function rowObj_(sh, r) {
  var v = sh.getRange(r, 1, 1, COLS.length).getValues()[0], o = {};
  COLS.forEach(function (k, i) { o[k] = v[i]; });
  return o;
}
function findBooking_(id, phone) {
  id = String(id || '').trim().toUpperCase(); phone = normPhone_(phone);
  if (!id || !phone) return null;
  var sh = sheet_(), last = sh.getLastRow();
  if (last < 2) return null;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).toUpperCase() === id) {
      var o = rowObj_(sh, i + 2);
      if (normPhone_(o['Telefon']) !== phone) return null;
      return { sheet: sh, row: i + 2, obj: o };
    }
  }
  return null;
}
function newId_(sh) {
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', last = sh.getLastRow();
  var existing = last >= 2 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (v) { return v[0]; }) : [];
  for (var n = 0; n < 50; n++) {
    var s = 'SAM-';
    for (var i = 0; i < 5; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    if (existing.indexOf(s) < 0) return s;
  }
  throw new Error('id_failed');
}
function checkSlot_(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('bad_date');
  if (CONFIG.SLOTS.indexOf(time) < 0) throw new Error('bad_time');
  var start = toDate_(date, time), now = new Date();
  if (start.getTime() < now.getTime() + CONFIG.MIN_LEAD_MINUTES * 60000) throw new Error('too_soon');
  if (start.getTime() > now.getTime() + (CONFIG.DAYS_AHEAD + 1) * 86400000) throw new Error('too_far');
}
function rateLimit_(phone) {
  var cache = CacheService.getScriptCache(), key = 'rl_' + phone, n = Number(cache.get(key) || 0);
  if (n >= 3) throw new Error('too_many');
  cache.put(key, String(n + 1), 3600);
}
function normPhone_(p) {
  var d = String(p || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.indexOf('60') === 0) { /* already international */ }
  else if (d.charAt(0) === '0') d = '6' + d;
  else if (d.charAt(0) === '1') d = '60' + d;
  return d.length >= 10 && d.length <= 13 ? d : '';
}
function clean_(s, max) { return String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
function esc_(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function toDateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.TZ, 'yyyy-MM-dd');
  var s = String(v || '').trim(), m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return m[1] + '-' + pad_(m[2]) + '-' + pad_(m[3]);
  if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/))) return m[3] + '-' + pad_(m[2]) + '-' + pad_(m[1]); // dd/mm/yyyy
  return s;
}
function toTimeStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.TZ, 'HH:mm');
  var s = String(v || '').trim().toLowerCase(), m = s.match(/^(\d{1,2})[:.](\d{2})\s*(am|pm|pg|ptg|mlm)?$/);
  if (!m) return s;
  var h = Number(m[1]);
  if ((m[3] === 'pm' || m[3] === 'ptg' || m[3] === 'mlm') && h < 12) h += 12;
  if ((m[3] === 'am' || m[3] === 'pg') && h === 12) h = 0;
  return pad_(h) + ':' + m[2];
}
function toDate_(d, t) {
  var ds = toDateStr_(d), ts = toTimeStr_(t);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds) || !/^\d{2}:\d{2}$/.test(ts)) return null;
  return new Date(ds + 'T' + ts + ':00+08:00');
}
function fmtWhen_(d, t) {
  var dt = toDate_(d, t);
  if (!dt) return toDateStr_(d) + ' ' + toTimeStr_(t);
  var days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
  var dow = Number(Utilities.formatDate(dt, CONFIG.TZ, 'u')) % 7;
  return days[dow] + ', ' + Utilities.formatDate(dt, CONFIG.TZ, 'd/M/yyyy h:mm a');
}
function pad_(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
