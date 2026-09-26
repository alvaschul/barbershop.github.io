/**
 * Badboy Barber — Google Apps Script web app
 *
 * Deploy: Extensions > Apps Script -> paste this file -> Deploy > New deployment
 *  - Execute as: Me
 *  - Who can access: Anyone
 * Copy the /exec URL into the app (Pengaturan > Sync > Google Sheets > URL web app).
 *
 * The app posts JSON with Content-Type text/plain (simple request, no CORS
 * preflight). Payloads carry `source: 'badboy-barber-pages'` and a `type` of:
 *   - 'txn'    one row added to sheet Transaksi per sale
 *   - 'report' one row added to sheet "Laporan Harian" for the daily recap
 *   - 'test'   no row, just confirms reachability
 */

var SOURCE = 'badboy-barber-pages';

function ensureSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function appendTxn(row, branch) {
  var sheet = ensureSheet('Transaksi');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Waktu', 'Tanggal', 'ID', 'Metode', 'Total', 'Tunai', 'QRIS', 'Kembalian', 'Cabang', 'Items']);
  }
  sheet.appendRow([
    row.createdAt,
    row.date,
    row.id,
    row.method,
    row.total,
    row.cash,
    row.qris,
    row.change,
    branch || '',
    row.lines.map(function (l) {
      return l.name + ' x' + l.qty;
    }).join(', ')
  ]);
}

function appendReport(r) {
  var sheet = ensureSheet('Laporan Harian');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Tgl', 'Cabang', 'Kapster', 'Transaksi', 'Pendapatan', 'Tunai', 'QRIS', 'Terjual', 'Produk', 'Uang Awal', 'Free', 'Cek']);
  }
  sheet.appendRow([
    r.date,
    r.cabang,
    (r.barbers || []).join(', '),
    r.summary.totalTransactions,
    r.summary.totalRevenue,
    r.summary.totalCash,
    r.summary.totalQris,
    r.summary.totalSales,
    r.summary.totalProducts,
    r.awal,
    r.free,
    r.text
  ]);
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    if (body.source !== SOURCE) throw new Error('unknown source');
    if (body.type === 'txn') {
      appendTxn(body.txn, body.meta && body.meta.branch);
    } else if (body.type === 'report') {
      appendReport(body);
    } else if (body.type !== 'test') {
      throw new Error('unknown type');
    }
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}