/*
 * extras.js — billing & sharing features for Khatana Dairy Manager.
 *
 *  - WhatsApp bill sent to the customer's own number
 *  - Invoice PDF generated on a canvas (Devanagari-safe) via jsPDF
 *  - PDF download and PDF share (WhatsApp / Drive / any app)
 *  - SMS bill
 *
 * In the Android APK these go through window.AndroidBridge so the native
 * share sheet, Downloads folder and SMS app are used. In a browser they
 * fall back to wa.me links, the Web Share API and a normal download.
 */
(function () {
  'use strict';

  function S() { return (window.DairyApp && window.DairyApp.state) || { customers: [], sales: [], payments: [] }; }
  function fmt(n) { return '₹' + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2); }
  function esc(s) { return String(s == null ? '' : s); }

  function monthName(month) {
    var lang = S().currentLang === 'en' ? 'en-US' : 'hi-IN';
    try { return new Date(month + '-02').toLocaleString(lang, { month: 'long', year: 'numeric' }); }
    catch (e) { return month; }
  }

  function customerOf(id) { return (S().customers || []).filter(function (c) { return c.id === id; })[0]; }

  function billData(customerId, month) {
    var st = S();
    var sales = (st.sales || []).filter(function (s) { return s.customerId === customerId && String(s.date).indexOf(month) === 0; });
    var pays = (st.payments || []).filter(function (p) { return p.customerId === customerId && String(p.date).indexOf(month) === 0; });
    var totalMilk = sales.reduce(function (a, s) { return a + Number(s.quantity || 0); }, 0);
    var totalSale = sales.reduce(function (a, s) { return a + Number(s.quantity || 0) * Number(s.rate || 0); }, 0);
    var totalPaid = pays.reduce(function (a, p) { return a + Number(p.amount || 0); }, 0);
    var allSales = (st.sales || []).filter(function (s) { return s.customerId === customerId && String(s.date) < month + '-01'; });
    var allPays = (st.payments || []).filter(function (p) { return p.customerId === customerId && String(p.date) < month + '-01'; });
    var opening = allSales.reduce(function (a, s) { return a + Number(s.quantity || 0) * Number(s.rate || 0); }, 0) -
                  allPays.reduce(function (a, p) { return a + Number(p.amount || 0); }, 0);
    var totalDue = opening + totalSale - totalPaid;
    var tx = sales.map(function (s) { return { date: s.date, kind: 'बिक्री' + (s.shift ? ' (' + String(s.shift).substring(0, 1) + ')' : ''), qty: Number(s.quantity || 0), rate: Number(s.rate || 0), amount: Number(s.quantity || 0) * Number(s.rate || 0) }; })
      .concat(pays.map(function (p) { return { date: p.date, kind: 'भुगतान', qty: null, rate: null, amount: Number(p.amount || 0) }; }))
      .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    return { sales: sales, pays: pays, totalMilk: totalMilk, totalSale: totalSale, totalPaid: totalPaid, opening: opening, totalDue: totalDue, tx: tx };
  }

  function billText(customerId, month) {
    var c = customerOf(customerId) || {};
    var d = billData(customerId, month);
    return '*डेयरी दूध प्रबंधक — मासिक बिल*\n' +
      'महीना: ' + monthName(month) + '\n' +
      'ग्राहक: ' + esc(c.name) + '\n\n' +
      'कुल दूध: ' + d.totalMilk.toFixed(2) + ' लीटर\n' +
      'कुल बिक्री: ' + fmt(d.totalSale) + '\n' +
      'कुल भुगतान: ' + fmt(d.totalPaid) + '\n' +
      'पिछला बकाया: ' + fmt(d.opening) + '\n' +
      '*कुल बकाया: ' + fmt(d.totalDue) + '*\n\n' +
      'धन्यवाद! 🙏';
  }

  function phoneDigits(p) {
    var d = String(p || '').replace(/[^0-9]/g, '');
    if (d.length === 10) return '91' + d;
    if (d.length === 11 && d.charAt(0) === '0') return '91' + d.substring(1);
    return d;
  }

  function openExternal(url) {
    if (window.AndroidBridge && window.AndroidBridge.openUrl) { try { window.AndroidBridge.openUrl(url); return; } catch (e) {} }
    window.open(url, '_blank');
  }

  /* ---------- actions ---------- */
  function whatsappBill(customerId, month) {
    var c = customerOf(customerId) || {};
    var text = encodeURIComponent(billText(customerId, month));
    var num = phoneDigits(c.phone);
    openExternal(num ? 'https://wa.me/' + num + '?text=' + text : 'https://wa.me/?text=' + text);
  }

  function smsBill(customerId, month) {
    var c = customerOf(customerId) || {};
    var body = billText(customerId, month).replace(/\*/g, '');
    var num = phoneDigits(c.phone);
    if (window.AndroidBridge && window.AndroidBridge.sendSms) { try { window.AndroidBridge.sendSms(num, body); return; } catch (e) {} }
    window.open('sms:' + num + '?body=' + encodeURIComponent(body), '_blank');
  }

  /* ---------- invoice canvas (Devanagari-safe) ---------- */
  function drawBill(customerId, month) {
    var c = customerOf(customerId) || {};
    var d = billData(customerId, month);
    var W = 1240, M = 70, RH = 48, HH = 56;
    var rows = d.tx.length;
    var H = 330 + HH + rows * RH + 430;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var x = cv.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#4CAF50'; x.fillRect(0, 0, W, 16);

    x.fillStyle = '#212121'; x.textAlign = 'center';
    x.font = 'bold 48px sans-serif'; x.fillText('डेयरी दूध प्रबंधक', W / 2, 96);
    x.fillStyle = '#616161'; x.font = '28px sans-serif'; x.fillText('मासिक बिल / Monthly Invoice', W / 2, 140);

    x.textAlign = 'left'; x.fillStyle = '#212121'; x.font = 'bold 30px sans-serif';
    x.fillText('ग्राहक: ' + esc(c.name), M, 210);
    x.font = '26px sans-serif'; x.fillStyle = '#424242';
    x.fillText('फ़ोन: ' + (esc(c.phone) || '-'), M, 250);
    x.fillText('महीना: ' + monthName(month), M, 290);
    x.fillText('दिनांक: ' + new Date().toLocaleDateString('hi-IN'), 700, 250);

    var y = 330;
    x.fillStyle = '#4CAF50'; x.fillRect(M, y, W - 2 * M, HH);
    x.fillStyle = '#ffffff'; x.font = 'bold 24px sans-serif';
    var cols = [M + 20, 340, 640, 810, W - M - 20];
    var heads = ['दिनांक', 'विवरण', 'मात्रा', 'दर', 'राशि'];
    x.textAlign = 'left'; x.fillText(heads[0], cols[0], y + 37); x.fillText(heads[1], cols[1], y + 37);
    x.fillText(heads[2], cols[2], y + 37); x.fillText(heads[3], cols[3], y + 37);
    x.textAlign = 'right'; x.fillText(heads[4], cols[4], y + 37);
    y += HH;

    x.font = '24px sans-serif';
    d.tx.forEach(function (t, i) {
      if (i % 2 === 1) { x.fillStyle = '#f5f5f5'; x.fillRect(M, y, W - 2 * M, RH); }
      x.fillStyle = '#212121'; x.textAlign = 'left';
      x.fillText(esc(t.date), cols[0], y + 32);
      x.fillText(esc(t.kind), cols[1], y + 32);
      x.fillText(t.qty == null ? '-' : t.qty.toFixed(2), cols[2], y + 32);
      x.fillText(t.rate == null ? '-' : fmt(t.rate), cols[3], y + 32);
      x.textAlign = 'right';
      x.fillStyle = t.qty == null ? '#2e7d32' : '#c62828';
      x.fillText(fmt(t.amount), cols[4], y + 32);
      y += RH;
    });
    x.strokeStyle = '#e0e0e0'; x.beginPath(); x.moveTo(M, y); x.lineTo(W - M, y); x.stroke();
    y += 40;

    var lines = [
      ['कुल दूध', d.totalMilk.toFixed(2) + ' लीटर', '#212121'],
      ['कुल बिक्री', fmt(d.totalSale), '#212121'],
      ['कुल भुगतान', fmt(d.totalPaid), '#2e7d32'],
      ['पिछला बकाया', fmt(d.opening), '#212121']
    ];
    x.textAlign = 'left';
    lines.forEach(function (l) {
      x.fillStyle = '#616161'; x.font = '26px sans-serif'; x.fillText(l[0], M, y);
      x.fillStyle = l[2]; x.font = 'bold 26px sans-serif'; x.textAlign = 'right'; x.fillText(l[1], W - M, y);
      x.textAlign = 'left'; y += 42;
    });
    y += 10;
    x.fillStyle = '#e8f5e9'; x.fillRect(M, y - 34, W - 2 * M, 70);
    x.fillStyle = '#1b5e20'; x.font = 'bold 34px sans-serif'; x.fillText('कुल बकाया', M + 20, y + 12);
    x.textAlign = 'right'; x.fillText(fmt(d.totalDue), W - M - 20, y + 12);
    y += 110;
    x.textAlign = 'center'; x.fillStyle = '#9e9e9e'; x.font = '22px sans-serif';
    x.fillText('यह बिल डेयरी दूध प्रबंधक ऐप से बनाया गया है', W / 2, y);
    return cv;
  }

  function canvasToPdf(cv, name) {
    var jsPDFctor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    var pdf = new jsPDFctor('p', 'mm', 'a4');
    var pw = pdf.internal.pageSize.getWidth();
    var ph = pdf.internal.pageSize.getHeight();
    var margin = 8;
    var iw = pw - 2 * margin;
    var pxPerMm = cv.width / iw;
    var pageHpx = (ph - 2 * margin) * pxPerMm;
    var srcY = 0, first = true;
    while (srcY < cv.height) {
      var sh = Math.min(pageHpx, cv.height - srcY);
      var c2 = document.createElement('canvas');
      c2.width = cv.width; c2.height = sh;
      c2.getContext('2d').drawImage(cv, 0, srcY, cv.width, sh, 0, 0, cv.width, sh);
      if (!first) pdf.addPage();
      pdf.addImage(c2.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, iw, sh / pxPerMm);
      first = false; srcY += sh;
    }
    pdf.setProperties({ title: name });
    return pdf;
  }

  function pdfName(customerId, month) {
    var c = customerOf(customerId) || {};
    return ('bill_' + String(c.name || 'customer').replace(/[^\w\u0900-\u097F]+/g, '_') + '_' + month + '.pdf');
  }

  function downloadPdf(customerId, month) {
    try {
      var pdf = canvasToPdf(drawBill(customerId, month), 'बिल');
      var name = pdfName(customerId, month);
      if (window.AndroidBridge && window.AndroidBridge.saveFile) {
        window.AndroidBridge.saveFile(name, pdf.output('datauristring').split(',')[1], 'application/pdf');
        return;
      }
      var blob = pdf.output('blob');
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = name; a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    } catch (e) { alert('PDF बनाने में त्रुटि: ' + e.message); }
  }

  function sharePdf(customerId, month) {
    var c = customerOf(customerId) || {};
    try {
      var pdf = canvasToPdf(drawBill(customerId, month), 'बिल');
      var name = pdfName(customerId, month);
      var b64 = pdf.output('datauristring').split(',')[1];
      if (window.AndroidBridge && window.AndroidBridge.shareFile) {
        window.AndroidBridge.shareFile(name, b64, 'application/pdf', billText(customerId, month));
        return;
      }
      var blob = pdf.output('blob');
      var file = new File([blob], name, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'बिल — ' + esc(c.name), text: billText(customerId, month) }).catch(function () {});
      } else { downloadPdf(customerId, month); }
    } catch (e) { alert('PDF शेयर करने में त्रुटि: ' + e.message); }
  }

  /* ---------- profile page buttons ---------- */
  function currentId() { var c = S().currentCustomer; return c && c.id; }
  function thisMonth() { return new Date().toISOString().substring(0, 7); }

  function injectProfileButtons() {
    var page = document.getElementById('profile-page');
    if (!page) return;
    if (page.querySelector('[data-bill]')) return;
    var card = page.querySelector('.enhanced-card');
    if (!card || !currentId()) return;
    var r1 = document.createElement('div'); r1.className = 'btn-group mt-1';
    r1.innerHTML = '<button class="btn btn-secondary" data-bill="download">📄 PDF डाउनलोड</button>' +
                   '<button class="btn btn-secondary" data-bill="share">📤 PDF शेयर</button>';
    var r2 = document.createElement('div'); r2.className = 'btn-group mt-1';
    r2.innerHTML = '<button class="btn btn-whatsapp" data-bill="wa">💬 WhatsApp बिल</button>' +
                   '<button class="btn btn-secondary" data-bill="sms">✉️ SMS भेजें</button>';
    card.appendChild(r1); card.appendChild(r2);
    card.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-bill]') : null;
      if (!b) return;
      var id = currentId(), m = thisMonth();
      var act = b.getAttribute('data-bill');
      if (act === 'download') downloadPdf(id, m);
      else if (act === 'share') sharePdf(id, m);
      else if (act === 'wa') whatsappBill(id, m);
      else if (act === 'sms') smsBill(id, m);
    });
  }

  function init() {
    var page = document.getElementById('profile-page');
    if (page && window.MutationObserver) {
      new MutationObserver(function () { setTimeout(injectProfileButtons, 0); })
        .observe(page, { childList: true });
    }
    injectProfileButtons();

    // Enhance the app's existing buttons so they use the customer's number
    // and produce a real PDF.
    window.shareOnWhatsApp = function (id, month) { whatsappBill(id, month || thisMonth()); };
    window.generateInvoicePDF = function (id, month) { downloadPdf(id, month || thisMonth()); };
    window.DairyBills = {
      whatsappBill: whatsappBill, smsBill: smsBill,
      downloadPdf: downloadPdf, sharePdf: sharePdf, billText: billText
    };
  }

  document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
})();
